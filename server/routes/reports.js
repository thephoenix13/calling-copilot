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

  // ── Timing metrics ────────────────────────────────────────────────────────
  const timingRow = db.prepare(`
    SELECT
      AVG(julianday(sc.selected_at) - julianday(sc.added_at))                            AS avg_time_to_hire,
      AVG(CASE WHEN sc.vi_invite_sent_at IS NOT NULL
          THEN julianday(sc.vi_invite_sent_at) - julianday(sc.added_at) END)              AS avg_sourcing_to_vi,
      AVG(CASE WHEN sc.selected_at IS NOT NULL AND sc.vi_invite_sent_at IS NOT NULL
          THEN julianday(sc.selected_at) - julianday(sc.vi_invite_sent_at) END)           AS avg_vi_to_selected
    FROM session_candidates sc
    JOIN sessions s ON s.id = sc.session_id
    WHERE s.user_id = ? AND sc.selected_at IS NOT NULL
  `).get(uid);

  const timing = {
    avgTimeToHire:   timingRow.avg_time_to_hire   != null ? Math.round(timingRow.avg_time_to_hire)   : null,
    avgSourcingToVI: timingRow.avg_sourcing_to_vi != null ? Math.round(timingRow.avg_sourcing_to_vi) : null,
    avgVIToSelected: timingRow.avg_vi_to_selected != null ? Math.round(timingRow.avg_vi_to_selected) : null,
  };

  // ── Stage conversion rates ────────────────────────────────────────────────
  const conversions = {
    sourcedToScreened:   funnel.sourced    > 0 ? Math.round(funnel.screenPass / funnel.sourced    * 100) : null,
    screenedToVI:        funnel.screenPass > 0 ? Math.round(funnel.viInvited  / funnel.screenPass * 100) : null,
    viToProceeded:       funnel.viInvited  > 0 ? Math.round(funnel.proceeded  / funnel.viInvited  * 100) : null,
    proceededToSelected: funnel.proceeded  > 0 ? Math.round(funnel.selected   / funnel.proceeded  * 100) : null,
  };

  // ── Session activity (last 25) ────────────────────────────────────────────
  const sessionActivity = db.prepare(`
    SELECT s.id, COALESCE(s.name, 'Unnamed Session') AS name, s.created_at,
           j.title AS job_title, j.client_name,
           COUNT(sc.id)                                                              AS sourced,
           SUM(CASE WHEN sc.screening_status='pass'    THEN 1 ELSE 0 END)           AS passed,
           SUM(CASE WHEN sc.decision='proceed'         THEN 1 ELSE 0 END)           AS proceeded,
           SUM(CASE WHEN sc.pipeline_status='selected' THEN 1 ELSE 0 END)           AS selected,
           ROUND(AVG(CASE WHEN sc.selected_at IS NOT NULL
               THEN julianday(sc.selected_at) - julianday(sc.added_at) END))        AS avg_days
    FROM sessions s
    LEFT JOIN session_candidates sc ON sc.session_id = s.id
    LEFT JOIN jobs j ON j.id = s.job_id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 25
  `).all(uid);

  // ── Assessment analytics ──────────────────────────────────────────────────
  const mcqRow = db.prepare(`
    SELECT
      COUNT(DISTINCT a.id)                                                                    AS total_assessments,
      COUNT(ai.id)                                                                            AS total_invited,
      SUM(CASE WHEN ai.status='completed' THEN 1 ELSE 0 END)                                  AS completed,
      AVG(asub.score)                                                                         AS avg_score,
      SUM(CASE WHEN asub.score IS NOT NULL AND asub.score >= a.pass_score THEN 1 ELSE 0 END)  AS passed_count,
      COUNT(asub.id)                                                                          AS total_scored,
      AVG(asub.time_taken_sec)                                                                AS avg_time_sec
    FROM assessments a
    LEFT JOIN assessment_invites ai ON ai.assessment_id = a.id
    LEFT JOIN assessment_submissions asub ON asub.invite_id = ai.id
    WHERE a.user_id = ?
  `).get(uid);

  const mcqScoreRows = db.prepare(`
    SELECT asub.score FROM assessment_submissions asub
    JOIN assessments a ON a.id = asub.assessment_id
    WHERE a.user_id = ? AND asub.score IS NOT NULL
  `).all(uid);

  const codingRow = db.prepare(`
    SELECT
      COUNT(DISTINCT ca.id)                                                                    AS total_assessments,
      COUNT(ci.id)                                                                             AS total_invited,
      SUM(CASE WHEN ci.status='completed' THEN 1 ELSE 0 END)                                  AS completed,
      AVG(csub.score)                                                                         AS avg_score,
      SUM(CASE WHEN csub.score IS NOT NULL AND csub.score >= ca.pass_score THEN 1 ELSE 0 END) AS passed_count,
      COUNT(csub.id)                                                                          AS total_scored,
      AVG(csub.time_taken_sec)                                                                AS avg_time_sec
    FROM coding_assessments ca
    LEFT JOIN coding_invites ci ON ci.assessment_id = ca.id
    LEFT JOIN coding_submissions csub ON csub.invite_id = ci.id
    WHERE ca.user_id = ?
  `).get(uid);

  const codingScoreRows = db.prepare(`
    SELECT csub.score FROM coding_submissions csub
    JOIN coding_assessments ca ON ca.id = csub.assessment_id
    WHERE ca.user_id = ? AND csub.score IS NOT NULL
  `).all(uid);

  const assessments = {
    mcq: {
      totalAssessments: mcqRow.total_assessments || 0,
      totalInvited:     mcqRow.total_invited     || 0,
      completed:        mcqRow.completed         || 0,
      avgScore:         mcqRow.avg_score         != null ? Math.round(mcqRow.avg_score)    : null,
      passedCount:      mcqRow.passed_count      || 0,
      totalScored:      mcqRow.total_scored      || 0,
      avgTimeSec:       mcqRow.avg_time_sec      != null ? Math.round(mcqRow.avg_time_sec) : null,
      scoreBuckets:     toBucket(mcqScoreRows, 'score'),
    },
    coding: {
      totalAssessments: codingRow.total_assessments || 0,
      totalInvited:     codingRow.total_invited     || 0,
      completed:        codingRow.completed         || 0,
      avgScore:         codingRow.avg_score         != null ? Math.round(codingRow.avg_score)    : null,
      passedCount:      codingRow.passed_count      || 0,
      totalScored:      codingRow.total_scored      || 0,
      avgTimeSec:       codingRow.avg_time_sec      != null ? Math.round(codingRow.avg_time_sec) : null,
      scoreBuckets:     toBucket(codingScoreRows, 'score'),
    },
  };

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
    timing,
    conversions,
    activity: { sessions: sessionActivity },
    assessments,
  });
});

// ── GET /reports/jobs — job list with aggregated pipeline metrics ─────────────
router.get('/jobs', (req, res) => {
  try {
    const uid = req.user.id;

    // Fetch jobs: own jobs + any job referenced by the user's sessions
    const jobs = db.prepare(`
      SELECT DISTINCT j.id, j.title, j.client_name, j.department, j.location,
             j.status, j.openings_count, j.required_skills, j.preferred_skills, j.created_at
      FROM jobs j
      WHERE j.user_id = ?
         OR j.id IN (
           SELECT DISTINCT s.job_id FROM sessions s
           WHERE s.user_id = ? AND s.job_id IS NOT NULL
         )
      ORDER BY j.created_at DESC
    `).all(uid, uid);

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

    // Candidates from sessions NOT linked to any job — keep totals consistent with summary
    const unlinkedRow = db.prepare(`
      SELECT
        COUNT(sc.id)                                                         AS sourced,
        SUM(CASE WHEN sc.screening_status = 'pass'     THEN 1 ELSE 0 END)  AS passed,
        SUM(CASE WHEN sc.decision         = 'proceed'  THEN 1 ELSE 0 END)  AS proceeded,
        SUM(CASE WHEN sc.pipeline_status  = 'selected' THEN 1 ELSE 0 END)  AS selected
      FROM session_candidates sc
      JOIN sessions s ON s.id = sc.session_id
      WHERE s.user_id = ? AND s.job_id IS NULL
    `).get(uid);

    const unlinked = (unlinkedRow.sourced > 0) ? {
      sourced:   unlinkedRow.sourced,
      passed:    unlinkedRow.passed,
      proceeded: unlinkedRow.proceeded,
      selected:  unlinkedRow.selected,
      pass_rate: unlinkedRow.sourced > 0 ? Math.round(unlinkedRow.passed / unlinkedRow.sourced * 100) : null,
    } : null;

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
          time_open:  Math.round((Date.now() - new Date(j.created_at).getTime()) / 86400000),
        };
      }),
      unlinked,
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

  // Allow access if user owns the job OR has sessions linked to it
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jid);
  const hasAccess = job && (
    job.user_id === uid ||
    db.prepare('SELECT id FROM sessions WHERE user_id=? AND job_id=?').get(uid, jid)
  );
  if (!hasAccess) return res.status(404).json({ error: 'Job not found.' });

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

// ── GET /reports/details — row-level data backing all aggregate tabs ──────────
router.get('/details', (req, res) => {
  try {
    const uid = req.user.id;

    // All pipeline candidates across every session
    const candidates = db.prepare(`
      SELECT
        c.name            AS candidate_name,
        c.email           AS candidate_email,
        c.current_title   AS candidate_title,
        c.experience_years,
        sc.screening_status,
        sc.ai_interview_score,
        sc.match_percentage,
        sc.decision,
        sc.interview_level,
        sc.pipeline_status,
        sc.added_at,
        sc.selected_at,
        s.name            AS session_name,
        j.title           AS job_title,
        j.client_name
      FROM session_candidates sc
      JOIN candidates c ON c.id = sc.candidate_id
      JOIN sessions   s ON s.id = sc.session_id
      LEFT JOIN jobs  j ON j.id = s.job_id
      WHERE s.user_id = ?
      ORDER BY sc.added_at DESC
      LIMIT 300
    `).all(uid);

    // MCQ assessment invites + submissions
    const mcqInvites = db.prepare(`
      SELECT
        ai.candidate_name,
        ai.candidate_email,
        ai.status,
        ai.invited_at,
        ai.completed_at,
        asub.score,
        asub.time_taken_sec,
        a.title      AS assessment_title,
        a.pass_score
      FROM assessment_invites ai
      JOIN assessments a ON a.id = ai.assessment_id
      LEFT JOIN assessment_submissions asub ON asub.invite_id = ai.id
      WHERE a.user_id = ?
      ORDER BY ai.invited_at DESC
      LIMIT 200
    `).all(uid);

    // Coding assessment invites + submissions
    const codingInvites = db.prepare(`
      SELECT
        ci.candidate_name,
        ci.candidate_email,
        ci.status,
        ci.invited_at,
        ci.completed_at,
        csub.score,
        csub.time_taken_sec,
        ca.title      AS assessment_title,
        ca.pass_score
      FROM coding_invites ci
      JOIN coding_assessments ca ON ca.id = ci.assessment_id
      LEFT JOIN coding_submissions csub ON csub.invite_id = ci.id
      WHERE ca.user_id = ?
      ORDER BY ci.invited_at DESC
      LIMIT 200
    `).all(uid);

    // Video interview candidates
    const videoCandidates = db.prepare(`
      SELECT
        vc.name                     AS candidate_name,
        vc.email                    AS candidate_email,
        vc.status,
        vc.created_at               AS invited_at,
        vc.interview_completed_at   AS completed_at,
        ve.overall_score,
        ve.hiring_recommendation,
        vi.title                    AS interview_title,
        j.title                     AS job_title
      FROM video_candidates vc
      JOIN video_interviews vi ON vi.id = vc.interview_id
      LEFT JOIN video_evaluations ve ON ve.candidate_id = vc.id
      LEFT JOIN jobs j ON j.id = vi.job_id
      WHERE vi.user_id = ?
      ORDER BY vc.created_at DESC
      LIMIT 200
    `).all(uid);

    // POFU candidates
    const pofuCandidates = db.prepare(`
      SELECT
        pc.candidate_name,
        pc.candidate_email,
        pc.role_title,
        pc.company_name,
        pc.state,
        pc.risk_level,
        pc.risk_score,
        pc.doj,
        pc.created_at,
        pc.last_email_at
      FROM pofu_candidates pc
      WHERE pc.user_id = ?
      ORDER BY pc.created_at DESC
      LIMIT 200
    `).all(uid);

    res.json({ candidates, mcqInvites, codingInvites, videoCandidates, pofuCandidates });
  } catch (err) {
    console.error('[reports/details]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
