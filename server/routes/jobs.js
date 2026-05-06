const express   = require('express');
const router    = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { db }    = require('../db');
const auth      = require('../middleware/auth');

const anthropic = new Anthropic();

router.use(auth);

function parseJob(j) {
  return {
    ...j,
    required_skills:  JSON.parse(j.required_skills  || '[]'),
    preferred_skills: JSON.parse(j.preferred_skills || '[]'),
    is_qualified:     j.is_qualified ? true : false,
  };
}

// GET /jobs — list all jobs (shared across users)
router.get('/', (req, res) => {
  const { status, search } = req.query;
  let q = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (status && status !== 'all') { q += ' AND status = ?'; params.push(status); }
  if (search) {
    q += ' AND (title LIKE ? OR client_name LIKE ? OR location LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  q += ' ORDER BY created_at DESC';

  const jobs = db.prepare(q).all(...params);
  res.json({ jobs: jobs.map(parseJob) });
});

// GET /jobs/:id
router.get('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json(parseJob(job));
});

// POST /jobs — create
router.post('/', (req, res) => {
  const {
    title, department, client_name, location, employment_type,
    description, experience_min, experience_max, salary_min, salary_max,
    openings_count, required_skills, preferred_skills, status,
  } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });

  const result = db.prepare(`
    INSERT INTO jobs
      (user_id, title, department, client_name, location, employment_type,
       description, experience_min, experience_max, salary_min, salary_max,
       openings_count, required_skills, preferred_skills, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id,
    title.trim(),
    department    || null,
    client_name   || null,
    location      || null,
    employment_type || 'Full-time',
    description   || null,
    experience_min != null ? Number(experience_min) : null,
    experience_max != null ? Number(experience_max) : null,
    salary_min     != null ? Number(salary_min)     : null,
    salary_max     != null ? Number(salary_max)     : null,
    openings_count != null ? Number(openings_count) : 1,
    JSON.stringify(Array.isArray(required_skills)  ? required_skills  : []),
    JSON.stringify(Array.isArray(preferred_skills) ? preferred_skills : []),
    status || 'active',
  );

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseJob(job));
});

// PUT /jobs/:id — full update
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found.' });

  const {
    title, department, client_name, location, employment_type,
    description, experience_min, experience_max, salary_min, salary_max,
    openings_count, required_skills, preferred_skills, status,
  } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });

  db.prepare(`
    UPDATE jobs SET
      title=?, department=?, client_name=?, location=?, employment_type=?,
      description=?, experience_min=?, experience_max=?, salary_min=?, salary_max=?,
      openings_count=?, required_skills=?, preferred_skills=?, status=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    title.trim(),
    department    || null,
    client_name   || null,
    location      || null,
    employment_type || 'Full-time',
    description   || null,
    experience_min != null ? Number(experience_min) : null,
    experience_max != null ? Number(experience_max) : null,
    salary_min     != null ? Number(salary_min)     : null,
    salary_max     != null ? Number(salary_max)     : null,
    openings_count != null ? Number(openings_count) : 1,
    JSON.stringify(Array.isArray(required_skills)  ? required_skills  : []),
    JSON.stringify(Array.isArray(preferred_skills) ? preferred_skills : []),
    status || 'active',
    req.params.id,
  );

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  res.json(parseJob(job));
});

// POST /jobs/:id/qualification-questions — AI-generate HM clarification questions
router.post('/:id/qualification-questions', async (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  const { regenerateIndex, existingQuestions } = req.body;
  const reqSkills  = JSON.parse(job.required_skills  || '[]');
  const isRegen    = regenerateIndex !== undefined && regenerateIndex !== null;

  const prompt = isRegen
    ? `You are a recruitment expert. A recruiter is conducting a Hiring Manager intake for:
Job Title: ${job.title} | Client: ${job.client_name || ''} | Required Skills: ${reqSkills.join(', ')}
Description: ${job.description || ''}

Generate 1 alternative replacement for question #${regenerateIndex + 1}: "${existingQuestions?.[regenerateIndex] || ''}"
It must be different, specific, open-ended, and help the recruiter understand the requirement more deeply.
Return a JSON array with exactly one string.`
    : `You are a recruitment expert. Generate 8 structured clarification questions for a recruiter to ask a Hiring Manager during a job intake call.

Job Title: ${job.title}
Client: ${job.client_name || ''} | Department: ${job.department || ''} | Location: ${job.location || ''}
Experience: ${job.experience_min || ''}–${job.experience_max || ''} years
Required Skills: ${reqSkills.join(', ')}
Description: ${job.description || ''}

Questions must:
- Be specific and open-ended (not yes/no)
- Cover: must-have vs. nice-to-have skills, team structure, success metrics, red flags, urgency, interview process
- Sound natural in a recruiter–HM conversation

Return a JSON array of 8 question strings only. No other text or markdown.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    let questions;
    try { questions = JSON.parse(raw); }
    catch {
      const matches = raw.match(/"([^"\n]{10,})"/g);
      questions = matches ? matches.map(s => s.slice(1, -1)) : [];
    }

    if (isRegen) {
      res.json({ question: Array.isArray(questions) ? (questions[0] || '') : '' });
    } else {
      res.json({ questions: (questions || []).map(q => ({ question: q, answer: '' })) });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /jobs/:id/qualify — mark job as qualified, save Q&A, trigger JD asset refresh
router.patch('/:id/qualify', async (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  const { qa } = req.body;

  db.prepare(
    `UPDATE jobs SET is_qualified = 1, qualification_qa = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(qa ? JSON.stringify(qa) : null, req.params.id);

  res.json({ ok: true });

  // Async JD asset refresh — don't block response
  if (qa?.length) {
    triggerJDRefresh(job, qa, req.user.id).catch(e =>
      console.error('[qualify] JD refresh failed:', e.message)
    );
  }
});

async function triggerJDRefresh(job, qa, userId) {
  const reqSkills = JSON.parse(job.required_skills || '[]');
  const qaText    = qa.filter(q => q.answer?.trim())
    .map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n');

  const prompt = `You are an expert recruitment consultant. Enhance the following job description using the HM clarification answers provided. Return a JSON object with these fields:
{
  "formattedJD": "full formatted JD as markdown",
  "recruiterBrief": "internal recruiter brief",
  "sourcingKeywords": { "primaryKeywords": [], "secondaryKeywords": [], "booleanStrings": [], "skillOnlyBooleanStrings": [], "exclusions": [] },
  "reachoutMaterial": { "emailSubject": "", "emailBody": "", "linkedinMessage": "", "whatsappMessage": "" },
  "clarificationQuestions": []
}

JOB DETAILS:
Title: ${job.title} | Client: ${job.client_name || ''} | Location: ${job.location || ''}
Experience: ${job.experience_min || ''}–${job.experience_max || ''} years
Required Skills: ${reqSkills.join(', ')}
Description: ${job.description || ''}

HM CLARIFICATION Q&A:
${qaText}

No markdown code fences in your response.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  let result;
  try { result = JSON.parse(raw); }
  catch {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s !== -1 && e > s) result = JSON.parse(raw.slice(s, e + 1));
    else return;
  }

  db.prepare(
    `INSERT INTO jd_enhancements (user_id, title, jd_input, client_notes, results)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    userId,
    `${job.title} — Post-Qualification Refresh`,
    job.description || '',
    `Qualification Q&A:\n${qaText}`,
    JSON.stringify(result),
  );
  console.log(`[qualify] JD assets refreshed for job ${job.id}`);
}

// GET /jobs/:id/matched-candidates — score all active candidates against this job
router.get('/:id/matched-candidates', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  const reqSkills  = JSON.parse(job.required_skills  || '[]').map(s => s.toLowerCase());
  const prefSkills = JSON.parse(job.preferred_skills || '[]').map(s => s.toLowerCase());
  const expMin     = job.experience_min;
  const expMax     = job.experience_max;

  const candidates = db.prepare("SELECT * FROM candidates WHERE status = 'active'").all();

  const scored = candidates.map(c => {
    const candSkills = JSON.parse(c.skills || '[]').map(s => s.toLowerCase());

    // Skill matching — partial substring match for flexibility
    const matchSkill = (jobSkill, cs) =>
      cs.some(s => s.includes(jobSkill) || jobSkill.includes(s));

    const matchedReq  = reqSkills.filter(s  => matchSkill(s, candSkills));
    const matchedPref = prefSkills.filter(s => matchSkill(s, candSkills));

    const reqScore  = reqSkills.length  > 0 ? matchedReq.length  / reqSkills.length  : 1;
    const prefScore = prefSkills.length > 0 ? matchedPref.length / prefSkills.length : 1;

    // Experience score
    const exp = c.experience_years || 0;
    let expScore = 1;
    if (expMin != null && exp < expMin) expScore = Math.max(0, 1 - (expMin - exp) / Math.max(expMin, 1));
    if (expMax != null && exp > expMax + 2) expScore = Math.max(0.5, 1 - (exp - expMax) / Math.max(expMax, 1));

    const totalScore = Math.round((reqScore * 0.65 + prefScore * 0.15 + expScore * 0.20) * 100);

    return {
      id:               c.id,
      name:             c.name,
      email:            c.email,
      phone:            c.phone,
      location:         c.location,
      current_title:    c.current_title,
      current_company:  c.current_company,
      experience_years: c.experience_years,
      skills:           JSON.parse(c.skills || '[]'),
      education:        c.education,
      match_score:      totalScore,
      matched_required: matchedReq,
      matched_preferred: matchedPref,
    };
  });

  const results = scored
    .filter(c => c.match_score >= 25)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 40);

  res.json({ candidates: results, total_pool: candidates.length });
});

// GET /jobs/:id/enhancement — most recent saved JD Enhancer assets for this job
router.get('/:id/enhancement', (req, res) => {
  const job = db.prepare('SELECT id, title FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  // 1. Pipeline session enhancement (most reliable — has explicit job_id)
  const session = db.prepare(`
    SELECT enhancement_data, updated_at
    FROM sessions
    WHERE job_id = ? AND enhancement_saved = 1 AND enhancement_data IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(req.params.id);

  if (session?.enhancement_data) {
    let enhancement = null;
    try { enhancement = JSON.parse(session.enhancement_data); } catch (_) {}
    if (enhancement) return res.json({ enhancement, source: 'session', generated_at: session.updated_at });
  }

  // 2. Standalone JD Enhancer save linked by job_id
  const jdeById = db.prepare(`
    SELECT results, updated_at
    FROM jd_enhancements
    WHERE job_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(req.params.id);

  if (jdeById?.results) {
    let enhancement = null;
    try { enhancement = JSON.parse(jdeById.results); } catch (_) {}
    if (enhancement) return res.json({ enhancement, source: 'jde', generated_at: jdeById.updated_at });
  }

  // 3. Fallback: match by title (for enhancements saved before job_id tracking was added)
  const jdeByTitle = db.prepare(`
    SELECT results, updated_at
    FROM jd_enhancements
    WHERE LOWER(title) = LOWER(?)
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(job.title);

  if (jdeByTitle?.results) {
    let enhancement = null;
    try { enhancement = JSON.parse(jdeByTitle.results); } catch (_) {}
    if (enhancement) return res.json({ enhancement, source: 'jde_title', generated_at: jdeByTitle.updated_at });
  }

  res.json({ enhancement: null });
});

// DELETE /jobs/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found.' });
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
