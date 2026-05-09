/**
 * server/routes/hm.js
 *
 * Hiring Manager portal — endpoints used by the external HM-facing UI.
 * Every route is gated to role=hiring_manager and only ever returns rows
 * tied to jobs the caller is explicitly attached to via job_hiring_managers.
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../db');
const auth    = require('../middleware/auth');
const { requireRole } = require('../middleware/permissions');
const { logActivity } = require('../utils/activity');

router.use(auth);
router.use(requireRole('hiring_manager'));

// Helper — confirm caller is attached to the given job, return job or null.
function getAttachedJob(jobId, hmUserId, companyId) {
  return db.prepare(`
    SELECT j.*
    FROM jobs j
    JOIN job_hiring_managers jhm ON jhm.job_id = j.id AND jhm.user_id = ?
    WHERE j.id = ? AND j.company_id = ?
  `).get(hmUserId, jobId, companyId);
}

// GET /hm/jobs — every job this HM is attached to
router.get('/jobs', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.id, j.title, j.client_name, j.location, j.employment_type,
           j.experience_min, j.experience_max, j.salary_min, j.salary_max,
           j.openings_count, j.status, j.created_at,
           j.required_skills, j.preferred_skills,
           jhm.added_at
    FROM jobs j
    JOIN job_hiring_managers jhm ON jhm.job_id = j.id AND jhm.user_id = ?
    WHERE j.company_id = ?
    ORDER BY jhm.added_at DESC
  `).all(req.user.id, req.user.company_id);

  res.json({
    jobs: jobs.map(j => ({
      ...j,
      required_skills:  JSON.parse(j.required_skills  || '[]'),
      preferred_skills: JSON.parse(j.preferred_skills || '[]'),
    })),
  });
});

// GET /hm/jobs/:jobId — single job, scoped to attachment
router.get('/jobs/:jobId', (req, res) => {
  const job = getAttachedJob(req.params.jobId, req.user.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found or not assigned to you.' });
  res.json({
    job: {
      ...job,
      required_skills:  JSON.parse(job.required_skills  || '[]'),
      preferred_skills: JSON.parse(job.preferred_skills || '[]'),
    },
  });
});

// GET /hm/jobs/:jobId/candidates
//   Returns candidates that have at least passed screening on a session
//   linked to this job. HM never sees Step 3 / pending / failed candidates.
router.get('/jobs/:jobId/candidates', (req, res) => {
  const job = getAttachedJob(req.params.jobId, req.user.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found or not assigned to you.' });

  const rows = db.prepare(`
    SELECT
      c.id, c.name, c.email, c.current_title, c.current_company,
      c.experience_years, c.location,
      sc.match_percentage, sc.screening_status,
      sc.ai_interview_score, sc.vi_review,
      sc.decision, sc.pipeline_status, sc.added_at, sc.selected_at,
      hcf.recommendation AS hm_recommendation,
      hcf.notes          AS hm_notes,
      hcf.submitted_at   AS hm_submitted_at,
      hcf.updated_at     AS hm_updated_at
    FROM session_candidates sc
    JOIN sessions s   ON s.id = sc.session_id
    JOIN candidates c ON c.id = sc.candidate_id
    LEFT JOIN hm_candidate_feedback hcf
      ON hcf.job_id = s.job_id AND hcf.candidate_id = c.id AND hcf.hm_user_id = ?
    WHERE s.job_id = ?
      AND sc.screening_status IN ('pass','on_hold')
    ORDER BY
      CASE sc.pipeline_status WHEN 'selected' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
      sc.added_at DESC
  `).all(req.user.id, job.id);

  res.json({ candidates: rows });
});

// POST /hm/jobs/:jobId/candidates/:candidateId/feedback
router.post('/jobs/:jobId/candidates/:candidateId/feedback', (req, res) => {
  const job = getAttachedJob(req.params.jobId, req.user.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found or not assigned to you.' });

  const { recommendation, notes } = req.body;
  const allowed = ['strong_yes', 'yes', 'maybe', 'no', 'strong_no'];
  if (recommendation && !allowed.includes(recommendation)) {
    return res.status(400).json({ error: `recommendation must be one of: ${allowed.join(', ')}.` });
  }

  // Candidate must actually be tied to this job via a session that's
  // progressed past screening.
  const row = db.prepare(`
    SELECT 1
    FROM session_candidates sc
    JOIN sessions s ON s.id = sc.session_id
    WHERE s.job_id = ? AND sc.candidate_id = ? AND sc.screening_status IN ('pass','on_hold')
    LIMIT 1
  `).get(job.id, req.params.candidateId);
  if (!row) return res.status(400).json({ error: 'Candidate is not on the shortlist for this job.' });

  db.prepare(`
    INSERT INTO hm_candidate_feedback (job_id, candidate_id, hm_user_id, recommendation, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(job_id, candidate_id, hm_user_id)
    DO UPDATE SET recommendation = excluded.recommendation,
                  notes          = excluded.notes,
                  updated_at     = datetime('now')
  `).run(job.id, req.params.candidateId, req.user.id, recommendation || null, notes || null);

  const fb = db.prepare(`
    SELECT recommendation, notes, submitted_at, updated_at
    FROM hm_candidate_feedback
    WHERE job_id = ? AND candidate_id = ? AND hm_user_id = ?
  `).get(job.id, req.params.candidateId, req.user.id);

  logActivity(req, 'hm.feedback.submit', 'candidate', Number(req.params.candidateId), {
    job_id: job.id, recommendation: recommendation || null,
  });

  res.json({ feedback: fb });
});

module.exports = router;
