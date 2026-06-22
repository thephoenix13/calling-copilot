const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'recruiter.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('admin', 'superuser', 'subuser')),
    display_name  TEXT,
    company_id    INTEGER,
    created_by    INTEGER,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS companies (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    industry      TEXT,
    website       TEXT,
    logo_url      TEXT,
    address       TEXT,
    contact_email TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calls (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    call_sid           TEXT    NOT NULL UNIQUE,
    user_id            INTEGER NOT NULL REFERENCES users(id),
    candidate_phone    TEXT    NOT NULL DEFAULT '',
    candidate_name     TEXT,
    role_title         TEXT,
    status             TEXT    NOT NULL DEFAULT 'active'
                                CHECK(status IN ('active', 'completed', 'sim')),
    started_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at           TEXT,
    duration_sec       INTEGER,
    recording_filename TEXT,
    recording_sid      TEXT
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id    INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    seq        INTEGER NOT NULL,
    speaker    TEXT    NOT NULL,
    text       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id);

  CREATE TABLE IF NOT EXISTS reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id       INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    report_type   TEXT    NOT NULL CHECK(report_type IN ('qa', 'candidate')),
    payload       TEXT    NOT NULL,
    generated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(call_id, report_type)
  );

  CREATE TABLE IF NOT EXISTS call_context (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id     INTEGER NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
    jd_text     TEXT,
    resume_text TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    title            TEXT    NOT NULL,
    department       TEXT,
    client_name      TEXT,
    location         TEXT,
    employment_type  TEXT    NOT NULL DEFAULT 'Full-time',
    description      TEXT,
    experience_min   INTEGER,
    experience_max   INTEGER,
    salary_min       INTEGER,
    salary_max       INTEGER,
    openings_count   INTEGER NOT NULL DEFAULT 1,
    required_skills  TEXT    NOT NULL DEFAULT '[]',
    preferred_skills TEXT    NOT NULL DEFAULT '[]',
    status           TEXT    NOT NULL DEFAULT 'active'
                             CHECK(status IN ('draft', 'active', 'closed')),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
`);

// Add is_qualified column if it doesn't exist (safe migration)
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN is_qualified INTEGER NOT NULL DEFAULT 0;`);
} catch (_) {}

db.exec(`

  CREATE TABLE IF NOT EXISTS candidates (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    name             TEXT    NOT NULL,
    email            TEXT,
    phone            TEXT,
    location         TEXT,
    current_title    TEXT,
    current_company  TEXT,
    experience_years REAL,
    skills           TEXT    NOT NULL DEFAULT '[]',
    education        TEXT,
    work_history     TEXT    NOT NULL DEFAULT '[]',
    linkedin_url     TEXT,
    portfolio_url    TEXT,
    resume_filename  TEXT,
    resume_text      TEXT,
    status           TEXT    NOT NULL DEFAULT 'active'
                             CHECK(status IN ('active', 'inactive')),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);

  CREATE TABLE IF NOT EXISTS jd_enhancements (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    title         TEXT    NOT NULL DEFAULT 'Untitled Enhancement',
    jd_input      TEXT    NOT NULL DEFAULT '',
    client_notes  TEXT,
    results       TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_jd_enhancements_user_id ON jd_enhancements(user_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    job_id            INTEGER REFERENCES jobs(id),
    name              TEXT,
    current_step      INTEGER NOT NULL DEFAULT 1,
    enhancement_data  TEXT,
    enhancement_saved INTEGER NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS session_candidates (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    candidate_id            INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    match_percentage        REAL,
    resume_score            TEXT,
    screening_status        TEXT NOT NULL DEFAULT 'pending' CHECK(screening_status IN ('pending','pass','fail')),
    screening_report_url    TEXT,
    ai_interview_score      INTEGER,
    ai_interview_report_url TEXT,
    decision                TEXT CHECK(decision IN ('proceed','pool')),
    interview_level         TEXT CHECK(interview_level IN ('L1','L2','L3')),
    email_sent              INTEGER NOT NULL DEFAULT 0,
    pipeline_status         TEXT NOT NULL DEFAULT 'pending' CHECK(pipeline_status IN ('pending','hold','reject','selected')),
    pipeline_feedback       TEXT,
    added_at                TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, candidate_id)
  );
  CREATE INDEX IF NOT EXISTS idx_session_candidates_session_id ON session_candidates(session_id);

  CREATE TABLE IF NOT EXISTS pofu_candidates (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    session_id       INTEGER REFERENCES sessions(id),
    candidate_id     INTEGER REFERENCES candidates(id),
    job_id           INTEGER REFERENCES jobs(id),
    candidate_name   TEXT NOT NULL,
    candidate_email  TEXT NOT NULL,
    role_title       TEXT,
    company_name     TEXT,
    doj              TEXT,
    state            TEXT NOT NULL DEFAULT 'offer_accepted'
                     CHECK(state IN ('offer_accepted','resigned','bgv','confirmed','joined','dropped')),
    risk_score       INTEGER NOT NULL DEFAULT 30,
    risk_level       TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low','medium','high')),
    last_email_at    TEXT,
    last_response_at TEXT,
    auto_paused      INTEGER NOT NULL DEFAULT 0,
    notes            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pofu_candidates_user ON pofu_candidates(user_id);

  CREATE TABLE IF NOT EXISTS pofu_emails (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    pofu_candidate_id INTEGER NOT NULL REFERENCES pofu_candidates(id) ON DELETE CASCADE,
    direction         TEXT NOT NULL DEFAULT 'outbound' CHECK(direction IN ('outbound','inbound')),
    trigger_reason    TEXT,
    subject           TEXT,
    body              TEXT,
    ai_generated      INTEGER NOT NULL DEFAULT 1,
    ai_analysis       TEXT,
    sent_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pofu_emails_candidate ON pofu_emails(pofu_candidate_id);
`);

// ── Video Interview tables ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS video_interviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    job_id          INTEGER REFERENCES jobs(id),
    title           TEXT    NOT NULL,
    job_description TEXT    NOT NULL DEFAULT '',
    question_count  INTEGER NOT NULL DEFAULT 5,
    expiry_date     TEXT,
    status          TEXT    NOT NULL DEFAULT 'active'
                    CHECK(status IN ('draft','active','closed')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_vi_user ON video_interviews(user_id);

  CREATE TABLE IF NOT EXISTS video_interview_questions (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id           INTEGER NOT NULL REFERENCES video_interviews(id) ON DELETE CASCADE,
    question_text          TEXT    NOT NULL,
    question_type          TEXT    NOT NULL DEFAULT 'behavioral'
                           CHECK(question_type IN ('technical','behavioral','situational')),
    estimated_time_minutes INTEGER NOT NULL DEFAULT 3,
    order_number           INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_viq_interview ON video_interview_questions(interview_id);

  CREATE TABLE IF NOT EXISTS video_candidates (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id           INTEGER NOT NULL REFERENCES video_interviews(id) ON DELETE CASCADE,
    candidate_id           INTEGER REFERENCES candidates(id),
    name                   TEXT    NOT NULL,
    email                  TEXT    NOT NULL,
    phone                  TEXT,
    access_code            TEXT    NOT NULL UNIQUE,
    status                 TEXT    NOT NULL DEFAULT 'invited'
                           CHECK(status IN ('invited','in_progress','completed','evaluated')),
    interview_started_at   TEXT,
    interview_completed_at TEXT,
    created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_vc_interview ON video_candidates(interview_id);

  CREATE TABLE IF NOT EXISTS video_responses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id    INTEGER NOT NULL REFERENCES video_candidates(id) ON DELETE CASCADE,
    interview_id    INTEGER NOT NULL REFERENCES video_interviews(id),
    question_id     INTEGER NOT NULL REFERENCES video_interview_questions(id),
    video_filename  TEXT,
    video_duration  INTEGER,
    file_size       INTEGER,
    transcription   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_vr_candidate ON video_responses(candidate_id);

  CREATE TABLE IF NOT EXISTS video_evaluations (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id          INTEGER NOT NULL REFERENCES video_candidates(id) ON DELETE CASCADE,
    interview_id          INTEGER NOT NULL REFERENCES video_interviews(id),
    overall_score         INTEGER,
    hiring_recommendation TEXT,
    evaluation_summary    TEXT,
    strengths             TEXT    NOT NULL DEFAULT '[]',
    weaknesses            TEXT    NOT NULL DEFAULT '[]',
    competency_scores     TEXT,
    behavioral_insights   TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ve_candidate ON video_evaluations(candidate_id);

  CREATE TABLE IF NOT EXISTS video_question_evaluations (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id          INTEGER NOT NULL REFERENCES video_evaluations(id) ON DELETE CASCADE,
    question_id            INTEGER NOT NULL REFERENCES video_interview_questions(id),
    score                  INTEGER,
    relevance_score        INTEGER,
    clarity_score          INTEGER,
    completeness_score     INTEGER,
    analysis               TEXT,
    keywords_found         TEXT    NOT NULL DEFAULT '[]',
    response_transcription TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_vqe_evaluation ON video_question_evaluations(evaluation_id);
`);

// IDF Feature 2 — Confidence-Based Evaluation: a confidence score (separate from
// the competence score) per question and overall, plus the signal breakdown.
try { db.exec('ALTER TABLE video_question_evaluations ADD COLUMN confidence INTEGER'); } catch (_) {}
try { db.exec('ALTER TABLE video_question_evaluations ADD COLUMN confidence_signals TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE video_evaluations ADD COLUMN confidence INTEGER'); } catch (_) {}
try { db.exec('ALTER TABLE video_evaluations ADD COLUMN confidence_signals TEXT'); } catch (_) {}

// ── Safe column migrations ─────────────────────────────────────────────────────
// vi_interview_id on sessions — inserted when VI Scheduler step was added;
// also triggers a one-time shift of current_step for existing sessions.
let viSchedulerMigrationRan = false;
try {
  db.exec('ALTER TABLE sessions ADD COLUMN vi_interview_id INTEGER');
  viSchedulerMigrationRan = true;
} catch (_) {}

if (viSchedulerMigrationRan) {
  // Shift sessions that were already past step 4 to account for the new step 5
  const shifted = db.prepare('UPDATE sessions SET current_step = current_step + 1 WHERE current_step >= 5').run();
  if (shifted.changes > 0) console.log(`[migration] Shifted current_step for ${shifted.changes} session(s) (VI Scheduler step insertion)`);
}

try { db.exec('ALTER TABLE session_candidates ADD COLUMN vi_invite_sent INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
try { db.exec('ALTER TABLE session_candidates ADD COLUMN vi_invite_sent_at TEXT'); } catch (_) {}
try { db.exec("ALTER TABLE session_candidates ADD COLUMN vi_review TEXT"); } catch (_) {}

// Migration: fix screening_status CHECK to include 'on_hold', add assessment_type column
try {
  const scMaster = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='session_candidates'"
  ).get();
  if (scMaster && !scMaster.sql.includes("'on_hold'")) {
    const cols = db.prepare('PRAGMA table_info(session_candidates)').all().map(c => c.name);
    const viSentSrc  = cols.includes('vi_invite_sent')   ? 'COALESCE(vi_invite_sent,0)' : '0';
    const viAtSrc    = cols.includes('vi_invite_sent_at') ? 'vi_invite_sent_at'           : 'NULL';
    const viRevSrc   = cols.includes('vi_review')         ? 'vi_review'                   : 'NULL';
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE session_candidates_v2 (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id              INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        candidate_id            INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        match_percentage        REAL,
        resume_score            TEXT,
        screening_status        TEXT NOT NULL DEFAULT 'pending'
                                CHECK(screening_status IN ('pending','pass','fail','on_hold')),
        screening_report_url    TEXT,
        ai_interview_score      INTEGER,
        ai_interview_report_url TEXT,
        decision                TEXT CHECK(decision IN ('proceed','pool')),
        interview_level         TEXT CHECK(interview_level IN ('L1','L2','L3')),
        email_sent              INTEGER NOT NULL DEFAULT 0,
        pipeline_status         TEXT NOT NULL DEFAULT 'pending'
                                CHECK(pipeline_status IN ('pending','hold','reject','selected')),
        pipeline_feedback       TEXT,
        added_at                TEXT NOT NULL DEFAULT (datetime('now')),
        vi_invite_sent          INTEGER NOT NULL DEFAULT 0,
        vi_invite_sent_at       TEXT,
        vi_review               TEXT,
        assessment_type         TEXT,
        UNIQUE(session_id, candidate_id)
      );
      INSERT INTO session_candidates_v2
        (id,session_id,candidate_id,match_percentage,resume_score,screening_status,
         screening_report_url,ai_interview_score,ai_interview_report_url,
         decision,interview_level,email_sent,pipeline_status,pipeline_feedback,added_at,
         vi_invite_sent,vi_invite_sent_at,vi_review)
        SELECT id,session_id,candidate_id,match_percentage,resume_score,screening_status,
               screening_report_url,ai_interview_score,ai_interview_report_url,
               decision,interview_level,email_sent,pipeline_status,pipeline_feedback,added_at,
               ${viSentSrc},${viAtSrc},${viRevSrc}
        FROM session_candidates;
      DROP TABLE session_candidates;
      ALTER TABLE session_candidates_v2 RENAME TO session_candidates;
      CREATE INDEX IF NOT EXISTS idx_session_candidates_session_id ON session_candidates(session_id);
    `);
    db.pragma('foreign_keys = ON');
    console.log('[migration] session_candidates: added on_hold + assessment_type');
  } else if (scMaster && !scMaster.sql.includes('assessment_type')) {
    try { db.exec('ALTER TABLE session_candidates ADD COLUMN assessment_type TEXT'); } catch (_) {}
  }
} catch (e) {
  console.error('[migration] session_candidates:', e.message);
  try { db.pragma('foreign_keys = ON'); } catch (_) {}
}

// Add qualification_qa column to jobs
try { db.exec('ALTER TABLE jobs ADD COLUMN qualification_qa TEXT'); } catch (_) {}

// Add job_id column to jd_enhancements so standalone enhancer can link to a DB job
try { db.exec('ALTER TABLE jd_enhancements ADD COLUMN job_id INTEGER REFERENCES jobs(id)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_jde_job ON jd_enhancements(job_id)'); } catch (_) {}

// Interview scheduling
try { db.exec('ALTER TABLE session_candidates ADD COLUMN interview_scheduled_at TEXT'); } catch (_) {}

// Selection timestamp for time-to-hire analytics
try { db.exec('ALTER TABLE session_candidates ADD COLUMN selected_at TEXT'); } catch (_) {}

// ── Phase 0: scope jobs and candidates by company_id ─────────────────────────
// Adds company_id columns to jobs/candidates so that every recruiter only sees
// their own agency's data (instead of the previous behaviour where jobs and
// candidates were globally visible to every authenticated user).
try { db.exec('ALTER TABLE jobs       ADD COLUMN company_id INTEGER REFERENCES companies(id)'); } catch (_) {}
try { db.exec('ALTER TABLE candidates ADD COLUMN company_id INTEGER REFERENCES companies(id)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_company_id       ON jobs(company_id)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_candidates_company_id ON candidates(company_id)'); } catch (_) {}
// Composite (company_id, created_at) — powers the default "latest N" list views;
// without this, large candidate tables force a full sort on every list request.
try { db.exec('CREATE INDEX IF NOT EXISTS idx_candidates_company_created ON candidates(company_id, created_at)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_company_created       ON jobs(company_id, created_at)'); } catch (_) {}
// (company_id, status, created_at) covers the paginated list COUNT + ORDER BY in
// one index — without status in the key, COUNT scans the whole company's rows.
try { db.exec('CREATE INDEX IF NOT EXISTS idx_candidates_company_status_created ON candidates(company_id, status, created_at)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_company_status_created       ON jobs(company_id, status, created_at)'); } catch (_) {}

// ── Phase 2: job assignment / ownership ───────────────────────────────────
// Recruiters, sourcers, team leads can be ASSIGNED to a job. Visibility stays
// company-wide (Phase 0); assignment only flags responsibility and powers the
// "My Jobs" filter.
db.exec(`
  CREATE TABLE IF NOT EXISTS job_assignees (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    role_on_job   TEXT    NOT NULL CHECK(role_on_job IN ('lead','collaborator','sourcer')),
    assigned_by   INTEGER REFERENCES users(id),
    assigned_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(job_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_job_assignees_job  ON job_assignees(job_id);
  CREATE INDEX IF NOT EXISTS idx_job_assignees_user ON job_assignees(user_id);
`);

// ── Phase 4: Hiring Manager portal ───────────────────────────────────────
// External stakeholders (role=hiring_manager) attach to specific jobs and
// submit per-candidate feedback. They never see the candidate database in
// bulk — only the candidates pushed through evaluation on jobs they own.
db.exec(`
  CREATE TABLE IF NOT EXISTS job_hiring_managers (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id    INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    added_by  INTEGER REFERENCES users(id),
    added_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(job_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_jhm_user ON job_hiring_managers(user_id);
  CREATE INDEX IF NOT EXISTS idx_jhm_job  ON job_hiring_managers(job_id);

  CREATE TABLE IF NOT EXISTS hm_candidate_feedback (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id          INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    hm_user_id      INTEGER NOT NULL REFERENCES users(id),
    recommendation  TEXT    CHECK(recommendation IN ('strong_yes','yes','maybe','no','strong_no')),
    notes           TEXT,
    submitted_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(job_id, candidate_id, hm_user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_hcf_job  ON hm_candidate_feedback(job_id);
  CREATE INDEX IF NOT EXISTS idx_hcf_cand ON hm_candidate_feedback(candidate_id);
`);

// ── Phase 5: activity log ─────────────────────────────────────────────────
// Append-only timeline of who did what. Driven by logActivity() in route
// handlers. Best-effort: insertion failures must never break the request,
// so this is a separate, independently-maintained table.
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    action       TEXT    NOT NULL,
    entity_type  TEXT    NOT NULL,
    entity_id    INTEGER,
    metadata     TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_activity_company ON activity_log(company_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_user    ON activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_entity  ON activity_log(entity_type, entity_id);
`);

// ── Market Intelligence (4-stage pipeline per Zeople-MI-Algorithm-Spec) ───
// One row per generated report. Stages 2 (research) and 4 (final report) write
// into research_doc and report_data respectively, so each stage can be re-run
// independently without burning a fresh web-research call.
db.exec(`
  CREATE TABLE IF NOT EXISTS mi_reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    job_id          INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    status          TEXT    NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','researching','structuring','generating','completed','failed')),
    job_context     TEXT    NOT NULL,         -- JSON: the JobContext fed into Stage 2
    research_doc    TEXT,                     -- JSON: raw Stage 2 content + citations
    report_data     TEXT,                     -- JSON: final ReportData (structuredData + execSummary)
    failure_reason  TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mi_reports_company ON mi_reports(company_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_mi_reports_user    ON mi_reports(user_id);
  CREATE INDEX IF NOT EXISTS idx_mi_reports_job     ON mi_reports(job_id);
  CREATE INDEX IF NOT EXISTS idx_mi_reports_status  ON mi_reports(status) WHERE status != 'completed';
`);

// Migration: candidate interaction columns on pofu_emails
try { db.exec('ALTER TABLE pofu_emails ADD COLUMN response_token TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE pofu_emails ADD COLUMN response_options TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE pofu_emails ADD COLUMN candidate_response TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE pofu_emails ADD COLUMN responded_at TEXT'); } catch (_) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_pofu_emails_token ON pofu_emails(response_token)'); } catch (_) {}

// ── MCQ Assessment tables ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS assessments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    job_id          INTEGER REFERENCES jobs(id),
    title           TEXT    NOT NULL,
    description     TEXT,
    instructions    TEXT,
    time_limit_min  INTEGER NOT NULL DEFAULT 30,
    pass_score      INTEGER NOT NULL DEFAULT 60,
    status          TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_assessments_user ON assessments(user_id);

  CREATE TABLE IF NOT EXISTS assessment_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id   INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_text   TEXT    NOT NULL,
    options         TEXT    NOT NULL DEFAULT '[]',
    correct_option  TEXT    NOT NULL,
    explanation     TEXT,
    topic           TEXT,
    difficulty      TEXT    NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
    order_num       INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_aq_assessment ON assessment_questions(assessment_id);

  CREATE TABLE IF NOT EXISTS assessment_invites (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id   INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    candidate_id    INTEGER REFERENCES candidates(id),
    candidate_name  TEXT    NOT NULL,
    candidate_email TEXT    NOT NULL,
    token           TEXT    NOT NULL UNIQUE,
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','started','completed')),
    invited_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    started_at      TEXT,
    completed_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ai_assessment ON assessment_invites(assessment_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_token ON assessment_invites(token);

  CREATE TABLE IF NOT EXISTS assessment_submissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invite_id       INTEGER NOT NULL REFERENCES assessment_invites(id) ON DELETE CASCADE,
    assessment_id   INTEGER NOT NULL REFERENCES assessments(id),
    answers         TEXT    NOT NULL DEFAULT '{}',
    score           INTEGER,
    correct_count   INTEGER,
    total_questions INTEGER,
    time_taken_sec  INTEGER,
    ai_evaluation   TEXT,
    submitted_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_as_invite ON assessment_submissions(invite_id);
`);

// ── Coding Assessment tables ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS coding_assessments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    job_id         INTEGER REFERENCES jobs(id),
    title          TEXT    NOT NULL,
    description    TEXT,
    instructions   TEXT,
    time_limit_min INTEGER NOT NULL DEFAULT 60,
    pass_score     INTEGER NOT NULL DEFAULT 60,
    status         TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ca_user ON coding_assessments(user_id);

  CREATE TABLE IF NOT EXISTS coding_questions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id     INTEGER NOT NULL REFERENCES coding_assessments(id) ON DELETE CASCADE,
    title             TEXT    NOT NULL,
    problem_statement TEXT    NOT NULL,
    starter_code      TEXT,
    language          TEXT    NOT NULL DEFAULT 'javascript',
    question_type     TEXT    NOT NULL DEFAULT 'write' CHECK(question_type IN ('write','fix','complete')),
    difficulty        TEXT    NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
    topic             TEXT,
    order_num         INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_cq_assessment ON coding_questions(assessment_id);

  CREATE TABLE IF NOT EXISTS coding_invites (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id   INTEGER NOT NULL REFERENCES coding_assessments(id) ON DELETE CASCADE,
    candidate_id    INTEGER REFERENCES candidates(id),
    candidate_name  TEXT    NOT NULL,
    candidate_email TEXT    NOT NULL,
    token           TEXT    NOT NULL UNIQUE,
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','started','completed')),
    invited_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    started_at      TEXT,
    completed_at    TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_token ON coding_invites(token);

  CREATE TABLE IF NOT EXISTS coding_submissions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    invite_id      INTEGER NOT NULL REFERENCES coding_invites(id) ON DELETE CASCADE,
    assessment_id  INTEGER NOT NULL REFERENCES coding_assessments(id),
    answers        TEXT    NOT NULL DEFAULT '{}',
    score          INTEGER,
    ai_evaluation  TEXT,
    time_taken_sec INTEGER,
    submitted_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_csub_invite ON coding_submissions(invite_id);
`);

// ── Ask MIS — conversation history for the on-demand reporting bot ──────────
db.exec(`
  CREATE TABLE IF NOT EXISTS mis_conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL DEFAULT 'Untitled query',
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mis_conv_user ON mis_conversations(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS mis_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES mis_conversations(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL CHECK(role IN ('user','assistant')),
    content         TEXT    NOT NULL,
    sql_used        TEXT,
    tables_json     TEXT,
    latency_ms      INTEGER,
    error           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mis_msg_conv ON mis_messages(conversation_id, id);
`);

// ── Candidate Intelligence Map (claim store) — IDF Feature 1: Gap-Driven Probing ──
// Structured, checkable claims pulled from a candidate's resume/JD. The live probe
// path passes these through the request (no DB round-trip needed mid-call); this
// table is the persistence surface that Confidence (#2) and Benchmarking (#5) will
// reuse once a call/candidate id is known.
db.exec(`
  CREATE TABLE IF NOT EXISTS candidate_claims (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id      INTEGER REFERENCES calls(id) ON DELETE CASCADE,
    candidate_id INTEGER REFERENCES candidates(id),
    skill        TEXT,
    claim        TEXT,
    criticality  TEXT,
    source       TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_candidate_claims_call ON candidate_claims(call_id);
`);

// ── Answer Corpus — IDF Feature 5: Benchmarking + Continuous Learning Loop (M8) ──
// Anonymised at ingestion: ONLY company / role / skill / score — no candidate id,
// name, or PII. Cohort statistics read from here; a minimum cohort size is enforced
// at query time so we never show a percentile off a handful of samples.
db.exec(`
  CREATE TABLE IF NOT EXISTS answer_corpus (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id  INTEGER,
    role_family TEXT,
    skill       TEXT,
    score       INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_corpus_cohort ON answer_corpus(company_id, skill);
`);

// ── Bias Detection & Mitigation — IDF Feature 3 (recruiter conduct, M7) ──────
// Objective per-call recruiter metrics + flagged bias patterns. Bias is assessed
// on the RECRUITER's conduct only; protected attributes are never stored.
db.exec(`
  CREATE TABLE IF NOT EXISTS recruiter_call_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id         INTEGER REFERENCES calls(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id),
    job_id          INTEGER,
    question_count  INTEGER,
    recruiter_chars INTEGER,
    candidate_chars INTEGER,
    talk_ratio_pct  INTEGER,
    bias_score      INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rcm_user ON recruiter_call_metrics(user_id);
  CREATE INDEX IF NOT EXISTS idx_rcm_call ON recruiter_call_metrics(call_id);

  CREATE TABLE IF NOT EXISTS bias_flags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id    INTEGER REFERENCES calls(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id),
    type       TEXT,
    severity   TEXT,
    evidence   TEXT,
    in_call    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_bias_user ON bias_flags(user_id);
  CREATE INDEX IF NOT EXISTS idx_bias_call ON bias_flags(call_id);
`);

// Read-only handle for the Ask MIS agent. Same DB file, opened separately so
// even a buggy generated query cannot mutate state. Each request still opens
// its own short-lived readonly handle for scope view installation; this shared
// handle is exposed for callers that just need read-only access (e.g. tests).
const dbReadOnly = new Database(DB_PATH, { readonly: true, fileMustExist: true });
dbReadOnly.pragma('query_only = ON');

// ── Schema migrations (safe, idempotent) ────────────────────────────────────
(function runMigrations() {
  // Rebuild users table if role CHECK constraint doesn't include 'superuser'
  try {
    const userMaster = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();

    // Trigger only when the schema is genuinely the v1 shape (no 'superuser')
    // AND not yet at v3 (no 'hiring_manager'). After Phase 1 the table sits at
    // v3 and "superuser" is absent — without the v3 guard we'd misfire here.
    const needsConstraintFix = userMaster
      && !userMaster.sql.includes('superuser')
      && !userMaster.sql.includes('hiring_manager');

    if (needsConstraintFix) {
      const cols = db.pragma('table_info(users)').map(c => c.name);
      // Only copy columns that actually exist in the old table
      const optionalCols = ['company_id', 'created_by', 'is_active'].filter(c => cols.includes(c));
      const baseCols     = ['id', 'email', 'password_hash', 'role', 'display_name'];
      const allCols      = [...baseCols, ...optionalCols, 'created_at'];
      const colList      = allCols.join(', ');

      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE users_v2 (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT    NOT NULL UNIQUE,
          password_hash TEXT    NOT NULL,
          role          TEXT    NOT NULL CHECK(role IN ('admin', 'superuser', 'subuser')),
          display_name  TEXT,
          company_id    INTEGER,
          created_by    INTEGER,
          is_active     INTEGER NOT NULL DEFAULT 1,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO users_v2 (${colList}) SELECT ${colList} FROM users;
        DROP TABLE users;
        ALTER TABLE users_v2 RENAME TO users;
      `);
      db.pragma('foreign_keys = ON');
      console.log('✅ Migrated users table: role CHECK now includes superuser');
    } else {
      // Table already has superuser; just add missing columns
      const userCols = db.pragma('table_info(users)').map(c => c.name);
      if (!userCols.includes('company_id')) {
        try { db.prepare('ALTER TABLE users ADD COLUMN company_id INTEGER').run(); } catch (_) {}
      }
      if (!userCols.includes('created_by')) {
        try { db.prepare('ALTER TABLE users ADD COLUMN created_by INTEGER').run(); } catch (_) {}
      }
      if (!userCols.includes('is_active')) {
        try { db.prepare('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1').run(); } catch (_) {}
      }
    }
  } catch (e) {
    console.error('[migration] users table:', e.message);
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  }

  // ── Phase 1: expand users.role CHECK to the 6-role hierarchy ──────────────
  // owner / team_lead / sr_recruiter / recruiter / sourcer / hiring_manager
  // Maps existing rows: admin → owner, superuser → owner, subuser → recruiter.
  try {
    const userMaster = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();
    const needsRoleExpansion = userMaster && !userMaster.sql.includes('hiring_manager');

    if (needsRoleExpansion) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE users_v3 (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT    NOT NULL UNIQUE,
          password_hash TEXT    NOT NULL,
          role          TEXT    NOT NULL CHECK(role IN
                          ('owner','team_lead','sr_recruiter','recruiter','sourcer','hiring_manager')),
          display_name  TEXT,
          company_id    INTEGER,
          created_by    INTEGER,
          is_active     INTEGER NOT NULL DEFAULT 1,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO users_v3 (id, email, password_hash, role, display_name, company_id, created_by, is_active, created_at)
        SELECT id, email, password_hash,
          CASE role
            WHEN 'admin'     THEN 'owner'
            WHEN 'superuser' THEN 'owner'
            WHEN 'subuser'   THEN 'recruiter'
            ELSE role
          END,
          display_name, company_id, created_by, is_active, created_at
        FROM users;
        DROP TABLE users;
        ALTER TABLE users_v3 RENAME TO users;
      `);
      db.pragma('foreign_keys = ON');
      console.log('✅ Migrated users table: role CHECK expanded to 6 roles · existing rows remapped');
    }
  } catch (e) {
    console.error('[migration] users role expansion:', e.message);
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  }
})();

async function seedUsers() {
  const users = [
    { email: 'pratik@zeople-ai.com',  password: 'password123', role: 'owner', display_name: 'Pratik'  },
    { email: 'divakar@zeople-ai.com', password: 'password123', role: 'owner', display_name: 'Divakar' },
  ];

  for (const user of users) {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(user.email);
    if (!existing) {
      const hash = await bcrypt.hash(user.password, 10);
      db.prepare('INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)')
        .run(user.email, hash, user.role, user.display_name);
      console.log(`✅ Seeded user: ${user.email} (${user.role})`);
    } else if (existing.role !== user.role) {
      // Upgrade Divakar from subuser → superuser on restart
      db.prepare('UPDATE users SET role = ? WHERE email = ?').run(user.role, user.email);
      console.log(`✅ Updated role for ${user.email}: ${existing.role} → ${user.role}`);
    }
  }

  // Seed Divakar's company if not yet created
  const divakar = db.prepare('SELECT id, company_id FROM users WHERE email = ?').get('divakar@zeople-ai.com');
  if (divakar && !divakar.company_id) {
    const co = db.prepare(
      `INSERT INTO companies (owner_id, name, industry, contact_email) VALUES (?, ?, ?, ?)`
    ).run(divakar.id, 'Zeople AI', 'Recruitment Technology', 'divakar@zeople-ai.com');
    db.prepare('UPDATE users SET company_id = ? WHERE id = ?').run(co.lastInsertRowid, divakar.id);
    console.log('✅ Seeded company for Divakar');
  }
}

// ── Phase 0 backfill: ensure every user has a company and every job/candidate
// is scoped to one. Runs AFTER seedUsers() so the seeded admin/superuser exist.
function ensureCompanyScoping() {
  // 1. For every user with no company_id, create a personal workspace and
  //    attach them to it. Owner-of-record on the company is the user themself.
  const orphanUsers = db.prepare(
    'SELECT id, email, display_name FROM users WHERE company_id IS NULL'
  ).all();

  if (orphanUsers.length) {
    const insertCompany = db.prepare(
      `INSERT INTO companies (owner_id, name, industry, contact_email)
       VALUES (?, ?, ?, ?)`
    );
    const linkUser = db.prepare(
      'UPDATE users SET company_id = ? WHERE id = ?'
    );

    db.transaction(() => {
      for (const u of orphanUsers) {
        const name = `${u.display_name || u.email.split('@')[0]}'s Workspace`;
        const co   = insertCompany.run(u.id, name, 'Recruitment', u.email);
        linkUser.run(co.lastInsertRowid, u.id);
        console.log(`✅ [phase 0] Created company "${name}" for user ${u.email}`);
      }
    })();
  }

  // 2. Backfill jobs.company_id from each row's creator user.
  const jobsBackfilled = db.prepare(
    `UPDATE jobs
     SET company_id = (SELECT company_id FROM users WHERE users.id = jobs.user_id)
     WHERE company_id IS NULL`
  ).run().changes;
  if (jobsBackfilled) console.log(`✅ [phase 0] Backfilled company_id on ${jobsBackfilled} job(s)`);

  // 3. Backfill candidates.company_id from each row's creator user.
  const candsBackfilled = db.prepare(
    `UPDATE candidates
     SET company_id = (SELECT company_id FROM users WHERE users.id = candidates.user_id)
     WHERE company_id IS NULL`
  ).run().changes;
  if (candsBackfilled) console.log(`✅ [phase 0] Backfilled company_id on ${candsBackfilled} candidate(s)`);

  // 4. Phase 2 backfill: for every existing job, insert a 'lead' assignee row
  //    pointing to the original creator. Idempotent via UNIQUE(job_id,user_id).
  const leadsBackfilled = db.prepare(
    `INSERT OR IGNORE INTO job_assignees (job_id, user_id, role_on_job, assigned_by)
     SELECT j.id, j.user_id, 'lead', j.user_id
     FROM jobs j
     WHERE j.user_id IS NOT NULL`
  ).run().changes;
  if (leadsBackfilled) console.log(`✅ [phase 2] Created lead assignee rows for ${leadsBackfilled} job(s)`);
}

module.exports = { db, dbReadOnly, DB_PATH, seedUsers, ensureCompanyScoping };
