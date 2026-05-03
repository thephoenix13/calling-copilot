const express    = require('express');
const router     = express.Router();
const Anthropic  = require('@anthropic-ai/sdk');
const { db }     = require('../db');
const auth       = require('../middleware/auth');

const anthropic = new Anthropic();

router.use(auth);

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON(raw) {
  if (!raw) return null;
  // Strategy 1: direct parse
  try { return JSON.parse(raw); } catch (_) {}
  // Strategy 2: extract fenced code block
  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) return JSON.parse(fence[1].trim());
  } catch (_) {}
  // Strategy 3: extract first brace-delimited object/array
  try {
    const brace = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (brace) return JSON.parse(brace[1]);
  } catch (_) {}
  return null;
}

function parseSession(s) {
  return {
    ...s,
    enhancement_data: parseJSON(s.enhancement_data),
  };
}

function parseSessionCandidate(sc) {
  return {
    ...sc,
    resume_score: parseJSON(sc.resume_score),
  };
}

function ownershipCheck(sessionId, userId) {
  return db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, userId);
}

// ── Calculate match score ────────────────────────────────────────────────────
// Formula: (matched_req / total_req) * 80 + (matched_pref / total_pref) * 20
// Zero-length arrays: skip that component (treat as 0 weight for that part).
function calcMatchScore(candidateSkills, requiredSkills, preferredSkills) {
  const cSkills = (candidateSkills || []).map(s => s.toLowerCase().trim());

  let score = 0;

  if (requiredSkills && requiredSkills.length > 0) {
    const matched = requiredSkills.filter(s =>
      cSkills.includes(s.toLowerCase().trim())
    ).length;
    score += (matched / requiredSkills.length) * 80;
  }

  if (preferredSkills && preferredSkills.length > 0) {
    const matched = preferredSkills.filter(s =>
      cSkills.includes(s.toLowerCase().trim())
    ).length;
    score += (matched / preferredSkills.length) * 20;
  }

  return Math.round(score * 100) / 100;
}

// ── GET / — list sessions for the authenticated user ────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT
      s.*,
      j.title       AS job_title,
      j.client_name AS job_client,
      (SELECT COUNT(*) FROM session_candidates sc WHERE sc.session_id = s.id) AS candidate_count
    FROM sessions s
    LEFT JOIN jobs j ON j.id = s.job_id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(req.user.id);

  res.json({ sessions: rows.map(parseSession) });
});

// ── POST / — create a new session ───────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, job_id } = req.body;

  const result = db.prepare(`
    INSERT INTO sessions (user_id, job_id, name)
    VALUES (?, ?, ?)
  `).run(req.user.id, job_id || null, name || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ── GET /:id — get full session with job + candidates ───────────────────────
router.get('/:id', (req, res) => {
  const session = db.prepare(`
    SELECT
      s.*,
      j.id               AS job_id,
      j.title            AS job_title,
      j.client_name      AS job_client,
      j.department       AS job_department,
      j.location         AS job_location,
      j.employment_type  AS job_employment_type,
      j.description      AS job_description,
      j.experience_min   AS job_experience_min,
      j.experience_max   AS job_experience_max,
      j.salary_min       AS job_salary_min,
      j.salary_max       AS job_salary_max,
      j.openings_count   AS job_openings_count,
      j.required_skills  AS job_required_skills,
      j.preferred_skills AS job_preferred_skills,
      j.status           AS job_status
    FROM sessions s
    LEFT JOIN jobs j ON j.id = s.job_id
    WHERE s.id = ? AND s.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!session) return res.status(404).json({ error: 'Session not found.' });

  // Build job sub-object
  const job = session.job_title ? {
    id:              session.job_id,
    title:           session.job_title,
    client_name:     session.job_client,
    department:      session.job_department,
    location:        session.job_location,
    employment_type: session.job_employment_type,
    description:     session.job_description,
    experience_min:  session.job_experience_min,
    experience_max:  session.job_experience_max,
    salary_min:      session.job_salary_min,
    salary_max:      session.job_salary_max,
    openings_count:  session.job_openings_count,
    required_skills:  parseJSON(session.job_required_skills)  || [],
    preferred_skills: parseJSON(session.job_preferred_skills) || [],
    status:          session.job_status,
  } : null;

  // Strip the job_ prefixed columns from the session object
  const sessionClean = Object.fromEntries(
    Object.entries(session).filter(([k]) => !k.startsWith('job_'))
  );

  // Fetch session candidates joined with candidate info
  const scRows = db.prepare(`
    SELECT
      sc.*,
      c.name           AS candidate_name,
      c.current_title  AS candidate_title,
      c.skills         AS candidate_skills,
      c.resume_text    AS candidate_resume_text,
      c.email          AS candidate_email,
      c.phone          AS candidate_phone,
      c.location       AS candidate_location,
      c.current_company AS candidate_current_company,
      c.experience_years AS candidate_experience_years
    FROM session_candidates sc
    JOIN candidates c ON c.id = sc.candidate_id
    WHERE sc.session_id = ?
    ORDER BY sc.added_at DESC
  `).all(req.params.id);

  const candidates = scRows.map(sc => ({
    ...parseSessionCandidate(sc),
    candidate_skills: parseJSON(sc.candidate_skills) || [],
  }));

  res.json({
    session: {
      ...parseSession(sessionClean),
      job,
      candidates,
    },
  });
});

// ── PUT /:id — update session fields ────────────────────────────────────────
router.put('/:id', (req, res) => {
  const existing = ownershipCheck(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Session not found.' });

  const allowed = ['name', 'job_id', 'current_step', 'enhancement_data', 'enhancement_saved', 'status', 'vi_interview_id'];
  const sets    = [];
  const values  = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      if (field === 'enhancement_data' && typeof req.body[field] === 'object') {
        values.push(JSON.stringify(req.body[field]));
      } else {
        values.push(req.body[field]);
      }
    }
  }

  if (sets.length === 0) return res.json({ ok: true });

  sets.push(`updated_at = datetime('now')`);
  values.push(req.params.id);

  db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  res.json({ ok: true });
});

// ── DELETE /:id — delete session ────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const existing = ownershipCheck(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Session not found.' });

  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── POST /:id/candidates — add candidates to session ────────────────────────
router.post('/:id/candidates', (req, res) => {
  const session = ownershipCheck(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const { candidate_ids } = req.body;
  if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
    return res.status(400).json({ error: 'candidate_ids must be a non-empty array.' });
  }

  // Fetch the session's job for skill matching
  const sessionRow = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  let requiredSkills  = [];
  let preferredSkills = [];

  if (sessionRow.job_id) {
    const job = db.prepare('SELECT required_skills, preferred_skills FROM jobs WHERE id = ?')
      .get(sessionRow.job_id);
    if (job) {
      requiredSkills  = parseJSON(job.required_skills)  || [];
      preferredSkills = parseJSON(job.preferred_skills) || [];
    }
  }

  const insertSC = db.prepare(`
    INSERT OR IGNORE INTO session_candidates (session_id, candidate_id, match_percentage)
    VALUES (?, ?, ?)
  `);

  const added = [];

  const doInserts = db.transaction(() => {
    for (const cid of candidate_ids) {
      const candidate = db.prepare(
        'SELECT id, name, skills FROM candidates WHERE id = ?'
      ).get(cid);

      if (!candidate) continue;

      const cSkills    = parseJSON(candidate.skills) || [];
      const matchScore = calcMatchScore(cSkills, requiredSkills, preferredSkills);

      const result = insertSC.run(req.params.id, candidate.id, matchScore);

      // Fetch the newly inserted (or existing) row
      const scRow = db.prepare(
        'SELECT * FROM session_candidates WHERE session_id = ? AND candidate_id = ?'
      ).get(req.params.id, candidate.id);

      added.push({
        ...parseSessionCandidate(scRow),
        candidate_name: candidate.name,
      });
    }
  });

  doInserts();

  res.status(201).json({ added });
});

// ── PUT /:id/candidates/:candidateId — update a session_candidate row ───────
// NOTE: :candidateId is the session_candidates.id PK, not the candidate_id FK
router.put('/:id/candidates/:candidateId', (req, res) => {
  const session = ownershipCheck(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const scRow = db.prepare(
    'SELECT id FROM session_candidates WHERE id = ? AND session_id = ?'
  ).get(req.params.candidateId, req.params.id);
  if (!scRow) return res.status(404).json({ error: 'Session candidate not found.' });

  const allowed = [
    'screening_status', 'screening_report_url',
    'ai_interview_score', 'ai_interview_report_url',
    'decision', 'interview_level',
    'email_sent', 'pipeline_status', 'pipeline_feedback',
    'resume_score', 'vi_review',
  ];

  const sets   = [];
  const values = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      if (field === 'resume_score' && typeof req.body[field] === 'object') {
        values.push(JSON.stringify(req.body[field]));
      } else {
        values.push(req.body[field]);
      }
    }
  }

  if (sets.length > 0) {
    values.push(scRow.id);
    db.prepare(`UPDATE session_candidates SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  res.json({ ok: true });
});

// ── DELETE /:id/candidates/:candidateId — remove session_candidate ───────────
router.delete('/:id/candidates/:candidateId', (req, res) => {
  const session = ownershipCheck(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const scRow = db.prepare(
    'SELECT id FROM session_candidates WHERE id = ? AND session_id = ?'
  ).get(req.params.candidateId, req.params.id);
  if (!scRow) return res.status(404).json({ error: 'Session candidate not found.' });

  db.prepare('DELETE FROM session_candidates WHERE id = ?').run(scRow.id);
  res.json({ ok: true });
});

// ── POST /:id/candidates/:candidateId/evaluate — AI resume evaluation ────────
router.post('/:id/candidates/:candidateId/evaluate', async (req, res) => {
  const session = ownershipCheck(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  // :candidateId here is the session_candidates.id PK
  const scRow = db.prepare(
    'SELECT * FROM session_candidates WHERE id = ? AND session_id = ?'
  ).get(req.params.candidateId, req.params.id);
  if (!scRow) return res.status(404).json({ error: 'Session candidate not found.' });

  // Get full candidate record
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?')
    .get(scRow.candidate_id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

  if (!candidate.resume_text || !candidate.resume_text.trim()) {
    return res.json({ score: null, reason: 'No resume text available' });
  }

  // Get session's job
  const sessionRow = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  let jobTitle        = 'Unknown Role';
  let requiredSkills  = [];
  let preferredSkills = [];

  if (sessionRow.job_id) {
    const job = db.prepare('SELECT title, required_skills, preferred_skills FROM jobs WHERE id = ?')
      .get(sessionRow.job_id);
    if (job) {
      jobTitle        = job.title;
      requiredSkills  = parseJSON(job.required_skills)  || [];
      preferredSkills = parseJSON(job.preferred_skills) || [];
    }
  }

  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      temperature: 0.3,
      system: 'You are a resume quality evaluator for Indian recruitment. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Evaluate the following resume against the job requirements and return ONLY valid JSON.

Job Title: ${jobTitle}
Required Skills: ${requiredSkills.join(', ') || 'None specified'}
Preferred Skills: ${preferredSkills.join(', ') || 'None specified'}

Resume:
${candidate.resume_text.slice(0, 5000)}

Return this exact JSON structure:
{
  "overall": <0-100>,
  "contentQuality": <0-100>,
  "aiWritingDetection": <0-100>,
  "experienceLevel": "<junior|mid|senior|lead>",
  "verdict": "<1-2 sentence summary>",
  "strengths": ["<str1>", "<str2>", "<str3>"]
}`,
      }],
    });

    const raw   = message.content[0]?.text || '';
    const score = parseJSON(raw);

    if (!score) {
      return res.status(500).json({ error: 'AI returned unparseable response.' });
    }

    // Persist to session_candidate
    db.prepare('UPDATE session_candidates SET resume_score = ? WHERE id = ?')
      .run(JSON.stringify(score), scRow.id);

    res.json({ score });
  } catch (err) {
    console.error('evaluate error:', err.message);
    res.status(500).json({ error: 'AI evaluation failed. Please try again.' });
  }
});

module.exports = router;
