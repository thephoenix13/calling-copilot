// Single-slide version: all 19 agents as one phase-grouped table with
// Purpose / Outcome / Technical columns. Theme colors match the
// Zeople-RPO-V1-Executive-Dark deck. Source deck is NOT modified.
const PptxGenJS = require('pptxgenjs');

const NAVY = '0A1628', GRAY = '6B7280', LIGHT = '9CA3AF';
const BG = 'F8FAFB', CARD = 'FFFFFF', BORDER = 'D1D8E4', FOOTER = '0E1A2B', HEAD = '0E1A2B';
const BRAND = 'F4621F', FONT = 'Calibri';
const FOOTER_TXT = 'ZEOPLE RecruiterOS  ·  Enterprise RPO Partnership  ·  Confidential  ·  May 2026  ·  zeople.ai';

const PHASES = [
  { name: 'PHASE 1 · INTAKE', color: 'F4621F', agents: [
    ['01', 'JD Enhancer', 'Rough brief → 6 recruiter-ready assets', '3+ hrs saved per mandate', 'JD, brief, HM Qs, outreach, keywords & market intel in one run'],
    ['02', 'Requirement Qualification', 'Structured AI-generated HM intake Q&A', 'First-round rejections −35–40%', '7-section Q&A stored on job; auto-triggers JD refresh on save'],
    ['03', 'Auto JD Refresh', 'JD self-updates whenever requirements change', 'Pipeline relevance +40%', 'Background agent regenerates all 6 assets; full version audit trail'],
  ] },
  { name: 'PHASE 2 · SOURCING', color: '7C3AED', agents: [
    ['04', 'Sourcing & Matching', 'AI match score on pipeline entry', 'Time-to-shortlist −50%+', '6-dim score vs live JD; ranked leaderboard; re-scores on refresh'],
    ['05', 'Market Intelligence', 'Market intel embedded in every JD', '3× more mandate extensions', 'Auto 6th asset: demand, comp signals, availability; in brief'],
    ['06', 'AI Candidate Scoring', 'Objective score before recruiter time', '−65% irrelevant pre-screens', '6-dim scorecard + written verdict; fit threshold; live-JD aligned'],
    ['07', 'Boolean Search', 'AI boolean built from the live JD', '+40% relevant candidates', 'Primary terms, synonyms, exclusions, title variants; auto-refresh'],
    ['08', 'AI Resume Detection', 'Flag AI / fraudulent CVs before first call', 'Catches 94% of AI resumes', '5-class verdict + 0–100 confidence; auto-fires & on-demand'],
  ] },
  { name: 'PHASE 3 · SCREENING', color: '0D9EA8', agents: [
    ['09', 'Screening CoPilot', 'Live in-call AI coaching', 'Ramp 10 wks → under 2', 'Live transcript, ~1s nudges; pre-call guide via Claude Opus'],
    ['10', 'CoPilot Reports', 'Two AI reports the moment a call ends', 'Saves 3–4 hrs docs/shortlist', 'Candidate eval + 8-dim QA, transcript-grounded; Claude Opus'],
    ['11', 'Recruiter Coaching', 'Every call becomes a coaching session', '2× client retention', '8-dim weighted scorecard; weak-vs-better nudges; client QA proof'],
  ] },
  { name: 'PHASE 4 · EVALUATE', color: '16A34A', agents: [
    ['12', 'Video Interviews', 'Async video with AI competency scoring', 'Scheduling 3–5 days → <4 hrs', '5-competency scoring; Q-gen & scoring by Claude Sonnet'],
    ['13', 'Coding Challenges', 'In-browser coding with AI evaluation', 'Eval lag gone; ~70% faster', '40/30/30 question mix; in-browser IDE; scored by Haiku'],
    ['14', 'MCQ Assessments', 'AI-generated MCQs + written evaluation', '+60% hiring-manager confidence', '≤10 MCQs via Sonnet; topic/gaps narrative; personalised links'],
    ['15', 'Assessment Reports', 'Unified video + coding + MCQ view', 'Saves 4+ hrs QBR prep', 'Native analytics tabs; cross-assessment ranking per candidate'],
  ] },
  { name: 'PHASE 5 · CLOSE', color: 'D97706', agents: [
    ['16', 'ZeBot', 'Plain-English pipeline queries', 'Kills the 48-hr BI wait', 'NL → live intelligence, no SQL; across all 8 analytics tabs'],
    ['17', 'POFU Engine', 'Prevent offer drops — every candidate, daily', 'Offer drops −40–60%', '6 states + 0–100 daily risk; sequences auto-pause/resume'],
    ['18', 'ATS Integration', 'Intelligence layer on top of your ATS', 'Analytics in 30 days; $0 swap', 'Layers on Workday/SAP/iCIMS; 8-tab real-time funnel'],
    ['19', 'Client Reporting', 'Real-time client reporting, automatically', 'Client escalations −50%', 'Live 8-tab dashboard; QA proof; per-candidate evidence reports'],
  ] },
];

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'W16x9', width: 13.333, height: 7.5 });
pptx.layout = 'W16x9';
pptx.title = 'Zeople RecruiterOS — 19 Agents One-Pager';

const W = 13.333, MX = 0.25;
const s = pptx.addSlide();
s.background = { color: BG };

// top accent bar + header + footer
s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: BRAND } });
s.addText('RPO PROCESS INTELLIGENCE MAP', { x: MX, y: 0.14, w: 9, h: 0.22, fontFace: FONT, fontSize: 9, bold: true, color: BRAND });
s.addText('19 AI agents — purpose, outcome & technical edge across 5 phases.',
  { x: MX, y: 0.34, w: W - MX * 2, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: NAVY });
s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.13, w: W, h: 0.37, fill: { color: FOOTER } });
s.addText(FOOTER_TXT, { x: MX, y: 7.13, w: W - MX * 2, h: 0.37, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 7, color: LIGHT });

// ---- table ----
const colW = [1.9, 3.05, 2.25, 5.18]; // Agent | Purpose | Outcome | Technical = 12.38
const border = [{ type: 'solid', color: BORDER, pt: 0.5 }];
const rows = [];

// header row
const hCell = (t, al) => ({ text: t, options: { fill: { color: HEAD }, color: 'FFFFFF', bold: true, fontSize: 8, align: al || 'left', valign: 'middle', h: 0.26 } });
rows.push([hCell('Agent'), hCell('Purpose'), hCell('Outcome'), hCell('Technical edge')]);

PHASES.forEach(ph => {
  rows.push([{ text: ph.name, options: { colspan: 4, fill: { color: ph.color }, color: 'FFFFFF', bold: true, fontSize: 7.5, align: 'left', valign: 'middle', charSpacing: 1, h: 0.22 } }]);
  ph.agents.forEach(a => {
    rows.push([
      { text: [{ text: a[0] + '  ', options: { bold: true, color: ph.color } }, { text: a[1], options: { bold: true, color: NAVY } }],
        options: { fill: { color: CARD }, fontSize: 6.7, valign: 'middle', h: 0.245 } },
      { text: a[2], options: { fill: { color: CARD }, color: NAVY, fontSize: 6.7, valign: 'middle' } },
      { text: a[3], options: { fill: { color: CARD }, color: GRAY, fontSize: 6.7, bold: true, valign: 'middle' } },
      { text: a[4], options: { fill: { color: CARD }, color: NAVY, fontSize: 6.7, valign: 'middle' } },
    ]);
  });
});

s.addTable(rows, { x: MX, y: 0.86, w: 12.38, colW, border, fontFace: FONT, valign: 'middle', autoPage: false });

const out = 'C:\\Users\\Admin\\Downloads\\Zeople-RPO-Phases-OnePager.pptx';
pptx.writeFile({ fileName: out }).then(() => console.log('Wrote', out));
