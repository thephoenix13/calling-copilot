const express = require('express');
const router = express.Router();
const { db } = require('../db');
const auth = require('../middleware/auth');

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

// PATCH /jobs/:id/qualify — mark job as qualified
router.patch('/:id/qualify', (req, res) => {
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found.' });
  db.prepare(`UPDATE jobs SET is_qualified = 1, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// DELETE /jobs/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found.' });
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
