/**
 * scripts/build-pipeline-walkthrough-html.js
 *
 * Builds dist/Zeople-Pipeline-Walkthrough.html — a worked example of the
 * 7-step Pipeline Sessions flow, using one real job + one real candidate
 * to show what each step does, which agent fires, and what the agent
 * returns. Reference / training-style document.
 *
 * Run with:  node scripts/build-pipeline-walkthrough-html.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'zeople-logo.png');
const OUT  = path.join(ROOT, 'dist', 'Zeople-Pipeline-Walkthrough.html');
if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });

const LOGO_URI = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');

// ─── Worked example: one job + one candidate moving through the pipeline ───
const SCENARIO = {
  job: {
    title:     'Senior React Developer',
    client:    'Razorpay',
    location:  'Bangalore (Hybrid)',
    band:      '₹28–42 LPA',
    skills:    ['React', 'TypeScript', 'Redux', 'Next.js', 'TailwindCSS', 'Jest'],
  },
  candidate: {
    name:        'Aditi Iyer',
    location:    'Bangalore',
    experience:  '6 years',
    current:     'Frontend Engineer · Swiggy',
    notice:      '60 days',
    ctc:         '₹22 LPA',
    expected:    '₹32 LPA',
  },
  recruiter: 'Pratik (Admin)',
  drive:     'Senior React Hiring Drive Q2',
};

const STEPS = [
  {
    n: 1, name: 'Select JD',
    blurb: 'Recruiter picks the job that this hiring drive will target.',
    action: 'Pratik opens "Senior React Hiring Drive Q2" and selects job #1 — <strong>Senior React Developer · Razorpay · Bangalore (Hybrid)</strong>. The job\'s required skills, salary band, and location are bound to this session.',
    agent: null,
    inputs: null,
    outputs: 'Session row created · `sessions.job_id = 1` · current_step advanced to 2.',
    state: 'Session is now scoped to a specific job; subsequent steps reuse this context.',
  },
  {
    n: 2, name: 'Enhance JD',
    blurb: 'JD Enhancer turns a raw description into 5 ready-to-use sourcing assets.',
    action: 'Pratik clicks <em>Generate Assets</em>. The JD Enhancer produces all five outputs in one Claude call.',
    agent: { name: 'JD Enhancer', endpoint: 'POST /enhance-jd', model: 'Claude Sonnet 4.6' },
    inputs:  { job: '<job #1 fields>', clientNotes: '— none —', fields: ['formattedJD','recruiterBrief','clarificationQuestions','reachoutMaterial','sourcingKeywords'] },
    outputs: {
      formattedJD: '# Senior React Developer · Razorpay\\n\\nBangalore (Hybrid) · 5–8 yrs · ₹28–42 LPA …',
      recruiterBrief: '"Senior IC role on the Checkout Web team. Owns React + TS in production. Looks for engineers shipping > 1 year on Next.js …"',
      sourcingKeywords: {
        booleanStrings: ['("Senior React" OR "Frontend Engineer") AND (TypeScript OR TS) AND (Next.js OR Redux) AND Bangalore'],
        primaryKeywords: ['React', 'TypeScript', 'Next.js'],
      },
      reachoutMaterial: { linkedinMessage: '"Hi Aditi, your work on Swiggy\'s checkout flow caught my eye …"' },
      clarificationQuestions: ['What\'s the team size and reporting structure?', 'Is the role IC or hands-on lead?', '…7 sections total'],
    },
    state: 'All 5 assets persisted to `sessions.enhancement_data`. Reused by Step 3 (resume scoring), Step 5 (MCQ context), and reach-outs.',
  },
  {
    n: 3, name: 'Source Candidates',
    blurb: 'Add candidates from the database; AI scores match quality and flags AI-written resumes.',
    action: 'Pratik adds <strong>Aditi Iyer</strong> from the candidate database. Two agents fire automatically.',
    agent: [
      { name: 'Resume Quality Evaluator', endpoint: 'POST /sessions/1/candidates/47/evaluate', model: 'Claude Haiku 4.5' },
      { name: 'AI Content Detector',      endpoint: 'POST /ai/check-ai-content',                model: 'Claude Haiku 4.5' },
    ],
    inputs: {
      candidate: 'Aditi Iyer · 6 yrs · React/TS/Next.js · Swiggy',
      job: 'Senior React Developer (skills: React, TypeScript, Redux, Next.js, TailwindCSS, Jest)',
    },
    outputs: {
      'Resume Quality Evaluator': {
        overall:           88,
        contentQuality:    'high',
        experienceLevel:   'senior',
        verdict:           'Strong match — 5 of 6 required skills present, senior IC trajectory.',
        strengths:         ['Production Next.js at scale', '6 yrs in B2C frontend', 'Jest + RTL exposure'],
      },
      'AI Content Detector': {
        verdict:    'likely_human',
        confidence: 92,
        summary:    'Idiosyncratic phrasing, specific project metrics, no template patterns.',
      },
    },
    state: '`session_candidates` row inserted with match_percentage=88, screening_status="pending". AI flags shown as badges on the Step 3 card.',
  },
  {
    n: 4, name: 'Recruiter Screening',
    blurb: 'Manual screening — Pass / On Hold / Reject. Optionally launch a live call.',
    action: 'Pratik opens Aditi\'s card, clicks <strong>"Screen via Call"</strong>. Calling CoPilot fires up with JD + resume context. After a 9-minute conversation, Pratik marks her <span class="pill pill--ok">Pass</span>.',
    agent: { name: 'Live Follow-Up Suggester (during call)', endpoint: 'POST /ai/suggest', model: 'Claude Haiku 4.5' },
    inputs:  { transcript: 'rolling last ~6 candidate utterances', currentQuestion: 'optional — what the recruiter is currently asking' },
    outputs: {
      suggestions: [
        'Walk me through the trickiest bug you debugged in your Next.js checkout flow.',
        'How did you decide between Redux Toolkit and Zustand on Swiggy\'s order tracker?',
        'What\'s your biggest blocker to a 60-day notice period?',
      ],
    },
    state: 'screening_status → "pass". Aditi unlocks Step 5. Call SID logged; transcript captured for the QA report later in Step 6.',
  },
  {
    n: 5, name: 'Assessment Round',
    blurb: 'Send Aditi a Video Interview. The VI evaluator scores her response across 5 competencies.',
    action: 'Pratik selects the <em>Video Interview</em> sub-mode, clicks <em>Generate Questions</em>, then <em>Send Invite</em>. Aditi records on her own time. After completion, Pratik clicks <em>Evaluate</em>.',
    agent: [
      { name: 'VI Question Generator', endpoint: 'POST /vi/interviews/12/generate',     model: 'Claude Sonnet 4.6' },
      { name: 'VI Evaluator',          endpoint: 'POST /vi/candidates/47/evaluate',     model: 'Claude Sonnet 4.6' },
    ],
    inputs: {
      'VI Question Generator': { jobDescription: 'formatted JD from Step 2', count: 5 },
      'VI Evaluator':          { transcribedResponses: '5 × ~3-min answers (Deepgram)', jobDescription: 'formatted JD' },
    },
    outputs: {
      'VI Question Generator': [
        '{ question_text: "Walk us through your most recent end-to-end project.", type: "behavioral", time: 4 }',
        '{ question_text: "How would you architect a payments dashboard for 1M req/day?", type: "technical", time: 5 }',
        '+ 3 more',
      ],
      'VI Evaluator': {
        overall_score:         84,
        hiring_recommendation: 'good_fit',
        competency_scores: { technical_skills: 88, communication: 82, problem_solving: 85, leadership: 76, cultural_fit: 88 },
        evaluation_summary:    'Solid technical depth; slight clarity gap when discussing trade-offs. Recommend advancing.',
      },
    },
    state: '`video_evaluations` row written. UI shows score 84 + "Good Fit" pill on Aditi\'s card. Step 6 unlocked.',
  },
  {
    n: 6, name: 'Decision',
    blurb: 'Recruiter sets interview level, marks Proceed/Pool, and the post-call AI generates two reports.',
    action: 'Pratik sets level <strong>L1</strong>, decision <strong>Proceed</strong>, and schedules the technical panel for 14 May at 11:30 AM. The earlier screening-call transcript is now used by the report generator.',
    agent: { name: 'Call QA + Candidate Report', endpoint: 'POST /ai/generate-reports', model: 'Claude Opus 4.6' },
    inputs:  { transcript: '~9 min, 38 turns', role: 'Senior React Developer', candidate: 'Aditi Iyer', recruiter: 'Pratik', jd: '<formattedJD>', resume: '<resume text>' },
    outputs: {
      qaReport: {
        summary: { score: 78, verdict: 'READY WITH CONDITIONS', riskLevel: 'Low' },
        weakest_dimension: 'Closing Effectiveness (12/15 — 80%)',
        nudges: [{ label: 'Closing with Clarity', weak: '"I\'ll let you know on next steps."', better: '"Next is a 45-min tech round with the Razorpay lead architect — typically within 5 working days. Can I lock in your availability?"' }],
      },
      candidateReport: {
        recommendation: 'recommend',
        overallFit:     82,
        strengths:     ['Production Next.js + TS', 'Strong communication', 'Cultural fit signals'],
        concerns:      ['60-day notice', 'Expected CTC at top of band'],
      },
    },
    state: 'Both reports persisted to `reports` table. QA report appears in Recruiter QA module. Candidate report opens in Step 6 panel for the panel reviewer.',
  },
  {
    n: 7, name: 'Pipeline Tracker',
    blurb: 'Kanban view — move Aditi through Selected / On Hold / Rejected. Inline interview rescheduler available.',
    action: 'After the technical panel passes, Pratik drags Aditi\'s card from <em>Pending</em> to <span class="pill pill--ok">Selected</span> and adds a voice note: "Panel happy. Sending offer at top of band."',
    agent: null,
    inputs: null,
    outputs: '`session_candidates.pipeline_status = "selected"` · `selected_at = 2026-05-08`. Aditi auto-transfers to POFU module on offer acceptance.',
    state: 'Session candidate is closed-won. POFU engine starts the offer-to-Day-1 lifecycle (separate module).',
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

// Render output JSON-ish in a readable indented format
function renderOutput(data, depth = 0) {
  if (data == null) return '';
  if (typeof data === 'string') return esc(data);
  if (Array.isArray(data)) {
    return data.map(item => `<div class="o-item">${renderOutput(item, depth + 1)}</div>`).join('');
  }
  if (typeof data === 'object') {
    return Object.entries(data).map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return `<div class="o-row"><span class="o-key">${esc(k)}</span><div class="o-nested">${renderOutput(v, depth + 1)}</div></div>`;
      }
      return `<div class="o-row"><span class="o-key">${esc(k)}</span><span class="o-val">${esc(String(v))}</span></div>`;
    }).join('');
  }
  return esc(String(data));
}

function renderAgent(agent) {
  if (!agent) return '';
  const list = Array.isArray(agent) ? agent : [agent];
  return `<div class="agent-list">
    ${list.map(a => `
      <div class="agent">
        <div class="agent__strip"></div>
        <div class="agent__body">
          <div class="agent__name">${esc(a.name)}</div>
          <code class="agent__endpoint">${esc(a.endpoint)}</code>
          <div class="agent__model">${esc(a.model)}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

function renderIO(label, data) {
  if (data == null) return '';
  const isStr = typeof data === 'string';
  return `<div class="io io--${label.toLowerCase()}">
    <div class="io__label">${esc(label)}</div>
    <div class="io__body">${isStr ? esc(data) : renderOutput(data)}</div>
  </div>`;
}

const renderStep = (s, idx) => {
  const hasAgent = !!s.agent;
  return `
    <section class="step">
      <header class="step__head">
        <div class="step__num">${s.n}</div>
        <div class="step__text">
          <h2 class="step__name">${esc(s.name)}</h2>
          <p class="step__blurb">${esc(s.blurb)}</p>
        </div>
        <div class="step__chip ${hasAgent ? 'step__chip--ai' : 'step__chip--manual'}">
          ${hasAgent ? 'AI Step' : 'Manual Step'}
        </div>
      </header>
      <div class="step__body">
        <div class="step__action">
          <span class="step__action-label">Action</span>
          <span class="step__action-text">${s.action}</span>
        </div>
        ${hasAgent ? renderAgent(s.agent) : ''}
        ${hasAgent ? `<div class="step__io">
          ${renderIO('Inputs',  s.inputs)}
          ${renderIO('Outputs', s.outputs)}
        </div>` : ''}
        <div class="step__state">
          <span class="step__state-label">↳ Result</span>
          <span class="step__state-text">${typeof s.outputs === 'string' && !hasAgent ? esc(s.outputs) + ' · ' : ''}${esc(s.state)}</span>
        </div>
      </div>
    </section>`;
};

// ─── HTML ──────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zeople RecruiterOS — Pipeline Walkthrough</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --orange:    #F97316;
    --orange-dim:#FEEBD6;
    --navy:      #1A2B4A;
    --bg:        #F1F5F9;
    --card:      #FFFFFF;
    --text-1:    #1E293B;
    --text-2:    #64748B;
    --text-3:    #94A3B8;
    --border:    #E2E8F0;
    --emerald:   #059669;
    --emerald-bg:#ECFDF5;
    --amber:     #F59E0B;
    --muted:     #F8FAFC;
    --mono:      'JetBrains Mono', Consolas, monospace;
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, .04);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--text-1);
    -webkit-font-smoothing: antialiased; line-height: 1.5;
    padding: 24px 16px 40px;
  }
  .page { max-width: 1320px; margin: 0 auto; }

  /* ── Header ── */
  .topbar { height: 6px; background: var(--orange); border-radius: 6px 6px 0 0; }
  .header {
    background: var(--card); border: 1px solid var(--border); border-top: none;
    border-radius: 0 0 12px 12px; padding: 18px 24px;
    display: flex; align-items: center; gap: 18px; box-shadow: var(--shadow-sm);
  }
  .header__logo {
    width: 48px; height: 48px; border-radius: 8px; background: var(--navy);
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .header__logo img { width: 38px; height: 38px; object-fit: contain; }
  .header__text { flex: 1; min-width: 0; }
  .header__brand {
    font-size: 11px; font-weight: 700; color: var(--orange);
    letter-spacing: .25em; margin-bottom: 4px;
  }
  .header__title { font-size: 22px; font-weight: 700; margin: 0; }
  .header__sub   { font-size: 13px; color: var(--text-2); margin-top: 2px; }
  .header__chip {
    font-size: 10px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase;
    background: var(--orange-dim); color: var(--orange);
    padding: 4px 10px; border-radius: 999px; white-space: nowrap;
  }

  /* ── Scenario card ── */
  .scenario {
    margin-top: 16px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: var(--shadow-sm); padding: 18px 20px;
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;
  }
  .scenario__col {
    border-left: 3px solid var(--orange);
    padding-left: 14px;
  }
  .scenario__col:nth-child(2) { border-color: #60a5fa; }
  .scenario__col:nth-child(3) { border-color: var(--emerald); }
  .scenario__label {
    font-size: 10px; font-weight: 700; letter-spacing: .15em;
    color: var(--text-3); text-transform: uppercase; margin-bottom: 6px;
  }
  .scenario__head {
    font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 4px;
  }
  .scenario__sub  { font-size: 12px; color: var(--text-2); line-height: 1.55; }
  .scenario__meta { font-size: 11px; color: var(--text-3); margin-top: 6px; }

  /* ── Step card ── */
  .step {
    margin-top: 16px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: var(--shadow-sm); overflow: hidden;
  }
  .step__head {
    display: flex; align-items: center; gap: 14px;
    background: var(--navy); color: #fff;
    padding: 12px 18px;
  }
  .step__num {
    flex: 0 0 36px;
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--orange); color: #fff;
    font-size: 16px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .step__text { flex: 1; min-width: 0; }
  .step__name { font-size: 17px; font-weight: 700; margin: 0; }
  .step__blurb { font-size: 12px; color: rgba(255,255,255,.7); margin: 3px 0 0; line-height: 1.5; }
  .step__chip {
    font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px; white-space: nowrap;
  }
  .step__chip--ai     { background: var(--orange); color: #fff; }
  .step__chip--manual { background: rgba(255,255,255,.12); color: rgba(255,255,255,.85); }

  .step__body { padding: 16px 20px; }

  .step__action {
    display: grid; grid-template-columns: 70px 1fr; gap: 14px;
    padding-bottom: 12px; margin-bottom: 12px;
    border-bottom: 1px solid var(--border);
    font-size: 13px; color: var(--text-1); line-height: 1.6;
  }
  .step__action-label {
    font-size: 9.5px; font-weight: 700; letter-spacing: .12em;
    color: var(--text-3); text-transform: uppercase; padding-top: 3px;
  }
  .step__action em { font-style: normal; color: var(--orange); font-weight: 500; }

  /* Agent inline list */
  .agent-list { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 12px; }
  .agent-list:has(.agent + .agent) { grid-template-columns: 1fr 1fr; }
  .agent {
    display: grid; grid-template-columns: 5px 1fr;
    background: var(--muted); border: 1px solid var(--border);
    border-radius: 8px; overflow: hidden;
  }
  .agent__strip { background: var(--orange); }
  .agent__body { padding: 9px 12px; min-width: 0; }
  .agent__name { font-size: 12.5px; font-weight: 700; color: var(--text-1); margin-bottom: 2px; }
  .agent__endpoint {
    display: block; font-family: var(--mono);
    font-size: 11px; color: var(--text-3); word-break: break-all;
  }
  .agent__model {
    font-size: 10px; color: var(--text-2); margin-top: 3px; font-family: var(--mono);
  }

  /* IO grid */
  .step__io {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    margin-bottom: 12px;
  }
  .io {
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--muted); overflow: hidden;
  }
  .io__label {
    font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase;
    padding: 7px 12px;
    background: var(--card); border-bottom: 1px solid var(--border);
  }
  .io--inputs  .io__label { color: #60a5fa; }
  .io--outputs .io__label { color: var(--emerald); }
  .io__body {
    padding: 10px 12px;
    font-size: 11.5px; color: var(--text-1); line-height: 1.6;
  }

  .o-row {
    display: grid; grid-template-columns: 150px 1fr; gap: 10px;
    align-items: baseline; padding: 2px 0;
  }
  .o-key {
    font-family: var(--mono); font-size: 10.5px; color: var(--text-3);
    word-break: break-word;
  }
  .o-val {
    color: var(--text-1); word-break: break-word;
  }
  .o-nested {
    padding-left: 8px; border-left: 2px solid var(--border);
    display: grid; gap: 2px;
  }
  .o-item {
    padding: 3px 0; border-bottom: 1px dashed var(--border);
  }
  .o-item:last-child { border-bottom: 0; }

  /* Result row */
  .step__state {
    display: grid; grid-template-columns: 70px 1fr; gap: 14px;
    padding: 10px 14px;
    background: var(--emerald-bg);
    border: 1px solid #BBF7D0; border-radius: 8px;
    font-size: 12px; color: var(--text-1); line-height: 1.6;
  }
  .step__state-label {
    font-size: 9.5px; font-weight: 700; letter-spacing: .12em;
    color: var(--emerald); text-transform: uppercase; padding-top: 3px;
  }

  /* Inline pills */
  .pill {
    display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .1em;
    padding: 2px 8px; border-radius: 999px; text-transform: uppercase; vertical-align: middle;
  }
  .pill--ok { background: var(--emerald-bg); color: var(--emerald); border: 1px solid #BBF7D0; }

  /* ── Footer ── */
  .footer {
    margin-top: 22px; padding: 14px 20px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; box-shadow: var(--shadow-sm);
    font-size: 11.5px; color: var(--text-3); line-height: 1.7;
  }
  .footer strong { color: var(--text-2); font-weight: 600; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .scenario { grid-template-columns: 1fr; }
    .step__io { grid-template-columns: 1fr; }
    .agent-list:has(.agent + .agent) { grid-template-columns: 1fr; }
    .o-row { grid-template-columns: 1fr; }
    .step__action, .step__state { grid-template-columns: 1fr; gap: 4px; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="topbar"></div>

    <header class="header">
      <div class="header__logo"><img src="${LOGO_URI}" alt="Zeople"></div>
      <div class="header__text">
        <div class="header__brand">ZEOPLE · RECRUITEROS</div>
        <h1 class="header__title">Pipeline Walkthrough — Worked Example</h1>
        <div class="header__sub">One job · one candidate · 7 steps · every agent in context</div>
      </div>
      <span class="header__chip">Training Manual</span>
    </header>

    <section class="scenario">
      <div class="scenario__col">
        <div class="scenario__label">Job</div>
        <div class="scenario__head">${esc(SCENARIO.job.title)}</div>
        <div class="scenario__sub">${esc(SCENARIO.job.client)} · ${esc(SCENARIO.job.location)}</div>
        <div class="scenario__meta">${esc(SCENARIO.job.band)} · ${esc(SCENARIO.job.skills.join(' · '))}</div>
      </div>
      <div class="scenario__col">
        <div class="scenario__label">Candidate</div>
        <div class="scenario__head">${esc(SCENARIO.candidate.name)}</div>
        <div class="scenario__sub">${esc(SCENARIO.candidate.current)} · ${esc(SCENARIO.candidate.experience)}</div>
        <div class="scenario__meta">${esc(SCENARIO.candidate.location)} · ${esc(SCENARIO.candidate.ctc)} → ${esc(SCENARIO.candidate.expected)} · Notice ${esc(SCENARIO.candidate.notice)}</div>
      </div>
      <div class="scenario__col">
        <div class="scenario__label">Drive</div>
        <div class="scenario__head">${esc(SCENARIO.drive)}</div>
        <div class="scenario__sub">Recruiter: ${esc(SCENARIO.recruiter)}</div>
        <div class="scenario__meta">Session created · current_step = 1 → 7</div>
      </div>
    </section>

    ${STEPS.map(renderStep).join('\n')}

    <footer class="footer">
      <strong>About this walkthrough.</strong>
      Inputs and outputs are realistic samples that match the actual response shapes returned by each agent — not literal API captures. Any candidate / job / company names are illustrative.
      The pipeline is idempotent: re-entering an earlier step does not re-fire AI calls unless the recruiter explicitly clicks the regenerate / re-evaluate action on that step's UI.
      Total agent calls in this single-candidate walkthrough: <strong>7</strong> (1 setup + 4 per-candidate evaluators + 1 live coach + 1 post-call report) — within the 7–12 range described in the Pipeline Agent Map.
    </footer>
  </div>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log('✅ Wrote ' + OUT);
