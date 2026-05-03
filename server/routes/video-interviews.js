const express   = require('express');
const router    = express.Router();
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@deepgram/sdk');
const { db }    = require('../db');
const auth      = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

const anthropic      = new Anthropic();
const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);

const VI_DIR = path.join(__dirname, '..', '..', 'uploads', 'vi');
fs.mkdirSync(VI_DIR, { recursive: true });

// ── Multer setup ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const cid = req.body.candidateId;
    const dir = path.join(VI_DIR, String(cid));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const qid = req.body.questionId;
    cb(null, `${qid}_${Date.now()}.webm`);
  },
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseJSON(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) {}
  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) return JSON.parse(fence[1].trim());
  } catch (_) {}
  try {
    const brace = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (brace) return JSON.parse(brace[1]);
  } catch (_) {}
  return null;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function clientUrl() {
  return process.env.CLIENT_URL || 'http://localhost:5173';
}

async function transcribeFile(filePath) {
  const audioBuffer = fs.readFileSync(filePath);
  const { result, error } = await deepgramClient.listen.prerecorded.transcribeFile(
    audioBuffer,
    { model: 'nova-2', smart_format: true, language: 'en' },
  );
  if (error) throw error;
  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
}

function getInterviewWithDetails(interviewId, userId) {
  const iv = db.prepare(
    'SELECT * FROM video_interviews WHERE id = ? AND user_id = ?'
  ).get(interviewId, userId);
  if (!iv) return null;

  const questions = db.prepare(
    'SELECT * FROM video_interview_questions WHERE interview_id = ? ORDER BY order_number, id'
  ).all(interviewId);

  const candidates = db.prepare(
    'SELECT * FROM video_candidates WHERE interview_id = ? ORDER BY created_at DESC'
  ).all(interviewId);

  return { ...iv, questions, candidates };
}

// ── PUBLIC routes (no auth) ──────────────────────────────────────────────────

// POST /vi/public/verify — verify access code + identity
router.post('/public/verify', (req, res) => {
  const { code, name, email } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Access code required.' });

  const vc = db.prepare('SELECT * FROM video_candidates WHERE access_code = ?').get(code.trim().toUpperCase());
  if (!vc) return res.status(404).json({ error: 'Invalid or expired access code.' });

  if (vc.status === 'completed' || vc.status === 'evaluated') {
    return res.status(400).json({ error: 'You have already completed this interview.' });
  }

  // Verify identity against stored name/email
  const nameMatch  = name?.trim()?.toLowerCase()  === vc.name.toLowerCase();
  const emailMatch = email?.trim()?.toLowerCase() === vc.email.toLowerCase();
  if (!nameMatch && !emailMatch) {
    return res.status(401).json({ error: 'Name or email does not match. Please check and try again.' });
  }

  const iv = db.prepare('SELECT * FROM video_interviews WHERE id = ?').get(vc.interview_id);
  if (!iv) return res.status(404).json({ error: 'Interview not found.' });
  if (iv.status !== 'active') return res.status(400).json({ error: 'This interview is no longer active.' });

  const questions = db.prepare(
    'SELECT id, question_text, question_type, estimated_time_minutes, order_number FROM video_interview_questions WHERE interview_id = ? ORDER BY order_number, id'
  ).all(vc.interview_id);

  res.json({
    candidateId:  vc.id,
    interviewId:  vc.interview_id,
    interviewTitle: iv.title,
    candidateName: vc.name,
    questions,
  });
});

// POST /vi/public/start — mark as in_progress
router.post('/public/start', (req, res) => {
  const { candidateId } = req.body;
  if (!candidateId) return res.status(400).json({ error: 'candidateId required.' });
  db.prepare(
    `UPDATE video_candidates SET status='in_progress', interview_started_at=datetime('now') WHERE id=? AND status='invited'`
  ).run(candidateId);
  res.json({ ok: true });
});

// POST /vi/public/upload — upload video response (one at a time)
router.post('/public/upload', upload.single('video'), async (req, res) => {
  const { candidateId, interviewId, questionId } = req.body;
  if (!candidateId || !interviewId || !questionId) {
    return res.status(400).json({ error: 'candidateId, interviewId, questionId required.' });
  }

  const vc = db.prepare('SELECT * FROM video_candidates WHERE id = ?').get(candidateId);
  if (!vc) return res.status(404).json({ error: 'Candidate not found.' });

  const filename = req.file ? req.file.filename : null;
  const fileSize = req.file ? req.file.size : 0;

  // Check for existing response for this question (allow re-upload)
  const existing = db.prepare(
    'SELECT id FROM video_responses WHERE candidate_id=? AND question_id=?'
  ).get(candidateId, questionId);

  let responseId;
  if (existing) {
    db.prepare(
      `UPDATE video_responses SET video_filename=?, file_size=?, transcription=NULL, created_at=datetime('now') WHERE id=?`
    ).run(filename, fileSize, existing.id);
    responseId = existing.id;
  } else {
    const result = db.prepare(
      `INSERT INTO video_responses (candidate_id, interview_id, question_id, video_filename, file_size)
       VALUES (?, ?, ?, ?, ?)`
    ).run(candidateId, interviewId, questionId, filename, fileSize);
    responseId = result.lastInsertRowid;
  }

  // Transcribe asynchronously (don't block the upload response)
  if (req.file) {
    const filePath = req.file.path;
    transcribeFile(filePath)
      .then(transcription => {
        db.prepare('UPDATE video_responses SET transcription=? WHERE id=?').run(transcription, responseId);
        console.log(`[VI] Transcription saved for response ${responseId}`);
      })
      .catch(err => console.error(`[VI] Transcription failed for response ${responseId}:`, err.message));
  }

  res.json({ ok: true, responseId });
});

// POST /vi/public/complete — mark interview as completed
router.post('/public/complete', (req, res) => {
  const { candidateId } = req.body;
  if (!candidateId) return res.status(400).json({ error: 'candidateId required.' });
  db.prepare(
    `UPDATE video_candidates SET status='completed', interview_completed_at=datetime('now') WHERE id=?`
  ).run(candidateId);
  res.json({ ok: true });
});

// ── AUTH middleware for all routes below ─────────────────────────────────────
router.use(auth);

// ── Interview CRUD ───────────────────────────────────────────────────────────

// GET /vi/interviews
router.get('/interviews', (req, res) => {
  const rows = db.prepare(`
    SELECT vi.*,
      j.title AS job_title,
      (SELECT COUNT(*) FROM video_interview_questions WHERE interview_id = vi.id) AS question_count_actual,
      (SELECT COUNT(*) FROM video_candidates WHERE interview_id = vi.id) AS candidate_count,
      (SELECT COUNT(*) FROM video_candidates WHERE interview_id = vi.id AND status='completed') AS completed_count,
      (SELECT COUNT(*) FROM video_candidates WHERE interview_id = vi.id AND status='evaluated') AS evaluated_count
    FROM video_interviews vi
    LEFT JOIN jobs j ON j.id = vi.job_id
    WHERE vi.user_id = ?
    ORDER BY vi.created_at DESC
  `).all(req.user.id);
  res.json({ interviews: rows });
});

// POST /vi/interviews
router.post('/interviews', (req, res) => {
  const { title, job_id, job_description, question_count, expiry_date, status } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required.' });

  const result = db.prepare(`
    INSERT INTO video_interviews (user_id, job_id, title, job_description, question_count, expiry_date, status)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    req.user.id,
    job_id || null,
    title.trim(),
    job_description || '',
    question_count || 5,
    expiry_date || null,
    status || 'draft',
  );

  const iv = db.prepare('SELECT * FROM video_interviews WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json({ interview: iv });
});

// GET /vi/interviews/:id
router.get('/interviews/:id', (req, res) => {
  const iv = getInterviewWithDetails(req.params.id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Not found.' });
  res.json({ interview: iv });
});

// PUT /vi/interviews/:id
router.put('/interviews/:id', (req, res) => {
  const { title, job_id, job_description, question_count, expiry_date, status } = req.body;
  const existing = db.prepare('SELECT id FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });

  db.prepare(`
    UPDATE video_interviews
    SET title=?, job_id=?, job_description=?, question_count=?, expiry_date=?, status=?, updated_at=datetime('now')
    WHERE id=? AND user_id=?
  `).run(
    title || '', job_id || null, job_description || '',
    question_count || 5, expiry_date || null, status || 'active',
    req.params.id, req.user.id,
  );

  const iv = getInterviewWithDetails(req.params.id, req.user.id);
  res.json({ interview: iv });
});

// DELETE /vi/interviews/:id
router.delete('/interviews/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  db.prepare('DELETE FROM video_interviews WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Question management ──────────────────────────────────────────────────────

// POST /vi/interviews/:id/generate — AI-generate questions
router.post('/interviews/:id/generate', async (req, res) => {
  const iv = db.prepare('SELECT * FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Not found.' });

  const count = req.body.count || iv.question_count || 5;
  const jd    = req.body.job_description || iv.job_description || '';

  if (!jd.trim()) return res.status(400).json({ error: 'Job description is required to generate questions.' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Generate ${count} interview questions for a video interview based on this job description:\n\n${jd}\n\nMix: 40% technical, 40% behavioral, 20% situational. Each question should take 2-5 minutes to answer.\n\nReturn ONLY a JSON array:\n[\n  {\n    "question_text": "string",\n    "question_type": "technical" | "behavioral" | "situational",\n    "estimated_time_minutes": number\n  }\n]`,
      }],
    });

    const text = message.content[0].text;
    const questions = parseJSON(text);
    if (!Array.isArray(questions)) throw new Error('AI returned invalid format.');

    // Delete existing questions and insert new ones
    db.prepare('DELETE FROM video_interview_questions WHERE interview_id=?').run(iv.id);
    const insert = db.prepare(
      'INSERT INTO video_interview_questions (interview_id, question_text, question_type, estimated_time_minutes, order_number) VALUES (?,?,?,?,?)'
    );
    const insertAll = db.transaction((qs) => {
      qs.forEach((q, i) => insert.run(iv.id, q.question_text, q.question_type || 'behavioral', q.estimated_time_minutes || 3, i));
    });
    insertAll(questions);

    if (jd !== iv.job_description) {
      db.prepare("UPDATE video_interviews SET job_description=?, updated_at=datetime('now') WHERE id=?").run(jd, iv.id);
    }

    const updated = getInterviewWithDetails(iv.id, req.user.id);
    res.json({ interview: updated });
  } catch (err) {
    console.error('[VI] Generate questions error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate questions.' });
  }
});

// POST /vi/interviews/:id/questions — add question manually
router.post('/interviews/:id/questions', (req, res) => {
  const iv = db.prepare('SELECT id FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Not found.' });

  const { question_text, question_type, estimated_time_minutes } = req.body;
  if (!question_text?.trim()) return res.status(400).json({ error: 'question_text required.' });

  const maxOrder = db.prepare('SELECT MAX(order_number) AS m FROM video_interview_questions WHERE interview_id=?').get(req.params.id);
  const order = (maxOrder?.m ?? -1) + 1;

  const result = db.prepare(
    'INSERT INTO video_interview_questions (interview_id, question_text, question_type, estimated_time_minutes, order_number) VALUES (?,?,?,?,?)'
  ).run(req.params.id, question_text.trim(), question_type || 'behavioral', estimated_time_minutes || 3, order);

  const q = db.prepare('SELECT * FROM video_interview_questions WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json({ question: q });
});

// PUT /vi/interviews/:id/questions/:qid
router.put('/interviews/:id/questions/:qid', (req, res) => {
  const iv = db.prepare('SELECT id FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Not found.' });

  const { question_text, question_type, estimated_time_minutes, order_number } = req.body;
  db.prepare(
    'UPDATE video_interview_questions SET question_text=?, question_type=?, estimated_time_minutes=?, order_number=? WHERE id=? AND interview_id=?'
  ).run(
    question_text || '', question_type || 'behavioral',
    estimated_time_minutes || 3, order_number ?? 0,
    req.params.qid, req.params.id,
  );

  const q = db.prepare('SELECT * FROM video_interview_questions WHERE id=?').get(req.params.qid);
  res.json({ question: q });
});

// DELETE /vi/interviews/:id/questions/:qid
router.delete('/interviews/:id/questions/:qid', (req, res) => {
  const iv = db.prepare('SELECT id FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Not found.' });
  db.prepare('DELETE FROM video_interview_questions WHERE id=? AND interview_id=?').run(req.params.qid, req.params.id);
  res.json({ ok: true });
});

// ── Candidate invitation ─────────────────────────────────────────────────────

// POST /vi/interviews/:id/invite
router.post('/interviews/:id/invite', async (req, res) => {
  const iv = db.prepare('SELECT * FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Not found.' });

  const { name, email, phone, candidate_id } = req.body;
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: 'name and email required.' });

  // Generate unique access code
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 20) return res.status(500).json({ error: 'Could not generate unique code.' });
  } while (db.prepare('SELECT id FROM video_candidates WHERE access_code=?').get(code));

  const result = db.prepare(
    `INSERT INTO video_candidates (interview_id, candidate_id, name, email, phone, access_code)
     VALUES (?,?,?,?,?,?)`
  ).run(iv.id, candidate_id || null, name.trim(), email.trim().toLowerCase(), phone || null, code);

  const link = `${clientUrl()}/interview?code=${code}`;

  const questionCount = db.prepare('SELECT COUNT(*) AS c FROM video_interview_questions WHERE interview_id=?').get(iv.id)?.c || 0;
  const totalMinutes  = db.prepare('SELECT SUM(estimated_time_minutes) AS s FROM video_interview_questions WHERE interview_id=?').get(iv.id)?.s || 0;

  // Send invitation email
  try {
    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#7c3aed">You're invited to interview!</h2>
  <p>Hi ${name},</p>
  <p>You have been invited to complete a video interview for:</p>
  <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0">
    <strong>${iv.title}</strong>
  </div>
  <p>This interview has <strong>${questionCount} questions</strong> and will take approximately <strong>${totalMinutes} minutes</strong> to complete.</p>
  <p>Click the button below to begin when you're ready:</p>
  <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0">
    Start Interview →
  </a>
  <p style="color:#6b7280;font-size:13px;margin-top:16px">
    Or copy this link: <a href="${link}">${link}</a>
  </p>
  <p style="color:#6b7280;font-size:13px">
    Your access code: <strong style="font-family:monospace;font-size:15px;letter-spacing:2px">${code}</strong>
  </p>
  ${iv.expiry_date ? `<p style="color:#f87171;font-size:13px">This interview expires on ${new Date(iv.expiry_date).toLocaleDateString()}.</p>` : ''}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">Powered by RecruiterOS</p>
</div>`;

    await sendEmail({
      to: email.trim(),
      subject: `Video Interview Invitation: ${iv.title}`,
      html,
    });
  } catch (emailErr) {
    console.error('[VI] Email send failed:', emailErr.message);
  }

  const vc = db.prepare('SELECT * FROM video_candidates WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json({ candidate: vc, link });
});

// ── Candidate report & evaluation ────────────────────────────────────────────

// GET /vi/candidates/:cid/responses
router.get('/candidates/:cid/responses', (req, res) => {
  const vc = db.prepare('SELECT * FROM video_candidates WHERE id=?').get(req.params.cid);
  if (!vc) return res.status(404).json({ error: 'Not found.' });

  // Verify ownership via interview
  const iv = db.prepare('SELECT id FROM video_interviews WHERE id=? AND user_id=?').get(vc.interview_id, req.user.id);
  if (!iv) return res.status(403).json({ error: 'Forbidden.' });

  const responses = db.prepare(`
    SELECT vr.*, viq.question_text, viq.question_type, viq.order_number
    FROM video_responses vr
    JOIN video_interview_questions viq ON viq.id = vr.question_id
    WHERE vr.candidate_id = ?
    ORDER BY viq.order_number, vr.id
  `).all(req.params.cid);

  res.json({ candidate: vc, responses });
});

// POST /vi/candidates/:cid/evaluate — trigger AI evaluation
router.post('/candidates/:cid/evaluate', async (req, res) => {
  const vc = db.prepare('SELECT * FROM video_candidates WHERE id=?').get(req.params.cid);
  if (!vc) return res.status(404).json({ error: 'Not found.' });

  const iv = db.prepare('SELECT * FROM video_interviews WHERE id=? AND user_id=?').get(vc.interview_id, req.user.id);
  if (!iv) return res.status(403).json({ error: 'Forbidden.' });

  const responses = db.prepare(`
    SELECT vr.*, viq.question_text, viq.question_type, viq.order_number
    FROM video_responses vr
    JOIN video_interview_questions viq ON viq.id = vr.question_id
    WHERE vr.candidate_id = ?
    ORDER BY viq.order_number, vr.id
  `).all(req.params.cid);

  const missing = responses.filter(r => !r.transcription);
  if (missing.length > 0) {
    return res.status(400).json({
      error: `${missing.length} response(s) are still being transcribed. Please try again in a moment.`,
    });
  }
  if (responses.length === 0) {
    return res.status(400).json({ error: 'No responses found for this candidate.' });
  }

  try {
    const prompt = `You are an expert HR recruiter evaluating a candidate's video interview responses.

Job Description:
${iv.job_description}

Candidate: ${vc.name}
Email: ${vc.email}

Interview Questions and Transcribed Responses:
${responses.map((r, i) => `
Question ${i + 1} (${r.question_type}):
${r.question_text}

Candidate's Response:
${r.transcription || '(no transcription available)'}
---`).join('\n')}

Provide a comprehensive evaluation in this EXACT JSON format:
{
  "overall_score": <number 0-100>,
  "hiring_recommendation": "<strong_fit|good_fit|needs_review|not_recommended>",
  "evaluation_summary": "<2-3 sentence summary>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "competency_scores": {
    "technical_skills": <0-100>,
    "communication": <0-100>,
    "problem_solving": <0-100>,
    "leadership": <0-100>,
    "cultural_fit": <0-100>
  },
  "behavioral_insights": "<paragraph>",
  "question_evaluations": [
    {
      "question_index": 0,
      "score": <0-100>,
      "relevance_score": <0-100>,
      "clarity_score": <0-100>,
      "completeness_score": <0-100>,
      "analysis": "<detailed analysis>",
      "keywords_found": ["<keyword1>"]
    }
  ]
}

Return ONLY the JSON, no additional text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const evaluation = parseJSON(message.content[0].text);
    if (!evaluation) throw new Error('AI returned invalid JSON.');

    // Delete existing evaluation if any
    const existingEval = db.prepare('SELECT id FROM video_evaluations WHERE candidate_id=?').get(vc.id);
    if (existingEval) {
      db.prepare('DELETE FROM video_evaluations WHERE id=?').run(existingEval.id);
    }

    // Save evaluation
    const evalResult = db.prepare(`
      INSERT INTO video_evaluations
        (candidate_id, interview_id, overall_score, hiring_recommendation, evaluation_summary,
         strengths, weaknesses, competency_scores, behavioral_insights)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      vc.id, iv.id,
      evaluation.overall_score,
      evaluation.hiring_recommendation,
      evaluation.evaluation_summary,
      JSON.stringify(evaluation.strengths || []),
      JSON.stringify(evaluation.weaknesses || []),
      JSON.stringify(evaluation.competency_scores || {}),
      evaluation.behavioral_insights || '',
    );

    const evalId = evalResult.lastInsertRowid;

    // Save question evaluations
    const insertQE = db.prepare(`
      INSERT INTO video_question_evaluations
        (evaluation_id, question_id, score, relevance_score, clarity_score, completeness_score,
         analysis, keywords_found, response_transcription)
      VALUES (?,?,?,?,?,?,?,?,?)
    `);
    const insertAllQE = db.transaction((qes) => {
      qes.forEach((qe) => {
        const response = responses[qe.question_index];
        if (!response) return;
        insertQE.run(
          evalId, response.question_id,
          qe.score, qe.relevance_score, qe.clarity_score, qe.completeness_score,
          qe.analysis || '',
          JSON.stringify(qe.keywords_found || []),
          response.transcription || '',
        );
      });
    });
    insertAllQE(evaluation.question_evaluations || []);

    // Update candidate status
    db.prepare(`UPDATE video_candidates SET status='evaluated' WHERE id=?`).run(vc.id);

    res.json({ ok: true, overall_score: evaluation.overall_score, hiring_recommendation: evaluation.hiring_recommendation });
  } catch (err) {
    console.error('[VI] Evaluation error:', err.message);
    res.status(500).json({ error: err.message || 'Evaluation failed.' });
  }
});

// GET /vi/candidates/:cid/report
router.get('/candidates/:cid/report', (req, res) => {
  const vc = db.prepare('SELECT * FROM video_candidates WHERE id=?').get(req.params.cid);
  if (!vc) return res.status(404).json({ error: 'Not found.' });

  const iv = db.prepare('SELECT * FROM video_interviews WHERE id=? AND user_id=?').get(vc.interview_id, req.user.id);
  if (!iv) return res.status(403).json({ error: 'Forbidden.' });

  const evaluation = db.prepare('SELECT * FROM video_evaluations WHERE candidate_id=? ORDER BY id DESC').get(vc.id);
  if (!evaluation) return res.status(404).json({ error: 'No evaluation found. Please trigger evaluation first.' });

  const questionEvals = db.prepare(`
    SELECT vqe.*, viq.question_text, viq.question_type, viq.order_number
    FROM video_question_evaluations vqe
    JOIN video_interview_questions viq ON viq.id = vqe.question_id
    WHERE vqe.evaluation_id = ?
    ORDER BY viq.order_number, vqe.id
  `).all(evaluation.id);

  res.json({
    candidate: vc,
    interview: iv,
    evaluation: {
      ...evaluation,
      strengths:         parseJSON(evaluation.strengths)         || [],
      weaknesses:        parseJSON(evaluation.weaknesses)        || [],
      competency_scores: parseJSON(evaluation.competency_scores) || {},
    },
    questionEvals: questionEvals.map(qe => ({
      ...qe,
      keywords_found: parseJSON(qe.keywords_found) || [],
    })),
  });
});

// GET /vi/interviews/:id/link — get shareable interview link info
router.get('/interviews/:id/link', (req, res) => {
  const iv = db.prepare('SELECT * FROM video_interviews WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Not found.' });
  res.json({ link: `${clientUrl()}/interview`, interviewId: iv.id });
});

// GET /vi/sessions/:sessionId/vi-scores — map session_candidate IDs to video evaluation scores
router.get('/sessions/:sessionId/vi-scores', (req, res) => {
  const session = db.prepare('SELECT id, vi_interview_id FROM sessions WHERE id=? AND user_id=?')
    .get(req.params.sessionId, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  if (!session.vi_interview_id) return res.json({ scores: {} });

  const rows = db.prepare(`
    SELECT sc.id            AS sc_id,
           vc.id            AS vc_id,
           vc.status        AS vc_status,
           ve.overall_score,
           ve.hiring_recommendation
    FROM   session_candidates sc
    JOIN   video_candidates   vc ON vc.candidate_id = sc.candidate_id
                                AND vc.interview_id  = ?
    LEFT JOIN video_evaluations ve ON ve.candidate_id = vc.id
    WHERE  sc.session_id = ?
  `).all(session.vi_interview_id, req.params.sessionId);

  const scores = {};
  rows.forEach(r => {
    scores[r.sc_id] = {
      overall_score:          r.overall_score,
      hiring_recommendation:  r.hiring_recommendation,
      vc_status:              r.vc_status,
      vc_id:                  r.vc_id,
    };
  });

  res.json({ scores });
});

// POST /vi/sessions/:sessionId/bulk-invite — send video interview invites to shortlisted session candidates
router.post('/sessions/:sessionId/bulk-invite', async (req, res) => {
  const { interview_id, sc_ids } = req.body;
  if (!interview_id || !Array.isArray(sc_ids) || sc_ids.length === 0) {
    return res.status(400).json({ error: 'interview_id and sc_ids[] required.' });
  }

  const session = db.prepare('SELECT id FROM sessions WHERE id=? AND user_id=?').get(req.params.sessionId, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const iv = db.prepare('SELECT * FROM video_interviews WHERE id=? AND user_id=?').get(interview_id, req.user.id);
  if (!iv) return res.status(404).json({ error: 'Interview not found.' });

  db.prepare("UPDATE sessions SET vi_interview_id=?, updated_at=datetime('now') WHERE id=?").run(interview_id, req.params.sessionId);

  const questionCount = db.prepare('SELECT COUNT(*) AS c FROM video_interview_questions WHERE interview_id=?').get(iv.id)?.c || 0;
  const totalMinutes  = db.prepare('SELECT COALESCE(SUM(estimated_time_minutes),0) AS s FROM video_interview_questions WHERE interview_id=?').get(iv.id)?.s || 0;

  const results = [];

  for (const scId of sc_ids) {
    const sc = db.prepare(`
      SELECT sc.*, c.email AS candidate_email, c.name AS candidate_name
      FROM session_candidates sc
      JOIN candidates c ON c.id = sc.candidate_id
      WHERE sc.id=? AND sc.session_id=?
    `).get(scId, req.params.sessionId);

    if (!sc) { results.push({ sc_id: scId, status: 'error', message: 'Not found' }); continue; }
    if (sc.screening_status !== 'pass') { results.push({ sc_id: scId, status: 'error', message: 'Not shortlisted' }); continue; }
    if (sc.vi_invite_sent) { results.push({ sc_id: scId, status: 'already_invited' }); continue; }

    let code;
    let attempts = 0;
    let codeOk = false;
    while (attempts < 20) {
      code = generateCode();
      attempts++;
      if (!db.prepare('SELECT id FROM video_candidates WHERE access_code=?').get(code)) { codeOk = true; break; }
    }
    if (!codeOk) { results.push({ sc_id: scId, status: 'error', message: 'Code generation failed' }); continue; }

    db.prepare('INSERT INTO video_candidates (interview_id, candidate_id, name, email, access_code) VALUES (?,?,?,?,?)')
      .run(iv.id, sc.candidate_id, sc.candidate_name, sc.candidate_email, code);

    const link = `${clientUrl()}/interview?code=${code}`;

    try {
      const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#7c3aed">You're invited to interview!</h2>
  <p>Hi ${sc.candidate_name},</p>
  <p>You have been shortlisted and invited to complete a video interview for:</p>
  <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0">
    <strong>${iv.title}</strong>
  </div>
  <p>This interview has <strong>${questionCount} question${questionCount !== 1 ? 's' : ''}</strong> and will take approximately <strong>${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}</strong>.</p>
  <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0">
    Start Interview →
  </a>
  <p style="color:#6b7280;font-size:13px;margin-top:16px">Or copy this link: <a href="${link}">${link}</a></p>
  <p style="color:#6b7280;font-size:13px">Your access code: <strong style="font-family:monospace;font-size:15px;letter-spacing:2px">${code}</strong></p>
  ${iv.expiry_date ? `<p style="color:#f87171;font-size:13px">This interview expires on ${new Date(iv.expiry_date).toLocaleDateString()}.</p>` : ''}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">Powered by RecruiterOS</p>
</div>`;
      await sendEmail({ to: sc.candidate_email, subject: `Video Interview Invitation: ${iv.title}`, html });
    } catch (emailErr) {
      console.error('[VI] Email failed:', emailErr.message);
    }

    db.prepare("UPDATE session_candidates SET vi_invite_sent=1, vi_invite_sent_at=datetime('now') WHERE id=?").run(scId);
    results.push({ sc_id: scId, status: 'invited', code, link });
  }

  res.json({ results });
});

// Serve video files (authenticated)
router.get('/video/:candidateId/:filename', (req, res) => {
  const { candidateId, filename } = req.params;
  const vc = db.prepare('SELECT * FROM video_candidates WHERE id=?').get(candidateId);
  if (!vc) return res.status(404).send('Not found.');

  const iv = db.prepare('SELECT id FROM video_interviews WHERE id=? AND user_id=?').get(vc.interview_id, req.user.id);
  if (!iv) return res.status(403).send('Forbidden.');

  const filePath = path.join(VI_DIR, candidateId, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Video not found.');
  res.sendFile(filePath);
});

module.exports = router;
