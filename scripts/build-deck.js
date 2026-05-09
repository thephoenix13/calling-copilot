/**
 * scripts/build-deck.js
 *
 * Generates dist/Zeople-RecruiterOS-Overview.pptx — a concise (~13-slide)
 * PowerPoint deck summarizing PRODUCT_OVERVIEW.md, themed with the
 * Zeople orange accent, navy sidebar tone, and Inter typography.
 *
 * Run with:  node scripts/build-deck.js
 */

const PptxGenJS = require('pptxgenjs');
const path      = require('path');
const fs        = require('fs');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'zeople-logo.png');
const OUT  = path.join(ROOT, 'dist', 'Zeople-RecruiterOS-Overview.pptx');

if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });

// ─── Zeople theme tokens (mirrored from client/src/App.css) ──────────────────
const C = {
  orange:     'F97316',
  orangeHov:  'EA580C',
  orangeDim:  'FEEBD6',   // approx of rgba(249,115,22,0.10)
  navy:       '1A2B4A',
  navyDeep:   '1D3461',
  bg:         'F1F5F9',
  card:       'FFFFFF',
  text1:      '1E293B',
  text2:      '64748B',
  text3:      '94A3B8',
  border:     'E2E8F0',
  emerald:    '059669',
  red:        'DC2626',
  amber:      'F59E0B',
  purple:     '7C3AED',
  white:      'FFFFFF',
};

const FONT = 'Inter';

// ─── Build the deck ──────────────────────────────────────────────────────────
const pptx = new PptxGenJS();
pptx.layout    = 'LAYOUT_WIDE';      // 13.333 × 7.5 in
pptx.title     = 'Zeople RecruiterOS — Product Overview';
pptx.company   = 'Zeople';
pptx.author    = 'Zeople';
pptx.subject   = 'Product Overview';

const W = 13.333, H = 7.5;

// ─── Master slide layouts ────────────────────────────────────────────────────
pptx.defineSlideMaster({
  title: 'CONTENT',
  background: { color: C.bg },
  objects: [
    // Top accent bar
    { rect: { x: 0,    y: 0,    w: W,   h: 0.08, fill: { color: C.orange } } },
    // Sidebar accent strip
    { rect: { x: 0,    y: 0.08, w: 0.18, h: H - 0.08, fill: { color: C.navy } } },
    // Header band
    { rect: { x: 0.18, y: 0.08, w: W - 0.18, h: 0.95, fill: { color: C.card } } },
    // Footer line
    { line: { x1: 0.6, y1: H - 0.45, x2: W - 0.6, y2: H - 0.45, line: { color: C.border, width: 0.75 } } },
    // Footer text
    { text: {
        text: 'Zeople RecruiterOS · Product Overview',
        options: { x: 0.6, y: H - 0.42, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: C.text3 },
    }},
    { text: {
        text: 'zeople.ai',
        options: { x: W - 1.6, y: H - 0.42, w: 1, h: 0.3, fontFace: FONT, fontSize: 9, color: C.text3, align: 'right' },
    }},
  ],
});

// ─── Reusable helpers ────────────────────────────────────────────────────────
const SAFE_X = 0.6;
const HEADER_Y = 0.18;
const BODY_Y = 1.30;

function addHeader(slide, eyebrow, title) {
  slide.addImage({ path: LOGO, x: SAFE_X, y: HEADER_Y, w: 0.55, h: 0.55 });
  slide.addText('ZEOPLE', { x: 1.20, y: HEADER_Y, w: 2.0, h: 0.3,
    fontFace: FONT, fontSize: 10, bold: true, color: C.orange, charSpacing: 4 });
  slide.addText(eyebrow, { x: 1.20, y: HEADER_Y + 0.30, w: 5.0, h: 0.25,
    fontFace: FONT, fontSize: 9, color: C.text3, charSpacing: 2 });
  slide.addText(title, { x: SAFE_X, y: 0.78, w: W - SAFE_X * 2, h: 0.5,
    fontFace: FONT, fontSize: 22, bold: true, color: C.text1 });
}

function addBullets(slide, items, opts = {}) {
  const x = opts.x ?? SAFE_X;
  const y = opts.y ?? BODY_Y;
  const w = opts.w ?? (W - SAFE_X * 2);
  const h = opts.h ?? (H - BODY_Y - 1.0);
  slide.addText(
    items.map(it => typeof it === 'string'
      ? { text: it, options: { bullet: { code: '25CF' }, color: C.text1 } }
      : it),
    { x, y, w, h,
      fontFace: FONT, fontSize: 14, color: C.text1, valign: 'top',
      paraSpaceAfter: 6, lineSpacing: 22 },
  );
}

function addCard(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill:   { color: opts.fill ?? C.card },
    line:   { color: opts.border ?? C.border, width: 0.5 },
    rectRadius: 0.08,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — COVER
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.background = { color: C.navy };

  // Right orange wedge (decorative)
  s.addShape(pptx.ShapeType.rect, { x: W - 1.6, y: 0, w: 1.6, h: H, fill: { color: C.orange } });
  s.addShape(pptx.ShapeType.rect, { x: W - 0.18, y: 0, w: 0.18, h: H, fill: { color: C.orangeHov } });

  // Logo + brand
  s.addImage({ path: LOGO, x: SAFE_X, y: 1.0, w: 0.9, h: 0.9 });
  s.addText('ZEOPLE', { x: 1.7, y: 1.05, w: 4, h: 0.55,
    fontFace: FONT, fontSize: 26, bold: true, color: C.white, charSpacing: 5 });
  s.addText('RecruiterOS', { x: 1.7, y: 1.55, w: 6, h: 0.4,
    fontFace: FONT, fontSize: 13, color: 'B0BEC5', charSpacing: 3 });

  // Title
  s.addText('Product Overview', { x: SAFE_X, y: 2.6, w: W - 3.0, h: 1.0,
    fontFace: FONT, fontSize: 44, bold: true, color: C.white });

  s.addText('AI-powered recruiting from sourcing through post-offer follow-up.',
    { x: SAFE_X, y: 3.6, w: W - 3.0, h: 0.8,
      fontFace: FONT, fontSize: 18, color: 'CBD5E1' });

  // Accent underline
  s.addShape(pptx.ShapeType.rect, { x: SAFE_X, y: 4.5, w: 1.4, h: 0.06, fill: { color: C.orange } });

  // Footer
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  s.addText(today, { x: SAFE_X, y: H - 0.7, w: 4, h: 0.3,
    fontFace: FONT, fontSize: 11, color: 'B0BEC5' });
  s.addText('zeople.ai', { x: W - 3.0, y: H - 0.7, w: 1.2, h: 0.3,
    fontFace: FONT, fontSize: 11, color: C.white, align: 'right' });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — WHAT IS RECRUITEROS
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'INTRODUCTION', 'What is Zeople RecruiterOS?');

  s.addText(
    'An AI-powered recruiting platform that helps recruiters manage the full hiring lifecycle — from sourcing and screening candidates to making final decisions and tracking post-offer follow-up — in one place.',
    { x: SAFE_X, y: 1.55, w: W - SAFE_X * 2, h: 1.2,
      fontFace: FONT, fontSize: 17, color: C.text2, lineSpacing: 28 },
  );

  // Three pillars
  const pillars = [
    { title: 'AI-native',          body: 'Real-time call coaching, resume scoring, evaluation reports, automated POFU emails — all powered by Claude.' },
    { title: 'End-to-end',         body: 'Sourcing → screening → assessment → decision → offer → joining. One platform, one source of truth.' },
    { title: 'Built for recruiters', body: 'Pipeline-first UI, agentic workflows, and per-recruiter QA scorecards designed for daily use.' },
  ];
  const cardW = (W - SAFE_X * 2 - 0.4) / 3;
  pillars.forEach((p, i) => {
    const x = SAFE_X + i * (cardW + 0.2);
    addCard(s, x, 3.4, cardW, 2.6);
    s.addShape(pptx.ShapeType.rect, { x: x + 0.3, y: 3.65, w: 0.4, h: 0.06, fill: { color: C.orange } });
    s.addText(p.title, { x: x + 0.3, y: 3.85, w: cardW - 0.6, h: 0.5,
      fontFace: FONT, fontSize: 16, bold: true, color: C.text1 });
    s.addText(p.body, { x: x + 0.3, y: 4.4, w: cardW - 0.6, h: 1.4,
      fontFace: FONT, fontSize: 12, color: C.text2, lineSpacing: 18, valign: 'top' });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — MODULE MAP
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'MODULE MAP', 'The platform at a glance');

  const groups = [
    { label: 'SOURCING & SETUP',  items: ['Job Management', 'Candidate Database', 'JD Enhancer'] },
    { label: 'EXECUTION',         items: ['Calling CoPilot', 'Pipeline Sessions'] },
    { label: 'EVALUATION',        items: ['Video Interviews', 'MCQ Assessments', 'Coding Assessments'] },
    { label: 'POST-OFFER',        items: ['POFU (Post-Offer Follow-Up)'] },
    { label: 'INSIGHTS',          items: ['Reports & Analytics', 'Recruiter QA'] },
    { label: 'ADMIN',             items: ['Settings (Superuser)'] },
  ];

  const cardW = (W - SAFE_X * 2 - 0.4) / 3;
  const cardH = 1.85;
  groups.forEach((g, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = SAFE_X + col * (cardW + 0.2);
    const y = 1.45 + row * (cardH + 0.25);
    addCard(s, x, y, cardW, cardH);
    s.addShape(pptx.ShapeType.rect, { x, y, w: cardW, h: 0.06, fill: { color: C.orange } });
    s.addText(g.label, { x: x + 0.3, y: y + 0.18, w: cardW - 0.6, h: 0.3,
      fontFace: FONT, fontSize: 10, bold: true, color: C.orange, charSpacing: 3 });
    s.addText(g.items.map(it => ({ text: it, options: { bullet: { code: '25CF' } } })),
      { x: x + 0.3, y: y + 0.55, w: cardW - 0.6, h: cardH - 0.7,
        fontFace: FONT, fontSize: 12, color: C.text1, lineSpacing: 18, paraSpaceAfter: 4, valign: 'top' });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — CALLING COPILOT
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'EXECUTION', 'Calling CoPilot — the flagship feature');

  // Left column
  s.addText('What it does', { x: SAFE_X, y: 1.55, w: 6, h: 0.35,
    fontFace: FONT, fontSize: 13, bold: true, color: C.orange, charSpacing: 2 });
  addBullets(s, [
    'Recruiter dials a candidate directly from the browser.',
    'Live transcription captures the conversation in real time.',
    'AI surfaces nudges and suggested questions during the call.',
    'Auto Demo mode simulates a full conversation for product walkthroughs.',
  ], { x: SAFE_X, y: 1.95, w: 6.3, h: 4.0 });

  // Right column — two report cards
  const rx = 7.2, rw = W - 7.2 - SAFE_X;
  s.addText('Two AI reports after every call', { x: rx, y: 1.55, w: rw, h: 0.35,
    fontFace: FONT, fontSize: 13, bold: true, color: C.orange, charSpacing: 2 });

  addCard(s, rx, 1.95, rw, 1.85);
  s.addText('Per-Call QA Report', { x: rx + 0.3, y: 2.05, w: rw - 0.6, h: 0.4,
    fontFace: FONT, fontSize: 15, bold: true, color: C.text1 });
  s.addText('8-dimension scorecard with weighted scores, transcript-grounded evidence, red flags, and weak vs. better coaching nudges.',
    { x: rx + 0.3, y: 2.5, w: rw - 0.6, h: 1.2,
      fontFace: FONT, fontSize: 11.5, color: C.text2, lineSpacing: 18, valign: 'top' });

  addCard(s, rx, 4.0, rw, 1.85);
  s.addText('Candidate Evaluation Report', { x: rx + 0.3, y: 4.10, w: rw - 0.6, h: 0.4,
    fontFace: FONT, fontSize: 15, bold: true, color: C.text1 });
  s.addText('Overall fit score, recommendation (recommend / consider / decline), strengths, concerns, and a written summary.',
    { x: rx + 0.3, y: 4.55, w: rw - 0.6, h: 1.2,
      fontFace: FONT, fontSize: 11.5, color: C.text2, lineSpacing: 18, valign: 'top' });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — PIPELINE SESSIONS (7 STEPS)
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'EXECUTION', 'Pipeline Sessions — agentic 7-step hiring drive');

  const steps = [
    ['1', 'Select JD',           'Pick the job for this drive'],
    ['2', 'Enhance JD',          'AI generates 5 ready assets'],
    ['3', 'Source Candidates',   'AI match scoring + content check'],
    ['4', 'Recruiter Screening', 'Pass / On Hold / Reject + live call'],
    ['5', 'Assessment Round',    'Video / MCQ / Coding + AI reports'],
    ['6', 'Decision',            'L1/L2/L3, Proceed/Pool, schedule interview'],
    ['7', 'Pipeline Tracker',    'Kanban board with inline scheduling'],
  ];
  // 4 + 3 layout
  const colW = (W - SAFE_X * 2 - 0.6) / 4;
  steps.forEach((st, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = SAFE_X + col * (colW + 0.2);
    const y = 1.55 + row * 2.3;
    addCard(s, x, y, colW, 2.05);
    // Step number badge
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.25, y: y + 0.22, w: 0.5, h: 0.5,
      fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
    s.addText(st[0], { x: x + 0.25, y: y + 0.24, w: 0.5, h: 0.5,
      fontFace: FONT, fontSize: 18, bold: true, color: C.white, align: 'center', valign: 'middle' });
    s.addText(st[1], { x: x + 0.85, y: y + 0.25, w: colW - 1.0, h: 0.45,
      fontFace: FONT, fontSize: 13, bold: true, color: C.text1, valign: 'middle' });
    s.addText(st[2], { x: x + 0.25, y: y + 0.95, w: colW - 0.5, h: 1.0,
      fontFace: FONT, fontSize: 11, color: C.text2, lineSpacing: 16, valign: 'top' });
  });

  s.addText('Steps unlock progressively. Step 5 has 4 sub-modes (VI / MCQ / Coding / AI Reports). Steps 6 & 7 include an inline interview scheduler.',
    { x: SAFE_X, y: H - 0.95, w: W - SAFE_X * 2, h: 0.4,
      fontFace: FONT, fontSize: 10.5, italic: true, color: C.text3 });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — SOURCING & SETUP
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'SOURCING & SETUP', 'Three modules that feed the pipeline');

  const modules = [
    {
      title: 'Job Management',
      body: 'Create and manage job postings — title, client, location, salary, required & preferred skills, headcount. Jobs feed into pipelines and the JD Enhancer.',
    },
    {
      title: 'Candidate Database',
      body: 'Searchable database of all candidates with contact details, experience, skills, resume text, and history. AI Content Check flags AI-generated resumes.',
    },
    {
      title: 'JD Enhancer',
      body: 'Paste a rough JD → get five ready-to-use assets: Formatted JD, Recruiter Brief, Clarification Questions, Reachout Material, Sourcing Keywords.',
    },
  ];

  const cardW = (W - SAFE_X * 2 - 0.4) / 3;
  modules.forEach((m, i) => {
    const x = SAFE_X + i * (cardW + 0.2);
    addCard(s, x, 1.55, cardW, 4.6);
    s.addShape(pptx.ShapeType.rect, { x: x + 0.3, y: 1.85, w: 0.5, h: 0.06, fill: { color: C.orange } });
    s.addText(m.title, { x: x + 0.3, y: 2.05, w: cardW - 0.6, h: 0.5,
      fontFace: FONT, fontSize: 18, bold: true, color: C.text1 });
    s.addText(m.body, { x: x + 0.3, y: 2.65, w: cardW - 0.6, h: 3.5,
      fontFace: FONT, fontSize: 13, color: C.text2, lineSpacing: 22, valign: 'top' });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — EVALUATION SUITE
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'EVALUATION', 'Three native assessment formats');

  const items = [
    { title: 'Video Interviews', body: 'Async video templates with multiple questions. AI scores communication, relevance, and 5 competencies per response.' },
    { title: 'MCQ Assessments',  body: 'Multiple-choice tests with time limits and pass scores. Personal invite links + AI-written evaluation alongside the raw score.' },
    { title: 'Coding Assessments', body: 'In-browser coding challenges with starter code. AI evaluates correctness, complexity, and edge-case handling.' },
  ];
  const cardW = (W - SAFE_X * 2 - 0.4) / 3;
  items.forEach((m, i) => {
    const x = SAFE_X + i * (cardW + 0.2);
    addCard(s, x, 1.55, cardW, 4.6);
    s.addShape(pptx.ShapeType.rect, { x: x + 0.3, y: 1.85, w: 0.5, h: 0.06, fill: { color: C.orange } });
    s.addText(m.title, { x: x + 0.3, y: 2.05, w: cardW - 0.6, h: 0.5,
      fontFace: FONT, fontSize: 18, bold: true, color: C.text1 });
    s.addText(m.body, { x: x + 0.3, y: 2.65, w: cardW - 0.6, h: 3.5,
      fontFace: FONT, fontSize: 13, color: C.text2, lineSpacing: 22, valign: 'top' });
  });

  s.addText('Each assessment integrates into Pipeline Sessions Step 5 and produces results visible in Reports & Analytics.',
    { x: SAFE_X, y: H - 0.95, w: W - SAFE_X * 2, h: 0.4,
      fontFace: FONT, fontSize: 10.5, italic: true, color: C.text3 });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — POFU
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'POST-OFFER', 'Post-Offer Follow-Up (POFU)');

  s.addText('Once a candidate accepts an offer, POFU automates the entire pre-joining stretch — and flags drop risk before Day 1.',
    { x: SAFE_X, y: 1.55, w: W - SAFE_X * 2, h: 0.7,
      fontFace: FONT, fontSize: 15, color: C.text2, lineSpacing: 22 });

  // Lifecycle row of 6 states
  const states = ['Offer Accepted','Resigned','BGV','Confirmed','Joined','Dropped'];
  const stateColors = [C.purple, C.amber, C.amber, C.emerald, C.emerald, C.red];
  const sX = SAFE_X, sY = 2.7;
  const sW = (W - SAFE_X * 2 - 0.5) / 6;
  states.forEach((label, i) => {
    const x = sX + i * (sW + 0.1);
    s.addShape(pptx.ShapeType.roundRect, { x, y: sY, w: sW, h: 0.7,
      fill: { color: stateColors[i] }, line: { color: stateColors[i], width: 0 }, rectRadius: 0.08 });
    s.addText(label, { x, y: sY, w: sW, h: 0.7,
      fontFace: FONT, fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle' });
  });
  s.addText('Lifecycle states tracked per candidate', { x: SAFE_X, y: 3.5, w: W - SAFE_X * 2, h: 0.3,
    fontFace: FONT, fontSize: 10, color: C.text3, italic: true, align: 'center' });

  // Bullets
  addBullets(s, [
    'AI-generated personalised check-in emails at the right intervals.',
    'Tracks BGV completion, joining-date confirmation, and final joining.',
    'Risk score (0–100) and risk level (low / medium / high) per candidate.',
    'Auto-pauses a sequence when a candidate replies, resumes on silence.',
  ], { x: SAFE_X, y: 4.0, w: W - SAFE_X * 2, h: 2.5 });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — REPORTS & ANALYTICS
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'INSIGHTS', 'Reports & Analytics — eight tabs, one source of truth');

  const tabs = [
    ['Pipeline Funnel',  'Sourced → Selected funnel + VI funnel'],
    ['Efficiency',       'Stage conversion, bottleneck flag, time-in-stage'],
    ['Candidates',       'Screening, decisions, score & match distribution'],
    ['Assessments',      'MCQ + Coding stats, score distributions'],
    ['Video Interviews', 'Recommendations, score, 5-competency averages'],
    ['Post-Offer',       'POFU state progression, risk, email engagement'],
    ['Activity',         'Session-level activity log + cycle times'],
    ['By Job',           'Per-job pipeline metrics with skills coverage'],
  ];
  const cardW = (W - SAFE_X * 2 - 0.6) / 4;
  const cardH = 1.55;
  tabs.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = SAFE_X + col * (cardW + 0.2);
    const y = 1.55 + row * (cardH + 0.2);
    addCard(s, x, y, cardW, cardH);
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.06, h: cardH, fill: { color: C.orange } });
    s.addText(t[0], { x: x + 0.25, y: y + 0.2, w: cardW - 0.4, h: 0.45,
      fontFace: FONT, fontSize: 13, bold: true, color: C.text1 });
    s.addText(t[1], { x: x + 0.25, y: y + 0.65, w: cardW - 0.4, h: 0.85,
      fontFace: FONT, fontSize: 11, color: C.text2, lineSpacing: 16, valign: 'top' });
  });

  s.addText('KPI strip on every view: Active Jobs · Time-to-Hire · Selection Rate · Pipeline Sessions · Candidates · Assessments · Video Interviews · POFU · Calls Made.',
    { x: SAFE_X, y: H - 0.95, w: W - SAFE_X * 2, h: 0.4,
      fontFace: FONT, fontSize: 10.5, italic: true, color: C.text3 });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — RECRUITER QA (NEW)
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'INSIGHTS · NEW', 'Recruiter QA — coaching from every call');

  // KPI cards
  const kpis = [
    { label: 'Calls Reviewed',    value: '—',   sub: 'QA scorecards generated', color: C.orange },
    { label: 'Avg QA Score',       value: '/100', sub: 'across all reviewed calls', color: C.emerald },
    { label: 'Needs Coaching',     value: '%',    sub: 'calls below 70',            color: C.red },
    { label: 'Weakest Dimension',  value: '★',    sub: 'most common low area',      color: C.purple },
  ];
  const kW = (W - SAFE_X * 2 - 0.6) / 4;
  kpis.forEach((k, i) => {
    const x = SAFE_X + i * (kW + 0.2);
    addCard(s, x, 1.55, kW, 1.5);
    s.addShape(pptx.ShapeType.rect, { x, y: 1.55, w: kW, h: 0.06, fill: { color: k.color } });
    s.addText(k.value, { x: x + 0.2, y: 1.7, w: kW - 0.4, h: 0.55,
      fontFace: FONT, fontSize: 22, bold: true, color: k.color });
    s.addText(k.label, { x: x + 0.2, y: 2.25, w: kW - 0.4, h: 0.3,
      fontFace: FONT, fontSize: 12, color: C.text1, bold: true });
    s.addText(k.sub, { x: x + 0.2, y: 2.55, w: kW - 0.4, h: 0.4,
      fontFace: FONT, fontSize: 10, color: C.text3 });
  });

  // Two columns
  s.addText('What you see', { x: SAFE_X, y: 3.4, w: 6, h: 0.3,
    fontFace: FONT, fontSize: 13, bold: true, color: C.orange, charSpacing: 2 });
  addBullets(s, [
    'Searchable list of every reviewed call.',
    'Color-coded QA score (red < 45, amber 45–69, green ≥ 70).',
    'Submission verdict + risk level pills per row.',
    'Sort by most recent, lowest score, or highest score.',
  ], { x: SAFE_X, y: 3.75, w: 6.3, h: 2.5 });

  s.addText('Drill-down', { x: 7.2, y: 3.4, w: 6, h: 0.3,
    fontFace: FONT, fontSize: 13, bold: true, color: C.orange, charSpacing: 2 });
  addBullets(s, [
    'Click any row to open the full Per-Call QA Report inline.',
    '8-dimension weighted scorecard with evidence quotes.',
    'Red flags ranked by severity (critical / high / medium).',
    'Weak vs. better coaching nudges with rationale.',
  ], { x: 7.2, y: 3.75, w: W - 7.2 - SAFE_X, h: 2.5 });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 11 — WHERE ZEOPLE LEADS
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'DIFFERENTIATION', 'Where Zeople leads vs. enterprise ATS');

  const wins = [
    { title: 'Live AI call coaching',           body: 'Real-time transcription + nudges during the call — not a post-mortem.' },
    { title: 'Per-call QA scorecards',          body: '8-dimension weighted grading on every recruiter call, with weak vs. better coaching prompts.' },
    { title: 'AI resume content check',         body: 'Flags AI-generated resume writing before you spend cycles on a candidate.' },
    { title: 'Native video interview analytics', body: 'Built-in scoring across 5 competencies — no HireVue integration needed.' },
    { title: 'Post-offer drop-risk scoring',    body: 'Predicts and tracks drop risk through to Day 1 with auto check-ins.' },
    { title: 'Per-session hiring drive analytics', body: 'Every hiring drive has its own funnel, conversion, and cycle-time view.' },
  ];
  const cardW = (W - SAFE_X * 2 - 0.4) / 3;
  const cardH = 1.95;
  wins.forEach((w, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = SAFE_X + col * (cardW + 0.2);
    const y = 1.55 + row * (cardH + 0.2);
    addCard(s, x, y, cardW, cardH, { fill: 'FFFAF3', border: C.orange });
    s.addText('✓', { x: x + 0.2, y: y + 0.18, w: 0.4, h: 0.4,
      fontFace: FONT, fontSize: 18, bold: true, color: C.orange });
    s.addText(w.title, { x: x + 0.6, y: y + 0.18, w: cardW - 0.7, h: 0.5,
      fontFace: FONT, fontSize: 13.5, bold: true, color: C.text1 });
    s.addText(w.body, { x: x + 0.2, y: y + 0.78, w: cardW - 0.4, h: cardH - 0.95,
      fontFace: FONT, fontSize: 11, color: C.text2, lineSpacing: 17, valign: 'top' });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 12 — GAPS & ROADMAP
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'HONEST ASSESSMENT', 'Gaps vs. enterprise ATS');

  s.addText('What standard ATS platforms still do better — and where Zeople is heading.',
    { x: SAFE_X, y: 1.55, w: W - SAFE_X * 2, h: 0.5,
      fontFace: FONT, fontSize: 14, color: C.text2 });

  // Two columns: Gaps | On the roadmap
  const colW = (W - SAFE_X * 2 - 0.4) / 2;

  // GAPS column
  addCard(s, SAFE_X, 2.3, colW, 4.0);
  s.addShape(pptx.ShapeType.rect, { x: SAFE_X, y: 2.3, w: colW, h: 0.06, fill: { color: C.red } });
  s.addText('CURRENT GAPS', { x: SAFE_X + 0.3, y: 2.45, w: colW - 0.6, h: 0.35,
    fontFace: FONT, fontSize: 11, bold: true, color: C.red, charSpacing: 3 });
  addBullets(s, [
    'Source of hire tracking (LinkedIn, referral, job board).',
    'Offer analytics — acceptance rate, decline reasons.',
    'Cost-per-hire economics.',
    'Aggregated multi-recruiter leaderboards (per-call exists; team-level pending).',
    'CSV / Excel export & scheduled email reports.',
    'BI tool integration (PowerBI, Looker).',
  ], { x: SAFE_X + 0.3, y: 2.85, w: colW - 0.6, h: 3.3 });

  // ROADMAP column
  const rx = SAFE_X + colW + 0.4;
  addCard(s, rx, 2.3, colW, 4.0);
  s.addShape(pptx.ShapeType.rect, { x: rx, y: 2.3, w: colW, h: 0.06, fill: { color: C.orange } });
  s.addText('ON THE ROADMAP', { x: rx + 0.3, y: 2.45, w: colW - 0.6, h: 0.35,
    fontFace: FONT, fontSize: 11, bold: true, color: C.orange, charSpacing: 3 });
  addBullets(s, [
    'Multi-recruiter QA dashboard with leaderboards.',
    'Source attribution + ROI per source.',
    'Offer & cost analytics module.',
    'Native CSV / Excel export from every report.',
    'Scheduled email digest (weekly / monthly).',
    'Read-only BI connectors.',
  ], { x: rx + 0.3, y: 2.85, w: colW - 0.6, h: 3.3 });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLIDE 13 — TECH STACK + CLOSING
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'CONTENT' });
  addHeader(s, 'CLOSING', 'Built on a focused, modern stack');

  // Stack rows
  const stack = [
    ['Frontend',      'React 18 + Vite'],
    ['Backend',       'Node.js + Express'],
    ['Database',      'SQLite (better-sqlite3)'],
    ['AI',            'Anthropic Claude — reports, evaluations, JD enhancement, POFU emails, content check'],
    ['Communication', 'Twilio (calls) · Hostinger SMTP (emails) · Deepgram (live transcription)'],
  ];
  let y = 1.55;
  stack.forEach(([label, val]) => {
    s.addText(label.toUpperCase(), { x: SAFE_X, y, w: 2.0, h: 0.4,
      fontFace: FONT, fontSize: 11, bold: true, color: C.orange, charSpacing: 2, valign: 'middle' });
    s.addText(val, { x: SAFE_X + 2.2, y, w: W - SAFE_X * 2 - 2.2, h: 0.4,
      fontFace: FONT, fontSize: 13, color: C.text1, valign: 'middle' });
    y += 0.5;
  });

  // Closing band
  s.addShape(pptx.ShapeType.roundRect, { x: SAFE_X, y: 4.6, w: W - SAFE_X * 2, h: 1.7,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, rectRadius: 0.1 });
  s.addShape(pptx.ShapeType.rect, { x: SAFE_X, y: 4.6, w: 0.1, h: 1.7, fill: { color: C.orange } });

  s.addText('One platform. From the first call to Day 1.',
    { x: SAFE_X + 0.4, y: 4.75, w: W - SAFE_X * 2 - 0.8, h: 0.7,
      fontFace: FONT, fontSize: 22, bold: true, color: C.white });
  s.addText('AI-native recruiting, built for the way recruiters actually work.',
    { x: SAFE_X + 0.4, y: 5.45, w: W - SAFE_X * 2 - 0.8, h: 0.5,
      fontFace: FONT, fontSize: 14, color: 'CBD5E1' });
}

// ─── Write file ──────────────────────────────────────────────────────────────
pptx.writeFile({ fileName: OUT })
  .then((file) => console.log('✅ Wrote ' + file))
  .catch((err) => { console.error('❌ Failed:', err); process.exit(1); });
