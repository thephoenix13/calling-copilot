// Answer Corpus — IDF Feature 5: Benchmarking + Continuous Learning Loop (M8).
//
// Ingestion is anonymised: we store only (company, role_family, skill, score).
// No candidate id, name, or PII ever enters this table. Cohort statistics are
// gated by MIN_COHORT so a percentile is never computed off a few samples.

const { db } = require('../db');

const MIN_COHORT = 30;

const normRole  = (r) => ((r || '').toString().trim().toLowerCase().slice(0, 80) || null);
const normSkill = (s) => (s || '').toString().trim().slice(0, 80);
const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n))));

// Record a batch of {skill, score} pairs for a role. Best-effort: never throws
// in a way that should break the caller's request (callers still wrap in try).
function recordCorpus(companyId, roleFamily, items) {
  const role = normRole(roleFamily);
  const rows = (Array.isArray(items) ? items : [])
    .map((it) => ({ skill: normSkill(it && it.skill), score: it && it.score }))
    .filter((r) => r.skill && Number.isFinite(Number(r.score)));
  if (!rows.length) return 0;

  const ins = db.prepare(
    'INSERT INTO answer_corpus (company_id, role_family, skill, score) VALUES (?,?,?,?)'
  );
  const tx = db.transaction((rs) => {
    for (const r of rs) ins.run(companyId ?? null, role, r.skill, clampScore(r.score));
  });
  tx(rows);
  return rows.length;
}

// Where does `score` sit in the cohort for (company, skill[, role])?
// Returns { skill, cohortSize, percentile?, insufficient, minCohort }.
function benchmark({ companyId, roleFamily, skill, score }) {
  const sk = normSkill(skill);
  const role = normRole(roleFamily);
  const cid = companyId ?? null;

  // Default cohort: company + skill. If a role is given AND its tighter cohort is
  // itself large enough, prefer it — otherwise fall back to the broader skill cohort.
  let cohort = db
    .prepare('SELECT score FROM answer_corpus WHERE company_id IS ? AND skill = ?')
    .all(cid, sk)
    .map((r) => r.score);

  if (role) {
    const byRole = db
      .prepare('SELECT score FROM answer_corpus WHERE company_id IS ? AND skill = ? AND role_family = ?')
      .all(cid, sk, role)
      .map((r) => r.score);
    if (byRole.length >= MIN_COHORT) cohort = byRole;
  }

  const n = cohort.length;
  if (n < MIN_COHORT) {
    return { skill: sk, cohortSize: n, minCohort: MIN_COHORT, insufficient: true };
  }

  const s = clampScore(score);
  const below = cohort.filter((v) => v < s).length;
  const percentile = Math.round((below / n) * 100);
  return { skill: sk, cohortSize: n, percentile, minCohort: MIN_COHORT, insufficient: false };
}

module.exports = { recordCorpus, benchmark, MIN_COHORT };
