/**
 * scripts/build-agents-catalog-html.js
 *
 * Builds dist/Zeople-AI-Agents-Catalog.html — a single-page reference of
 * every AI agent in the platform, grouped by module/function. Companion
 * to the Pipeline Agent Map, but more comprehensive and reference-style.
 *
 * Run with:  node scripts/build-agents-catalog-html.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'zeople-logo.png');
const OUT  = path.join(ROOT, 'dist', 'Zeople-AI-Agents-Catalog.html');
if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });

const LOGO_URI = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');

// ─── Agent inventory ───────────────────────────────────────────────────────
const MODULES = [
  {
    id:    'pipeline',
    title: 'Pipeline Sessions',
    sub:   'Agentic 7-step hiring drive — Steps 2 through 6 each invoke AI agents.',
    agents: [
      {
        name: 'JD Enhancer',
        endpoint: 'POST /enhance-jd',
        model: 'Claude Sonnet 4.6',
        trigger: 'Step 2 → recruiter clicks "Generate Assets"',
        inputs:  'job, clientNotes, companyScript, fields',
        outputs: 'formattedJD · recruiterBrief · clarificationQuestions · reachoutMaterial · sourcingKeywords · marketIntelligence',
        fires:   '1× per session (shared by all candidates)',
      },
      {
        name: 'Resume Quality Evaluator',
        endpoint: 'POST /sessions/:id/candidates/:cid/evaluate',
        model: 'Claude Haiku 4.5',
        trigger: 'Step 3 → auto-fires when candidate is added',
        inputs:  'resume text, job title, required & preferred skills',
        outputs: 'overall · contentQuality · aiWritingDetection · experienceLevel · verdict · strengths',
        fires:   '1× per candidate added to the session',
      },
      {
        name: 'AI Content Detector',
        endpoint: 'POST /ai/check-ai-content',
        model: 'Claude Haiku 4.5',
        trigger: 'Step 3 → recruiter clicks "Run AI Check" (also exposed standalone in Candidate Database)',
        inputs:  'resume text (100–3000 chars)',
        outputs: 'verdict (human / likely_human / mixed / likely_ai / ai_generated) · confidence · indicators · summary',
        fires:   'On demand · 0–1 per candidate',
      },
      {
        name: 'VI Question Generator',
        endpoint: 'POST /vi/interviews/:id/generate',
        model: 'Claude Sonnet 4.6',
        trigger: 'Step 5a → recruiter creates a video interview template',
        inputs:  'job description, desired question count',
        outputs: 'array of { question_text, question_type (technical/behavioral/situational), estimated_time_minutes }',
        fires:   '1× per interview template (shared across all VI candidates)',
      },
      {
        name: 'VI Evaluator',
        endpoint: 'POST /vi/candidates/:cid/evaluate',
        model: 'Claude Sonnet 4.6',
        trigger: 'Step 5a → recruiter clicks "Evaluate" on a completed video interview',
        inputs:  'job description, transcribed candidate responses (Deepgram)',
        outputs: 'overall_score · hiring_recommendation · evaluation_summary · strengths · weaknesses · 5-competency scores · per-question evaluations',
        fires:   '1× per candidate per interview',
      },
      {
        name: 'MCQ Question Generator',
        endpoint: 'POST /assessments/:id/ai-generate',
        model: 'Claude Sonnet 4.6',
        trigger: 'Step 5b → recruiter clicks "Generate Questions"',
        inputs:  'job context, recruiter brief & phone screening Qs (from Step 2), topic & difficulty preference',
        outputs: 'up to 10 MCQs each with { question_text, 4 options, correct_option, explanation, topic, difficulty }',
        fires:   '1× per MCQ assessment (shared by all invitees)',
      },
      {
        name: 'MCQ Evaluator',
        endpoint: '(internal) /assessments/take/:token/submit',
        model: 'Claude Haiku 4.5',
        trigger: 'Step 5b → fires automatically after candidate submits',
        inputs:  'assessment title, score breakdown, per-question correctness',
        outputs: 'summary · strengths · gaps · topic_scores · difficulty_breakdown · recommendation · question_analysis',
        fires:   '1× per submission · async (does not block response)',
      },
      {
        name: 'Coding Question Generator',
        endpoint: 'POST /coding-assessments/:id/ai-generate',
        model: 'Claude Sonnet 4.6',
        trigger: 'Step 5c → recruiter clicks "Generate Questions"',
        inputs:  'language, count, difficulty, job context',
        outputs: 'array of { title, problem_statement, starter_code, language, question_type (write/fix/complete), difficulty }',
        fires:   '1× per coding assessment (auto-balances 40/30/30 across question types)',
      },
      {
        name: 'Coding Evaluator',
        endpoint: '(internal) /coding-assessments/take/:token/submit',
        model: 'Claude Haiku 4.5',
        trigger: 'Step 5c → fires automatically after candidate submits',
        inputs:  'code solutions per question, language, difficulty, type metadata',
        outputs: 'overall_score · summary · recommendation · strengths · gaps · per-question { correctness, quality, feedback }',
        fires:   '1× per submission · async',
      },
      {
        name: 'Call QA + Candidate Report',
        endpoint: 'POST /ai/generate-reports',
        model: 'Claude Opus 4.6',
        trigger: 'Step 6 → fires when a recruiter call ends (and from Calling CoPilot)',
        inputs:  'transcript (speaker/text), role, candidateName, recruiterName, JD excerpt, resume excerpt',
        outputs: 'qaReport (8-dim scorecard, red flags, weak/better nudges) + candidateReport (verdict, scores, recommendation)',
        fires:   '1× per completed recruiter call · powers the Recruiter QA module',
      },
    ],
  },

  {
    id:    'copilot',
    title: 'Calling CoPilot',
    sub:   'Real-time AI coaching during live recruiter calls + the auto-demo simulation.',
    agents: [
      {
        name: 'Live Follow-Up Suggester',
        endpoint: 'POST /ai/suggest',
        model: 'Claude Haiku 4.5',
        trigger: 'Calling CoPilot → debounced ~1s after each candidate response',
        inputs:  'last ~6 candidate utterances, current question context',
        outputs: '2–3 sharp follow-up questions',
        fires:   'Once per new candidate transcript line · low-latency requirement',
      },
      {
        name: 'Candidate Simulation Reply',
        endpoint: 'POST /ai/sim-reply',
        model: 'Claude Haiku 4.5',
        trigger: 'Demo Vid / Auto Demo flow — generates a candidate response after each recruiter question',
        inputs:  'recruiter message, conversation history (last 10 turns), role, candidate name, JD, resume',
        outputs: '{ candidateReply: 2–4 sentences in candidate persona }',
        fires:   '1× per recruiter question in a simulated call (~8–10 per demo)',
      },
      {
        name: 'Interview Question Generator',
        endpoint: 'POST /ai/generate-questions',
        model: 'Claude Opus 4.6',
        trigger: 'Calling CoPilot → recruiter clicks "Generate Guide" in the Interview Panel',
        inputs:  'JD (file or text) + resume (optional)',
        outputs: '4–6 sections (Background · Technical · Problem-Solving · Role-Specific · Culture · Closing) with 3–5 questions each',
        fires:   '1× per interview guide build · pre-call preparation',
      },
    ],
  },

  {
    id:    'jobs',
    title: 'Job Management',
    sub:   'Hiring-manager intake and per-job JD asset generation.',
    agents: [
      {
        name: 'HM Clarification Question Generator',
        endpoint: 'POST /jobs/:id/qualification-questions',
        model: 'Claude Sonnet 4.6',
        trigger: 'Job detail → recruiter clicks "Generate Intake Questions" (or regenerates a single Q)',
        inputs:  'job title, client, required skills, description · (optional) regenerateIndex + existingQuestions',
        outputs: '7-section intake Q&A structure (or 1 replacement question)',
        fires:   '1× per job, plus on-demand single-question regeneration',
      },
      {
        name: 'Job-attached JD Refresher',
        endpoint: 'PATCH /jobs/:id/qualify  →  triggerJDRefresh()',
        model: 'Claude Sonnet 4.6',
        trigger: 'Recruiter saves HM Q&A and marks the job qualified',
        inputs:  'job details + HM Q&A answers',
        outputs: 'Refreshed JD assets (formattedJD · recruiterBrief · sourcingKeywords · reachoutMaterial · clarificationQuestions)',
        fires:   '1× per job qualification · async background refresh',
      },
    ],
  },

  {
    id:    'candidates',
    title: 'Candidate Database',
    sub:   'Resume ingestion + AI-content checking on stored profiles.',
    agents: [
      {
        name: 'Resume Parser / Field Extractor',
        endpoint: 'POST /candidates/parse-resume',
        model: 'Claude Sonnet 4.6',
        trigger: 'Candidate Database → recruiter uploads a PDF or DOCX resume',
        inputs:  'extracted resume text (via pdf-parse / mammoth)',
        outputs: 'structured fields: name, email, phone, location, current_title, current_company, experience_years, skills, education, work_history',
        fires:   '1× per resume uploaded',
      },
      {
        name: 'AI Content Detector (standalone)',
        endpoint: 'POST /ai/check-ai-content',
        model: 'Claude Haiku 4.5',
        trigger: 'Candidate detail view → "Run AI Check" button (same agent as Pipeline Step 3, exposed here too)',
        inputs:  'resume text',
        outputs: 'verdict · confidence · indicators · summary',
        fires:   'On demand · per candidate',
      },
    ],
  },

  {
    id:    'pofu',
    title: 'Post-Offer Follow-Up (POFU)',
    sub:   'Auto-generated email outreach across the offer-to-Day-1 lifecycle.',
    agents: [
      {
        name: 'POFU Email Composer',
        endpoint: 'server/utils/pofu-engine.js  →  generateEmail()',
        model: 'Claude Haiku 4.5',
        trigger: 'POFU engine selects a trigger (weekly check-in / silence follow-up / DOJ reminder / BGV request / risk escalation / no-response nudge) and asks Claude for a message',
        inputs:  'candidate name, role, company, DOJ, current state, risk level, trigger reason',
        outputs: '{ subject, body } — plain-text email signed "The Zeople Team"',
        fires:   'Multiple per candidate over the offer-to-joining window (~3–6 emails typical)',
      },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const totalAgents    = MODULES.reduce((n, m) => n + m.agents.length, 0);
const uniqueEndpoints = new Set();
MODULES.forEach(m => m.agents.forEach(a => uniqueEndpoints.add(a.endpoint)));

const agentCard = (a) => `
  <div class="agent">
    <div class="agent__strip"></div>
    <div class="agent__body">
      <div class="agent__head">
        <div class="agent__name">${esc(a.name)}</div>
        <code class="agent__endpoint">${esc(a.endpoint)}</code>
      </div>
      <div class="agent__rows">
        <div class="row"><span class="row__k">Trigger</span><span class="row__v">${esc(a.trigger)}</span></div>
        <div class="row"><span class="row__k">Inputs</span><span class="row__v">${esc(a.inputs)}</span></div>
        <div class="row"><span class="row__k">Outputs</span><span class="row__v">${esc(a.outputs)}</span></div>
        <div class="row"><span class="row__k">Model</span><span class="row__v row__v--mono">${esc(a.model)}</span></div>
        <div class="row"><span class="row__k">Fires</span><span class="row__v row__v--accent">${esc(a.fires)}</span></div>
      </div>
    </div>
  </div>`;

const moduleSection = (m, i) => `
  <section class="module">
    <header class="module__head">
      <div class="module__index">${String(i + 1).padStart(2, '0')}</div>
      <div class="module__text">
        <h2 class="module__title">${esc(m.title)}</h2>
        <p class="module__sub">${esc(m.sub)}</p>
      </div>
      <div class="module__count">${m.agents.length}<small>&nbsp;agent${m.agents.length === 1 ? '' : 's'}</small></div>
    </header>
    <div class="module__grid">
      ${m.agents.map(agentCard).join('')}
    </div>
  </section>`;

// ─── HTML ──────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zeople RecruiterOS — AI Agents & LLM Calls</title>
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
    --muted:     #F8FAFC;
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, .04);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--text-1);
    -webkit-font-smoothing: antialiased; line-height: 1.45;
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

  /* ── Stat strip ── */
  .stats {
    margin-top: 16px;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  }
  .stat {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px; box-shadow: var(--shadow-sm);
    border-top: 3px solid var(--orange);
  }
  .stat__value { font-size: 24px; font-weight: 700; color: var(--text-1); line-height: 1; }
  .stat__label { font-size: 11px; font-weight: 600; color: var(--text-1); margin-top: 6px; }
  .stat__sub   { font-size: 10.5px; color: var(--text-3); margin-top: 2px; }

  /* ── Module section ── */
  .module {
    margin-top: 22px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: var(--shadow-sm); overflow: hidden;
  }
  .module__head {
    display: flex; align-items: center; gap: 16px;
    background: var(--navy); color: #fff; padding: 14px 20px;
  }
  .module__index {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 14px; font-weight: 700; color: var(--orange);
    letter-spacing: .1em;
    background: rgba(249, 115, 22, .12);
    padding: 6px 10px; border-radius: 6px;
  }
  .module__text { flex: 1; min-width: 0; }
  .module__title { font-size: 17px; font-weight: 700; margin: 0; }
  .module__sub   { font-size: 12px; color: rgba(255,255,255,.7); margin: 3px 0 0; line-height: 1.5; }
  .module__count {
    font-size: 16px; font-weight: 700; white-space: nowrap;
  }
  .module__count small { font-size: 11px; color: rgba(255,255,255,.6); font-weight: 500; }

  .module__grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    padding: 16px;
  }

  /* ── Agent card ── */
  .agent {
    display: grid; grid-template-columns: 6px 1fr;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden;
  }
  .agent__strip { background: var(--orange); }
  .agent__body { padding: 12px 14px; min-width: 0; }
  .agent__head {
    margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
  }
  .agent__name {
    font-size: 14px; font-weight: 700; color: var(--text-1); line-height: 1.35;
    margin-bottom: 4px;
  }
  .agent__endpoint {
    display: block; font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 11px; color: var(--text-3); word-break: break-all;
  }
  .agent__rows { display: grid; gap: 5px; }
  .row {
    display: grid; grid-template-columns: 64px 1fr;
    gap: 10px; align-items: baseline;
    font-size: 11.5px; line-height: 1.5;
  }
  .row__k {
    font-size: 9.5px; font-weight: 700; letter-spacing: .12em;
    color: var(--text-3); text-transform: uppercase;
  }
  .row__v { color: var(--text-1); }
  .row__v--mono {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 11px; color: var(--text-2);
  }
  .row__v--accent { color: var(--orange); font-weight: 500; }

  /* ── Footer ── */
  .footer {
    margin-top: 22px; padding: 14px 20px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; box-shadow: var(--shadow-sm);
    font-size: 11.5px; color: var(--text-3); font-style: italic;
    line-height: 1.6;
  }
  .footer strong { color: var(--text-2); font-style: normal; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .stats { grid-template-columns: 1fr 1fr; }
    .module__grid { grid-template-columns: 1fr; }
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
        <h1 class="header__title">AI Agents &amp; LLM Calls Reference</h1>
        <div class="header__sub">Every Anthropic call in the platform, grouped by module / function</div>
      </div>
      <span class="header__chip">Engineering Reference</span>
    </header>

    <div class="stats">
      <div class="stat">
        <div class="stat__value">${totalAgents}</div>
        <div class="stat__label">Agents in production</div>
        <div class="stat__sub">across all modules</div>
      </div>
      <div class="stat">
        <div class="stat__value">${uniqueEndpoints.size}</div>
        <div class="stat__label">Unique LLM endpoints</div>
        <div class="stat__sub">includes 1 internal-only call</div>
      </div>
      <div class="stat">
        <div class="stat__value">${MODULES.length}</div>
        <div class="stat__label">Product modules</div>
        <div class="stat__sub">Pipeline · CoPilot · Jobs · Candidates · POFU</div>
      </div>
      <div class="stat">
        <div class="stat__value">3</div>
        <div class="stat__label">Claude models in use</div>
        <div class="stat__sub">Opus 4.6 · Sonnet 4.6 · Haiku 4.5</div>
      </div>
    </div>

    ${MODULES.map(moduleSection).join('\n')}

    <footer class="footer">
      <strong>Notes.</strong>
      The Pipeline Sessions count (10 agents) includes the Call QA + Candidate Report agent that also runs from Calling CoPilot — it is listed once under its primary triggering surface.
      The AI Content Detector appears in two sections (Pipeline Step 3 and Candidate Database) since the same endpoint is called from both surfaces; counted once for the unique-endpoint total.
      Async evaluators (MCQ, Coding, POFU) fire after the user-facing response is returned, so user-perceived latency is unaffected by their cost.
    </footer>
  </div>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log('✅ Wrote ' + OUT);
console.log(`   ${totalAgents} agents · ${uniqueEndpoints.size} unique endpoints · ${MODULES.length} modules`);
