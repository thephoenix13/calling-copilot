/**
 * One-shot migration: strip visible "Demo" markers from already-seeded rows,
 * but FIRST capture their IDs into .seed-demo-ids.json so future seed re-runs
 * can still clean them up. After this script runs, the seed-demo.js script
 * uses the ID file (not markers) for idempotency.
 *
 * Run once:  node server/seed-demo-cleanup-markers.js
 */

const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');

const DB_PATH = path.join(__dirname, '..', 'recruiter.db');
const ID_FILE = path.join(__dirname, '.seed-demo-ids.json');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// 1. Capture IDs of currently-seeded rows (by their existing markers)
const ids = {
  candidates:           db.prepare("SELECT id FROM candidates WHERE email LIKE '%@demo.in'").all().map(r => r.id),
  sessions:             db.prepare("SELECT id FROM sessions WHERE name LIKE '[Demo] %'").all().map(r => r.id),
  calls:                db.prepare("SELECT id FROM calls WHERE call_sid LIKE 'DEMO-%'").all().map(r => r.id),
  video_interviews:     db.prepare("SELECT id FROM video_interviews WHERE title LIKE '[Demo] %'").all().map(r => r.id),
  assessments:          db.prepare("SELECT id FROM assessments WHERE title LIKE '[Demo] %'").all().map(r => r.id),
  coding_assessments:   db.prepare("SELECT id FROM coding_assessments WHERE title LIKE '[Demo] %'").all().map(r => r.id),
  pofu_candidates:      db.prepare("SELECT id FROM pofu_candidates WHERE candidate_email LIKE '%@demo.in'").all().map(r => r.id),
};

console.log('Captured IDs:');
for (const [table, list] of Object.entries(ids)) {
  console.log(`  ${table.padEnd(22)} ${list.length}`);
}

fs.writeFileSync(ID_FILE, JSON.stringify(ids, null, 2));
console.log(`\nWrote ${ID_FILE}`);

// 2. Strip visible markers
console.log('\nStripping visible markers...');
db.transaction(() => {
  // Session names
  const r1 = db.prepare("UPDATE sessions SET name = REPLACE(name, '[Demo] ', '') WHERE name LIKE '[Demo] %'").run();
  console.log(`  sessions.name           ${r1.changes} rows`);

  // Video interview titles
  const r2 = db.prepare("UPDATE video_interviews SET title = REPLACE(title, '[Demo] ', '') WHERE title LIKE '[Demo] %'").run();
  console.log(`  video_interviews.title  ${r2.changes} rows`);

  // MCQ assessment titles
  const r3 = db.prepare("UPDATE assessments SET title = REPLACE(title, '[Demo] ', '') WHERE title LIKE '[Demo] %'").run();
  console.log(`  assessments.title       ${r3.changes} rows`);

  // Coding assessment titles
  const r4 = db.prepare("UPDATE coding_assessments SET title = REPLACE(title, '[Demo] ', '') WHERE title LIKE '[Demo] %'").run();
  console.log(`  coding_assessments.title ${r4.changes} rows`);

  // Email domains: @demo.in → @gmail.com
  const r5 = db.prepare("UPDATE candidates       SET email           = REPLACE(email,           '@demo.in', '@gmail.com') WHERE email           LIKE '%@demo.in'").run();
  const r6 = db.prepare("UPDATE pofu_candidates  SET candidate_email = REPLACE(candidate_email, '@demo.in', '@gmail.com') WHERE candidate_email LIKE '%@demo.in'").run();
  const r7 = db.prepare("UPDATE assessment_invites SET candidate_email = REPLACE(candidate_email, '@demo.in', '@gmail.com') WHERE candidate_email LIKE '%@demo.in'").run();
  const r8 = db.prepare("UPDATE coding_invites     SET candidate_email = REPLACE(candidate_email, '@demo.in', '@gmail.com') WHERE candidate_email LIKE '%@demo.in'").run();
  const r9 = db.prepare("UPDATE video_candidates   SET email           = REPLACE(email,           '@demo.in', '@gmail.com') WHERE email           LIKE '%@demo.in'").run();
  console.log(`  emails (5 tables)        ${r5.changes + r6.changes + r7.changes + r8.changes + r9.changes} rows`);

  // POFU notes (the seed currently writes "Candidate currently in offer_accepted state.") — leave as-is, neutral wording.
})();

console.log('\n✅ Cleanup complete. Re-seed via: node server/seed-demo.js');
db.close();
