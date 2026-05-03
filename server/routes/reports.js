const express = require('express');
const router  = express.Router();
const { db }  = require('../db');
const auth    = require('../middleware/auth');

router.use(auth);

function parseJSON(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

router.get('/summary', (req, res) => {
  const uid = req.user.id;

  // ── Overview KPIs ─────────────────────────────────────────────────────────
  const activeJobs      = db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE user_id=? AND status='active'").get(uid).c;
  const totalJobs       = db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE user_id=?").get(uid).c;
  const totalCandidates = db.prepare("SELECT COUNT(*) AS c FROM candidates WHERE user_id=?").get(uid).c;
  const totalSessions   = db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE user_id=?").get(uid).c;
  const totalVI         = db.prepare("SELECT COUNT(*) AS c FROM video_interviews WHERE user_id=?").get(uid).c;
  const totalPofu       = db.prepare("SELECT COUNT(*) AS c FROM pofu_candidates WHERE user_id=?").get(uid).c;

  const callStats = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
           AVG(CASE WHEN duration_sec IS NOT NULL AND duration_sec > 0 THEN duration_sec END) AS avg_duration
    FROM calls WHERE user_id=?
  `).get(uid);

  // ── Pipeline Funnel ───────────────────────────────────────────────────────
  const scAll = db.prepare(`
    SELECT sc.screening_status, sc.decision, sc.pipeline_status,
           sc.vi_invite_sent, sc.vi_review, sc.ai_interview_score, sc.match_percentage
    FROM session_candidates sc
    JOIN sessions s ON s.id = sc.session_id
    WHERE s.user_id = ?
  `).all(uid);

  const funnel = {
    sourced:     scAll.length,
    screenPass:  scAll.filter(r => r.screening_status === 'pass').length,
    screenFail:  scAll.filter(r => r.screening_status === 'fail').length,
    screenPend:  scAll.filter(r => r.screening_status === 'pending').length,
    viInvited:   scAll.filter(r => r.vi_invite_sent).length,
    proceeded:   scAll.filter(r => r.decision === 'proceed').length,
    pooled:      scAll.filter(r => r.decision === 'pool').length,
    selected:    scAll.filter(r => r.pipeline_status === 'selected').length,
  };

  // ── Screening metrics ─────────────────────────────────────────────────────
  const toBucket = (rows, field) => {
    const vals = rows.filter(r => r[field] != null);
    return [
      { range: '0–20',   count: vals.filter(r => r[field] <= 20).length },
      { range: '21–40',  count: vals.filter(r => r[field] > 20 && r[field] <= 40).length },
      { range: '41–60',  count: vals.filter(r => r[field] > 40 && r[field] <= 60).length },
      { range: '61–80',  count: vals.filter(r => r[field] > 60 && r[field] <= 80).length },
      { range: '81–100', count: vals.filter(r => r[field] > 80).length },
    ];
  };

  const screening = {
    statusBreakdown: { pass: funnel.screenPass, fail: funnel.screenFail, pending: funnel.screenPend },
    scoreBuckets:    toBucket(scAll, 'ai_interview_score'),
    matchBuckets:    toBucket(scAll, 'match_percentage'),
    decisions:       { proceed: funnel.proceeded, pool: funnel.pooled },
    viReview: {
      hold:   scAll.filter(r => r.vi_review === 'hold').length,
      reject: scAll.filter(r => r.vi_review === 'reject').length,
    },
  };

  // ── Video Interview metrics ───────────────────────────────────────────────
  const vcAll = db.prepare(`
    SELECT vc.status
    FROM video_candidates vc
    JOIN video_interviews vi ON vi.id = vc.interview_id
    WHERE vi.user_id = ?
  `).all(uid);

  const videoFunnel = {
    total:      vcAll.length,
    invited:    vcAll.filter(r => r.status === 'invited').length,
    inProgress: vcAll.filter(r => r.status === 'in_progress').length,
    completed:  vcAll.filter(r => r.status === 'completed').length,
    evaluated:  vcAll.filter(r => r.status === 'evaluated').length,
  };

  const evalAll = db.prepare(`
    SELECT ve.overall_score, ve.hiring_recommendation, ve.competency_scores
    FROM video_evaluations ve
    JOIN video_candidates vc ON vc.id = ve.candidate_id
    JOIN video_interviews vi ON vi.id = vc.interview_id
    WHERE vi.user_id = ?
  `).all(uid);

  const evalScoreBuckets = toBucket(evalAll, 'overall_score');

  const recCounts = {};
  evalAll.forEach(r => {
    if (r.hiring_recommendation) {
      recCounts[r.hiring_recommendation] = (recCounts[r.hiring_recommendation] || 0) + 1;
    }
  });

  const compKeys = ['technical_skills', 'communication', 'problem_solving', 'leadership', 'cultural_fit'];
  const compTotals = {}; const compCounts = {};
  compKeys.forEach(k => { compTotals[k] = 0; compCounts[k] = 0; });
  evalAll.forEach(r => {
    const cs = parseJSON(r.competency_scores);
    if (!cs) return;
    compKeys.forEach(k => { if (cs[k] != null) { compTotals[k] += cs[k]; compCounts[k]++; } });
  });
  const avgCompetency = {};
  compKeys.forEach(k => {
    avgCompetency[k] = compCounts[k] > 0 ? Math.round(compTotals[k] / compCounts[k]) : null;
  });

  // ── POFU metrics ──────────────────────────────────────────────────────────
  const pofuAll = db.prepare("SELECT state, risk_level, risk_score FROM pofu_candidates WHERE user_id=?").all(uid);
  const stateCounts = {}; const riskCounts = { low: 0, medium: 0, high: 0 };
  pofuAll.forEach(r => {
    stateCounts[r.state] = (stateCounts[r.state] || 0) + 1;
    if (r.risk_level in riskCounts) riskCounts[r.risk_level]++;
  });
  const avgRisk = pofuAll.length
    ? Math.round(pofuAll.reduce((s, r) => s + (r.risk_score || 0), 0) / pofuAll.length)
    : 0;

  const emailRows = db.prepare(`
    SELECT pe.direction, COUNT(*) AS c
    FROM pofu_emails pe
    JOIN pofu_candidates pc ON pc.id = pe.pofu_candidate_id
    WHERE pc.user_id = ?
    GROUP BY pe.direction
  `).all(uid);
  const emailCounts = { outbound: 0, inbound: 0 };
  emailRows.forEach(r => { emailCounts[r.direction] = r.c; });

  // ── Jobs breakdown ────────────────────────────────────────────────────────
  const jobStatusRows = db.prepare("SELECT status, COUNT(*) AS c FROM jobs WHERE user_id=? GROUP BY status").all(uid);
  const jobStatus = {};
  jobStatusRows.forEach(r => { jobStatus[r.status] = r.c; });

  res.json({
    overview: { activeJobs, totalJobs, totalCandidates, totalSessions, totalVI, totalPofu,
      calls: { total: callStats.total || 0, completed: callStats.completed || 0,
               avgDuration: Math.round(callStats.avg_duration || 0) } },
    funnel,
    screening,
    video: { funnel: videoFunnel, scoreBuckets: evalScoreBuckets, recommendations: recCounts,
             avgCompetency, totalEvaluated: evalAll.filter(r => r.overall_score != null).length },
    pofu:  { stateCounts, riskCounts, avgRisk, emailCounts, total: pofuAll.length },
    jobs:  { status: jobStatus },
  });
});

// ── GET /reports/jobs — job list with aggregated pipeline metrics ─────────────
router.get('/jobs', (req, res) => {
  try {
    const uid = req.user.id;

    // Fetch jobs
    const jobs = db.prepare(
      'SELECT id, title, client_name, department, location, status, openings_count, required_skills, preferred_skills, created_at FROM jobs WHERE user_id = ? ORDER BY created_at DESC'
    ).all(uid);

    // Aggregate session_candidates per job via sessions.job_id
    const scAgg = db.prepare(`
      SELECT s.job_id,
             COUNT(sc.id)                                                          AS sourced,
             SUM(CASE WHEN sc.screening_status = 'pass'       THEN 1 ELSE 0 END)  AS passed,
             SUM(CASE WHEN sc.decision          = 'proceed'   THEN 1 ELSE 0 END)  AS proceeded,
             SUM(CASE WHEN sc.pipeline_status   = 'selected'  THEN 1 ELSE 0 END)  AS selected
      FROM session_candidates sc
      JOIN sessions s ON s.id = sc.session_id
      WHERE s.user_id = ? AND s.job_id IS NOT NULL
      GROUP BY s.job_id
    `).all(uid);
    const scMap = {};
    scAgg.forEach(r => { scMap[r.job_id] = r; });

    // VI count per job
    const viAgg = db.prepare(
      "SELECT job_id, COUNT(*) AS vi_count FROM video_interviews WHERE user_id = ? AND job_id IS NOT NULL GROUP BY job_id"
    ).all(uid);
    const viMap = {};
    viAgg.forEach(r => { viMap[r.job_id] = r.vi_count; });

    // POFU count per job
    const pofuAgg = db.prepare(
      "SELECT job_id, COUNT(*) AS pofu_count FROM pofu_candidates WHERE user_id = ? AND job_id IS NOT NULL GROUP BY job_id"
    ).all(uid);
    const pofuMap = {};
    pofuAgg.forEach(r => { pofuMap[r.job_id] = r.pofu_count; });

    res.json({
      jobs: jobs.map(j => {
        const sc = scMap[j.id] || { sourced: 0, passed: 0, proceeded: 0, selected: 0 };
        return {
          ...j,
          required_skills:  parseJSON(j.required_skills)  || [],
          preferred_skills: parseJSON(j.preferred_skills) || [],
          sourced:    sc.sourced,
          passed:     sc.passed,
          proceeded:  sc.proceeded,
          selected:   sc.selected,
          vi_count:   viMap[j.id]   || 0,
          pofu_count: pofuMap[j.id] || 0,
          pass_rate:  sc.sourced > 0 ? Math.round(sc.passed / sc.sourced * 100) : null,
        };
      }),
    });
  } catch (err) {
    console.error('[reports/jobs]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /reports/jobs/:jobId — detailed analytics for one job ─────────────────
router.get('/jobs/:jobId', (req, res) => {
  try {
  const uid = req.user.id;
  const jid = req.params.jobId;

  const job = db.prepare('SELECT * FROM jobs WHERE id=? AND user_id=?').get(jid, uid);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  // All session_candidates across all sessions for this job
  const scRows = db.prepare(`
    SELECT sc.screening_status, sc.ai_interview_score, sc.match_percentage,
           sc.decision, sc.pipeline_status, sc.vi_invite_sent, sc.vi_review,
           c.skills AS candidate_skills
    FROM session_candidates sc
    JOIN sessions s ON s.id = sc.session_id
    JOIN candidates c ON c.id = sc.candidate_id
    WHERE s.job_id = ? AND s.user_id = ?
  `).all(jid, uid);

  const toBucket = (rows, field) => {
    const vals = rows.filter(r => r[field] != null);
    return [
      { range: '0–20',   count: vals.filter(r => r[field] <= 20).length },
      { range: '21–40',  count: vals.filter(r => r[field] > 20 && r[field] <= 40).length },
      { range: '41–60',  count: vals.filter(r => r[field] > 40 && r[field] <= 60).length },
      { range: '61–80',  count: vals.filter(r => r[field] > 60 && r[field] <= 80).length },
      { range: '81–100', count: vals.filter(r => r[field] > 80).length },
    ];
  };

  // Funnel
  const funnel = {
    sourced:    scRows.length,
    passed:     scRows.filter(r => r.screening_status === 'pass').length,
    failed:     scRows.filter(r => r.screening_status === 'fail').length,
    viInvited:  scRows.filter(r => r.vi_invite_sent).length,
    proceeded:  scRows.filter(r => r.decision === 'proceed').length,
    selected:   scRows.filter(r => r.pipeline_status === 'selected').length,
  };

  // Skills coverage analysis
  const requiredSkills  = parseJSON(job.required_skills)  || [];
  const preferredSkills = parseJSON(job.preferred_skills) || [];

  const skillHits = {};
  [...requiredSkills, ...preferredSkills].forEach(s => { skillHits[s] = 0; });

  scRows.forEach(r => {
    const cs = (parseJSON(r.candidate_skills) || []).map(s => s.toLowerCase().trim());
    [...requiredSkills, ...preferredSkills].forEach(s => {
      if (cs.includes(s.toLowerCase().trim())) skillHits[s]++;
    });
  });

  const skillsCoverage = {
    required:  requiredSkills.map(s => ({ skill: s, count: skillHits[s] || 0, total: scRows.length })),
    preferred: preferredSkills.map(s => ({ skill: s, count: skillHits[s] || 0, total: scRows.length })),
  };

  // Video interview data for this job
  const vcRows = db.prepare(`
    SELECT vc.status, ve.overall_score, ve.hiring_recommendation, ve.competency_scores
    FROM video_candidates vc
    JOIN video_interviews vi ON vi.id = vc.interview_id
    LEFT JOIN video_evaluations ve ON ve.candidate_id = vc.id
    WHERE vi.job_id = ? AND vi.user_id = ?
  `).all(jid, uid);

  const videoFunnel = {
    total:      vcRows.length,
    completed:  vcRows.filter(r => r.status === 'completed' || r.status === 'evaluated').length,
    evaluated:  vcRows.filter(r => r.status === 'evaluated').length,
  };

  const recCounts = {};
  vcRows.forEach(r => {
    if (r.hiring_recommendation) recCounts[r.hiring_recommendation] = (recCounts[r.hiring_recommendation] || 0) + 1;
  });

  const compKeys = ['technical_skills', 'communication', 'problem_solving', 'leadership', 'cultural_fit'];
  const compTotals = {}; const compCounts = {};
  compKeys.forEach(k => { compTotals[k] = 0; compCounts[k] = 0; });
  vcRows.forEach(r => {
    const cs = parseJSON(r.competency_scores);
    if (!cs) return;
    compKeys.forEach(k => { if (cs[k] != null) { compTotals[k] += cs[k]; compCounts[k]++; } });
  });
  const avgCompetency = {};
  compKeys.forEach(k => { avgCompetency[k] = compCounts[k] > 0 ? Math.round(compTotals[k] / compCounts[k]) : null; });

  // POFU data
  const pofuRows = db.prepare("SELECT state, risk_level, risk_score FROM pofu_candidates WHERE job_id=? AND user_id=?").all(jid, uid);
  const pofuStates = {};
  pofuRows.forEach(r => { pofuStates[r.state] = (pofuStates[r.state] || 0) + 1; });

  res.json({
    job: { ...job, required_skills: requiredSkills, preferred_skills: preferredSkills },
    funnel,
    screening: {
      scoreBuckets: toBucket(scRows, 'ai_interview_score'),
      matchBuckets: toBucket(scRows, 'match_percentage'),
    },
    skillsCoverage,
    video: { funnel: videoFunnel, recommendations: recCounts, avgCompetency },
    pofu:  { total: pofuRows.length, states: pofuStates,
             avgRisk: pofuRows.length ? Math.round(pofuRows.reduce((s,r) => s + (r.risk_score||0), 0) / pofuRows.length) : 0 },
  });
  } catch (err) {
    console.error('[reports/jobs/:jobId]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
