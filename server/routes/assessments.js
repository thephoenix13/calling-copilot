const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { db }   = require('../db');
const auth      = require('../middleware/auth');
const { sendEmail }       = require('../utils/mailer');
const { buildInviteEmail } = require('../utils/emailTemplates');

const anthropic = new Anthropic();

// ── Helpers ──────────────────────────────────────────────────────────────────

function clientUrl() {
  return process.env.CLIENT_URL || 'http://localhost:5173';
}

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

// ── AI Evaluation (async, runs after submission) ──────────────────────────────

async function runAIEvaluation(submissionId) {
  try {
    const sub        = db.prepare('SELECT * FROM assessment_submissions WHERE id = ?').get(submissionId);
    const invite     = db.prepare('SELECT * FROM assessment_invites WHERE id = ?').get(sub.invite_id);
    const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(sub.assessment_id);
    const questions  = db.prepare(
      'SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY order_num'
    ).all(sub.assessment_id);

    const answers = JSON.parse(sub.answers || '{}');
    const questionAnalysis = questions.map(q => {
      const selected     = answers[q.id] || null;
      const correct      = selected === q.correct_option;
      const opts         = JSON.parse(q.options || '[]');
      const selectedText = opts.find(o => o.id === selected)?.text || selected;
      const correctText  = opts.find(o => o.id === q.correct_option)?.text || q.correct_option;
      return {
        question:       q.question_text,
        topic:          q.topic,
        difficulty:     q.difficulty,
        selected,
        selectedText,
        correct_option: q.correct_option,
        correctText,
        is_correct:     correct,
        explanation:    q.explanation,
      };
    });

    const prompt = `You are an expert technical recruiter evaluating an MCQ assessment result.

Assessment: ${assessment.title}
Candidate: ${invite.candidate_name}
Score: ${sub.score}% (${sub.correct_count}/${sub.total_questions} correct)
Time taken: ${Math.round((sub.time_taken_sec || 0) / 60)} minutes

Question-by-question breakdown:
${questionAnalysis.map((q, i) => `${i + 1}. [${q.topic || 'General'}] [${q.difficulty}] ${q.question}: ${q.is_correct ? 'CORRECT' : `WRONG (selected: ${q.selectedText}, correct: ${q.correctText})`}`).join('\n')}

Provide a JSON evaluation with this structure (no markdown, no code fences):
{
  "summary": "2-3 sentence overall summary",
  "strengths": ["topic1", "topic2"],
  "gaps": ["topic1", "topic2"],
  "topic_scores": {"TopicName": {"correct": N, "total": N}},
  "difficulty_breakdown": {"easy": {"correct":N,"total":N}, "medium": {"correct":N,"total":N}, "hard": {"correct":N,"total":N}},
  "recommendation": "strong_pass|pass|borderline|fail",
  "recommendation_note": "one sentence rationale",
  "question_analysis": [{"question_num": 1, "is_correct": true, "note": "brief insight"}]
}`;

    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    let eval_data;
    try {
      eval_data = JSON.parse(msg.content[0].text.trim());
    } catch {
      const s = msg.content[0].text.indexOf('{');
      const e = msg.content[0].text.lastIndexOf('}');
      if (s !== -1 && e > s) {
        eval_data = JSON.parse(msg.content[0].text.slice(s, e + 1));
      }
    }

    if (eval_data) {
      db.prepare('UPDATE assessment_submissions SET ai_evaluation = ? WHERE id = ?')
        .run(JSON.stringify(eval_data), submissionId);
      console.log(`[Assessments] AI evaluation saved for submission ${submissionId}`);
    }
  } catch (err) {
    console.error(`[Assessments] AI evaluation failed for submission ${submissionId}:`, err.message);
  }
}

// ── PUBLIC routes (no auth — must be registered BEFORE router.use(auth)) ─────

// GET /assessments/take/:token — candidate loads assessment
router.get('/take/:token', (req, res) => {
  const invite = db.prepare('SELECT * FROM assessment_invites WHERE token = ?').get(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invalid or expired link.' });

  if (invite.status === 'completed') {
    return res.json({ alreadyCompleted: true });
  }

  // Mark as started (only set started_at once)
  if (invite.status === 'pending') {
    db.prepare(
      `UPDATE assessment_invites SET status='started', started_at=datetime('now') WHERE id=?`
    ).run(invite.id);
  } else {
    // already 'started' — just update status field (no-op, keep started_at)
    db.prepare(`UPDATE assessment_invites SET status='started' WHERE id=? AND started_at IS NULL`)
      .run(invite.id);
  }

  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(invite.assessment_id);
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' });

  // Return questions WITHOUT correct_option
  const questions = db.prepare(
    `SELECT id, question_text, options, topic, difficulty, order_num
     FROM assessment_questions
     WHERE assessment_id = ?
     ORDER BY order_num, id`
  ).all(invite.assessment_id).map(q => ({
    ...q,
    options: parseJSON(q.options) || [],
  }));

  res.json({
    invite: {
      id:             invite.id,
      candidate_name: invite.candidate_name,
      status:         'started',
    },
    assessment: {
      title:          assessment.title,
      description:    assessment.description,
      instructions:   assessment.instructions,
      time_limit_min: assessment.time_limit_min,
    },
    questions,
  });
});

// POST /assessments/take/:token/submit — candidate submits answers
router.post('/take/:token/submit', (req, res) => {
  const { answers = {}, time_taken_sec } = req.body;

  const invite = db.prepare('SELECT * FROM assessment_invites WHERE token = ?').get(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invalid or expired link.' });
  if (invite.status === 'completed') {
    return res.status(400).json({ error: 'Assessment already submitted.' });
  }

  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(invite.assessment_id);
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' });

  const questions = db.prepare(
    'SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY order_num'
  ).all(invite.assessment_id);

  // Score calculation
  const total_questions = questions.length;
  let correct_count = 0;
  questions.forEach(q => {
    if (answers[q.id] && answers[q.id] === q.correct_option) {
      correct_count++;
    }
  });

  const score = total_questions > 0 ? Math.round((correct_count / total_questions) * 100) : 0;
  const passed = score >= assessment.pass_score;

  // Insert submission
  const subResult = db.prepare(
    `INSERT INTO assessment_submissions
       (invite_id, assessment_id, answers, score, correct_count, total_questions, time_taken_sec)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    invite.id,
    invite.assessment_id,
    JSON.stringify(answers),
    score,
    correct_count,
    total_questions,
    time_taken_sec || null,
  );

  const submissionId = subResult.lastInsertRowid;

  // Mark invite as completed
  db.prepare(
    `UPDATE assessment_invites SET status='completed', completed_at=datetime('now') WHERE id=?`
  ).run(invite.id);

  // Trigger async AI evaluation (do not block response)
  setImmediate(() => {
    runAIEvaluation(submissionId);
  });

  res.json({
    score,
    correct_count,
    total_questions,
    pass_score:  assessment.pass_score,
    passed,
  });
});

// ── AUTH middleware — all routes below require authentication ─────────────────
router.use(auth);

// ── Assessment CRUD ───────────────────────────────────────────────────────────

// GET /assessments — list all assessments for this user
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*,
           COUNT(DISTINCT aq.id)  AS question_count,
           COUNT(DISTINCT ai.id)  AS invite_count,
           COUNT(DISTINCT ai2.id) AS completed_count,
           j.title                AS job_title
    FROM assessments a
    LEFT JOIN assessment_questions aq ON aq.assessment_id = a.id
    LEFT JOIN assessment_invites ai   ON ai.assessment_id  = a.id
    LEFT JOIN assessment_invites ai2  ON ai2.assessment_id = a.id AND ai2.status = 'completed'
    LEFT JOIN jobs j                  ON j.id = a.job_id
    WHERE a.user_id = ?
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all(req.user.id);

  res.json({ assessments: rows });
});

// POST /assessments — create assessment
router.post('/', (req, res) => {
  const { title, description, instructions, job_id, time_limit_min, pass_score } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' });

  const result = db.prepare(
    `INSERT INTO assessments (user_id, job_id, title, description, instructions, time_limit_min, pass_score)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.id,
    job_id   || null,
    title.trim(),
    description   || null,
    instructions  || null,
    time_limit_min != null ? time_limit_min : 30,
    pass_score     != null ? pass_score     : 60,
  );

  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ assessment });
});

// GET /assessments/:id — get assessment with questions, invites, and submissions
router.get('/:id', (req, res) => {
  const assessment = db.prepare(
    'SELECT * FROM assessments WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const questions = db.prepare(
    'SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY order_num, id'
  ).all(req.params.id).map(q => ({ ...q, options: parseJSON(q.options) || [] }));

  const inviteRows = db.prepare(
    'SELECT * FROM assessment_invites WHERE assessment_id = ? ORDER BY invited_at DESC'
  ).all(req.params.id);

  const invites = inviteRows.map(invite => {
    const submission = invite.status === 'completed'
      ? db.prepare('SELECT * FROM assessment_submissions WHERE invite_id = ? ORDER BY id DESC').get(invite.id)
      : null;
    if (submission && submission.ai_evaluation) {
      submission.ai_evaluation = parseJSON(submission.ai_evaluation);
    }
    return { ...invite, submission: submission || null };
  });

  res.json({ assessment, questions, invites });
});

// PUT /assessments/:id — update assessment
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });

  const { title, description, instructions, job_id, time_limit_min, pass_score, status } = req.body;

  db.prepare(
    `UPDATE assessments
     SET title=?, description=?, instructions=?, job_id=?, time_limit_min=?, pass_score=?, status=?, updated_at=datetime('now')
     WHERE id=? AND user_id=?`
  ).run(
    title         || '',
    description   || null,
    instructions  || null,
    job_id        || null,
    time_limit_min != null ? time_limit_min : 30,
    pass_score     != null ? pass_score     : 60,
    status        || 'draft',
    req.params.id,
    req.user.id,
  );

  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
  res.json({ assessment });
});

// DELETE /assessments/:id — delete assessment (CASCADE handles children)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });

  db.prepare('DELETE FROM assessments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Question management ───────────────────────────────────────────────────────

// POST /assessments/:id/questions — add one question
router.post('/:id/questions', (req, res) => {
  const assessment = db.prepare('SELECT id FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const { question_text, options, correct_option, explanation, topic, difficulty } = req.body;
  if (!question_text?.trim()) return res.status(400).json({ error: 'question_text is required.' });
  if (!correct_option?.trim()) return res.status(400).json({ error: 'correct_option is required.' });

  const maxRow = db.prepare('SELECT MAX(order_num) AS m FROM assessment_questions WHERE assessment_id = ?').get(req.params.id);
  const order_num = (maxRow?.m ?? -1) + 1;

  const result = db.prepare(
    `INSERT INTO assessment_questions
       (assessment_id, question_text, options, correct_option, explanation, topic, difficulty, order_num)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.params.id,
    question_text.trim(),
    JSON.stringify(Array.isArray(options) ? options : []),
    correct_option.trim(),
    explanation  || null,
    topic        || null,
    difficulty   || 'medium',
    order_num,
  );

  const question = db.prepare('SELECT * FROM assessment_questions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ question: { ...question, options: parseJSON(question.options) || [] } });
});

// PUT /assessments/:id/questions/:qid — update question
router.put('/:id/questions/:qid', (req, res) => {
  const assessment = db.prepare('SELECT id FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const { question_text, options, correct_option, explanation, topic, difficulty, order_num } = req.body;

  db.prepare(
    `UPDATE assessment_questions
     SET question_text=?, options=?, correct_option=?, explanation=?, topic=?, difficulty=?, order_num=?
     WHERE id=? AND assessment_id=?`
  ).run(
    question_text  || '',
    JSON.stringify(Array.isArray(options) ? options : []),
    correct_option || '',
    explanation    || null,
    topic          || null,
    difficulty     || 'medium',
    order_num      ?? 0,
    req.params.qid,
    req.params.id,
  );

  const question = db.prepare('SELECT * FROM assessment_questions WHERE id = ?').get(req.params.qid);
  if (!question) return res.status(404).json({ error: 'Question not found.' });
  res.json({ question: { ...question, options: parseJSON(question.options) || [] } });
});

// DELETE /assessments/:id/questions/:qid — delete question
router.delete('/:id/questions/:qid', (req, res) => {
  const assessment = db.prepare('SELECT id FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  db.prepare('DELETE FROM assessment_questions WHERE id = ? AND assessment_id = ?').run(req.params.qid, req.params.id);
  res.json({ ok: true });
});

// ── AI Question Generation ────────────────────────────────────────────────────

// GET /assessments/:id/ai-context — preview what context will be used for generation
router.get('/:id/ai-context', (req, res) => {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  let job = null;
  let has_session_assets  = false;
  let has_enhancer_assets = false;

  if (assessment.job_id) {
    job = db.prepare('SELECT id, title, client_name, required_skills, preferred_skills FROM jobs WHERE id = ?').get(assessment.job_id);

    const session = db.prepare(
      `SELECT id FROM sessions WHERE job_id = ? AND user_id = ? AND enhancement_data IS NOT NULL LIMIT 1`
    ).get(assessment.job_id, req.user.id);
    if (session) has_session_assets = true;

    if (!has_session_assets && job?.title) {
      const enh = db.prepare(
        `SELECT id FROM jd_enhancements WHERE user_id = ? AND title LIKE ? LIMIT 1`
      ).get(req.user.id, `%${job.title}%`);
      if (enh) has_enhancer_assets = true;
    }
  }

  res.json({
    job: job ? { id: job.id, title: job.title, client_name: job.client_name } : null,
    has_session_assets,
    has_enhancer_assets,
    context_level: has_session_assets || has_enhancer_assets ? 'full' : (job ? 'job_only' : 'none'),
  });
});

// POST /assessments/:id/ai-generate — generate N MCQ questions via Claude
router.post('/:id/ai-generate', async (req, res) => {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const count      = req.body.count      || 10;
  const topic      = req.body.topic      || null;
  const difficulty = req.body.difficulty || 'medium';

  // ── Load job + JD assets ──────────────────────────────────────────────────
  let job        = null;
  let assets     = null; // parsed results JSON from jd_enhancements
  let assetsSource = null;

  if (assessment.job_id) {
    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(assessment.job_id);

    // 1. Try sessions linked to this job (most specific)
    const session = db.prepare(
      `SELECT enhancement_data FROM sessions
       WHERE job_id = ? AND user_id = ? AND enhancement_data IS NOT NULL
       ORDER BY updated_at DESC LIMIT 1`
    ).get(assessment.job_id, req.user.id);

    if (session?.enhancement_data) {
      assets = parseJSON(session.enhancement_data);
      assetsSource = 'session';
    }

    // 2. Fall back to jd_enhancements by job title match
    if (!assets && job?.title) {
      const enh = db.prepare(
        `SELECT results FROM jd_enhancements
         WHERE user_id = ? AND title LIKE ?
         ORDER BY created_at DESC LIMIT 1`
      ).get(req.user.id, `%${job.title}%`);

      if (enh?.results) {
        assets = parseJSON(enh.results);
        assetsSource = 'jd_enhancer';
      }
    }
  }

  // ── Build context block ───────────────────────────────────────────────────
  const contextLines = [];
  if (assessment.description) contextLines.push(`Assessment description: ${assessment.description}`);

  if (job) {
    contextLines.push(`Job title: ${job.title}`);
    if (job.client_name)  contextLines.push(`Client / Company: ${job.client_name}`);
    if (job.department)   contextLines.push(`Department: ${job.department}`);

    const requiredSkills  = parseJSON(job.required_skills)  || [];
    const preferredSkills = parseJSON(job.preferred_skills) || [];
    if (requiredSkills.length)  contextLines.push(`Required skills: ${requiredSkills.join(', ')}`);
    if (preferredSkills.length) contextLines.push(`Preferred skills: ${preferredSkills.join(', ')}`);

    const expParts = [];
    if (job.experience_min != null) expParts.push(`${job.experience_min}`);
    if (job.experience_max != null) expParts.push(`${job.experience_max}`);
    if (expParts.length) contextLines.push(`Experience required: ${expParts.join('–')} years`);

    if (job.description) {
      contextLines.push(`\nJob description:\n${job.description.slice(0, 1200)}`);
    }
  }

  // ── Inject prepared JD assets ─────────────────────────────────────────────
  if (assets) {
    // Recruiter brief — compact plain-English summary of what matters in this role
    if (assets.recruiterBrief && typeof assets.recruiterBrief === 'string') {
      contextLines.push(`\nRecruiter brief (plain-English role summary):\n${assets.recruiterBrief.slice(0, 800)}`);
    }

    // Phone screening questions — ideal answers are goldmines for MCQ generation
    const phoneQs = assets.reachoutMaterial?.questions?.phoneScreening;
    if (Array.isArray(phoneQs) && phoneQs.length > 0) {
      const qBlock = phoneQs.slice(0, 8).map((q, i) =>
        `Q${i + 1}: ${q.question}\nIdeal answer: ${q.idealAnswer || ''}${q.explanation ? `\nWhy it matters: ${q.explanation}` : ''}`
      ).join('\n\n');
      contextLines.push(`\nPhone screening questions prepared for this role (use these as inspiration for MCQ topics and depth):\n${qBlock}`);
    }

    // Formatted JD — grab the first 600 chars for role responsibilities
    if (assets.formattedJD && typeof assets.formattedJD === 'string' && !assets.recruiterBrief) {
      contextLines.push(`\nRole overview:\n${assets.formattedJD.slice(0, 600)}`);
    }
  }

  const contextBlock = contextLines.length > 0 ? contextLines.join('\n') : 'General technical assessment.';
  const topicLine    = topic ? `Focus specifically on the topic: ${topic}.` : 'Cover a broad mix of relevant topics based on the role context.';
  const diffLine     = difficulty === 'mixed'
    ? 'Mix difficulties: roughly 30% easy, 50% medium, 20% hard — vary the difficulty field per question.'
    : `All questions should be of "${difficulty}" difficulty.`;

  const prompt = `You are an expert technical assessment designer creating MCQ questions for a recruiter platform.

Role context:
${contextBlock}

${topicLine}
${diffLine}

Generate exactly ${count} multiple-choice questions. Each question must have exactly 4 options (A, B, C, D), one correct answer, and a brief explanation.

Return ONLY a valid JSON array with no markdown fences, no preamble, no trailing text:
[
  {
    "question_text": "string",
    "options": [
      {"id": "A", "text": "option text"},
      {"id": "B", "text": "option text"},
      {"id": "C", "text": "option text"},
      {"id": "D", "text": "option text"}
    ],
    "correct_option": "A",
    "explanation": "brief explanation of why the answer is correct",
    "topic": "specific topic name",
    "difficulty": "easy|medium|hard"
  }
]`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw       = message.content[0].text;
    const generated = parseJSON(raw);

    if (!Array.isArray(generated) || generated.length === 0) {
      throw new Error('AI returned an invalid or empty question array.');
    }

    // Get current max order_num
    const maxRow    = db.prepare('SELECT MAX(order_num) AS m FROM assessment_questions WHERE assessment_id = ?').get(req.params.id);
    let   nextOrder = (maxRow?.m ?? -1) + 1;

    const insertQ = db.prepare(
      `INSERT INTO assessment_questions
         (assessment_id, question_text, options, correct_option, explanation, topic, difficulty, order_num)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertedIds = [];
    const insertMany  = db.transaction((qs) => {
      qs.forEach(q => {
        const result = insertQ.run(
          req.params.id,
          q.question_text   || '',
          JSON.stringify(Array.isArray(q.options) ? q.options : []),
          q.correct_option  || 'A',
          q.explanation     || null,
          q.topic           || topic || null,
          ['easy','medium','hard'].includes(q.difficulty) ? q.difficulty : (difficulty === 'mixed' ? 'medium' : difficulty),
          nextOrder++,
        );
        insertedIds.push(result.lastInsertRowid);
      });
    });
    insertMany(generated);

    const questions = insertedIds.map(id => {
      const q = db.prepare('SELECT * FROM assessment_questions WHERE id = ?').get(id);
      return { ...q, options: parseJSON(q.options) || [] };
    });

    res.status(201).json({ questions, generated_count: questions.length, context_used: assetsSource || (job ? 'job_only' : 'none') });
  } catch (err) {
    console.error('[Assessments] AI generate error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate questions.' });
  }
});

// ── Candidate Invitations ─────────────────────────────────────────────────────

// POST /assessments/:id/invite — invite candidate(s)
router.post('/:id/invite', (req, res) => {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const { candidates, job_title } = req.body;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: 'candidates array is required.' });
  }

  const insertInvite = db.prepare(
    `INSERT INTO assessment_invites
       (assessment_id, candidate_id, candidate_name, candidate_email, token)
     VALUES (?, ?, ?, ?, ?)`
  );

  const invites = [];

  const insertAll = db.transaction((cands) => {
    cands.forEach(c => {
      if (!c.name?.trim() || !c.email?.trim()) return;
      const token = crypto.randomBytes(16).toString('hex');
      const result = insertInvite.run(
        req.params.id,
        c.candidate_id || null,
        c.name.trim(),
        c.email.trim().toLowerCase(),
        token,
      );
      const invite = db.prepare('SELECT * FROM assessment_invites WHERE id = ?').get(result.lastInsertRowid);
      invites.push({
        ...invite,
        link: `${clientUrl()}/assessment?token=${token}`,
      });
    });
  });
  insertAll(candidates);

  res.status(201).json({ invites });

  // Send invite emails in background — don't block the response
  const recruiter = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
  const recruiterName = recruiter?.display_name || 'Your Recruiter';

  for (const inv of invites) {
    const html = buildInviteEmail({
      candidateName:  inv.candidate_name,
      recruiterName,
      assessmentType: 'MCQ assessment',
      jobTitle:       job_title || '',
      timeLimitMin:   assessment.time_limit_min || 30,
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
    }).catch(err => console.error(`[MCQ Invite] Email to ${inv.candidate_email} failed:`, err.message));
  }
});

// POST /assessments/:id/invites/:inviteId/resend — resend invite email
router.post('/:id/invites/:inviteId/resend', async (req, res) => {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const invite = db.prepare('SELECT * FROM assessment_invites WHERE id = ? AND assessment_id = ?').get(req.params.inviteId, req.params.id);
  if (!invite) return res.status(404).json({ error: 'Invite not found.' });

  const link = `${clientUrl()}/assessment?token=${invite.token}`;
  try {
    const recruiter = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
    const recruiterName = recruiter?.display_name || 'Your Recruiter';
    const jobRow = assessment.job_id
      ? db.prepare('SELECT title FROM jobs WHERE id = ?').get(assessment.job_id)
      : null;
    const html = buildInviteEmail({
      candidateName:  invite.candidate_name,
      recruiterName,
      assessmentType: 'MCQ assessment',
      jobTitle:       jobRow?.title || '',
      timeLimitMin:   assessment.time_limit_min || 30,
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
    console.error(`[MCQ Resend] Email to ${invite.candidate_email} failed:`, err.message);
    res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
  }
});

// ── Results ───────────────────────────────────────────────────────────────────

// GET /assessments/:id/results — all submissions for this assessment
router.get('/:id/results', (req, res) => {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!assessment) return res.status(404).json({ error: 'Not found.' });

  const submissions = db.prepare(`
    SELECT s.*,
           i.candidate_name,
           i.candidate_email,
           i.token,
           i.status          AS invite_status,
           i.invited_at,
           i.started_at,
           i.completed_at
    FROM assessment_submissions s
    JOIN assessment_invites i ON i.id = s.invite_id
    WHERE s.assessment_id = ?
    ORDER BY s.submitted_at DESC
  `).all(req.params.id).map(row => ({
    ...row,
    ai_evaluation: row.ai_evaluation ? parseJSON(row.ai_evaluation) : null,
    passed:        row.score != null ? row.score >= assessment.pass_score : null,
  }));

  res.json({ assessment, submissions });
});

module.exports = router;
