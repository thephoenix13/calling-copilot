/**
 * scripts/selftest.js
 *
 * Extra probes the smoke suite doesn't cover:
 *   - Cross-company assignee operations are blocked
 *   - Activity feed records the actions we just performed
 *   - HM feedback round-trips between HM portal and recruiter view
 *   - /reports/summary numbers are internally consistent
 *
 * Run with:  node scripts/selftest.js
 */

const path     = require('path');
const Database = require(path.join(__dirname, '..', 'server', 'node_modules', 'better-sqlite3'));

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', 'recruiter.db');

const results = [];
const ok   = (name, detail = '') => results.push({ name, passed: true,  detail });
const fail = (name, detail = '') => results.push({ name, passed: false, detail });

async function http(method, url, { token, body } = {}) {
  const res = await fetch(BACKEND + url, {
    method,
    headers: {
      ...(body  ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` }   : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  try { parsed = await res.json(); } catch {}
  return { status: res.status, body: parsed };
}

function cleanup() {
  const db = new Database(DB_PATH);
  const u = db.prepare(`SELECT id, company_id FROM users WHERE email LIKE 'selftest-%@example.in'`).all();
  if (u.length === 0) { db.close(); return; }
  const ids = u.map(x => x.id);
  const ph  = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM hm_candidate_feedback WHERE hm_user_id  IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM job_hiring_managers   WHERE user_id     IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM job_hiring_managers   WHERE added_by    IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM job_assignees         WHERE user_id     IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM job_assignees         WHERE assigned_by IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM activity_log          WHERE user_id     IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM users                 WHERE email LIKE 'selftest-%@example.in'`).run();
  // Drop orphan companies (only ones the selftest users solely owned).
  const cos = [...new Set(u.map(x => x.company_id).filter(Boolean))];
  for (const c of cos) {
    const n = db.prepare('SELECT COUNT(*) AS n FROM users WHERE company_id = ?').get(c).n;
    if (n === 0) db.prepare('DELETE FROM companies WHERE id = ?').run(c);
  }
  db.close();
}

async function main() {
  cleanup();

  // ── Setup ────────────────────────────────────────────────────────────────
  const pratikLogin = await http('POST', '/auth/login', { body: { email: 'pratik@zeople-ai.com',  password: 'password123' } });
  const divLogin    = await http('POST', '/auth/login', { body: { email: 'divakar@zeople-ai.com', password: 'password123' } });
  const pratikToken = pratikLogin.body?.token;
  const divToken    = divLogin.body?.token;

  // ── Probe 1: Cross-company assignee add (Divakar tries to add into Pratik's job)
  // Divakar is owner of company 1; job 1 belongs to Pratik's company 2.
  const xCompany = await http('POST', '/jobs/1/assignees', {
    token: divToken,
    body: { user_id: 2, role_on_job: 'collaborator' },  // Divakar himself
  });
  if (xCompany.status === 404) ok('Cross-company assignee add → 404 (Divakar cannot touch Pratik\'s job)');
  else fail('Cross-company assignee add → 404', `got ${xCompany.status}`);

  // ── Probe 2: Activity feed records mutations ────────────────────────────
  // Take a snapshot of activity, do an action, confirm a new event appears.
  const beforeAct = await http('GET', '/admin/activity?limit=5', { token: pratikToken });
  const beforeIds = new Set((beforeAct.body?.events || []).map(e => e.id));

  // Provision a selftest TL.
  const tlEmail = `selftest-tl-${Date.now()}@example.in`;
  const tlCreate = await http('POST', '/settings/team', {
    token: pratikToken,
    body: { email: tlEmail, password: 'tlpass1234', display_name: 'Selftest TL', role: 'team_lead' },
  });
  const tlId = tlCreate.body?.member?.id;
  if (!tlId) { fail('Provision Team Lead', `status=${tlCreate.status}`); cleanup(); printResults(); return; }

  // Have Pratik attach the TL to job 1 — should log job.assignee.add
  const attach = await http('POST', '/jobs/1/assignees', {
    token: pratikToken,
    body: { user_id: tlId, role_on_job: 'collaborator' },
  });
  if (attach.status !== 200) { fail('Attach TL to job 1', `status=${attach.status}`); }

  const afterAct = await http('GET', '/admin/activity?limit=10', { token: pratikToken });
  const newEvent = (afterAct.body?.events || []).find(e =>
    !beforeIds.has(e.id) && e.action === 'job.assignee.add' && e.entity_id === 1
  );
  if (newEvent && (newEvent.metadata?.user_id ?? null) === tlId) {
    ok(`Activity feed recorded job.assignee.add for the new TL (event id=${newEvent.id})`);
  } else {
    fail('Activity feed recorded job.assignee.add', `newEvent=${JSON.stringify(newEvent)}`);
  }

  // ── Probe 3: HM feedback round-trip ──────────────────────────────────────
  const hmEmail = `selftest-hm-${Date.now()}@example.in`;
  const hmCreate = await http('POST', '/settings/team', {
    token: pratikToken,
    body: { email: hmEmail, password: 'hmpass1234', display_name: 'Selftest HM', role: 'hiring_manager' },
  });
  const hmId    = hmCreate.body?.member?.id;
  const hmLogin = await http('POST', '/auth/login', { body: { email: hmEmail, password: 'hmpass1234' } });
  const hmToken = hmLogin.body?.token;

  await http('POST', '/jobs/1/hiring-managers', { token: pratikToken, body: { user_id: hmId } });

  // HM submits feedback on a candidate that's actually on the shortlist for job 1.
  const cands = await http('GET', '/hm/jobs/1/candidates', { token: hmToken });
  const targetCand = (cands.body?.candidates || [])[0];
  if (!targetCand) {
    ok('HM feedback round-trip — skipped (no shortlisted candidates on job 1)');
  } else {
    const feedbackPost = await http('POST', `/hm/jobs/1/candidates/${targetCand.id}/feedback`, {
      token: hmToken,
      body: { recommendation: 'strong_yes', notes: 'Selftest probe — strong fit for the role.' },
    });
    if (feedbackPost.status !== 200) {
      fail('HM submits feedback', `status=${feedbackPost.status}`);
    }

    // Now Pratik (recruiter side) reads HM feedback.
    const fbList = await http('GET', '/jobs/1/hm-feedback', { token: pratikToken });
    const seen = (fbList.body?.feedback || []).find(f =>
      f.hm_user_id === hmId && f.candidate_id === targetCand.id && f.recommendation === 'strong_yes'
    );
    if (seen) {
      ok('HM feedback visible to recruiter via /jobs/:id/hm-feedback (round-trip ok)');
    } else {
      fail('HM feedback visible to recruiter', `feedback list=${JSON.stringify(fbList.body?.feedback)}`);
    }
  }

  // ── Probe 4: /reports/summary numerical sanity ───────────────────────────
  // For Pratik (owner), totalJobs should equal company-scoped jobs count.
  const summary = await http('GET', '/reports/summary', { token: pratikToken });
  const apiTotalJobs = summary.body?.overview?.totalJobs ?? -1;

  const db = new Database(DB_PATH, { readonly: true });
  const dbCompanyJobs = db.prepare(`
    SELECT COUNT(*) AS c FROM jobs j
    JOIN users u ON u.id = j.user_id
    WHERE u.company_id = (SELECT company_id FROM users WHERE email = 'pratik@zeople-ai.com')
  `).get().c;
  db.close();

  if (apiTotalJobs === dbCompanyJobs) {
    ok(`/reports/summary totalJobs (${apiTotalJobs}) matches DB company-jobs count (${dbCompanyJobs})`);
  } else {
    fail('/reports/summary totalJobs matches DB', `api=${apiTotalJobs} db=${dbCompanyJobs}`);
  }

  // ── Probe 5: Sourcer can see jobs but not write to them via /jobs ────────
  const srcEmail = `selftest-src-${Date.now()}@example.in`;
  const srcCreate = await http('POST', '/settings/team', {
    token: pratikToken,
    body: { email: srcEmail, password: 'srcpass1234', display_name: 'Selftest Sourcer', role: 'sourcer' },
  });
  if (!srcCreate.body?.member?.id) { fail('Provision sourcer', `status=${srcCreate.status}`); }
  else {
    const srcLogin = await http('POST', '/auth/login', { body: { email: srcEmail, password: 'srcpass1234' } });
    const srcToken = srcLogin.body?.token;

    const srcJobs = await http('GET', '/jobs', { token: srcToken });
    if (srcJobs.status === 200 && (srcJobs.body?.jobs?.length ?? 0) > 0) {
      ok(`Sourcer reads /jobs (${srcJobs.body.jobs.length} jobs visible)`);
    } else {
      fail('Sourcer reads /jobs', `status=${srcJobs.status} count=${srcJobs.body?.jobs?.length}`);
    }

    const srcCreateJob = await http('POST', '/jobs', {
      token: srcToken,
      body: { title: 'should-fail', status: 'active' },
    });
    if (srcCreateJob.status === 403) {
      ok('Sourcer blocked from POST /jobs (capability gate)');
    } else {
      fail('Sourcer blocked from POST /jobs', `got ${srcCreateJob.status}`);
    }
  }

  // ── Probe 6: Detach + cleanup ────────────────────────────────────────────
  await http('DELETE', `/jobs/1/assignees/${tlId}`, { token: pratikToken });
  await http('DELETE', `/jobs/1/hiring-managers/${hmId}`, { token: pratikToken });

  cleanup();
  printResults();
}

function printResults() {
  console.log('\n──── Self-test Results ────');
  for (const r of results) {
    if (r.passed) console.log(`  ✅ ${r.name}`);
    else          console.log(`  ❌ ${r.name}\n     ${r.detail}`);
  }
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  console.log(`────────────────────────────`);
  console.log(`${passed}/${results.length} passed${failed ? `, ${failed} failed` : ''}.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 selftest crashed:', err);
  cleanup();
  process.exit(2);
});
