/**
 * scripts/build-agent-map-html.js
 *
 * Generates dist/Zeople-Pipeline-Agent-Map.html — a single, self-contained
 * HTML file showing which AI agents the 7-step pipeline triggers. Zeople
 * theme baked in, logo embedded as base64, prints to PDF cleanly via
 * the browser's "Print → Save as PDF" command.
 *
 * Run with:  node scripts/build-agent-map-html.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'zeople-logo.png');
const OUT  = path.join(ROOT, 'dist', 'Zeople-Pipeline-Agent-Map.html');
if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });

// Embed logo as base64
const LOGO_B64 = fs.readFileSync(LOGO).toString('base64');
const LOGO_URI = `data:image/png;base64,${LOGO_B64}`;

// ─── Pipeline data ─────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, name: 'Select JD',           note: 'Pick the job for this hiring drive' },
  { n: 2, name: 'Enhance JD',          note: 'Generate 5 ready-to-use sourcing assets',
    agents: [
      { name: 'JD Enhancer', model: 'sonnet', endpoint: 'POST /enhance-jd',
        produces: 'Formatted JD · Recruiter Brief · Clarification Qs · Reachout · Sourcing Keywords' },
    ]},
  { n: 3, name: 'Source Candidates',   note: 'Add candidates from the database',
    agents: [
      { name: 'Resume Quality Evaluator', model: 'haiku',
        endpoint: 'POST /sessions/:id/candidates/:cid/evaluate',
        produces: 'Match score · strengths · verdict (auto-fires on add)' },
      { name: 'AI Content Detector', model: 'haiku',
        endpoint: 'POST /ai/check-ai-content',
        produces: 'Human / mixed / AI-generated verdict + confidence' },
    ]},
  { n: 4, name: 'Recruiter Screening', note: 'Pass / On Hold / Reject — optional live call' },
  { n: 5, name: 'Assessment Round',    note: 'Branches into 3 evaluation tracks',
    branches: [
      { label: 'Video Interview', agents: [
          { name: 'VI Question Generator', model: 'sonnet',
            endpoint: 'POST /vi/interviews/:id/generate',
            produces: 'Mix of technical · behavioural · situational questions' },
          { name: 'VI Evaluator', model: 'sonnet',
            endpoint: 'POST /vi/candidates/:cid/evaluate',
            produces: 'Overall · 5 competencies · per-question scores' },
        ]},
      { label: 'MCQ Assessment', agents: [
          { name: 'MCQ Question Generator', model: 'sonnet',
            endpoint: 'POST /assessments/:id/ai-generate',
            produces: '4-option MCQs with explanations · topic & difficulty tagged' },
          { name: 'MCQ Evaluator', model: 'haiku',
            endpoint: '(post-submit · async)',
            produces: 'Topic / difficulty breakdown · recommendation' },
        ]},
      { label: 'Coding Assessment', agents: [
          { name: 'Coding Question Generator', model: 'sonnet',
            endpoint: 'POST /coding-assessments/:id/ai-generate',
            produces: 'Write / fix / complete style problems with starter code' },
          { name: 'Coding Evaluator', model: 'haiku',
            endpoint: '(post-submit · async)',
            produces: 'Per-question correctness + quality + feedback' },
        ]},
    ]},
  { n: 6, name: 'Decision',            note: 'L1/L2/L3 · Proceed/Pool · Schedule interview',
    agents: [
      { name: 'Call QA + Candidate Report', model: 'opus',
        endpoint: 'POST /ai/generate-reports',
        produces: 'Recruiter QA scorecard + candidate hire / hold / no-hire (uses live call transcript)' },
    ]},
  { n: 7, name: 'Pipeline Tracker',    note: 'Kanban board · inline interview scheduler' },
];

// ─── Render helpers ────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const agentCard = (a) => `
  <div class="agent">
    <div class="agent__strip"></div>
    <div class="agent__body">
      <div class="agent__head">
        <span class="agent__name">${esc(a.name)}</span>
      </div>
      <code class="agent__endpoint">${esc(a.endpoint)}</code>
      ${a.produces ? `<div class="agent__produces">${esc(a.produces)}</div>` : ''}
    </div>
  </div>`;

const branchRow = (b) => `
  <div class="branch">
    <div class="branch__label">${esc(b.label)}</div>
    <div class="branch__agents">${b.agents.map(agentCard).join('')}</div>
  </div>`;

const stepRow = (step) => {
  const hasAgents = (step.agents && step.agents.length) || step.branches;
  const stepCls   = hasAgents ? 'step step--active' : 'step step--passive';

  let right;
  if (step.branches) {
    right = `<div class="branches">${step.branches.map(branchRow).join('')}</div>`;
  } else if (!hasAgents) {
    right = `<div class="empty">— no AI agent · manual step —</div>`;
  } else if (step.agents.length === 1) {
    right = `<div class="agents agents--one">${agentCard(step.agents[0])}</div>`;
  } else {
    right = `<div class="agents agents--two">${step.agents.map(agentCard).join('')}</div>`;
  }

  return `
    <div class="row">
      <div class="${stepCls}">
        <div class="step__num">${step.n}</div>
        <div class="step__text">
          <div class="step__name">${esc(step.name)}</div>
          <div class="step__note">${esc(step.note)}</div>
        </div>
      </div>
      <div class="cell">${right}</div>
    </div>`;
};

// ─── HTML ──────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zeople RecruiterOS — Pipeline Agent Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --orange:    #F97316;
    --orange-dim:#FEEBD6;
    --navy:      #1A2B4A;
    --navy-deep: #1D3461;
    --bg:        #F1F5F9;
    --card:      #FFFFFF;
    --text-1:    #1E293B;
    --text-2:    #64748B;
    --text-3:    #94A3B8;
    --border:    #E2E8F0;
    --emerald:   #059669;
    --red:       #DC2626;
    --amber:     #F59E0B;
    --purple:    #7C3AED;
    --blue:      #3B82F6;
    --muted:     #F8FAFC;
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, .04);
    --shadow:    0 1px 3px rgba(15, 23, 42, .06), 0 1px 2px rgba(15, 23, 42, .04);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text-1);
    -webkit-font-smoothing: antialiased;
    line-height: 1.45;
    padding: 24px 16px 40px;
  }

  .page {
    max-width: 1280px;
    margin: 0 auto;
    background: transparent;
  }

  /* ── Header band ── */
  .topbar { height: 6px; background: var(--orange); border-radius: 6px 6px 0 0; }
  .header {
    background: var(--card);
    border: 1px solid var(--border);
    border-top: none;
    border-radius: 0 0 12px 12px;
    padding: 18px 24px;
    display: flex;
    align-items: center;
    gap: 18px;
    box-shadow: var(--shadow-sm);
  }
  .header__logo {
    width: 48px; height: 48px;
    border-radius: 8px;
    background: var(--navy);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .header__logo img { width: 38px; height: 38px; object-fit: contain; }
  .header__text { flex: 1; min-width: 0; }
  .header__brand {
    font-size: 11px; font-weight: 700; color: var(--orange);
    letter-spacing: .25em; margin-bottom: 4px;
  }
  .header__title { font-size: 22px; font-weight: 700; color: var(--text-1); margin: 0; }
  .header__sub   { font-size: 13px; color: var(--text-2); margin-top: 2px; }
  .header__eyebrow {
    font-size: 10px; font-weight: 700; color: var(--text-3);
    letter-spacing: .2em; text-transform: uppercase;
    background: var(--orange-dim); color: var(--orange);
    padding: 4px 10px; border-radius: 999px; white-space: nowrap;
  }

  /* ── Grid ── */
  .grid {
    margin-top: 20px;
    display: grid;
    gap: 14px;
  }
  .row {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 14px;
    align-items: stretch;
  }

  /* ── Step badge ── */
  .step {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    min-height: 86px;
  }
  .step--active  { background: var(--navy); border-color: var(--navy); color: #fff; }
  .step--passive { background: var(--muted); border-style: dashed; }

  .step__num {
    flex: 0 0 36px;
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--orange);
    color: #fff;
    font-size: 16px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .step__text { min-width: 0; }
  .step__name { font-size: 15px; font-weight: 600; line-height: 1.3; }
  .step--passive .step__name { color: var(--text-2); }
  .step__note {
    font-size: 11.5px; margin-top: 4px; line-height: 1.45;
    color: rgba(255,255,255,.65);
  }
  .step--passive .step__note { color: var(--text-3); }

  /* ── Right cell ── */
  .cell { display: flex; }
  .empty {
    flex: 1;
    background: var(--muted);
    border: 1px dashed var(--border);
    border-radius: 10px;
    color: var(--text-3);
    font-style: italic;
    font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    min-height: 86px;
  }

  .agents { display: grid; gap: 12px; flex: 1; }
  .agents--one { grid-template-columns: 1fr; }
  .agents--two { grid-template-columns: 1fr 1fr; }

  .branches { display: grid; gap: 10px; flex: 1; }
  .branch {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 14px;
    align-items: stretch;
  }
  .branch__label {
    font-size: 11px; font-weight: 700;
    color: var(--orange);
    letter-spacing: .15em; text-transform: uppercase;
    display: flex; align-items: center;
    line-height: 1.3;
  }
  .branch__agents { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* ── Agent card ── */
  .agent {
    display: grid;
    grid-template-columns: 6px 1fr;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    min-height: 86px;
  }
  .agent__strip { background: var(--orange); }

  .agent__body { padding: 12px 14px; min-width: 0; }
  .agent__head {
    display: flex; align-items: flex-start; gap: 10px;
    margin-bottom: 6px;
  }
  .agent__name {
    font-size: 13.5px; font-weight: 600; color: var(--text-1);
    flex: 1; min-width: 0; line-height: 1.35;
  }

  .agent__endpoint {
    display: block;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 11px;
    color: var(--text-3);
    margin-bottom: 6px;
    word-break: break-all;
  }
  .agent__produces {
    font-size: 11.5px;
    color: var(--text-2);
    font-style: italic;
    line-height: 1.5;
  }

  /* ── Breakdown section ── */
  .breakdown {
    margin-top: 28px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .breakdown__head {
    background: var(--navy);
    color: #fff;
    padding: 18px 24px;
  }
  .breakdown__eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: .25em;
    color: var(--orange); text-transform: uppercase; margin-bottom: 6px;
  }
  .breakdown__title { font-size: 20px; font-weight: 700; margin: 0; }
  .breakdown__sub   { font-size: 13px; color: rgba(255,255,255,.7); margin-top: 4px; line-height: 1.5; }

  .breakdown__body { padding: 22px 24px 26px; }

  .group {
    border-top: 1px solid var(--border);
    padding-top: 16px; margin-top: 18px;
  }
  .group:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
  .group__label {
    font-size: 11px; font-weight: 700; letter-spacing: .2em;
    color: var(--orange); text-transform: uppercase; margin-bottom: 12px;
  }
  .group__items { display: grid; gap: 8px; }
  .item {
    display: grid;
    grid-template-columns: 90px 1fr auto;
    gap: 14px;
    align-items: baseline;
    font-size: 13px;
    color: var(--text-1);
    padding: 6px 0;
  }
  .item__step {
    font-size: 10px; font-weight: 700; letter-spacing: .12em;
    color: var(--text-3); text-transform: uppercase;
  }
  .item__name { font-weight: 600; }
  .item__desc { color: var(--text-2); margin-left: 6px; font-weight: 400; }
  .item__count {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px; color: var(--text-2);
    background: var(--muted); padding: 3px 10px; border-radius: 6px;
    border: 1px solid var(--border); white-space: nowrap;
  }

  .scenarios {
    margin-top: 26px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
  }
  .scenario {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    background: var(--muted);
  }
  .scenario--lean    { border-left: 4px solid var(--emerald); }
  .scenario--typical { border-left: 4px solid var(--orange); }
  .scenario--heavy   { border-left: 4px solid var(--purple); }
  .scenario__head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 10px;
  }
  .scenario__label {
    font-size: 11px; font-weight: 700; letter-spacing: .15em;
    text-transform: uppercase; color: var(--text-3);
  }
  .scenario__total {
    font-size: 22px; font-weight: 700; color: var(--text-1);
  }
  .scenario__total small { font-size: 12px; color: var(--text-3); font-weight: 500; }
  .scenario__desc {
    font-size: 12px; color: var(--text-2); line-height: 1.55;
    margin: 0;
  }
  .scenario__math {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 11px; color: var(--text-3);
    background: var(--card);
    padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border);
    margin-top: 10px;
    word-break: break-word;
  }

  .footnote {
    margin-top: 18px;
    font-size: 11.5px; color: var(--text-3); font-style: italic;
    line-height: 1.6;
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .row { grid-template-columns: 1fr; }
    .agents--two { grid-template-columns: 1fr; }
    .branch { grid-template-columns: 1fr; gap: 8px; }
    .branch__agents { grid-template-columns: 1fr; }
    .scenarios { grid-template-columns: 1fr; }
    .item { grid-template-columns: 1fr auto; }
    .item__step { grid-column: 1 / -1; }
  }

  /* ── Print → PDF ── */
  @page { size: A4 landscape; margin: 14mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .header, .agent, .footer, .step, .empty {
      box-shadow: none;
      page-break-inside: avoid;
    }
    .row { page-break-inside: avoid; }
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
        <h1 class="header__title">Pipeline Agent Interaction Map</h1>
        <div class="header__sub">How the 7-step hiring pipeline calls AI agents</div>
      </div>
      <span class="header__eyebrow">Pipeline Sessions</span>
    </header>

    <div class="grid">
      ${STEPS.map(stepRow).join('\n')}
    </div>

    <section class="breakdown">
      <div class="breakdown__head">
        <div class="breakdown__eyebrow">Cost Breakdown</div>
        <h2 class="breakdown__title">Where the 7–12 agent calls come from</h2>
        <p class="breakdown__sub">
          Counting from the perspective of <strong>one candidate</strong> moving through the full pipeline end-to-end.
          The pipeline has two cost layers: a fixed <em>setup cost</em> per session (paid once and reused for every candidate),
          and a recurring <em>per-candidate cost</em> for the work the AI does on that specific candidate.
        </p>
      </div>

      <div class="breakdown__body">

        <div class="group">
          <div class="group__label">Setup calls — once per session, amortized across all candidates</div>
          <div class="group__items">
            <div class="item">
              <span class="item__step">Step 2</span>
              <span><span class="item__name">JD Enhancer</span><span class="item__desc">— builds the 5 sourcing assets the rest of the pipeline reuses.</span></span>
              <span class="item__count">1 call</span>
            </div>
            <div class="item">
              <span class="item__step">Step 5</span>
              <span><span class="item__name">Question Generator</span><span class="item__desc">— one call per assessment created (VI / MCQ / Coding). Adds 1 call per assessment type used.</span></span>
              <span class="item__count">1–3 calls</span>
            </div>
          </div>
        </div>

        <div class="group">
          <div class="group__label">Per-candidate calls — fire for each candidate that progresses</div>
          <div class="group__items">
            <div class="item">
              <span class="item__step">Step 3</span>
              <span><span class="item__name">Resume Quality Evaluator</span><span class="item__desc">— auto-fires when a candidate is added to the session.</span></span>
              <span class="item__count">1 call</span>
            </div>
            <div class="item">
              <span class="item__step">Step 3</span>
              <span><span class="item__name">AI Content Detector</span><span class="item__desc">— optional, triggered on demand to flag AI-written resumes.</span></span>
              <span class="item__count">0–1 call</span>
            </div>
            <div class="item">
              <span class="item__step">Step 5</span>
              <span><span class="item__name">Assessment Evaluator</span><span class="item__desc">— one call per submission per assessment track the candidate takes (VI, MCQ, Coding).</span></span>
              <span class="item__count">1–3 calls</span>
            </div>
            <div class="item">
              <span class="item__step">Step 6</span>
              <span><span class="item__name">Call QA + Candidate Report</span><span class="item__desc">— generated after the recruiter finishes a live screening call.</span></span>
              <span class="item__count">1 call</span>
            </div>
          </div>
        </div>

        <div class="group">
          <div class="group__label">Real-time during the call (Calling CoPilot)</div>
          <div class="group__items">
            <div class="item">
              <span class="item__step">Step 4 / 6</span>
              <span><span class="item__name">Live Follow-Up Suggester</span><span class="item__desc">— low-latency nudges every few exchanges. Variable, typically 3–6 in a 10-minute call.</span></span>
              <span class="item__count">3–6 calls</span>
            </div>
          </div>
        </div>

        <div class="scenarios">

          <div class="scenario scenario--lean">
            <div class="scenario__head">
              <span class="scenario__label">Lean path</span>
              <span class="scenario__total">5<small>&nbsp;calls</small></span>
            </div>
            <p class="scenario__desc">One assessment track only, no AI content check, no live coaching.</p>
            <div class="scenario__math">JD Enh (1) + Q-Gen (1) + Resume (1) + Evaluator (1) + Call Report (1)</div>
          </div>

          <div class="scenario scenario--typical">
            <div class="scenario__head">
              <span class="scenario__label">Typical path</span>
              <span class="scenario__total">8–9<small>&nbsp;calls</small></span>
            </div>
            <p class="scenario__desc">One assessment track, AI content check on, modest live coaching during the call.</p>
            <div class="scenario__math">5 (lean) + Content Check (1) + Live Suggestions (~3)</div>
          </div>

          <div class="scenario scenario--heavy">
            <div class="scenario__head">
              <span class="scenario__label">Heavy path</span>
              <span class="scenario__total">12+<small>&nbsp;calls</small></span>
            </div>
            <p class="scenario__desc">Multiple assessment tracks, content check, full live coaching across a longer call.</p>
            <div class="scenario__math">JD Enh (1) + 3 × Q-Gen (3) + Resume (1) + Content Check (1) + 3 × Evaluator (3) + Call Report (1) + Live Suggestions (~3)</div>
          </div>

        </div>

        <div class="footnote">
          Setup calls (JD Enhancer, Question Generators) are paid once per session and reused for every candidate in that session — so for a hiring drive with 10 candidates, the JD Enhancer cost amortises to one-tenth of a call per candidate. The 7–12 range above reflects the marginal cost of moving a single candidate through the pipeline, including their share of the setup work.
        </div>

      </div>
    </section>
  </div>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log('✅ Wrote ' + OUT);
console.log('   Open in browser, then File → Print → Save as PDF for a PDF copy.');
