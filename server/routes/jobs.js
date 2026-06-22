const express   = require('express');
const router    = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { db }    = require('../db');
const auth      = require('../middleware/auth');
const { requireCapability } = require('../middleware/permissions');
const { logActivity } = require('../utils/activity');

const anthropic = new Anthropic();

router.use(auth);

// Helper — fetch all assignees on a job, joined with user display info.
function getAssignees(jobId) {
  return db.prepare(`
    SELECT ja.id, ja.user_id, ja.role_on_job, ja.assigned_at, ja.assigned_by,
           u.display_name, u.email, u.role AS user_role
    FROM job_assignees ja
    JOIN users u ON u.id = ja.user_id
    WHERE ja.job_id = ?
    ORDER BY CASE ja.role_on_job WHEN 'lead' THEN 0 WHEN 'collaborator' THEN 1 ELSE 2 END, ja.assigned_at ASC
  `).all(jobId);
}

// Helper — fetch hiring managers attached to a job, joined with user info.
function getHiringManagers(jobId) {
  return db.prepare(`
    SELECT jhm.id, jhm.user_id, jhm.added_at, jhm.added_by,
           u.display_name, u.email
    FROM job_hiring_managers jhm
    JOIN users u ON u.id = jhm.user_id
    WHERE jhm.job_id = ?
    ORDER BY jhm.added_at ASC
  `).all(jobId);
}

function parseJob(j) {
  return {
    ...j,
    required_skills:  JSON.parse(j.required_skills  || '[]'),
    preferred_skills: JSON.parse(j.preferred_skills || '[]'),
    is_qualified:     j.is_qualified ? true : false,
  };
}

// GET /jobs — list jobs for the current user's company
//   ?assigned_to=me  → only jobs the caller is an assignee on
//   ?status=active   → filter by status
//   ?search=...      → match on title / client / location
router.get('/', (req, res) => {
  const { status, search, assigned_to } = req.query;
  const params = [req.user.company_id];
  let cond = '';

  if (assigned_to === 'me') {
    cond += ` AND EXISTS (SELECT 1 FROM job_assignees ja
                          WHERE ja.job_id = j.id AND ja.user_id = ?)`;
    params.push(req.user.id);
  }
  // Hiring Managers only see jobs they're explicitly attached to.
  if (req.user.role === 'hiring_manager') {
    cond += ` AND EXISTS (SELECT 1 FROM job_hiring_managers jhm
                          WHERE jhm.job_id = j.id AND jhm.user_id = ?)`;
    params.push(req.user.id);
  }
  if (status && status !== 'all') { cond += ' AND j.status = ?'; params.push(status); }
  if (search) {
    cond += ' AND (j.title LIKE ? OR j.client_name LIKE ? OR j.location LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM jobs j WHERE j.company_id = ?${cond}`).get(...params).n;

  let q = `
    SELECT j.*,
           lead_user.display_name AS lead_name,
           lead_user.id           AS lead_user_id
    FROM jobs j
    LEFT JOIN job_assignees ja_lead
      ON ja_lead.job_id = j.id AND ja_lead.role_on_job = 'lead'
    LEFT JOIN users lead_user ON lead_user.id = ja_lead.user_id
    WHERE j.company_id = ?${cond}
    ORDER BY j.created_at DESC`;

  // Pagination is opt-in: callers that pass ?limit get a page; others get all
  // jobs (preserves existing behaviour for internal callers).
  const qParams = [...params];
  let page = 1, limit = null;
  if (req.query.limit != null) {
    limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
    q += ' LIMIT ? OFFSET ?';
    qParams.push(limit, (page - 1) * limit);
  }

  const jobs = db.prepare(q).all(...qParams);
  res.json({ jobs: jobs.map(parseJob), total, page, limit: limit ?? total });
});

// GET /jobs/:id
router.get('/:id', (req, res) => {
  const job = db.prepare(
    'SELECT * FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  // HMs may only see jobs they're attached to.
  if (req.user.role === 'hiring_manager') {
    const attached = db.prepare(
      'SELECT 1 FROM job_hiring_managers WHERE job_id = ? AND user_id = ?'
    ).get(job.id, req.user.id);
    if (!attached) return res.status(404).json({ error: 'Job not found.' });
  }

  res.json({ ...parseJob(job), assignees: getAssignees(job.id) });
});

// POST /jobs — create
router.post('/', requireCapability('jobs.create'), (req, res) => {
  const {
    title, department, client_name, location, employment_type,
    description, experience_min, experience_max, salary_min, salary_max,
    openings_count, required_skills, preferred_skills, status,
  } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });

  // Create job + auto-assign the creator as the Lead in one transaction so
  // every job always has at least one assignee row.
  const newJobId = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO jobs
        (user_id, company_id, title, department, client_name, location, employment_type,
         description, experience_min, experience_max, salary_min, salary_max,
         openings_count, required_skills, preferred_skills, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      req.user.id,
      req.user.company_id,
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
    const jobId = result.lastInsertRowid;
    db.prepare(
      `INSERT INTO job_assignees (job_id, user_id, role_on_job, assigned_by)
       VALUES (?, ?, 'lead', ?)`
    ).run(jobId, req.user.id, req.user.id);
    return jobId;
  })();

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(newJobId);
  logActivity(req, 'job.create', 'job', newJobId, { title: job.title, client: job.client_name });
  res.status(201).json({ ...parseJob(job), assignees: getAssignees(newJobId) });
});

// PUT /jobs/:id — full update
router.put('/:id', requireCapability('jobs.update'), (req, res) => {
  const existing = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
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
  logActivity(req, 'job.update', 'job', job.id, { title: job.title });
  res.json(parseJob(job));
});

// POST /jobs/:id/qualification-questions — AI-generate HM clarification questions
router.post('/:id/qualification-questions', async (req, res) => {
  const job = db.prepare(
    'SELECT * FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
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
  const job = db.prepare(
    'SELECT * FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
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

// GET /jobs/:id/matched-candidates — score this company's candidates against this job
router.get('/:id/matched-candidates', (req, res) => {
  const job = db.prepare(
    'SELECT * FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  const reqSkills  = JSON.parse(job.required_skills  || '[]').map(s => s.toLowerCase());
  const prefSkills = JSON.parse(job.preferred_skills || '[]').map(s => s.toLowerCase());
  const expMin     = job.experience_min;
  const expMax     = job.experience_max;

  const candidates = db.prepare(
    "SELECT * FROM candidates WHERE status = 'active' AND company_id = ?"
  ).all(req.user.company_id);

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
  const job = db.prepare(
    'SELECT id, title FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
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

// ── Assignees ────────────────────────────────────────────────────────────────

// GET /jobs/:id/assignees — anyone in the company can read
router.get('/:id/assignees', (req, res) => {
  const job = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ assignees: getAssignees(job.id) });
});

// POST /jobs/:id/assignees — owner or team_lead only
router.post('/:id/assignees', requireCapability('jobs.assign'), (req, res) => {
  const { user_id, role_on_job } = req.body;
  if (!user_id || !role_on_job) {
    return res.status(400).json({ error: 'user_id and role_on_job are required.' });
  }
  const allowed = ['lead', 'collaborator', 'sourcer'];
  if (!allowed.includes(role_on_job)) {
    return res.status(400).json({ error: `role_on_job must be one of ${allowed.join(', ')}.` });
  }

  const job = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  // Target user must belong to the same company.
  const target = db.prepare(
    'SELECT id FROM users WHERE id = ? AND company_id = ?'
  ).get(user_id, req.user.company_id);
  if (!target) return res.status(400).json({ error: 'Target user is not in your company.' });

  try {
    db.transaction(() => {
      // Promotion to 'lead' is exclusive — demote any existing lead first.
      if (role_on_job === 'lead') {
        db.prepare(
          `UPDATE job_assignees SET role_on_job = 'collaborator'
           WHERE job_id = ? AND role_on_job = 'lead' AND user_id != ?`
        ).run(job.id, user_id);
      }
      db.prepare(
        `INSERT INTO job_assignees (job_id, user_id, role_on_job, assigned_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(job_id, user_id)
         DO UPDATE SET role_on_job = excluded.role_on_job, assigned_by = excluded.assigned_by`
      ).run(job.id, user_id, role_on_job, req.user.id);
    })();
    logActivity(req, 'job.assignee.add', 'job', job.id, { user_id, role_on_job });
    res.json({ assignees: getAssignees(job.id) });
  } catch (err) {
    console.error('jobs/assignees POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /jobs/:id/assignees/:userId — owner or team_lead only
router.delete('/:id/assignees/:userId', requireCapability('jobs.assign'), (req, res) => {
  const job = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  // A job must always retain at least one assignee — so refuse to remove the
  // last one (typical enterprise ATS behaviour).
  const remaining = db.prepare(
    'SELECT COUNT(*) AS n FROM job_assignees WHERE job_id = ?'
  ).get(job.id).n;
  if (remaining <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last assignee. Add another first.' });
  }

  db.prepare(
    'DELETE FROM job_assignees WHERE job_id = ? AND user_id = ?'
  ).run(job.id, req.params.userId);
  logActivity(req, 'job.assignee.remove', 'job', job.id, { user_id: Number(req.params.userId) });
  res.json({ assignees: getAssignees(job.id) });
});

// ── Hiring Managers (external stakeholders) ─────────────────────────────────

// GET /jobs/:id/hiring-managers — visible to anyone in the company
router.get('/:id/hiring-managers', (req, res) => {
  const job = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ hiring_managers: getHiringManagers(job.id) });
});

// POST /jobs/:id/hiring-managers — owner / team_lead only
router.post('/:id/hiring-managers', requireCapability('jobs.assign'), (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required.' });

  const job = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  // Target must be a hiring_manager in the same company.
  const target = db.prepare(
    `SELECT id, role FROM users WHERE id = ? AND company_id = ?`
  ).get(user_id, req.user.company_id);
  if (!target) return res.status(400).json({ error: 'Target user is not in your company.' });
  if (target.role !== 'hiring_manager') {
    return res.status(400).json({ error: 'Target user is not a Hiring Manager.' });
  }

  try {
    db.prepare(
      `INSERT INTO job_hiring_managers (job_id, user_id, added_by)
       VALUES (?, ?, ?)
       ON CONFLICT(job_id, user_id) DO NOTHING`
    ).run(job.id, user_id, req.user.id);
    logActivity(req, 'job.hm.attach', 'job', job.id, { user_id });
    res.json({ hiring_managers: getHiringManagers(job.id) });
  } catch (err) {
    console.error('jobs/hiring-managers POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /jobs/:id/hm-feedback — read all HM feedback for candidates on this job.
// Visible to anyone in the company (recruiters need to see what stakeholders said).
router.get('/:id/hm-feedback', (req, res) => {
  const job = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  const rows = db.prepare(`
    SELECT
      hcf.id, hcf.candidate_id, hcf.recommendation, hcf.notes,
      hcf.submitted_at, hcf.updated_at,
      hm.id           AS hm_user_id,
      hm.display_name AS hm_display_name,
      hm.email        AS hm_email,
      c.name          AS candidate_name,
      c.current_title AS candidate_title
    FROM hm_candidate_feedback hcf
    JOIN users      hm ON hm.id = hcf.hm_user_id
    JOIN candidates c  ON c.id  = hcf.candidate_id
    WHERE hcf.job_id = ?
    ORDER BY hcf.updated_at DESC
  `).all(job.id);

  res.json({ feedback: rows });
});

// DELETE /jobs/:id/hiring-managers/:userId — owner / team_lead only
router.delete('/:id/hiring-managers/:userId', requireCapability('jobs.assign'), (req, res) => {
  const job = db.prepare(
    'SELECT id FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  db.prepare(
    'DELETE FROM job_hiring_managers WHERE job_id = ? AND user_id = ?'
  ).run(job.id, req.params.userId);
  logActivity(req, 'job.hm.detach', 'job', job.id, { user_id: Number(req.params.userId) });
  res.json({ hiring_managers: getHiringManagers(job.id) });
});

// DELETE /jobs/:id
router.delete('/:id', requireCapability('jobs.delete'), (req, res) => {
  const existing = db.prepare(
    'SELECT id, title FROM jobs WHERE id = ? AND company_id = ?'
  ).get(req.params.id, req.user.company_id);
  if (!existing) return res.status(404).json({ error: 'Job not found.' });
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  logActivity(req, 'job.delete', 'job', existing.id, { title: existing.title });
  res.json({ ok: true });
});

module.exports = router;
