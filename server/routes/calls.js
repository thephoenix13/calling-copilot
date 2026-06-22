const express = require('express');
const router = express.Router();
const { db } = require('../db');
const authMiddleware = require('../middleware/auth');
const { requireCapability } = require('../middleware/permissions');
const { visibleUserIds } = require('../utils/scoping');
const { recordCorpus } = require('../utils/corpus');

// POST /calls/start — create a call record linked to the authenticated user
router.post('/start', authMiddleware, requireCapability('calls.start'), (req, res) => {
  const { callSid, to = '', candidateName, roleTitle } = req.body;

  if (!callSid) {
    return res.status(400).json({ error: 'callSid is required.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM calls WHERE call_sid = ?').get(callSid);
    if (existing) {
      return res.json({ callId: existing.id });
    }

    const isSim = callSid.startsWith('SIM-');
    const result = db.prepare(
      'INSERT INTO calls (call_sid, user_id, candidate_phone, candidate_name, role_title, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(callSid, req.user.id, to, candidateName || null, roleTitle || null, isSim ? 'sim' : 'active');

    res.json({ callId: result.lastInsertRowid });
  } catch (err) {
    console.error('calls/start error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /calls/:callSid/reports — save QA + candidate reports
router.post('/:callSid/reports', authMiddleware, requireCapability('calls.start'), (req, res) => {
  const { callSid } = req.params;
  const { qaReport, candidateReport, jd, resume } = req.body;

  const call = db.prepare('SELECT id FROM calls WHERE call_sid = ?').get(callSid);
  if (!call) {
    return res.status(404).json({ error: 'Call not found.' });
  }

  try {
    const upsert = db.prepare(
      `INSERT INTO reports (call_id, report_type, payload)
       VALUES (?, ?, ?)
       ON CONFLICT(call_id, report_type)
       DO UPDATE SET payload = excluded.payload, generated_at = datetime('now')`
    );

    if (qaReport)        upsert.run(call.id, 'qa',        JSON.stringify(qaReport));
    if (candidateReport) upsert.run(call.id, 'candidate', JSON.stringify(candidateReport));

    if (jd || resume) {
      db.prepare(
        `INSERT INTO call_context (call_id, jd_text, resume_text)
         VALUES (?, ?, ?)
         ON CONFLICT(call_id)
         DO UPDATE SET jd_text = excluded.jd_text, resume_text = excluded.resume_text`
      ).run(call.id, jd || null, resume || null);
    }

    // IDF Feature 5 — feed the anonymised answer corpus from the candidate scorecard (best-effort)
    try {
      if (candidateReport && Array.isArray(candidateReport.technical)) {
        const companyId = db.prepare('SELECT company_id FROM users WHERE id=?').get(req.user.id)?.company_id ?? null;
        const role = (candidateReport.meta && candidateReport.meta.role) || req.body.role || '';
        const items = candidateReport.technical.map(t => ({ skill: t.area, score: t.pct }));
        recordCorpus(companyId, role, items);
      }
    } catch (e) { console.error('[calls] corpus ingest:', e.message); }

    // IDF Feature 3 — persist recruiter conduct metrics + bias flags (best-effort, idempotent)
    try {
      if (qaReport && qaReport.bias) {
        const b = qaReport.bias;
        const m = b.metrics || {};
        db.prepare('DELETE FROM recruiter_call_metrics WHERE call_id=?').run(call.id);
        db.prepare('DELETE FROM bias_flags WHERE call_id=?').run(call.id);
        db.prepare(
          `INSERT INTO recruiter_call_metrics
             (call_id, user_id, job_id, question_count, recruiter_chars, candidate_chars, talk_ratio_pct, bias_score)
           VALUES (?,?,?,?,?,?,?,?)`
        ).run(call.id, req.user.id, null, m.questionCount ?? null, m.recruiterChars ?? null,
              m.candidateChars ?? null, m.talkRatioPct ?? null, b.score ?? null);
        if (Array.isArray(b.flags) && b.flags.length) {
          const insFlag = db.prepare(
            'INSERT INTO bias_flags (call_id, user_id, type, severity, evidence, in_call) VALUES (?,?,?,?,?,0)'
          );
          const txF = db.transaction(fs => {
            for (const f of fs) insFlag.run(call.id, req.user.id, f.type || null, f.severity || null, f.evidence || null);
          });
          txF(b.flags);
        }
      }
    } catch (e) { console.error('[calls] bias persist:', e.message); }

    res.json({ ok: true });
  } catch (err) {
    console.error('calls/reports error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /calls/:callSid/reports — fetch saved reports for a call
router.get('/:callSid/reports', authMiddleware, requireCapability('calls.read'), (req, res) => {
  const { callSid } = req.params;

  const call = db.prepare('SELECT id FROM calls WHERE call_sid = ?').get(callSid);
  if (!call) {
    return res.status(404).json({ error: 'Call not found.' });
  }

  const rows = db.prepare('SELECT report_type, payload FROM reports WHERE call_id = ?').all(call.id);
  const result = {};
  for (const row of rows) {
    result[row.report_type === 'qa' ? 'qaReport' : 'candidateReport'] = JSON.parse(row.payload);
  }

  res.json(result);
});

// GET /calls — list calls. Owners and Team Leads see every recruiter's calls
// in the company; everyone else sees only their own.
router.get('/', authMiddleware, requireCapability('calls.read'), (req, res) => {
  const ids = visibleUserIds(req);
  if (ids.length === 0) return res.json({ calls: [] });
  const placeholders = ids.map(() => '?').join(',');
  const calls = db.prepare(
    `SELECT id, call_sid, candidate_phone, candidate_name, role_title, status,
            started_at, ended_at, duration_sec, recording_filename, user_id
     FROM calls
     WHERE user_id IN (${placeholders})
     ORDER BY started_at DESC
     LIMIT 50`
  ).all(...ids);

  res.json({ calls });
});

module.exports = router;
