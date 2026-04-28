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
