const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const pdfParse  = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { db }    = require('../db');
const auth      = require('../middleware/auth');

const anthropic = new Anthropic();
const MODEL     = 'claude-sonnet-4-6';

router.use(auth);

// ── Core helpers ─────────────────────────────────────────────────────────────

async function callAI(system, user, maxTokens = 1500, temperature = 0.7) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return msg.content[0].text;
}

function parseJSON(text) {
  // 1. Direct parse
  try { return JSON.parse(text.trim()); } catch {}
  // 2. Strip leading/trailing fence markers (handles truncated responses where closing ``` never arrives)
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try { return JSON.parse(stripped.trim()); } catch {}
  // 3. Extract first {...} block
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
  // 4. Extract first [...] block
  const sa = text.indexOf('['), ea = text.lastIndexOf(']');
  if (sa !== -1 && ea !== -1 && ea > sa) { try { return JSON.parse(text.slice(sa, ea + 1)); } catch {} }
  return text;
}

function buildJobContext(job, clientNotes) {
  const lines = [
    `Title: ${job.title || 'Not specified'}`,
    `Department: ${job.department || 'Not specified'}`,
    `Location: ${job.location || 'Not specified'}`,
    `Employment Type: ${job.employment_type || 'Full-time'}`,
  ];
  if (job.client_name)    lines.push(`Client: ${job.client_name}`);
  if (job.openings_count) lines.push(`Openings: ${job.openings_count}`);

  const [eMin, eMax] = [job.experience_min, job.experience_max];
  if (eMin != null || eMax != null) lines.push(`Experience: ${eMin ?? '?'}–${eMax ?? '?'} years`);

  const [sMin, sMax] = [job.salary_min, job.salary_max];
  if (sMin != null || sMax != null) lines.push(`Salary: ₹${sMin ?? '?'}–${sMax ?? '?'} LPA`);

  if (job.required_skills?.length)  lines.push(`Required Skills: ${job.required_skills.join(', ')}`);
  if (job.preferred_skills?.length) lines.push(`Preferred Skills: ${job.preferred_skills.join(', ')}`);
  if (job.description)              lines.push(`\nDescription:\n${job.description}`);
  if (clientNotes)                  lines.push(`\nClient Notes:\n${clientNotes}`);

  return lines.join('\n');
}

const HIGHLIGHT_SYSTEM_SUFFIX = `

CRITICAL: The client has provided additional notes. You MUST:
1. Incorporate ALL client notes into your output.
2. Wrap every piece of content derived from client notes with [[NOTES_HIGHLIGHT]] and [[/NOTES_HIGHLIGHT]] markers.
Example: [[NOTES_HIGHLIGHT]]WordPress experience is required[[/NOTES_HIGHLIGHT]]
Every client-note-influenced phrase MUST be wrapped. Do not skip.`;

function highlightUserSuffix(clientNotes) {
  return `\n\nMANDATORY: Client provided these notes: "${clientNotes}". Wrap ALL content derived from these notes with [[NOTES_HIGHLIGHT]]...[[/NOTES_HIGHLIGHT]] markers. No exceptions.`;
}

function withManualInput(user, manualInput) {
  return manualInput
    ? `${user}\n\nAdditional Instructions (incorporate into output):\n${manualInput}`
    : user;
}

// ── Asset generators ─────────────────────────────────────────────────────────

async function genFormattedJD(job, clientNotes, manualInput) {
  const ctx = buildJobContext(job, clientNotes);
  const sys = `You are a job description rewriting specialist for Indian recruitment. Produce professional, engaging JDs in clean Markdown.${clientNotes ? HIGHLIGHT_SYSTEM_SUFFIX : ''}`;

  let user = `Rewrite the job details below as a polished job description using this structure:

1. **[Job Title] — [Location]** (header)
2. **About the Role** (~250 words, sell the opportunity)
3. **Key Responsibilities** (6–8 bullets)
4. **Must-Have Skills** (from required skills list)
5. **Nice-to-Have Skills** (from preferred skills list)
6. **What We Offer** (CTC, growth, team culture)
7. **Interview Process** (2–3 stage overview)

Rules:
- Expand all abbreviations
- Use Indian context: CTC in LPA, notice period in days
- Output clean Markdown only — no placeholders or meta-commentary

---
${ctx}`;

  if (clientNotes) user += highlightUserSuffix(clientNotes);
  return callAI(sys, withManualInput(user, manualInput), 1500, 0.7);
}

async function genRecruiterBrief(job, clientNotes, manualInput) {
  const ctx = buildJobContext(job, clientNotes);
  const sys = `You are a recruitment assistant helping non-technical recruiters understand technical roles. Be plain-English, scannable, under 250 words total.${clientNotes ? HIGHLIGHT_SYSTEM_SUFFIX : ''}`;

  let user = `Write a Recruiter Brief — a quick-reference card for a recruiter who may not have a technical background. Hard cap: 250 words. Use these 7 sections exactly:

1. **What This Person Will Do** (2–3 sentences)
2. **Must-Have Skills** (max 5 bullets — explain each in plain English)
3. **Nice-to-Have Skills** (max 4 bullets)
4. **Domain / Industry Background** (what experience context helps)
5. **Company / Client Type** (what kind of org this is)
6. **Contract Type & Notice** (permanent/contract, notice period norms)
7. **Experience Range** (years + seniority signal)

No jargon. Indian context (CTC in LPA, notice in days).

---
${ctx}`;

  if (clientNotes) user += highlightUserSuffix(clientNotes);
  return callAI(sys, withManualInput(user, manualInput), 800, 0.7);
}

async function genClarificationQuestions(job, clientNotes, manualInput) {
  const ctx = buildJobContext(job, clientNotes);
  const sys = `You are a recruitment clarification specialist for Indian staffing. Generate targeted questions for recruiters to ask clients before sourcing begins.${clientNotes ? HIGHLIGHT_SYSTEM_SUFFIX : ''}`;

  let user = `Generate clarification questions for this job opening. Return ONLY valid JSON (no markdown fences).

Schema:
{
  "domainAndIndustry":       [{ "question": "...", "rationale": "...", "response": "" }],
  "primarySkills":           [...],
  "secondarySkills":         [...],
  "projectsAndExperience":   [...],
  "processAndTimeline":      [...],
  "compensationAndBenefits": [...],
  "otherClarifications":     [...]
}

Question counts per category: domainAndIndustry (2–3), primarySkills (4–6), secondarySkills (2–3), projectsAndExperience (2–3), processAndTimeline (2–3), compensationAndBenefits (2–3), otherClarifications (2–3).
Each item: "question" (specific, actionable), "rationale" (1–2 sentences why it matters), "response" (always "").

---
${ctx}`;

  if (clientNotes) user += highlightUserSuffix(clientNotes);
  const raw = await callAI(sys, withManualInput(user, manualInput), 3000, 0.7);
  return parseJSON(raw);
}

async function genReachoutMaterial(job, clientNotes, companyScript, manualInput) {
  const ctx = buildJobContext(job, clientNotes);
  const sys = `You are a candidate reachout and briefing agent for Indian recruitment. Create authentic, compelling outreach messages that get responses.${clientNotes ? HIGHLIGHT_SYSTEM_SUFFIX : ''}`;

  const scriptNote = companyScript
    ? `MANDATORY: Use this company script verbatim as the company intro in all messages:\n"${companyScript}"`
    : 'Write a professional generic company introduction.';

  let user = `Generate candidate reachout material. Return ONLY valid JSON (no markdown fences).

${scriptNote}

Schema:
{
  "companyScript": "the company intro used",
  "whatsapp": "3–4 lines, conversational, 1–2 emojis, role + company + CTC range",
  "linkedin": "3–4 lines, professional tone, no emojis, role + opportunity hook",
  "pitch": "call script: company intro → opportunity → client context → role details → next steps",
  "questions": {
    "phoneScreening": [
      { "question": "...", "idealAnswer": "...", "explanation": "...", "validationCues": ["..."] }
    ],
    "sourcingFocus": ["sourcing tip 1", "sourcing tip 2"]
  }
}

phoneScreening: 7–8 questions. sourcingFocus: 4–6 actionable strings.

---
${ctx}`;

  if (clientNotes) user += highlightUserSuffix(clientNotes);
  const raw = await callAI(sys, withManualInput(user, manualInput), 6000, 0.8);
  return parseJSON(raw);
}

async function genSourcingKeywords(job, clientNotes, manualInput) {
  const ctx = buildJobContext(job, clientNotes);
  const sys = `You are a specialised Sourcing Keyword Agent for Indian recruitment. Generate precise keyword sets optimised for Naukri and LinkedIn search.${clientNotes ? HIGHLIGHT_SYSTEM_SUFFIX : ''}`;

  let user = `Generate sourcing keywords. Return ONLY valid JSON (no markdown fences).

Schema:
{
  "primaryKeywords":         ["10–15 primary search terms"],
  "secondaryKeywords":       ["10–15 secondary/related terms"],
  "booleanStrings":          ["5–8 full Boolean strings for Naukri/LinkedIn — include experience + location"],
  "skillOnlyBooleanStrings": ["EXACTLY 2 strings — skills/tech/frameworks ONLY, no location/experience"],
  "exclusions":              ["5–8 terms to exclude from search"]
}

---
${ctx}`;

  if (clientNotes) user += highlightUserSuffix(clientNotes);
  const raw = await callAI(sys, withManualInput(user, manualInput), 2000, 0.5);
  return parseJSON(raw);
}

async function runParseFields(description) {
  const sys = `You are a job description parser. Extract structured fields. Return ONLY valid JSON.`;
  const user = `Extract fields from this JD. Return JSON (null for missing values):
{
  "title": string, "department": string, "location": string, "employment_type": string,
  "experience_min": number, "experience_max": number,
  "salary_min": number, "salary_max": number,
  "client_name": string, "openings_count": number,
  "required_skills": string[], "preferred_skills": string[],
  "description": string
}

Salary in LPA (Indian context). Experience in years.

---
${description}`;
  const raw = await callAI(sys, user, 1500, 0.3);
  return parseJSON(raw);
}

async function genMarketIntelligence(job) {
  const ctx = buildJobContext(job, null);
  const sys = `You are a talent market analyst specialising in Indian recruitment. Provide realistic, data-driven market intelligence based on current hiring trends.`;

  const user = `Generate market intelligence for this job role in India (2025). Return ONLY valid JSON.

Schema:
{
  "salaryBenchmarks": {
    "junior": { "min": number, "max": number, "label": "0-3 years" },
    "mid":    { "min": number, "max": number, "label": "3-6 years" },
    "senior": { "min": number, "max": number, "label": "6+ years" }
  },
  "demandSignal": "high|medium|low",
  "demandRationale": "2-3 sentences on talent supply vs demand in India",
  "competitorHiring": ["5-7 companies actively hiring for similar profiles"],
  "hotSkills": [{ "skill": "...", "trend": "rising|stable|declining" }],
  "sourcingChannels": [
    { "channel": "Naukri|LinkedIn|GitHub|etc", "priority": "primary|secondary", "tip": "one actionable tip" }
  ],
  "candidateExpectations": ["4-6 key expectations candidates in this segment typically have"],
  "avgNoticePeriod": "e.g. 30-60 days",
  "availabilityScore": "high|medium|low",
  "availabilityNotes": "1-2 sentences on candidate availability and competition"
}

All salaries in LPA. Be realistic for the Indian market.

---
${ctx}`;

  const raw = await callAI(sys, user, 2000, 0.6);
  return parseJSON(raw);
}

// ── Routes ───────────────────────────────────────────────────────────────────

const STANDARD_FIELDS = ['formattedJD', 'recruiterBrief', 'clarificationQuestions', 'reachoutMaterial', 'sourcingKeywords'];
const ALL_FIELDS = [...STANDARD_FIELDS, 'marketIntelligence'];

const CATEGORY_LABELS = {
  domainAndIndustry:       'Domain & Industry',
  primarySkills:           'Primary Skills',
  secondarySkills:         'Secondary Skills',
  projectsAndExperience:   'Projects & Experience',
  processAndTimeline:      'Process & Timeline',
  compensationAndBenefits: 'Compensation & Benefits',
  otherClarifications:     'Other Clarifications',
};

// POST /regen-question — regenerate a single clarification question
router.post('/regen-question', async (req, res) => {
  const { job, category, questionIndex, question, rationale, instruction } = req.body;
  if (!job || !category || !question) return res.status(400).json({ error: 'job, category, and question are required.' });

  const categoryLabel = CATEGORY_LABELS[category] || category;
  const ctx = buildJobContext(job, null);

  const sys = `You are a recruitment clarification specialist for Indian staffing. Generate targeted, specific clarification questions that recruiters ask clients before sourcing begins.`;
  const user = `Regenerate the following clarification question for the category "${categoryLabel}".

Current question: "${question}"
Current rationale: "${rationale || 'N/A'}"
${instruction ? `\nImprovement instruction: ${instruction}` : '\nMake the question more specific, actionable, and relevant to the job context.'}

Return ONLY valid JSON (no markdown fences):
{ "question": "...", "rationale": "..." }

Job context:
---
${ctx}`;

  try {
    const raw = await callAI(sys, user, 500, 0.7);
    const parsed = parseJSON(raw);
    if (parsed && parsed.question) return res.json(parsed);
    res.status(500).json({ error: 'Could not parse regenerated question.' });
  } catch (err) {
    console.error('regen-question error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST / — generate assets (or parse_fields)
router.post('/', async (req, res) => {
  const { mode, description, job, clientNotes, companyScript, fields, manualInput } = req.body;

  if (mode === 'parse_fields') {
    if (!description) return res.status(400).json({ error: 'description is required.' });
    try {
      return res.json({ fields: await runParseFields(description) });
    } catch (err) {
      console.error('enhance-jd parse_fields error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (!job) return res.status(400).json({ error: 'job object is required.' });

  const toGenerate = fields?.length ? fields.filter(f => ALL_FIELDS.includes(f)) : STANDARD_FIELDS;

  const generators = {
    formattedJD:            () => genFormattedJD(job, clientNotes, manualInput),
    recruiterBrief:         () => genRecruiterBrief(job, clientNotes, manualInput),
    clarificationQuestions: () => genClarificationQuestions(job, clientNotes, manualInput),
    reachoutMaterial:       () => genReachoutMaterial(job, clientNotes, companyScript, manualInput),
    sourcingKeywords:       () => genSourcingKeywords(job, clientNotes, manualInput),
    marketIntelligence:     () => genMarketIntelligence(job),
  };

  const results = {};
  await Promise.all(
    toGenerate.map(async field => {
      try {
        results[field] = await generators[field]();
      } catch (err) {
        console.error(`enhance-jd [${field}] error:`, err.message);
        results[field] = null;
      }
    })
  );
  res.json(results);
});

// POST /extract-text — file → plain text
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/extract-text', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    let text = '';
    if (ext === '.pdf') {
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else {
      text = req.file.buffer.toString('utf-8');
    }
    if (!text?.trim()) return res.status(400).json({ error: 'Could not extract text from file.' });
    res.json({ text: text.slice(0, 12000) });
  } catch (err) {
    console.error('extract-text error:', err.message);
    res.status(500).json({ error: 'Text extraction failed.' });
  }
});

// GET /saved/:id — full item
router.get('/saved/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM jd_enhancements WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  res.json({ item: { ...row, results: JSON.parse(row.results || '{}') } });
});

// GET /saved — list
router.get('/saved', (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, jd_input, client_notes, created_at
    FROM jd_enhancements WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 30
  `).all(req.user.id);
  res.json({ saved: rows });
});

// POST /saved — upsert
router.post('/saved', (req, res) => {
  const { id, title, jdInput, clientNotes, results } = req.body;
  if (!results) return res.status(400).json({ error: 'results required.' });

  if (id) {
    const existing = db.prepare('SELECT id FROM jd_enhancements WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });
    db.prepare('UPDATE jd_enhancements SET title=?, jd_input=?, client_notes=?, results=? WHERE id=?')
      .run(title || 'Untitled', jdInput || '', clientNotes || null, JSON.stringify(results), id);
    return res.json({ id });
  }

  const row = db.prepare(`
    INSERT INTO jd_enhancements (user_id, title, jd_input, client_notes, results)
    VALUES (?,?,?,?,?)
  `).run(req.user.id, title || 'Untitled', jdInput || '', clientNotes || null, JSON.stringify(results));
  res.status(201).json({ id: row.lastInsertRowid });
});

// DELETE /saved/:id
router.delete('/saved/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM jd_enhancements WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  db.prepare('DELETE FROM jd_enhancements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
