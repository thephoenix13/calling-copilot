/**
 * server/routes/market-intelligence.js
 *
 * 4-stage Market Intelligence pipeline per Zeople-MI-Algorithm-Spec §1–§14.
 *
 *   POST   /mi/parse-jd                       Stage 0: extract JobContext from raw JD text
 *   POST   /mi/reports                        Stage 1: insert pending row, fire Stages 2-4 in background
 *   GET    /mi/reports                        list (scoped via visibleUserIds)
 *   GET    /mi/reports/:id                    poll status + report_data
 *   PUT    /mi/reports/:id                    save edits (Phase 8)
 *   DELETE /mi/reports/:id                    remove (owner / team_lead / creator)
 *   POST   /mi/reports/:id/enrich-reputation  Stage 5: Glassdoor refresh
 *   POST   /mi/reports/:id/retry              re-run from Stage 2 with cached job_context
 *
 * Models per spec §12.2:
 *   Stage 0 — claude-haiku-4-5
 *   Stage 2 — claude-opus-4-7  (web_search + web_fetch + adaptive thinking)
 *   Stage 3 — claude-sonnet-4-6 (output_config.format json_schema)
 *   Stage 4 — claude-haiku-4-5
 *   Stage 5 — claude-sonnet-4-6 (web_search, narrower scope)
 */

'use strict';

const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const pdfParse  = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { db }    = require('../db');
const auth      = require('../middleware/auth');
const { requireCapability, requireRead } = require('../middleware/permissions');
const { visibleUserIds } = require('../utils/scoping');
const { logActivity }    = require('../utils/activity');
const {
  ALLOWED_VALUES,
  PARSE_JD_SYSTEM_PROMPT, PARSE_JD_TOOL,
  RESEARCH_SYSTEM_PROMPT, buildResearchUserPrompt,
  STRUCTURE_SYSTEM_PROMPT, STRUCTURED_DATA_SCHEMA, buildStructureUserPrompt,
  EXEC_SUMMARY_SYSTEM_PROMPT, buildExecSummaryUserPrompt,
  REPUTATION_SYSTEM_PROMPT, buildReputationUserPrompt,
  applyBusinessRules, extractCitations, injectSources,
} = require('../utils/mi-prompts');

const router = express.Router();
const client = new Anthropic();

const MODELS = {
  PARSE_JD:    'claude-haiku-4-5',
  RESEARCH:    'claude-opus-4-7',
  STRUCTURE:   'claude-sonnet-4-6',
  EXEC_SUMMARY:'claude-haiku-4-5',
  REPUTATION:  'claude-sonnet-4-6',
};

router.use(auth);

// ── Multer for /mi/upload-jd (PDF / DOCX / TXT in memory) ────────────────
const uploadJD = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['.pdf', '.docx', '.txt'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only PDF, DOCX, or TXT files are allowed.'), ok);
  },
});

async function extractTextFromUpload(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }
  return file.buffer.toString('utf-8');
}

/** Run the same Stage-0 extraction as /mi/parse-jd, given raw JD text. */
async function runStage0Parse(rawText) {
  const r = await client.messages.create({
    model: MODELS.PARSE_JD,
    max_tokens: 1024,
    system: [{ type: 'text', text: PARSE_JD_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [PARSE_JD_TOOL],
    tool_choice: { type: 'tool', name: 'extract_job_fields' },
    messages: [{ role: 'user', content: rawText.slice(0, 8000) }],
  });
  const tool = r.content.find(b => b.type === 'tool_use');
  if (!tool) throw new Error('Parser did not return a structured field set.');
  return sanitizeJobContext({ ...tool.input, detailedJobDescription: rawText });
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseJSON(s) { try { return JSON.parse(s); } catch { return null; } }

/** Validate a partial JobContext object — drop anything outside the enum allowlists. */
function sanitizeJobContext(raw) {
  const out = { ...(raw || {}) };
  if (out.location        && !ALLOWED_VALUES.locations.includes(out.location))               delete out.location;
  if (out.industry        && !ALLOWED_VALUES.industries.includes(out.industry))               delete out.industry;
  if (out.employmentType  && !ALLOWED_VALUES.employmentTypes.includes(out.employmentType))    delete out.employmentType;
  if (out.experienceLevel && !ALLOWED_VALUES.experienceLevels.includes(out.experienceLevel))  delete out.experienceLevel;
  if (out.noticePeriod    && !ALLOWED_VALUES.noticePeriods.includes(out.noticePeriod))        delete out.noticePeriod;
  if (out.mustHaveSkills && !Array.isArray(out.mustHaveSkills)) delete out.mustHaveSkills;
  if (out.mustHaveSkills) out.mustHaveSkills = out.mustHaveSkills.map(String).filter(Boolean);
  return out;
}

/** Required-fields check before kicking off Stages 2-4. */
function validateForGeneration(jc) {
  const missing = [];
  for (const f of ['title', 'location', 'industry', 'employmentType', 'experienceLevel']) {
    if (!jc[f] || (typeof jc[f] === 'string' && !jc[f].trim())) missing.push(f);
  }
  if (!Array.isArray(jc.mustHaveSkills) || jc.mustHaveSkills.length === 0) missing.push('mustHaveSkills');
  return missing;
}

function loadReport(id, allowedUserIds) {
  if (!allowedUserIds.length) return null;
  const ph = allowedUserIds.map(() => '?').join(',');
  return db.prepare(
    `SELECT * FROM mi_reports WHERE id = ? AND user_id IN (${ph})`
  ).get(id, ...allowedUserIds);
}

function rowToApi(row) {
  if (!row) return null;
  return {
    id:              row.id,
    user_id:         row.user_id,
    company_id:      row.company_id,
    job_id:          row.job_id,
    status:          row.status,
    job_context:     parseJSON(row.job_context),
    report_data:     row.report_data ? parseJSON(row.report_data) : null,
    failure_reason:  row.failure_reason,
    created_at:      row.created_at,
    updated_at:      row.updated_at,
  };
}

function setStatus(reportId, status, extra = {}) {
  const sets = ['status = ?', "updated_at = datetime('now')"];
  const vals = [status];
  if (Object.prototype.hasOwnProperty.call(extra, 'failure_reason')) {
    sets.push('failure_reason = ?'); vals.push(extra.failure_reason || null);
  }
  if (Object.prototype.hasOwnProperty.call(extra, 'research_doc')) {
    sets.push('research_doc = ?'); vals.push(extra.research_doc || null);
  }
  if (Object.prototype.hasOwnProperty.call(extra, 'report_data')) {
    sets.push('report_data = ?'); vals.push(extra.report_data || null);
  }
  vals.push(reportId);
  db.prepare(`UPDATE mi_reports SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

// ── Stage 0 — JD parser ──────────────────────────────────────────────────

router.post('/parse-jd', requireCapability('mi.write'), async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return res.status(400).json({ error: 'Job description text is too short (min 20 chars).' });
  }
  try {
    const fields = await runStage0Parse(text);
    res.json({ fields });
  } catch (err) {
    console.error('[mi/parse-jd]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Stage 0 (file upload) — extract text from PDF/DOCX/TXT then parse ─────

router.post('/upload-jd', requireCapability('mi.write'), uploadJD.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const text = await extractTextFromUpload(req.file);
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Could not extract enough text from the file.' });
    }
    const fields = await runStage0Parse(text);
    res.json({ fields, rawText: text });
  } catch (err) {
    console.error('[mi/upload-jd]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── Stage 2 — Research (called from background runner) ───────────────────

async function runStage2_research(jobContext) {
  // Opus 4.7 uses thinking.type='adaptive' paired with output_config.effort
  // (per spec §12.6) — the older `enabled` + `budget_tokens` form is rejected.
  const r = await client.messages.create({
    model:         MODELS.RESEARCH,
    max_tokens:    16000,
    thinking:      { type: 'adaptive' },
    output_config: { effort: 'high' },
    tools: [
      { type: 'web_search_20260209', name: 'web_search' },
      { type: 'web_fetch_20260209',  name: 'web_fetch' },
    ],
    system: [
      { type: 'text', text: RESEARCH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: buildResearchUserPrompt(jobContext) }],
  });

  // Concatenate text blocks into a single content string for the structurer's
  // user prompt. Keep the raw blocks too so we can extract citation URLs.
  const textContent = r.content
    .filter(b => b.type === 'text')
    .map(b => b.text || '')
    .join('\n\n');
  const sources = extractCitations(r.content);

  return { content: textContent, sources, rawBlocks: r.content };
}

// ── Stage 3 — Structurer ─────────────────────────────────────────────────

async function runStage3_structure(jobContext, researchDoc) {
  const r = await client.messages.create({
    model:      MODELS.STRUCTURE,
    max_tokens: 8000,
    output_config: { format: { type: 'json_schema', schema: STRUCTURED_DATA_SCHEMA } },
    system: [
      { type: 'text', text: STRUCTURE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{
      role: 'user',
      content: buildStructureUserPrompt(jobContext, researchDoc.content),
    }],
  });

  const text = r.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Structurer returned no text block.');
  const parsed = JSON.parse(text);   // schema-guaranteed by Anthropic; no repair pass
  return applyBusinessRules(parsed);
}

// ── Stage 4 — Executive summary ──────────────────────────────────────────

async function runStage4_execSummary(jobContext, structuredData) {
  const r = await client.messages.create({
    model:      MODELS.EXEC_SUMMARY,
    max_tokens: 600,
    system:     EXEC_SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildExecSummaryUserPrompt(jobContext, structuredData) }],
  });
  return (r.content.find(b => b.type === 'text')?.text || '').trim();
}

// ── Background runner — Stage 2 → Stage 3 → Stage 4 ──────────────────────
// If `cachedResearch` is supplied, Stage 2 is skipped and we go straight to
// Stage 3 — used by the retry path to avoid a re-run of expensive web search.

async function runPipeline(reportId, jobContext, cachedResearch = null) {
  try {
    let researchDoc = cachedResearch;
    if (!researchDoc) {
      setStatus(reportId, 'researching');
      researchDoc = await runStage2_research(jobContext);
      setStatus(reportId, 'structuring', {
        research_doc: JSON.stringify({
          content:   researchDoc.content,
          sources:   researchDoc.sources,
          timestamp: new Date().toISOString(),
        }),
      });
    } else {
      setStatus(reportId, 'structuring');
      console.log(`[mi] Report ${reportId} reusing cached research (${researchDoc.sources?.length || 0} sources)`);
    }

    const structuredRaw = await runStage3_structure(jobContext, researchDoc);
    const structured    = injectSources(structuredRaw, researchDoc.sources);

    setStatus(reportId, 'generating');
    const execSummary = await runStage4_execSummary(jobContext, structured);

    const reportData = {
      jobContext,
      structuredData: structured,
      executiveSummary: execSummary,
      generatedAt: new Date().toISOString(),
    };

    setStatus(reportId, 'completed', { report_data: JSON.stringify(reportData) });
    console.log(`[mi] Report ${reportId} completed`);
  } catch (err) {
    console.error(`[mi] Report ${reportId} failed:`, err.message);
    setStatus(reportId, 'failed', { failure_reason: err.message?.slice(0, 500) || 'Unknown error' });
  }
}

// ── Endpoint: create a report (kicks off pipeline) ───────────────────────

router.post('/reports', requireCapability('mi.write'), (req, res) => {
  const sanitized = sanitizeJobContext(req.body?.jobContext);
  const missing = validateForGeneration(sanitized);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  // Optional job_id link — must belong to the caller's company.
  let jobId = null;
  if (req.body?.jobId) {
    const j = db.prepare('SELECT id FROM jobs WHERE id = ? AND company_id = ?')
      .get(req.body.jobId, req.user.company_id);
    if (!j) return res.status(400).json({ error: 'Job not found in your company.' });
    jobId = j.id;
  }

  const result = db.prepare(`
    INSERT INTO mi_reports (user_id, company_id, job_id, status, job_context)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(req.user.id, req.user.company_id, jobId, JSON.stringify(sanitized));

  const reportId = result.lastInsertRowid;
  logActivity(req, 'mi.report.create', 'mi_report', reportId, { title: sanitized.title, location: sanitized.location });

  // Fire and forget — caller polls for status. setImmediate puts it on the
  // next tick so the HTTP response goes out first.
  setImmediate(() => runPipeline(reportId, sanitized));

  res.status(201).json({ id: reportId, status: 'pending' });
});

// ── Endpoint: list reports (scoped via visibleUserIds) ───────────────────

router.get('/reports', requireRead('mi.read.own'), (req, res) => {
  const ids = visibleUserIds(req);
  if (ids.length === 0) return res.json({ reports: [] });
  const ph = ids.map(() => '?').join(',');

  let q = `
    SELECT r.id, r.user_id, r.job_id, r.status, r.job_context,
           r.failure_reason, r.created_at, r.updated_at,
           u.display_name AS author_name,
           j.title        AS job_title
    FROM mi_reports r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN jobs j ON j.id = r.job_id
    WHERE r.user_id IN (${ph})
  `;
  const params = [...ids];
  if (req.query.job_id) {
    q += ' AND r.job_id = ?';
    params.push(Number(req.query.job_id));
  }
  q += ' ORDER BY r.created_at DESC LIMIT 100';

  const rows = db.prepare(q).all(...params).map(r => ({
    id: r.id,
    user_id: r.user_id,
    job_id: r.job_id,
    status: r.status,
    job_context: parseJSON(r.job_context),
    job_title: r.job_title,
    author_name: r.author_name,
    failure_reason: r.failure_reason,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  res.json({ reports: rows });
});

// ── Endpoint: poll a single report ───────────────────────────────────────

router.get('/reports/:id', requireRead('mi.read.own'), (req, res) => {
  const row = loadReport(req.params.id, visibleUserIds(req));
  if (!row) return res.status(404).json({ error: 'Report not found.' });
  res.json({ report: rowToApi(row) });
});

// ── Endpoint: save edits to a report (Phase 8) ───────────────────────────
// Per spec §13.8: edits are persisted as-is to report_data; no schema re-validation.

router.put('/reports/:id', requireCapability('mi.write'), (req, res) => {
  const row = loadReport(req.params.id, visibleUserIds(req));
  if (!row) return res.status(404).json({ error: 'Report not found.' });
  if (row.status !== 'completed') {
    return res.status(409).json({ error: 'Only completed reports can be edited.' });
  }
  const incoming = req.body?.report_data;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'report_data object is required.' });
  }
  db.prepare(
    "UPDATE mi_reports SET report_data = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(incoming), row.id);
  logActivity(req, 'mi.report.edit', 'mi_report', row.id);
  res.json({ ok: true });
});

// ── Endpoint: delete ─────────────────────────────────────────────────────

router.delete('/reports/:id', requireCapability('mi.write'), (req, res) => {
  const row = loadReport(req.params.id, visibleUserIds(req));
  if (!row) return res.status(404).json({ error: 'Report not found.' });
  // Recruiters can only delete their own; team_lead/owner can delete any in scope.
  const role = req.user.role;
  const senior = role === 'owner' || role === 'team_lead';
  if (!senior && row.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete reports you created.' });
  }
  db.prepare('DELETE FROM mi_reports WHERE id = ?').run(row.id);
  logActivity(req, 'mi.report.delete', 'mi_report', row.id);
  res.json({ ok: true });
});

// ── Endpoint: retry a failed report (re-run Stage 2 with cached context) ──

router.post('/reports/:id/retry', requireCapability('mi.write'), (req, res) => {
  const row = loadReport(req.params.id, visibleUserIds(req));
  if (!row) return res.status(404).json({ error: 'Report not found.' });
  if (row.status !== 'failed' && row.status !== 'completed') {
    return res.status(409).json({ error: `Cannot retry a ${row.status} report.` });
  }
  const jc = parseJSON(row.job_context);
  if (!jc) return res.status(500).json({ error: 'Stored job_context is corrupt.' });

  // If a cached research_doc is present, reuse it — saves ~$0.20 + 90s.
  const cachedResearch = row.research_doc ? parseJSON(row.research_doc) : null;
  setStatus(row.id, 'pending', { failure_reason: null, report_data: null });
  setImmediate(() => runPipeline(row.id, jc, cachedResearch));
  res.json({ id: row.id, status: 'pending', reusedResearch: !!cachedResearch });
});

// ── Stage 5 — Reputation enrichment ──────────────────────────────────────

router.post('/reports/:id/enrich-reputation', requireCapability('mi.write'), async (req, res) => {
  const row = loadReport(req.params.id, visibleUserIds(req));
  if (!row) return res.status(404).json({ error: 'Report not found.' });
  if (row.status !== 'completed') {
    return res.status(409).json({ error: 'Reputation can only be refreshed on completed reports.' });
  }

  const reportData = parseJSON(row.report_data);
  const companies = (reportData?.structuredData?.competitorAnalysis?.topHiringCompanies || [])
    .slice(0, 5)
    .map(c => c.name)
    .filter(Boolean);
  if (companies.length === 0) {
    return res.status(400).json({ error: 'No competitor companies in the report to enrich.' });
  }

  try {
    const r = await client.messages.create({
      model:      MODELS.REPUTATION,
      max_tokens: 4000,
      tools: [
        { type: 'web_search_20260209', name: 'web_search' },
        { type: 'web_fetch_20260209',  name: 'web_fetch' },
      ],
      system: [{ type: 'text', text: REPUTATION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildReputationUserPrompt(companies) }],
    });

    // Best-effort extraction — Stage 5 doesn't use json_schema so we parse loose text.
    const text = r.content.filter(b => b.type === 'text').map(b => b.text || '').join('\n');
    const updatedCompanies = parseReputationText(text, companies);
    const sources = extractCitations(r.content);

    reportData.structuredData.talentReputation = {
      ...reportData.structuredData.talentReputation,
      companies: updatedCompanies,
      ratingSource: 'Glassdoor India (refreshed)',
      sources,
      confidence: 'high',
    };
    db.prepare(
      "UPDATE mi_reports SET report_data = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(reportData), row.id);

    logActivity(req, 'mi.reputation.refresh', 'mi_report', row.id);
    res.json({ talentReputation: reportData.structuredData.talentReputation });
  } catch (err) {
    console.error('[mi/enrich-reputation]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Loose parse of Stage-5 markdown into the talentReputation.companies shape. */
function parseReputationText(text, requestedCompanies) {
  const out = [];
  for (const name of requestedCompanies) {
    // Find the segment of text mentioning this company.
    const idx = text.toLowerCase().indexOf(name.toLowerCase());
    let rating = null;
    let recommendationRate = null;
    if (idx >= 0) {
      const window = text.slice(idx, idx + 400);
      const ratingMatch = window.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*5/i);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      const recMatch = window.match(/(\d{1,3})\s*%\s*(?:would\s+)?recommend/i);
      if (recMatch) recommendationRate = `${recMatch[1]}% recommend`;
    }
    out.push({ name, rating: rating ?? null, recommendationRate: recommendationRate || null });
  }
  return out;
}

module.exports = router;
