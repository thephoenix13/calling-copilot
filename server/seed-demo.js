/**
 * server/seed-demo.js
 *
 * Idempotent demo seed: safe to re-run. The script tracks all rows it
 * inserts in `server/.seed-demo-ids.json`. On each run it deletes
 * the previously-seeded rows (by ID) before inserting fresh ones, so
 * re-running never duplicates and never affects real (un-tracked) data.
 *
 * Run with:  node server/seed-demo.js
 */

const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'recruiter.db');
const ID_FILE = path.join(__dirname, '.seed-demo-ids.json');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const pick   = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const choose = (arr, n) => {
  const a = arr.slice();
  const out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
};
const daysAgo = (d, hour = 11, min = 30) => {
  const t = new Date(); t.setDate(t.getDate() - d); t.setHours(hour, min, 0, 0);
  return t.toISOString().slice(0, 19).replace('T', ' ');
};
const initials = (name) => name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
const randId   = () => crypto.randomBytes(8).toString('hex');

const seededIds = {
  candidates: [], sessions: [], calls: [], video_interviews: [],
  assessments: [], coding_assessments: [], pofu_candidates: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Indian name pool + role/skill data
// ─────────────────────────────────────────────────────────────────────────────
const INDIAN_NAMES = [
  'Aarav Sharma','Aditi Iyer','Ananya Reddy','Arjun Mehta','Bhavna Singh',
  'Devendra Patel','Diya Joshi','Esha Kapoor','Farhan Khan','Gaurav Desai',
  'Harsha Bansal','Ishaan Verma','Jaya Pillai','Kiran Rao','Lakshmi Nair',
  'Manish Malhotra','Nandita Bose','Omkar Kulkarni','Priya Kapoor','Rahul Gupta',
  'Saanvi Choudhary','Tanvi Agarwal','Uday Khanna','Varun Jain','Yashika Saxena',
  'Komal Sharma','Rohan Bhatt','Neha Shetty','Vikram Pandey','Riya Banerjee',
];

const SKILLS_BY_ROLE = {
  'Senior React Developer':       ['React','TypeScript','Redux','Next.js','TailwindCSS','Jest'],
  'Node.js Backend Engineer':     ['Node.js','Express','PostgreSQL','Redis','REST APIs','Docker'],
  'Full Stack Developer (MERN)':  ['React','Node.js','MongoDB','Express','REST APIs','Git'],
  'Data Engineer':                ['Python','Airflow','Spark','SQL','Snowflake','dbt'],
  'DevOps / Platform Engineer':   ['Kubernetes','AWS','Terraform','CI/CD','Prometheus','Linux'],
  'Product Manager — SaaS B2B':   ['Product Strategy','Roadmapping','SQL','User Research','SaaS Metrics'],
  'QA Automation Engineer':       ['Selenium','TestNG','Postman','RestAssured','JIRA','SQL'],
  'Machine Learning Engineer':    ['Python','PyTorch','scikit-learn','MLOps','SQL','AWS SageMaker'],
  'Android Developer (Kotlin)':   ['Kotlin','Android SDK','Jetpack Compose','RxJava','Firebase'],
  'Technical Project Manager':    ['Agile','JIRA','Stakeholder Mgmt','Risk Mgmt','SDLC'],
  'Senior Java Developer':        ['Java','Spring Boot','Hibernate','Microservices','Kafka','SQL'],
};

const CITIES = ['Bangalore','Mumbai','Pune','Hyderabad','Delhi NCR','Chennai','Gurgaon','Noida','Kolkata'];

// ─────────────────────────────────────────────────────────────────────────────
// QA Report generator (matches ai.js shape)
// ─────────────────────────────────────────────────────────────────────────────
const DIMENSIONS = [
  { id: 1, dimension: 'Opening & Positioning',         weight: '10%', max: 15 },
  { id: 2, dimension: 'Communication & Clarity',       weight: '15%', max: 20 },
  { id: 3, dimension: 'Role Selling & Value Prop',     weight: '15%', max: 20 },
  { id: 4, dimension: 'Technical / Functional Screening', weight: '25%', max: 30 },
  { id: 5, dimension: 'Candidate Control',             weight: '10%', max: 5  },
  { id: 6, dimension: 'Closing Effectiveness',         weight: '10%', max: 15 },
  { id: 7, dimension: 'Data Accuracy',                 weight: '5%',  max: 5  },
  { id: 8, dimension: 'Conversion Readiness',          weight: '10%', max: 5  },
];

const EVIDENCE_LIBRARY = {
  fail: [
    'Greeting too casual; no consent or time check.',
    'No project walkthrough; only yes/no skill questions.',
    'Compensation not validated against client band.',
    'Vague closing — no timeline or next-step ownership.',
    'Candidate drove the conversation; recruiter did not steer.',
    'Role pitched as a job title only — no responsibilities or value prop.',
  ],
  warn: [
    'Adequate flow but low confidence; minor grammar slips.',
    'Skill probe was shallow; only one project discussed.',
    'CTC noted but expectations vs band not reconciled.',
    'Closing CTA present but timeline unclear.',
  ],
  pass: [
    'Strong opening with consent, time check, and clear purpose.',
    'Detailed project walkthrough with depth indicators.',
    'Compensation discussed transparently with client band reference.',
    'Crisp closing with timeline and locked availability.',
  ],
};
const QUOTE_LIBRARY = {
  fail: [
    'Hi, this is calling regarding the job opportunity.',
    'Do you have experience in React?',
    'Once your profile is shortlisted, I will let you know.',
  ],
  warn: [
    'We have an opening with the client for this position.',
    'Walk me through your current responsibilities briefly.',
    'I will share the JD and revert with the next step.',
  ],
  pass: [
    'Hi, this is Komal from TechRecruit — do you have 10 minutes to discuss a Senior Java Developer role at PWC?',
    'Walk me through the last microservice you owned end-to-end — what was the throughput?',
    'Next step is a tech round with the lead architect, typically within 5 working days. Can I lock in your availability?',
  ],
};

const RED_FLAGS_BY_ROLE = (role) => ([
  { severity: 'critical', text: `No validation of ${role} expertise — niche role, zero skill probing conducted` },
  { severity: 'critical', text: 'No project, integration, or architecture discussion despite candidate experience' },
  { severity: 'high',     text: 'Salary fit vs client band never confirmed — submission without this is high risk' },
  { severity: 'high',     text: 'Candidate has active offer & joining date — urgency not acknowledged or managed' },
  { severity: 'medium',   text: 'Weak brand representation — may reduce candidate confidence in opportunity' },
]);

const NUDGE_LIBRARY = [
  {
    label: 'Technical Depth', icon: '⚙',
    weak:   'Do you have hands-on experience with this stack?',
    better: 'Walk me through the last production feature you owned end-to-end — what was the data volume and what would you do differently?',
    why:    'Yes/no tech questions give zero signal. Project walkthroughs reveal depth in 60 seconds.',
  },
  {
    label: 'Role Selling', icon: '🎯',
    weak:   'We have an opening for this position with our client.',
    better: 'This is a strategic role on the platform team — you would own scaling and reliability for a fintech serving 10M+ daily users.',
    why:    'Candidates decide in the first 90 seconds whether the call is worth their time.',
  },
  {
    label: 'Closing with Clarity', icon: '🏁',
    weak:   'Once your profile is shortlisted, I will let you know.',
    better: 'Next step is a 45-min tech round with the lead architect — typically within 5 working days. Can I lock in your availability?',
    why:    'Vague closes create dropout risk, especially when a competing offer is on the table.',
  },
  {
    label: 'Compensation Anchoring', icon: '💰',
    weak:   'What are your expectations?',
    better: 'The band for this role is X–Y LPA depending on the panel outcome. Where would you ideally land?',
    why:    'Anchor to the band first to set expectations and avoid mid-process renegotiation.',
  },
];

function buildQAReport({ recruiter, candidate, role, client, durationSec, callDate, callId, scoreTarget }) {
  const target = scoreTarget;
  const scorecard = DIMENSIONS.map(d => {
    const noise = rand(-15, 15);
    const pct = Math.max(5, Math.min(95, target + noise));
    const score = Math.round((pct / 100) * d.max);
    const status = pct >= 70 ? 'pass' : pct >= 45 ? 'warn' : 'fail';
    return {
      ...d, score, pct,
      evidence: pick(EVIDENCE_LIBRARY[status]),
      quote:    pick(QUOTE_LIBRARY[status]),
      status,
    };
  });

  const verdict =
    target >= 70 ? 'READY FOR CLIENT' :
    target >= 50 ? 'READY WITH CONDITIONS' :
                   'NOT READY';
  const riskLevel = target >= 70 ? 'Low' : target >= 50 ? 'Medium' : 'High';
  const outcome   = target >= 70 ? 'Strong Submission' : target >= 50 ? 'Conditional' : 'Critical Fail';

  const dt = new Date(callDate);
  const meta = {
    recruiter,
    recruiterInitials: initials(recruiter),
    date:     dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time:     dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    duration: `${Math.floor(durationSec / 60)} min ${durationSec % 60} sec`,
    candidate, role, client, callId,
  };

  const numFlags = target >= 70 ? 1 : target >= 50 ? 3 : 5;
  const redFlags = choose(RED_FLAGS_BY_ROLE(role), numFlags);

  return {
    meta,
    summary: { score: target, rawScore: Math.round(target * 0.65), maxScore: 100, verdict, riskLevel, outcome },
    scorecard,
    redFlags,
    nudges: choose(NUDGE_LIBRARY, target >= 70 ? 2 : 3),
  };
}

function buildCandidateReport({ candidate, role, scoreTarget }) {
  const recommendation = scoreTarget >= 70 ? 'recommend' : scoreTarget >= 50 ? 'consider' : 'decline';
  return {
    candidate, role,
    overallFit: scoreTarget,
    recommendation,
    strengths: choose([
      'Strong technical foundation in core stack',
      'Hands-on with production systems at scale',
      'Clear communication and structured thinking',
      'Demonstrated ownership of recent projects',
      'Cultural alignment with collaborative environments',
    ], 3),
    concerns: scoreTarget >= 70
      ? ['Notice period may be long', 'Compensation expectations slightly above band']
      : ['Skill depth below required threshold', 'Limited exposure to client tech stack', 'Notice period concerns'],
    summary: `${candidate} is a ${recommendation === 'recommend' ? 'strong' : recommendation === 'consider' ? 'moderate' : 'weak'} fit for the ${role} role based on the screening conversation.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN previous demo data using ID tracking file
// ─────────────────────────────────────────────────────────────────────────────
console.log('🧹 Cleaning previous demo data via ID file...');

let prior = { candidates: [], sessions: [], calls: [], video_interviews: [],
              assessments: [], coding_assessments: [], pofu_candidates: [] };
if (fs.existsSync(ID_FILE)) {
  try { prior = { ...prior, ...JSON.parse(fs.readFileSync(ID_FILE, 'utf-8')) }; }
  catch (e) { console.warn('  Could not parse', ID_FILE, '— starting fresh'); }
}

const inList = (arr) => arr.length ? `(${arr.join(',')})` : '(NULL)';
db.transaction(() => {
  // Calls (cascades to transcripts/reports/call_context)
  if (prior.calls.length) {
    db.prepare(`DELETE FROM transcripts  WHERE call_id IN ${inList(prior.calls)}`).run();
    db.prepare(`DELETE FROM reports      WHERE call_id IN ${inList(prior.calls)}`).run();
    db.prepare(`DELETE FROM call_context WHERE call_id IN ${inList(prior.calls)}`).run();
    db.prepare(`DELETE FROM calls        WHERE id      IN ${inList(prior.calls)}`).run();
  }

  // POFU emails + candidates
  if (prior.pofu_candidates.length) {
    db.prepare(`DELETE FROM pofu_emails     WHERE pofu_candidate_id IN ${inList(prior.pofu_candidates)}`).run();
    db.prepare(`DELETE FROM pofu_candidates WHERE id                IN ${inList(prior.pofu_candidates)}`).run();
  }

  // Video interviews + cascading children
  if (prior.video_interviews.length) {
    const vis = inList(prior.video_interviews);
    db.prepare(`DELETE FROM video_question_evaluations WHERE evaluation_id IN (SELECT id FROM video_evaluations WHERE interview_id IN ${vis})`).run();
    db.prepare(`DELETE FROM video_evaluations          WHERE interview_id IN ${vis}`).run();
    db.prepare(`DELETE FROM video_responses            WHERE interview_id IN ${vis}`).run();
    db.prepare(`DELETE FROM video_candidates           WHERE interview_id IN ${vis}`).run();
    db.prepare(`DELETE FROM video_interview_questions  WHERE interview_id IN ${vis}`).run();
    db.prepare(`DELETE FROM video_interviews           WHERE id            IN ${vis}`).run();
  }

  // MCQ assessments
  if (prior.assessments.length) {
    const aIds = inList(prior.assessments);
    db.prepare(`DELETE FROM assessment_submissions WHERE assessment_id IN ${aIds}`).run();
    db.prepare(`DELETE FROM assessment_invites     WHERE assessment_id IN ${aIds}`).run();
    db.prepare(`DELETE FROM assessment_questions   WHERE assessment_id IN ${aIds}`).run();
    db.prepare(`DELETE FROM assessments            WHERE id            IN ${aIds}`).run();
  }

  // Coding assessments
  if (prior.coding_assessments.length) {
    const cIds = inList(prior.coding_assessments);
    db.prepare(`DELETE FROM coding_submissions WHERE assessment_id IN ${cIds}`).run();
    db.prepare(`DELETE FROM coding_invites     WHERE assessment_id IN ${cIds}`).run();
    db.prepare(`DELETE FROM coding_questions   WHERE assessment_id IN ${cIds}`).run();
    db.prepare(`DELETE FROM coding_assessments WHERE id            IN ${cIds}`).run();
  }

  // Sessions (cascades to session_candidates via FK)
  if (prior.sessions.length) {
    db.prepare(`DELETE FROM session_candidates WHERE session_id IN ${inList(prior.sessions)}`).run();
    db.prepare(`DELETE FROM sessions           WHERE id         IN ${inList(prior.sessions)}`).run();
  }

  // Candidates last
  if (prior.candidates.length) {
    db.prepare(`DELETE FROM candidates WHERE id IN ${inList(prior.candidates)}`).run();
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Seed candidates (split between users)
// ─────────────────────────────────────────────────────────────────────────────
console.log('👤 Seeding candidates...');

const insertCandidate = db.prepare(`
  INSERT INTO candidates
    (user_id, name, email, phone, location, current_title, current_company,
     experience_years, skills, education, work_history, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
`);

const candidateRecords = [];
INDIAN_NAMES.forEach((name, i) => {
  const userId = i % 2 === 0 ? 1 : 2;
  const slug   = name.toLowerCase().replace(/\s+/g, '.');
  const email  = `${slug}@gmail.com`;
  const phone  = '+91 9' + String(rand(100000000, 999999999)).slice(0, 9);
  const role   = pick(Object.keys(SKILLS_BY_ROLE));
  const skills = SKILLS_BY_ROLE[role];
  const company = pick(['Infosys','TCS','Wipro','Accenture','HCL','Cognizant','Capgemini','Tech Mahindra','Mindtree','LTI']);
  const experience = rand(2, 12);
  const result = insertCandidate.run(
    userId, name, email, phone, pick(CITIES), role, company, experience,
    JSON.stringify(skills),
    pick(['B.E. CS, VIT','B.Tech IT, NIT Trichy','M.Tech, IIIT-H','B.E. ECE, BITS Pilani','B.Tech CS, IIT Bombay']),
    JSON.stringify([{ company, role, years: experience }]),
  );
  candidateRecords.push({ id: result.lastInsertRowid, user_id: userId, name, email, phone, role });
  seededIds.candidates.push(result.lastInsertRowid);
});
console.log(`  +${candidateRecords.length} candidates`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Seed sessions + session candidates
// ─────────────────────────────────────────────────────────────────────────────
console.log('🧭 Seeding sessions + pipeline candidates...');

const allJobs = db.prepare('SELECT id, user_id, title, client_name FROM jobs').all();
const jobsByUser = (uid) => allJobs.filter(j => j.user_id === uid);

const insertSession = db.prepare(`
  INSERT INTO sessions (user_id, job_id, name, current_step, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertSC = db.prepare(`
  INSERT INTO session_candidates
    (session_id, candidate_id, match_percentage, screening_status, decision, pipeline_status,
     vi_invite_sent, ai_interview_score, email_sent, added_at, selected_at, vi_review)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const SESSION_NAMES = [
  'Senior React Hiring Drive Q2','MERN Stack Pipeline','DevOps Bench','Java Backend Sprint',
  'Data Engineering Cohort','PM Pipeline','Java Senior Hiring','Sales AM Pool',
];
const sessionRecords = [];
for (let i = 0; i < SESSION_NAMES.length; i++) {
  const userId = i % 2 === 0 ? 1 : 2;
  const userJobs = jobsByUser(userId);
  if (!userJobs.length) continue;
  const job = pick(userJobs);
  const step = pick([2, 4, 5, 6, 8]);
  const created = daysAgo(rand(3, 35));
  const r = insertSession.run(userId, job.id, SESSION_NAMES[i], step, 'active', created, created);
  sessionRecords.push({ id: r.lastInsertRowid, user_id: userId, job_id: job.id, job_title: job.title, client: job.client_name });
  seededIds.sessions.push(r.lastInsertRowid);
}

const ownedCandidates = (uid) => candidateRecords.filter(c => c.user_id === uid);
let totalSC = 0;
for (const s of sessionRecords) {
  const pool = ownedCandidates(s.user_id);
  const picks = choose(pool, rand(4, 8));
  for (const c of picks) {
    const screen = pick(['pending','pass','pass','pass','fail','on_hold']);
    let decision = null, pipeline = 'pending', vi = 0, viScore = null, emailSent = 0, selectedAt = null, viReview = null;
    if (screen === 'pass') {
      vi = Math.random() < 0.7 ? 1 : 0;
      if (vi) viScore = rand(55, 92);
      decision = pick(['proceed','proceed','pool']);
      emailSent = 1;
      if (decision === 'proceed') {
        pipeline = pick(['pending','pending','hold','selected','selected','reject']);
        if (pipeline === 'selected') selectedAt = daysAgo(rand(0, 10));
      }
      if (vi && Math.random() < 0.5) viReview = pick(['Strong fit','Needs deeper review','Communication good, tech average']);
    }
    const matchPct = screen === 'pass' ? rand(72, 95) : rand(40, 80);
    insertSC.run(s.id, c.id, matchPct, screen, decision, pipeline, vi, viScore, emailSent,
                 daysAgo(rand(1, 30)), selectedAt, viReview);
    totalSC++;
  }
}
console.log(`  +${sessionRecords.length} sessions, +${totalSC} session candidates`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Seed calls + QA reports + transcripts
// ─────────────────────────────────────────────────────────────────────────────
console.log('📞 Seeding calls, QA reports, transcripts...');

const insertCall = db.prepare(`
  INSERT INTO calls (call_sid, user_id, candidate_phone, candidate_name, role_title, status,
                     started_at, ended_at, duration_sec)
  VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?)
`);
const insertReport = db.prepare(`
  INSERT INTO reports (call_id, report_type, payload, generated_at) VALUES (?, ?, ?, ?)
`);
const insertTranscript = db.prepare(`
  INSERT INTO transcripts (call_id, seq, speaker, text, created_at) VALUES (?, ?, ?, ?, ?)
`);
const insertCallCtx = db.prepare(`
  INSERT INTO call_context (call_id, jd_text, resume_text) VALUES (?, ?, ?)
`);

const RECRUITERS = { 1: 'Pratik', 2: 'Divakar' };
let callsAdded = 0;

for (let i = 0; i < 18; i++) {
  const userId = i % 2 === 0 ? 1 : 2;
  const cand = pick(ownedCandidates(userId));
  if (!cand) continue;
  const job = pick(jobsByUser(userId));
  if (!job) continue;

  const callDate = daysAgo(rand(1, 30), rand(10, 18), rand(0, 59));
  const durationSec = rand(240, 720);
  const endedAt = new Date(new Date(callDate).getTime() + durationSec * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');
  const callSid = `CA${randId()}${randId()}`.slice(0, 34);

  const callRes = insertCall.run(
    callSid, userId, cand.phone, cand.name, job.title, callDate, endedAt, durationSec,
  );
  const callId = callRes.lastInsertRowid;
  seededIds.calls.push(callId);

  const profile = pick(['low','low','medium','medium','medium','high','high']);
  const scoreTarget =
    profile === 'low'    ? rand(30, 49) :
    profile === 'medium' ? rand(50, 69) :
                           rand(70, 92);

  const qaReport = buildQAReport({
    recruiter: RECRUITERS[userId],
    candidate: cand.name,
    role:      job.title,
    client:    job.client_name || 'Confidential',
    durationSec,
    callDate,
    callId:    `CALL-${new Date(callDate).toISOString().slice(2, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
    scoreTarget,
  });
  const candReport = buildCandidateReport({ candidate: cand.name, role: job.title, scoreTarget });

  insertReport.run(callId, 'qa',        JSON.stringify(qaReport),   callDate);
  insertReport.run(callId, 'candidate', JSON.stringify(candReport), callDate);

  insertCallCtx.run(callId,
    `Role: ${job.title} | Client: ${job.client_name}\nKey skills: ${(SKILLS_BY_ROLE[job.title] || []).join(', ')}`,
    `${cand.name} | ${cand.role} | ${pick(CITIES)} | ${rand(2, 12)} years experience`,
  );

  const lines = [
    ['Recruiter', `Hi ${cand.name.split(' ')[0]}, this is ${RECRUITERS[userId]} from Zeople — do you have 10 minutes to discuss a ${job.title} role at ${job.client_name}?`],
    ['Candidate', 'Hi, sure — go ahead.'],
    ['Recruiter', 'Great. Could you give me a quick overview of your current role and your overall experience?'],
    ['Candidate', `Sure. I am currently working as a ${cand.role} for the last ${rand(2, 6)} years.`],
    ['Recruiter', 'Walk me through the most recent project you owned end-to-end — what stack, what scale?'],
    ['Candidate', 'Recently I built an analytics module that handles around 50K daily events using a Postgres + Redis stack.'],
    ['Recruiter', 'Interesting. What is your current notice period and CTC expectation?'],
    ['Candidate', `Notice is 30 days, current CTC is ${rand(8, 22)} LPA, expected around ${rand(15, 30)} LPA.`],
  ];
  let seq = 1;
  for (const [speaker, text] of lines) {
    insertTranscript.run(callId, seq++, speaker, text, callDate);
  }
  callsAdded++;
}
console.log(`  +${callsAdded} calls (with QA + candidate reports + transcripts)`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Seed video interviews
// ─────────────────────────────────────────────────────────────────────────────
console.log('🎥 Seeding video interviews...');

const insertVI = db.prepare(`
  INSERT INTO video_interviews (user_id, job_id, title, job_description, question_count, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
`);
const insertVIQ = db.prepare(`
  INSERT INTO video_interview_questions (interview_id, question_text, question_type, estimated_time_minutes, order_number)
  VALUES (?, ?, ?, ?, ?)
`);
const insertVC = db.prepare(`
  INSERT INTO video_candidates (interview_id, name, email, phone, access_code, status, interview_started_at, interview_completed_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertVResp = db.prepare(`
  INSERT INTO video_responses (candidate_id, interview_id, question_id, video_filename, video_duration, transcription, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertVEval = db.prepare(`
  INSERT INTO video_evaluations
    (candidate_id, interview_id, overall_score, hiring_recommendation, evaluation_summary,
     strengths, weaknesses, competency_scores, behavioral_insights, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertVQEval = db.prepare(`
  INSERT INTO video_question_evaluations
    (evaluation_id, question_id, score, relevance_score, clarity_score, completeness_score, analysis, keywords_found, response_transcription)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const VI_QUESTIONS_TPL = [
  { q: 'Walk us through your most recent end-to-end project.',         t: 'behavioral',  m: 4 },
  { q: 'Tell us about a technical challenge you debugged in production.', t: 'technical',  m: 4 },
  { q: 'How do you prioritize when given conflicting deadlines?',      t: 'situational', m: 3 },
  { q: 'What is one decision in your last role you would revisit today?', t: 'behavioral', m: 3 },
  { q: 'Describe how you would design a system for the role you are interviewing for.', t: 'technical', m: 5 },
];

let viCount = 0, vcCount = 0;
for (let i = 0; i < 4; i++) {
  const userId = i % 2 === 0 ? 1 : 2;
  const job = pick(jobsByUser(userId));
  if (!job) continue;
  const created = daysAgo(rand(5, 25));

  const viRes = insertVI.run(userId, job.id, `${job.title} — Round 1`,
    `Video interview for ${job.title} at ${job.client_name}.`, VI_QUESTIONS_TPL.length, created, created);
  const interviewId = viRes.lastInsertRowid;
  viCount++;
  seededIds.video_interviews.push(interviewId);

  const questionIds = VI_QUESTIONS_TPL.map((tpl, idx) => {
    const qr = insertVIQ.run(interviewId, tpl.q, tpl.t, tpl.m, idx + 1);
    return qr.lastInsertRowid;
  });

  const candPool = ownedCandidates(userId);
  for (const cand of choose(candPool, rand(4, 6))) {
    const startedAt   = daysAgo(rand(2, 15));
    const completedAt = daysAgo(rand(0, 2));
    const accessCode  = randId().toUpperCase();
    const vcRes = insertVC.run(interviewId, cand.name, cand.email, cand.phone,
      accessCode, 'evaluated', startedAt, completedAt, startedAt);
    const vcId = vcRes.lastInsertRowid;
    vcCount++;

    for (const qid of questionIds) {
      insertVResp.run(vcId, interviewId, qid, null, rand(80, 280),
        'Candidate explained the project clearly with concrete metrics and trade-offs.', completedAt);
    }

    const overall = rand(48, 92);
    const rec = overall >= 80 ? 'strong_fit' : overall >= 65 ? 'good_fit' : overall >= 50 ? 'needs_review' : 'not_recommended';
    const competencyScores = {
      technical_skills:  rand(40, 95),
      communication:     rand(50, 95),
      problem_solving:   rand(40, 90),
      leadership:        rand(40, 90),
      cultural_fit:      rand(50, 95),
    };
    const veRes = insertVEval.run(vcId, interviewId, overall, rec,
      `Candidate showed ${overall >= 70 ? 'strong' : 'mixed'} signal across the rubric. Communication was clear; technical depth ${overall >= 70 ? 'matched' : 'below'} the role bar.`,
      JSON.stringify(['Clear structured answers','Good ownership signals','Concrete project metrics']),
      JSON.stringify(overall < 70 ? ['Limited system design depth','Vague on trade-offs','Some clarity gaps'] : ['Notice period long']),
      JSON.stringify(competencyScores),
      `Evidence-led responses; ${overall >= 70 ? 'recommend advancing' : 'recommend additional screen'}.`,
      completedAt,
    );
    const evalId = veRes.lastInsertRowid;

    for (const qid of questionIds) {
      const s = rand(40, 95);
      insertVQEval.run(evalId, qid, s, rand(40, 95), rand(50, 95), rand(40, 95),
        `Response was ${s >= 70 ? 'detailed' : 'partial'} with relevant examples.`,
        JSON.stringify(choose(['scale','metrics','ownership','trade-offs','SLA','latency'], 3)),
        'Candidate explained the project clearly with concrete metrics.',
      );
    }
  }
}
console.log(`  +${viCount} video interviews, +${vcCount} video candidates (with evaluations)`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Seed MCQ assessments
// ─────────────────────────────────────────────────────────────────────────────
console.log('📝 Seeding MCQ assessments...');

const insertMCQ      = db.prepare(`INSERT INTO assessments (user_id, job_id, title, description, time_limit_min, pass_score, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
const insertMCQQ     = db.prepare(`INSERT INTO assessment_questions (assessment_id, question_text, options, correct_option, explanation, topic, difficulty, order_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const insertMCQInv   = db.prepare(`INSERT INTO assessment_invites (assessment_id, candidate_id, candidate_name, candidate_email, token, status, invited_at, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertMCQSub   = db.prepare(`INSERT INTO assessment_submissions (invite_id, assessment_id, answers, score, correct_count, total_questions, time_taken_sec, ai_evaluation, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const MCQ_QUESTIONS = [
  { q: 'Which method is used to convert a JSON string to a JS object?', opts: ['JSON.parse','JSON.stringify','Object.fromString','parseJSON'], correct: 'JSON.parse', topic: 'JavaScript', diff: 'easy' },
  { q: 'In React, which hook is used for memoizing a value?',           opts: ['useState','useEffect','useMemo','useRef'], correct: 'useMemo', topic: 'React', diff: 'easy' },
  { q: 'What does the SQL HAVING clause do?',                            opts: ['Filters rows before grouping','Filters groups after aggregation','Joins tables','Defines indexes'], correct: 'Filters groups after aggregation', topic: 'SQL', diff: 'medium' },
  { q: 'Which of these is NOT a HTTP idempotent method?',               opts: ['GET','PUT','DELETE','POST'], correct: 'POST', topic: 'Web', diff: 'medium' },
  { q: 'What is the time complexity of binary search on a sorted array?', opts: ['O(n)','O(log n)','O(n log n)','O(1)'], correct: 'O(log n)', topic: 'DSA', diff: 'easy' },
];

let mcqCount = 0, mcqInvCount = 0;
for (let i = 0; i < 3; i++) {
  const userId = i % 2 === 0 ? 1 : 2;
  const job = pick(jobsByUser(userId));
  if (!job) continue;
  const created = daysAgo(rand(8, 25));
  const aRes = insertMCQ.run(userId, job.id, `${job.title} Screening MCQ`,
    `Pre-screen MCQ for ${job.title} candidates.`, 30, 60, created, created);
  const aId = aRes.lastInsertRowid;
  mcqCount++;
  seededIds.assessments.push(aId);

  MCQ_QUESTIONS.forEach((q, idx) => {
    insertMCQQ.run(aId, q.q, JSON.stringify(q.opts), q.correct, `Standard ${q.topic} concept.`, q.topic, q.diff, idx);
  });

  for (const cand of choose(ownedCandidates(userId), rand(4, 6))) {
    const completed = Math.random() < 0.7;
    const invitedAt   = daysAgo(rand(5, 20));
    const startedAt   = completed ? daysAgo(rand(1, 5)) : null;
    const completedAt = completed ? daysAgo(rand(0, 4)) : null;
    const token = `mcq-${aId}-${cand.id}-${randId()}`;
    const invRes = insertMCQInv.run(aId, cand.id, cand.name, cand.email, token,
      completed ? 'completed' : pick(['pending','started']), invitedAt, startedAt, completedAt);
    mcqInvCount++;

    if (completed) {
      const correct = rand(2, 5);
      const score = Math.round(correct / MCQ_QUESTIONS.length * 100);
      const answers = {};
      MCQ_QUESTIONS.forEach((q, idx) => { answers[idx] = idx < correct ? q.correct : pick(q.opts.filter(o => o !== q.correct)); });
      insertMCQSub.run(invRes.lastInsertRowid, aId, JSON.stringify(answers), score, correct, MCQ_QUESTIONS.length,
        rand(600, 1700), JSON.stringify({ verdict: score >= 60 ? 'pass' : 'fail', summary: `Scored ${score}% — ${score >= 60 ? 'meets' : 'below'} threshold.` }),
        completedAt);
    }
  }
}
console.log(`  +${mcqCount} MCQ assessments, +${mcqInvCount} invites (most completed)`);

// ─────────────────────────────────────────────────────────────────────────────
// 6. Seed Coding assessments
// ─────────────────────────────────────────────────────────────────────────────
console.log('💻 Seeding coding assessments...');

const insertCA    = db.prepare(`INSERT INTO coding_assessments (user_id, job_id, title, description, time_limit_min, pass_score, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
const insertCAQ   = db.prepare(`INSERT INTO coding_questions (assessment_id, title, problem_statement, starter_code, language, question_type, difficulty, topic, order_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertCAInv = db.prepare(`INSERT INTO coding_invites (assessment_id, candidate_id, candidate_name, candidate_email, token, status, invited_at, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertCASub = db.prepare(`INSERT INTO coding_submissions (invite_id, assessment_id, answers, score, ai_evaluation, time_taken_sec, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);

const CODING_QUESTIONS = [
  { title: 'Reverse a Linked List', stmt: 'Given the head of a singly linked list, reverse the list and return the new head.',
    starter: 'function reverseList(head) {\n  // your code\n}', lang: 'javascript', type: 'write', diff: 'medium', topic: 'Linked Lists' },
  { title: 'Top K Frequent Elements', stmt: 'Given an integer array, return the K most frequent elements in any order.',
    starter: 'function topKFrequent(nums, k) {\n  // your code\n}', lang: 'javascript', type: 'write', diff: 'medium', topic: 'Hash Map / Heap' },
];

let caCount = 0, caInvCount = 0;
for (let i = 0; i < 2; i++) {
  const userId = i % 2 === 0 ? 1 : 2;
  const job = pick(jobsByUser(userId));
  if (!job) continue;
  const created = daysAgo(rand(8, 22));
  const cRes = insertCA.run(userId, job.id, `${job.title} Coding Round`,
    `Coding round for ${job.title}.`, 60, 60, created, created);
  const cId = cRes.lastInsertRowid;
  caCount++;
  seededIds.coding_assessments.push(cId);

  CODING_QUESTIONS.forEach((q, idx) => {
    insertCAQ.run(cId, q.title, q.stmt, q.starter, q.lang, q.type, q.diff, q.topic, idx);
  });

  for (const cand of choose(ownedCandidates(userId), rand(3, 5))) {
    const completed   = Math.random() < 0.6;
    const invitedAt   = daysAgo(rand(5, 20));
    const startedAt   = completed ? daysAgo(rand(1, 4)) : null;
    const completedAt = completed ? daysAgo(rand(0, 3)) : null;
    const token = `coding-${cId}-${cand.id}-${randId()}`;
    const invRes = insertCAInv.run(cId, cand.id, cand.name, cand.email, token,
      completed ? 'completed' : pick(['pending','started']), invitedAt, startedAt, completedAt);
    caInvCount++;

    if (completed) {
      const score = rand(40, 95);
      insertCASub.run(invRes.lastInsertRowid, cId,
        JSON.stringify({ 0: 'function reverseList(h) { let p=null,c=h; while(c){[c.next,p,c]=[p,c,c.next]} return p; }', 1: '// solution' }),
        score,
        JSON.stringify({ verdict: score >= 60 ? 'pass' : 'fail', summary: `Code is ${score >= 60 ? 'correct and reasonably efficient' : 'partially correct with edge-case gaps'}.`, complexity: 'O(n)' }),
        rand(900, 3200), completedAt);
    }
  }
}
console.log(`  +${caCount} coding assessments, +${caInvCount} invites`);

// ─────────────────────────────────────────────────────────────────────────────
// 7. Seed POFU candidates + emails
// ─────────────────────────────────────────────────────────────────────────────
console.log('📬 Seeding POFU candidates + email history...');

const insertPofu  = db.prepare(`
  INSERT INTO pofu_candidates
    (user_id, candidate_id, job_id, candidate_name, candidate_email, role_title, company_name,
     doj, state, risk_score, risk_level, last_email_at, last_response_at, notes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertPofuEmail = db.prepare(`
  INSERT INTO pofu_emails
    (pofu_candidate_id, direction, trigger_reason, subject, body, ai_generated, ai_analysis, sent_at, candidate_response, responded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const POFU_STATES   = ['offer_accepted','resigned','bgv','confirmed','joined','dropped'];
const RISK_BY_STATE = { offer_accepted: 'medium', resigned: 'medium', bgv: 'low', confirmed: 'low', joined: 'low', dropped: 'high' };
const POFU_TRIGGERS = [
  { reason: 'weekly_checkin',   subj: 'Quick check-in this week',                body: 'Hi {name}, just checking in — how is the resignation conversation with your current employer going?' },
  { reason: 'silence_followup', subj: 'Following up — haven’t heard back',       body: 'Hi {name}, I wanted to follow up to see if everything is on track for the joining date.' },
  { reason: 'doj_reminder',     subj: 'Looking forward to your joining',         body: 'Hi {name}, your joining date with {company} is approaching — let me know if you need any documentation help.' },
  { reason: 'bgv_request',      subj: 'BGV verification next steps',             body: 'Hi {name}, the BGV team will reach out shortly. Please respond promptly to keep your joining on schedule.' },
];

let pofuCount = 0, pofuEmailCount = 0;
const pofuPicks = choose(candidateRecords, 12);
for (const cand of pofuPicks) {
  const userId = cand.user_id;
  const job = pick(jobsByUser(userId)) || pick(allJobs);
  const state = pick(POFU_STATES);
  const risk = RISK_BY_STATE[state];
  const riskScore = risk === 'low' ? rand(10, 35) : risk === 'medium' ? rand(40, 65) : rand(70, 92);
  const created = daysAgo(rand(10, 45));
  const lastEmail = daysAgo(rand(0, 6));
  const doj = (() => { const d = new Date(); d.setDate(d.getDate() + rand(5, 45)); return d.toISOString().slice(0, 10); })();

  const pofuRes = insertPofu.run(
    userId, cand.id, job.id, cand.name, cand.email, job.title, job.client_name,
    doj, state, riskScore, risk, lastEmail, null,
    `Candidate currently in ${state.replace('_', ' ')} state.`,
    created, lastEmail,
  );
  const pofuId = pofuRes.lastInsertRowid;
  pofuCount++;
  seededIds.pofu_candidates.push(pofuId);

  const numEmails = rand(3, 5);
  for (let i = 0; i < numEmails; i++) {
    const tpl = pick(POFU_TRIGGERS);
    const sentAt = daysAgo(rand(0, 30 - i * 3));
    const hasResponse = Math.random() < 0.4;
    insertPofuEmail.run(
      pofuId, 'outbound', tpl.reason, tpl.subj,
      tpl.body.replace('{name}', cand.name.split(' ')[0]).replace('{company}', job.client_name || 'the team'),
      1,
      JSON.stringify({ tone: 'positive', urgency: i === 0 ? 'low' : 'medium' }),
      sentAt,
      hasResponse ? pick(['Thanks, on track for joining.','Will revert by EOW.','Slight delay due to BGV; should be fine.']) : null,
      hasResponse ? sentAt : null,
    );
    pofuEmailCount++;
  }
}
console.log(`  +${pofuCount} POFU candidates, +${pofuEmailCount} POFU emails`);

// ─────────────────────────────────────────────────────────────────────────────
// Persist seeded IDs for next run's cleanup
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(ID_FILE, JSON.stringify(seededIds, null, 2));
console.log(`\n📝 Wrote ${ID_FILE} (${Object.values(seededIds).reduce((n, l) => n + l.length, 0)} IDs tracked)`);
console.log('✅ Demo seed complete.');
db.close();
