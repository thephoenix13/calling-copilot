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
    role          TEXT    NOT NULL CHECK(role IN ('admin', 'subuser')),
    display_name  TEXT,
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

async function seedUsers() {
  const users = [
    { email: 'pratik@zeople-ai.com',  password: 'password123', role: 'admin',   display_name: 'Pratik' },
    { email: 'divakar@zeople-ai.com', password: 'password123', role: 'subuser', display_name: 'Divakar' },
  ];

  for (const user of users) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email);
    if (!existing) {
      const hash = await bcrypt.hash(user.password, 10);
      db.prepare('INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)')
        .run(user.email, hash, user.role, user.display_name);
      console.log(`✅ Seeded user: ${user.email}`);
    }
  }
}

module.exports = { db, seedUsers };
