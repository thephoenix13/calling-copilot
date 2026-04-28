const express = require('express');
const router = express.Router();
const { db } = require('../db');
const authMiddleware = require('../middleware/auth');

// POST /calls/start — create a call record linked to the authenticated user
router.post('/start', authMiddleware, (req, res) => {
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
router.post('/:callSid/reports', authMiddleware, (req, res) => {
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

    res.json({ ok: true });
  } catch (err) {
    console.error('calls/reports error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /calls/:callSid/reports — fetch saved reports for a call
router.get('/:callSid/reports', authMiddleware, (req, res) => {
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

// GET /calls — list calls for the authenticated user (most recent first)
router.get('/', authMiddleware, (req, res) => {
  const calls = db.prepare(
    `SELECT id, call_sid, candidate_phone, candidate_name, role_title, status,
            started_at, ended_at, duration_sec, recording_filename
     FROM calls
     WHERE user_id = ?
     ORDER BY started_at DESC
     LIMIT 50`
  ).all(req.user.id);

  res.json({ calls });
});

module.exports = router;
