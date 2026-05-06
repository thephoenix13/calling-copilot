const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { db }    = require('../db');
const auth      = require('../middleware/auth');
const { sendEmail }       = require('../utils/mailer');
const { buildInviteEmail } = require('../utils/emailTemplates');

const anthropic = new Anthropic();

function clientUrl() { return process.env.CLIENT_URL || 'http://localhost:5173'; }

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

// ── AI Evaluation ─────────────────────────────────────────────────────────────
async function runAIEvaluation(submissionId) {
  try {
    const sub        = db.prepare('SELECT * FROM coding_submissions WHERE id = ?').get(submissionId);
    const invite     = db.prepare('SELECT * FROM coding_invites WHERE id = ?').get(sub.invite_id);
    const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ?').get(sub.assessment_id);
    const questions  = db.prepare('SELECT * FROM coding_questions WHERE assessment_id = ? ORDER BY order_num').all(sub.assessment_id);
    const answers    = JSON.parse(sub.answers || '{}');

    const qBlocks = questions.map((q, i) => {
      const code = answers[q.id] || '(no answer submitted)';
      return `--- Question ${i + 1}: ${q.title} [${q.question_type} / ${q.language} / ${q.difficulty}] ---
Problem: ${q.problem_statement}${q.starter_code ? `\nStarter code provided:\n${q.starter_code}` : ''}
Candidate's answer:
\`\`\`${q.language}
${code}
\`\`\``;
    }).join('\n\n');

    const prompt = `You are a senior software engineer evaluating a coding assessment.

Assessment: ${assessment.title}
Candidate: ${invite.candidate_name}

Evaluate each coding answer on correctness (does it solve the problem?), code quality (naming, structure, edge cases), and language-appropriate patterns.

${qBlocks}

Return ONLY valid JSON:
{
  "overall_score": <0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "recommendation": "<strong_pass|pass|borderline|fail>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "per_question": [
    {
      "question_id": <id>,
      "score": <0-100>,
      "correctness": "<correct|partial|incorrect>",
      "quality": "<excellent|good|fair|poor>",
      "feedback": "<specific 1-2 sentence feedback>"
    }
  ]
}`;

    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const ev = parseJSON(msg.content[0].text);
    if (ev) {
      db.prepare('UPDATE coding_submissions SET ai_evaluation = ?, score = ? WHERE id = ?')
        .run(JSON.stringify(ev), ev.overall_score ?? null, submissionId);
      console.log(`[CodingAssessments] AI evaluation saved for submission ${submissionId}`);
    }
  } catch (err) {
    console.error(`[CodingAssessments] AI eval failed for submission ${submissionId}:`, err.message);
  }
}

// ── PUBLIC routes ─────────────────────────────────────────────────────────────

router.get('/take/:token', (req, res) => {
  const invite = db.prepare('SELECT * FROM coding_invites WHERE token = ?').get(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invalid or expired link.' });
  if (invite.status === 'completed') return res.json({ alreadyCompleted: true });

  if (invite.status === 'pending') {
    db.prepare(`UPDATE coding_invites SET status='started', started_at=datetime('now') WHERE id=?`).run(invite.id);
  }

  const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ?').get(invite.assessment_id);
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' });

  const questions = db.prepare(
    'SELECT id, title, problem_statement, starter_code, language, question_type, difficulty, topic, order_num FROM coding_questions WHERE assessment_id = ? ORDER BY order_num'
  ).all(invite.assessment_id);

  res.json({
    invite:     { id: invite.id, candidate_name: invite.candidate_name, status: 'started' },
    assessment: { title: assessment.title, description: assessment.description, instructions: assessment.instructions, time_limit_min: assessment.time_limit_min },
    questions,
  });
});

router.post('/take/:token/submit', (req, res) => {
  const invite = db.prepare('SELECT * FROM coding_invites WHERE token = ?').get(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invalid link.' });
  if (invite.status === 'completed') return res.json({ alreadySubmitted: true });

  const { answers = {}, time_taken_sec } = req.body;

  const result = db.prepare(
    `INSERT INTO coding_submissions (invite_id, assessment_id, answers, time_taken_sec) VALUES (?, ?, ?, ?)`
  ).run(invite.id, invite.assessment_id, JSON.stringify(answers), time_taken_sec || null);

  db.prepare(`UPDATE coding_invites SET status='completed', completed_at=datetime('now') WHERE id=?`).run(invite.id);

  const submissionId = result.lastInsertRowid;
  setImmediate(() => runAIEvaluation(submissionId));

  res.json({ ok: true, message: 'Submitted successfully. Your results will be evaluated shortly.' });
});

// ── AUTH middleware ───────────────────────────────────────────────────────────
router.use(auth);

// ── Assessment CRUD ───────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*,
           COUNT(DISTINCT cq.id)  AS question_count,
           COUNT(DISTINCT ci.id)  AS invite_count,
           COUNT(DISTINCT ci2.id) AS completed_count,
           j.title                AS job_title
    FROM coding_assessments a
    LEFT JOIN coding_questions cq ON cq.assessment_id = a.id
    LEFT JOIN coding_invites ci   ON ci.assessment_id = a.id
    LEFT JOIN coding_invites ci2  ON ci2.assessment_id = a.id AND ci2.status = 'completed'
    LEFT JOIN jobs j              ON j.id = a.job_id
    WHERE a.user_id = ?
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all(req.user.id);
  res.json({ assessments: rows });
});

router.post('/', (req, res) => {
  const { title, description, instructions, job_id, time_limit_min, pass_score } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' });

  const result = db.prepare(
    `INSERT INTO coding_assessments (user_id, job_id, title, description, instructions, time_limit_min, pass_score) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, job_id || null, title.trim(), description || null, instructions || null,
    time_limit_min ?? 60, pass_score ?? 60);

  res.status(201).json({ assessment: db.prepare('SELECT * FROM coding_assessments WHERE id = ?').get(result.lastInsertRowid) });
});

router.get('/:id', (req, res) => {
  const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const questions = db.prepare('SELECT * FROM coding_questions WHERE assessment_id = ? ORDER BY order_num, id').all(req.params.id);

  const inviteRows = db.prepare('SELECT * FROM coding_invites WHERE assessment_id = ? ORDER BY invited_at DESC').all(req.params.id);
  const invites = inviteRows.map(inv => {
    const sub = inv.status === 'completed'
      ? db.prepare('SELECT * FROM coding_submissions WHERE invite_id = ? ORDER BY id DESC').get(inv.id)
      : null;
    if (sub?.ai_evaluation) sub.ai_evaluation = parseJSON(sub.ai_evaluation);
    return { ...inv, submission: sub || null };
  });

  res.json({ assessment, questions, invites });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });

  const { title, description, instructions, job_id, time_limit_min, pass_score, status } = req.body;
  db.prepare(`UPDATE coding_assessments SET title=?,description=?,instructions=?,job_id=?,time_limit_min=?,pass_score=?,status=?,updated_at=datetime('now') WHERE id=? AND user_id=?`)
    .run(title || '', description || null, instructions || null, job_id || null,
      time_limit_min ?? 60, pass_score ?? 60, status || 'draft', req.params.id, req.user.id);

  res.json({ assessment: db.prepare('SELECT * FROM coding_assessments WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  db.prepare('DELETE FROM coding_assessments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── AI Context check ──────────────────────────────────────────────────────────

router.get('/:id/ai-context', (req, res) => {
  const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  let job = null, has_session_assets = false, has_enhancer_assets = false;
  if (assessment.job_id) {
    job = db.prepare('SELECT id, title, client_name FROM jobs WHERE id = ?').get(assessment.job_id);
    const session = db.prepare('SELECT id FROM sessions WHERE job_id=? AND user_id=? AND enhancement_data IS NOT NULL LIMIT 1').get(assessment.job_id, req.user.id);
    if (session) has_session_assets = true;
    if (!has_session_assets && job?.title) {
      const enh = db.prepare('SELECT id FROM jd_enhancements WHERE user_id=? AND title LIKE ? LIMIT 1').get(req.user.id, `%${job.title}%`);
      if (enh) has_enhancer_assets = true;
    }
  }

  res.json({
    job: job ? { id: job.id, title: job.title, client_name: job.client_name } : null,
    has_session_assets, has_enhancer_assets,
    context_level: has_session_assets || has_enhancer_assets ? 'full' : (job ? 'job_only' : 'none'),
  });
});

// ── AI Question Generation ────────────────────────────────────────────────────

router.post('/:id/ai-generate', async (req, res) => {
  const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const count      = Math.min(req.body.count || 5, 10);
  const language   = req.body.language   || 'javascript';
  const difficulty = req.body.difficulty || 'mixed';
  const topic      = req.body.topic      || null;

  // Load job + assets context
  let job = null, assets = null;
  if (assessment.job_id) {
    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(assessment.job_id);
    const session = db.prepare('SELECT enhancement_data FROM sessions WHERE job_id=? AND user_id=? AND enhancement_data IS NOT NULL ORDER BY updated_at DESC LIMIT 1').get(assessment.job_id, req.user.id);
    if (session?.enhancement_data) { assets = parseJSON(session.enhancement_data); }
    if (!assets && job?.title) {
      const enh = db.prepare('SELECT results FROM jd_enhancements WHERE user_id=? AND title LIKE ? ORDER BY created_at DESC LIMIT 1').get(req.user.id, `%${job.title}%`);
      if (enh?.results) assets = parseJSON(enh.results);
    }
  }

  // Build context
  const ctxLines = [];
  if (assessment.description) ctxLines.push(`Assessment description: ${assessment.description}`);
  if (job) {
    ctxLines.push(`Job title: ${job.title}`);
    const req_skills  = parseJSON(job.required_skills)  || [];
    const pref_skills = parseJSON(job.preferred_skills) || [];
    if (req_skills.length)  ctxLines.push(`Required skills: ${req_skills.join(', ')}`);
    if (pref_skills.length) ctxLines.push(`Preferred skills: ${pref_skills.join(', ')}`);
    if (job.description)    ctxLines.push(`Role description: ${job.description.slice(0, 600)}`);
  }
  if (assets?.recruiterBrief) ctxLines.push(`Role brief: ${assets.recruiterBrief.slice(0, 500)}`);

  const context   = ctxLines.length ? ctxLines.join('\n') : 'General software engineering assessment.';
  const topicLine = topic ? `Focus questions on: ${topic}.` : 'Cover topics relevant to the role.';
  const diffLine  = difficulty === 'mixed'
    ? 'Mix difficulties: roughly 30% easy, 50% medium, 20% hard.'
    : `All questions should be "${difficulty}" difficulty.`;

  // Distribute question types: 40% write, 30% fix, 30% complete
  const nWrite    = Math.round(count * 0.4) || 1;
  const nFix      = Math.round(count * 0.3) || 1;
  const nComplete = count - nWrite - nFix;

  const prompt = `You are a senior ${language} engineer creating coding assessment questions for a technical recruiter platform.

Role context:
${context}

${topicLine}
${diffLine}

Generate exactly ${count} coding questions in ${language}:
- ${nWrite} "write" type: candidate writes a complete solution from scratch
- ${nFix} "fix" type: candidate finds and fixes bugs in provided code
- ${nComplete} "complete" type: candidate completes a partial implementation

For "fix" and "complete" types, provide realistic starter_code with clear placeholders or bugs.
For "write" type, provide a minimal function signature as starter_code.

Return ONLY valid JSON array:
[
  {
    "title": "Short descriptive title",
    "problem_statement": "Clear problem description with examples of input/output",
    "starter_code": "// starter code here (function signature, buggy code, or partial impl)",
    "language": "${language}",
    "question_type": "write|fix|complete",
    "difficulty": "easy|medium|hard",
    "topic": "specific topic"
  }
]`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const generated = parseJSON(msg.content[0].text);
    if (!Array.isArray(generated) || generated.length === 0) throw new Error('AI returned invalid question array.');

    const maxRow    = db.prepare('SELECT MAX(order_num) AS m FROM coding_questions WHERE assessment_id = ?').get(req.params.id);
    let   nextOrder = (maxRow?.m ?? -1) + 1;

    const insertQ = db.prepare(
      `INSERT INTO coding_questions (assessment_id, title, problem_statement, starter_code, language, question_type, difficulty, topic, order_num)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const ids = [];
    db.transaction(qs => {
      qs.forEach(q => {
        const diff = ['easy','medium','hard'].includes(q.difficulty) ? q.difficulty : (difficulty === 'mixed' ? 'medium' : difficulty);
        const type = ['write','fix','complete'].includes(q.question_type) ? q.question_type : 'write';
        const r = insertQ.run(req.params.id, q.title || 'Untitled', q.problem_statement || '', q.starter_code || null, language, type, diff, q.topic || topic || null, nextOrder++);
        ids.push(r.lastInsertRowid);
      });
    })(generated);

    const questions = ids.map(id => db.prepare('SELECT * FROM coding_questions WHERE id = ?').get(id));
    res.status(201).json({ questions, generated_count: questions.length });
  } catch (err) {
    console.error('[CodingAssessments] AI generate error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate questions.' });
  }
});

// ── Question CRUD ─────────────────────────────────────────────────────────────

router.post('/:id/questions', (req, res) => {
  const assessment = db.prepare('SELECT id FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const { title, problem_statement, starter_code, language, question_type, difficulty, topic } = req.body;
  if (!title?.trim())             return res.status(400).json({ error: 'title is required.' });
  if (!problem_statement?.trim()) return res.status(400).json({ error: 'problem_statement is required.' });

  const maxRow = db.prepare('SELECT MAX(order_num) AS m FROM coding_questions WHERE assessment_id = ?').get(req.params.id);
  const order  = (maxRow?.m ?? -1) + 1;

  const result = db.prepare(
    `INSERT INTO coding_questions (assessment_id, title, problem_statement, starter_code, language, question_type, difficulty, topic, order_num)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.params.id, title.trim(), problem_statement.trim(), starter_code || null,
    language || 'javascript', question_type || 'write', difficulty || 'medium', topic || null, order);

  res.status(201).json({ question: db.prepare('SELECT * FROM coding_questions WHERE id = ?').get(result.lastInsertRowid) });
});

router.put('/:id/questions/:qid', (req, res) => {
  const assessment = db.prepare('SELECT id FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const { title, problem_statement, starter_code, language, question_type, difficulty, topic } = req.body;
  db.prepare(`UPDATE coding_questions SET title=?,problem_statement=?,starter_code=?,language=?,question_type=?,difficulty=?,topic=? WHERE id=? AND assessment_id=?`)
    .run(title || '', problem_statement || '', starter_code || null,
      language || 'javascript', question_type || 'write', difficulty || 'medium', topic || null,
      req.params.qid, req.params.id);

  res.json({ question: db.prepare('SELECT * FROM coding_questions WHERE id = ?').get(req.params.qid) });
});

router.delete('/:id/questions/:qid', (req, res) => {
  const assessment = db.prepare('SELECT id FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });
  db.prepare('DELETE FROM coding_questions WHERE id = ? AND assessment_id = ?').run(req.params.qid, req.params.id);
  res.json({ ok: true });
});

// ── Invitations ───────────────────────────────────────────────────────────────

router.post('/:id/invite', (req, res) => {
  const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const { candidates, job_title } = req.body;
  if (!Array.isArray(candidates) || candidates.length === 0) return res.status(400).json({ error: 'candidates array required.' });

  const insert = db.prepare(`INSERT INTO coding_invites (assessment_id, candidate_id, candidate_name, candidate_email, token) VALUES (?, ?, ?, ?, ?)`);
  const invites = [];

  db.transaction(cands => {
    cands.forEach(c => {
      if (!c.name?.trim() || !c.email?.trim()) return;
      const token = crypto.randomBytes(16).toString('hex');
      const r = insert.run(req.params.id, c.candidate_id || null, c.name.trim(), c.email.trim().toLowerCase(), token);
      const inv = db.prepare('SELECT * FROM coding_invites WHERE id = ?').get(r.lastInsertRowid);
      invites.push({ ...inv, link: `${clientUrl()}/coding-assessment?token=${token}` });
    });
  })(candidates);

  res.status(201).json({ invites });

  // Send invite emails in background — don't block the response
  const recruiter = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
  const recruiterName = recruiter?.display_name || 'Your Recruiter';

  for (const inv of invites) {
    const html = buildInviteEmail({
      candidateName:  inv.candidate_name,
      recruiterName,
      assessmentType: 'Coding assessment',
      jobTitle:       job_title || '',
      timeLimitMin:   assessment.time_limit_min || 60,
      passScore:      assessment.pass_score ?? null,
      link:           inv.link,
      ctaLabel:       'Start Assessment',
    });
    sendEmail({
      to:      `"${inv.candidate_name}" <${inv.candidate_email}>`,
      subject: job_title
        ? `Next step from our conversation — ${assessment.title} (${job_title})`
        : `Next step from our conversation — ${assessment.title}`,
      html,
    }).catch(err => console.error(`[Coding Invite] Email to ${inv.candidate_email} failed:`, err.message));
  }
});

// POST /coding-assessments/:id/invites/:inviteId/resend — resend invite email
router.post('/:id/invites/:inviteId/resend', async (req, res) => {
  const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const invite = db.prepare('SELECT * FROM coding_invites WHERE id = ? AND assessment_id = ?').get(req.params.inviteId, req.params.id);
  if (!invite) return res.status(404).json({ error: 'Invite not found.' });

  const link = `${clientUrl()}/coding-assessment?token=${invite.token}`;
  try {
    const recruiter = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
    const recruiterName = recruiter?.display_name || 'Your Recruiter';
    const jobRow = assessment.job_id
      ? db.prepare('SELECT title FROM jobs WHERE id = ?').get(assessment.job_id)
      : null;
    const html = buildInviteEmail({
      candidateName:  invite.candidate_name,
      recruiterName,
      assessmentType: 'Coding assessment',
      jobTitle:       jobRow?.title || '',
      timeLimitMin:   assessment.time_limit_min || 60,
      passScore:      assessment.pass_score ?? null,
      link,
      ctaLabel:       'Start Assessment',
      isReminder:     true,
    });
    await sendEmail({
      to:      `"${invite.candidate_name}" <${invite.candidate_email}>`,
      subject: `Reminder: ${assessment.title}`,
      html,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(`[Coding Resend] Email to ${invite.candidate_email} failed:`, err.message);
    res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
  }
});

// ── Results ───────────────────────────────────────────────────────────────────

router.get('/:id/results', (req, res) => {
  const assessment = db.prepare('SELECT * FROM coding_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const submissions = db.prepare(`
    SELECT s.*, i.candidate_name, i.candidate_email, i.status AS invite_status, i.invited_at, i.completed_at
    FROM coding_submissions s
    JOIN coding_invites i ON i.id = s.invite_id
    WHERE s.assessment_id = ?
    ORDER BY s.submitted_at DESC
  `).all(req.params.id).map(row => ({
    ...row,
    ai_evaluation: row.ai_evaluation ? parseJSON(row.ai_evaluation) : null,
    passed: row.score != null ? row.score >= assessment.pass_score : null,
  }));

  res.json({ assessment, submissions });
});

module.exports = router;
