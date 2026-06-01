/**
 * server/services/mis-scope.js
 *
 * Per-request scope computation and view installation for the Ask MIS agent.
 *
 * The agent NEVER queries raw tables. Instead it queries `v_*` TEMP VIEWs that
 * we create per-request, with scope filters baked in as integer literals. This
 * makes scoping impossible to bypass via prompt injection — the views *are* the
 * permission boundary, not the LLM's good behaviour.
 *
 * Open a handle with openScopedDb(scope); close it when done.
 */

const Database = require('better-sqlite3');
const { db, DB_PATH } = require('../db');
const { visibleUserIds } = require('../utils/scoping');

const ROW_LIMIT = 5000;

/**
 * Build the request-scoped context object. Driven by the caller's role,
 * mirroring how utils/scoping.js#visibleUserIds works, plus HM job attachments.
 *
 *   { role, userId, companyId, visibleUserIds: [int], hmJobIds: [int]|null,
 *     scopeKind: 'company'|'self'|'hm' }
 */
function computeScope(req) {
  const user = req?.user;
  if (!user) throw new Error('computeScope: missing req.user');
  if (!user.company_id) throw new Error('computeScope: user has no company_id');

  const base = {
    role: user.role,
    userId: Number(user.id),
    companyId: Number(user.company_id),
    visibleUserIds: visibleUserIds(req).map(Number),
    hmJobIds: null,
    scopeKind: 'self',
  };

  if (user.role === 'owner' || user.role === 'team_lead') {
    base.scopeKind = 'company';
  } else if (user.role === 'hiring_manager') {
    base.scopeKind = 'hm';
    const rows = db.prepare(
      'SELECT job_id FROM job_hiring_managers WHERE user_id = ?'
    ).all(user.id);
    base.hmJobIds = rows.map(r => Number(r.job_id));
  }

  return base;
}

/**
 * Open a fresh DB handle, install the v_* scoped TEMP VIEWs, then lock it
 * read-only via pragma. We can't open with `readonly: true` because SQLite
 * treats CREATE TEMP VIEW as a write (even though TEMP lives in the in-memory
 * temp DB) and rejects it. Instead we open writeable, create views, then set
 * `query_only=ON` before the LLM-generated SQL ever runs.
 *
 * Caller is responsible for calling .close() when done.
 */
function openScopedDb(scope) {
  const conn = new Database(DB_PATH, { fileMustExist: true });
  conn.pragma('busy_timeout = 5000');
  installScopedViews(conn, scope);
  conn.pragma('query_only = ON');
  return conn;
}

// ── Scope literals (safe — all values are integers we control) ──────────────
function intCsv(arr) {
  if (!arr || arr.length === 0) return 'NULL'; // produces an empty IN(NULL) → no rows
  return arr.map(n => Number(n)).filter(n => Number.isFinite(n)).join(',') || 'NULL';
}

function installScopedViews(conn, scope) {
  const { scopeKind, companyId, userId, visibleUserIds: vids, hmJobIds } = scope;
  const vidsCsv  = intCsv(vids);
  const hmJobCsv = intCsv(hmJobIds || []);
  const co       = Number(companyId);
  const me       = Number(userId);

  // ── jobs ────────────────────────────────────────────────────────────────
  //   company: all jobs in company
  //   self   : jobs created by visible users (= self for r/sr/sourcer)
  //   hm     : jobs the HM is attached to
  let jobWhere;
  if (scopeKind === 'company') jobWhere = `j.company_id = ${co}`;
  else if (scopeKind === 'hm') jobWhere = `j.id IN (${hmJobCsv})`;
  else                          jobWhere = `j.user_id IN (${vidsCsv})`;

  conn.exec(`
    CREATE TEMP VIEW v_jobs AS
    SELECT j.id, j.user_id, j.company_id, j.title, j.department, j.client_name,
           j.location, j.employment_type, j.experience_min, j.experience_max,
           j.salary_min, j.salary_max, j.openings_count, j.status, j.is_qualified,
           j.created_at, j.updated_at,
           lead_user.id AS lead_user_id, lead_user.display_name AS lead_name
    FROM jobs j
    LEFT JOIN job_assignees ja_lead
      ON ja_lead.job_id = j.id AND ja_lead.role_on_job = 'lead'
    LEFT JOIN users lead_user ON lead_user.id = ja_lead.user_id
    WHERE ${jobWhere};
  `);

  // ── candidates ──────────────────────────────────────────────────────────
  //   company / self : by user_id IN visible
  //   hm             : candidates that appear in session_candidates of HM-scoped sessions
  let candWhere;
  if (scopeKind === 'hm') {
    candWhere = `
      c.id IN (
        SELECT DISTINCT sc.candidate_id
        FROM session_candidates sc
        JOIN sessions s ON s.id = sc.session_id
        WHERE s.job_id IN (${hmJobCsv})
      )
    `;
  } else {
    candWhere = `c.user_id IN (${vidsCsv})`;
  }

  conn.exec(`
    CREATE TEMP VIEW v_candidates AS
    SELECT c.id, c.user_id, c.name, c.email, c.phone, c.location,
           c.current_title, c.current_company, c.experience_years,
           c.skills, c.education, c.status, c.created_at, c.updated_at
    FROM candidates c
    WHERE ${candWhere};
  `);

  // ── sessions (pipeline) ────────────────────────────────────────────────
  let sessWhere;
  if (scopeKind === 'hm') sessWhere = `s.job_id IN (${hmJobCsv})`;
  else                     sessWhere = `s.user_id IN (${vidsCsv})`;

  conn.exec(`
    CREATE TEMP VIEW v_sessions AS
    SELECT s.id, s.user_id, s.job_id, s.name, s.current_step,
           s.status, s.created_at, s.updated_at
    FROM sessions s
    WHERE ${sessWhere};
  `);

  // ── session_candidates (scoped via parent session) ─────────────────────
  conn.exec(`
    CREATE TEMP VIEW v_session_candidates AS
    SELECT sc.id, sc.session_id, sc.candidate_id, sc.match_percentage,
           sc.screening_status, sc.ai_interview_score, sc.decision,
           sc.interview_level, sc.email_sent, sc.pipeline_status,
           sc.vi_invite_sent, sc.vi_review, sc.assessment_type,
           sc.interview_scheduled_at, sc.selected_at, sc.added_at
    FROM session_candidates sc
    WHERE sc.session_id IN (SELECT id FROM v_sessions);
  `);

  // ── jd_enhancements ────────────────────────────────────────────────────
  let jdeWhere;
  if (scopeKind === 'hm') jdeWhere = `jde.job_id IN (${hmJobCsv})`;
  else                     jdeWhere = `jde.user_id IN (${vidsCsv})`;

  conn.exec(`
    CREATE TEMP VIEW v_jd_enhancements AS
    SELECT jde.id, jde.user_id, jde.title, jde.job_id, jde.created_at
    FROM jd_enhancements jde
    WHERE ${jdeWhere};
  `);

  // ── pofu_candidates ────────────────────────────────────────────────────
  let pofuWhere;
  if (scopeKind === 'hm') pofuWhere = `pc.job_id IN (${hmJobCsv})`;
  else                     pofuWhere = `pc.user_id IN (${vidsCsv})`;

  conn.exec(`
    CREATE TEMP VIEW v_pofu_candidates AS
    SELECT pc.id, pc.user_id, pc.session_id, pc.candidate_id, pc.job_id,
           pc.candidate_name, pc.role_title, pc.company_name, pc.doj,
           pc.state, pc.risk_score, pc.risk_level, pc.last_email_at,
           pc.last_response_at, pc.created_at
    FROM pofu_candidates pc
    WHERE ${pofuWhere};
  `);

  // ── job_assignees (scoped via v_jobs) ─────────────────────────────────
  conn.exec(`
    CREATE TEMP VIEW v_job_assignees AS
    SELECT ja.id, ja.job_id, ja.user_id, ja.role_on_job, ja.assigned_at
    FROM job_assignees ja
    WHERE ja.job_id IN (SELECT id FROM v_jobs);
  `);

  // ── job_hiring_managers (scoped via v_jobs) ───────────────────────────
  conn.exec(`
    CREATE TEMP VIEW v_job_hiring_managers AS
    SELECT jhm.id, jhm.job_id, jhm.user_id, jhm.added_at
    FROM job_hiring_managers jhm
    WHERE jhm.job_id IN (SELECT id FROM v_jobs);
  `);

  // ── users (limited columns, scoped to caller's company) ────────────────
  //   For HM, also include themselves plus all assignees on HM jobs so
  //   the agent can resolve names attached to those jobs.
  let userWhere;
  if (scopeKind === 'hm') {
    userWhere = `
      u.id = ${me}
      OR u.id IN (SELECT user_id FROM v_job_assignees)
      OR u.id IN (SELECT user_id FROM v_job_hiring_managers)
    `;
  } else {
    userWhere = `u.company_id = ${co}`;
  }
  conn.exec(`
    CREATE TEMP VIEW v_users AS
    SELECT u.id, u.email, u.display_name, u.role
    FROM users u
    WHERE ${userWhere};
  `);

  // ── MCQ assessments ────────────────────────────────────────────────────
  let aWhere;
  if (scopeKind === 'hm') aWhere = `a.job_id IN (${hmJobCsv})`;
  else                     aWhere = `a.user_id IN (${vidsCsv})`;

  conn.exec(`
    CREATE TEMP VIEW v_assessments AS
    SELECT a.id, a.user_id, a.job_id, a.title, a.description, a.time_limit_min,
           a.pass_score, a.status, a.created_at, a.updated_at
    FROM assessments a
    WHERE ${aWhere};

    CREATE TEMP VIEW v_assessment_invites AS
    SELECT ai.id, ai.assessment_id, ai.candidate_id, ai.candidate_name,
           ai.candidate_email, ai.status, ai.invited_at, ai.started_at,
           ai.completed_at
    FROM assessment_invites ai
    WHERE ai.assessment_id IN (SELECT id FROM v_assessments);

    CREATE TEMP VIEW v_assessment_submissions AS
    SELECT s.id, s.invite_id, s.assessment_id, s.score, s.correct_count,
           s.total_questions, s.time_taken_sec, s.submitted_at
    FROM assessment_submissions s
    WHERE s.invite_id IN (SELECT id FROM v_assessment_invites);
  `);

  // ── Coding assessments ─────────────────────────────────────────────────
  let cWhere;
  if (scopeKind === 'hm') cWhere = `ca.job_id IN (${hmJobCsv})`;
  else                     cWhere = `ca.user_id IN (${vidsCsv})`;

  conn.exec(`
    CREATE TEMP VIEW v_coding_assessments AS
    SELECT ca.id, ca.user_id, ca.job_id, ca.title, ca.time_limit_min,
           ca.pass_score, ca.status, ca.created_at, ca.updated_at
    FROM coding_assessments ca
    WHERE ${cWhere};

    CREATE TEMP VIEW v_coding_invites AS
    SELECT ci.id, ci.assessment_id, ci.candidate_id, ci.candidate_name,
           ci.candidate_email, ci.status, ci.invited_at, ci.started_at,
           ci.completed_at
    FROM coding_invites ci
    WHERE ci.assessment_id IN (SELECT id FROM v_coding_assessments);

    CREATE TEMP VIEW v_coding_submissions AS
    SELECT cs.id, cs.invite_id, cs.assessment_id, cs.score, cs.time_taken_sec,
           cs.submitted_at
    FROM coding_submissions cs
    WHERE cs.invite_id IN (SELECT id FROM v_coding_invites);
  `);

  // ── Video interviews ───────────────────────────────────────────────────
  let viWhere;
  if (scopeKind === 'hm') viWhere = `vi.job_id IN (${hmJobCsv})`;
  else                     viWhere = `vi.user_id IN (${vidsCsv})`;

  conn.exec(`
    CREATE TEMP VIEW v_video_interviews AS
    SELECT vi.id, vi.user_id, vi.job_id, vi.title, vi.question_count,
           vi.expiry_date, vi.status, vi.created_at, vi.updated_at
    FROM video_interviews vi
    WHERE ${viWhere};

    CREATE TEMP VIEW v_video_candidates AS
    SELECT vc.id, vc.interview_id, vc.candidate_id, vc.name, vc.email,
           vc.status, vc.interview_started_at, vc.interview_completed_at,
           vc.created_at
    FROM video_candidates vc
    WHERE vc.interview_id IN (SELECT id FROM v_video_interviews);

    CREATE TEMP VIEW v_video_evaluations AS
    SELECT ve.id, ve.candidate_id, ve.interview_id, ve.overall_score,
           ve.hiring_recommendation, ve.created_at
    FROM video_evaluations ve
    WHERE ve.interview_id IN (SELECT id FROM v_video_interviews);
  `);
}

// Allowed view names — the SQL guard whitelists FROM/JOIN against this set.
const ALLOWED_VIEWS = [
  'v_jobs', 'v_candidates', 'v_sessions', 'v_session_candidates',
  'v_jd_enhancements', 'v_pofu_candidates',
  'v_job_assignees', 'v_job_hiring_managers', 'v_users',
  'v_assessments', 'v_assessment_invites', 'v_assessment_submissions',
  'v_coding_assessments', 'v_coding_invites', 'v_coding_submissions',
  'v_video_interviews', 'v_video_candidates', 'v_video_evaluations',
];

module.exports = {
  computeScope,
  openScopedDb,
  installScopedViews,
  ALLOWED_VIEWS,
  ROW_LIMIT,
};
