const express  = require('express');
const router   = express.Router();
const { db }   = require('../db');
const auth     = require('../middleware/auth');
const { calcRisk, generateEmail, bodyToHtml } = require('../utils/pofu-engine');
const { sendEmail } = require('../utils/mailer');

router.use(auth);

function parsePOFU(row) {
  return row;
}

// GET /pofu — list all POFU candidates for this user
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM pofu_candidates
    WHERE user_id = ?
    ORDER BY
      CASE risk_level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      doj ASC
  `).all(req.user.id);
  res.json({ candidates: rows });
});

// GET /pofu/stats — dashboard summary
router.get('/stats', (req, res) => {
  const all     = db.prepare('SELECT * FROM pofu_candidates WHERE user_id = ?').all(req.user.id);
  const now     = new Date();
  const joiningThisWeek = all.filter(c => {
    if (!c.doj) return false;
    const d = new Date(c.doj);
    const days = Math.ceil((d - now) / 86400000);
    return days >= 0 && days <= 7;
  });
  res.json({
    total:    all.length,
    atRisk:   all.filter(c => c.risk_level === 'high').length,
    medium:   all.filter(c => c.risk_level === 'medium').length,
    joiningThisWeek: joiningThisWeek.length,
    joined:   all.filter(c => c.state === 'joined').length,
    dropped:  all.filter(c => c.state === 'dropped').length,
  });
});

// POST /pofu — enroll a candidate
router.post('/', (req, res) => {
  const {
    candidate_name, candidate_email, role_title, company_name,
    doj, session_id, candidate_id, job_id,
  } = req.body;

  if (!candidate_name?.trim()) return res.status(400).json({ error: 'candidate_name is required.' });
  if (!candidate_email?.trim()) return res.status(400).json({ error: 'candidate_email is required.' });

  const { score, level } = calcRisk({ state: 'offer_accepted', doj, last_email_at: null, last_response_at: null, auto_paused: 0 });

  const result = db.prepare(`
    INSERT INTO pofu_candidates
      (user_id, session_id, candidate_id, job_id, candidate_name, candidate_email,
       role_title, company_name, doj, risk_score, risk_level)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id,
    session_id || null, candidate_id || null, job_id || null,
    candidate_name.trim(), candidate_email.trim(),
    role_title || null, company_name || null,
    doj || null, score, level,
  );

  const row = db.prepare('SELECT * FROM pofu_candidates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ candidate: row });
});

// GET /pofu/:id — single candidate with email history
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM pofu_candidates WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });

  const emails = db.prepare(
    'SELECT * FROM pofu_emails WHERE pofu_candidate_id = ? ORDER BY sent_at DESC'
  ).all(row.id);

  res.json({ candidate: row, emails });
});

// PUT /pofu/:id — update state / notes / doj / pause
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pofu_candidates WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });

  const allowed = ['state', 'doj', 'notes', 'auto_paused', 'last_response_at', 'candidate_email'];
  const sets = [], values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { sets.push(`${key} = ?`); values.push(req.body[key]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });

  sets.push(`updated_at = datetime('now')`);

  // Recalculate risk after state/doj change
  const merged = { ...existing, ...req.body };
  const { score, level } = calcRisk(merged);
  sets.push('risk_score = ?', 'risk_level = ?');
  values.push(score, level);

  values.push(req.params.id);
  db.prepare(`UPDATE pofu_candidates SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM pofu_candidates WHERE id = ?').get(req.params.id);
  res.json({ candidate: updated });
});

// DELETE /pofu/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM pofu_candidates WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  db.prepare('DELETE FROM pofu_candidates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /pofu/:id/send-email — manual or ad-hoc email send
router.post('/:id/send-email', async (req, res) => {
  const candidate = db.prepare('SELECT * FROM pofu_candidates WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!candidate) return res.status(404).json({ error: 'Not found.' });

  const { trigger_reason, subject: manualSubject, body: manualBody } = req.body;

  try {
    let subject, body, aiGenerated = true;

    if (manualSubject && manualBody) {
      subject = manualSubject;
      body = manualBody;
      aiGenerated = false;
    } else {
      const reason = trigger_reason || 'risk_amber_checkin';
      const generated = await generateEmail(candidate, reason);
      subject = generated.subject;
      body = generated.body;
    }

    const html = bodyToHtml(body);
    await sendEmail({ to: candidate.candidate_email, subject, html, text: body });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO pofu_emails (pofu_candidate_id, direction, trigger_reason, subject, body, ai_generated, sent_at)
      VALUES (?, 'outbound', ?, ?, ?, ?, ?)
    `).run(candidate.id, trigger_reason || 'manual', subject, body, aiGenerated ? 1 : 0, now);

    db.prepare('UPDATE pofu_candidates SET last_email_at=?, updated_at=datetime("now") WHERE id=?')
      .run(now, candidate.id);

    res.json({ ok: true, subject, body });
  } catch (err) {
    console.error('[POFU] send-email error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /pofu/:id/log-reply — recruiter logs an inbound reply
router.post('/:id/log-reply', (req, res) => {
  const candidate = db.prepare('SELECT id FROM pofu_candidates WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!candidate) return res.status(404).json({ error: 'Not found.' });

  const { body, sentiment } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO pofu_emails (pofu_candidate_id, direction, trigger_reason, body, ai_generated, ai_analysis, sent_at)
    VALUES (?, 'inbound', 'reply', ?, 0, ?, ?)
  `).run(candidate.id, body || '', sentiment || null, now);

  db.prepare('UPDATE pofu_candidates SET last_response_at=?, updated_at=datetime("now") WHERE id=?')
    .run(now, candidate.id);

  res.json({ ok: true });
});

// POST /pofu/:id/preview-email — preview what AI would generate
router.post('/:id/preview-email', async (req, res) => {
  const candidate = db.prepare('SELECT * FROM pofu_candidates WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!candidate) return res.status(404).json({ error: 'Not found.' });

  const { trigger_reason = 'risk_amber_checkin' } = req.body;
  try {
    const { subject, body } = await generateEmail(candidate, trigger_reason);
    res.json({ subject, body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
