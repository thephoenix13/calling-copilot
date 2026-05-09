/**
 * scripts/build-agent-map.js
 *
 * Generates dist/Zeople-Pipeline-Agent-Map.pptx — a single-slide map of
 * which AI agents (and which Claude model) get triggered at each of the
 * 7 pipeline steps. Same Zeople theme as the main overview deck.
 *
 * Run with:  node scripts/build-agent-map.js
 */

const PptxGenJS = require('pptxgenjs');
const path      = require('path');
const fs        = require('fs');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'zeople-logo.png');
const OUT  = path.join(ROOT, 'dist', 'Zeople-Pipeline-Agent-Map.pptx');
if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });

// ─── Theme ──────────────────────────────────────────────────────────────────
const C = {
  orange:   'F97316',
  navy:     '1A2B4A',
  bg:       'F1F5F9',
  card:     'FFFFFF',
  text1:    '1E293B',
  text2:    '64748B',
  text3:    '94A3B8',
  border:   'E2E8F0',
  emerald:  '059669',
  red:      'DC2626',
  amber:    'F59E0B',
  purple:   '7C3AED',
  blue:     '3B82F6',
  white:    'FFFFFF',
  muted:    'F8FAFC',
};
const FONT = 'Inter';

// Model → color mapping (used for agent pill borders)
const MODEL = {
  opus:   { color: C.purple,  label: 'Opus 4.6'   },
  sonnet: { color: C.orange,  label: 'Sonnet 4.6' },
  haiku:  { color: C.blue,    label: 'Haiku 4.5'  },
};

// ─── Pipeline data ──────────────────────────────────────────────────────────
const STEPS = [
  {
    n: 1, name: 'Select JD',
    note: 'Pick the job for this hiring drive',
    agents: [],
  },
  {
    n: 2, name: 'Enhance JD',
    note: 'Generate 5 ready-to-use sourcing assets',
    agents: [
      { name: 'JD Enhancer', model: 'sonnet',
        endpoint: 'POST /enhance-jd',
        produces: 'Formatted JD · Recruiter Brief · Clarification Qs · Reachout · Sourcing Keywords' },
    ],
  },
  {
    n: 3, name: 'Source Candidates',
    note: 'Add candidates from the database',
    agents: [
      { name: 'Resume Quality Evaluator', model: 'haiku',
        endpoint: 'POST /sessions/:id/candidates/:cid/evaluate',
        produces: 'Match score · strengths · verdict (auto-fires on add)' },
      { name: 'AI Content Detector', model: 'haiku',
        endpoint: 'POST /ai/check-ai-content',
        produces: 'Human / mixed / AI-generated verdict + confidence' },
    ],
  },
  {
    n: 4, name: 'Recruiter Screening',
    note: 'Pass / On Hold / Reject — optional live call',
    agents: [], // manual; live call agents listed in Step 6
  },
  {
    n: 5, name: 'Assessment Round',
    note: 'Branches into 3 evaluation tracks',
    branches: [
      { label: 'VIDEO INTERVIEW', agents: [
          { name: 'VI Question Generator', model: 'sonnet', endpoint: 'POST /vi/interviews/:id/generate' },
          { name: 'VI Evaluator',          model: 'sonnet', endpoint: 'POST /vi/candidates/:cid/evaluate',
            produces: 'Overall · 5 competencies · per-question scores' },
        ]},
      { label: 'MCQ ASSESSMENT', agents: [
          { name: 'MCQ Question Generator', model: 'sonnet', endpoint: 'POST /assessments/:id/ai-generate' },
          { name: 'MCQ Evaluator',          model: 'haiku',  endpoint: '(post-submit · async)',
            produces: 'Topic / difficulty breakdown · recommendation' },
        ]},
      { label: 'CODING ASSESSMENT', agents: [
          { name: 'Coding Question Generator', model: 'sonnet', endpoint: 'POST /coding-assessments/:id/ai-generate' },
          { name: 'Coding Evaluator',          model: 'haiku',  endpoint: '(post-submit · async)',
            produces: 'Per-question correctness + quality + feedback' },
        ]},
    ],
  },
  {
    n: 6, name: 'Decision',
    note: 'L1/L2/L3 · Proceed/Pool · Schedule interview',
    agents: [
      { name: 'Call QA + Candidate Report', model: 'opus',
        endpoint: 'POST /ai/generate-reports',
        produces: 'Recruiter QA scorecard + candidate hire/hold/no-hire (uses live call transcript)' },
    ],
  },
  {
    n: 7, name: 'Pipeline Tracker',
    note: 'Kanban board · inline interview scheduler',
    agents: [],
  },
];

// ─── Build deck ─────────────────────────────────────────────────────────────
const pptx = new PptxGenJS();
pptx.layout  = 'LAYOUT_WIDE';
pptx.title   = 'Zeople RecruiterOS — Pipeline Agent Map';
pptx.company = 'Zeople';
pptx.author  = 'Zeople';

const W = 13.333, H = 7.5;
const s = pptx.addSlide();
s.background = { color: C.bg };

// Top accent + sidebar
s.addShape(pptx.ShapeType.rect, { x: 0, y: 0,    w: W,    h: 0.08, fill: { color: C.orange } });
s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.08, w: 0.18, h: H - 0.08, fill: { color: C.navy } });

// Header band
s.addShape(pptx.ShapeType.rect, { x: 0.18, y: 0.08, w: W - 0.18, h: 0.95, fill: { color: C.card } });
s.addImage({ path: LOGO, x: 0.55, y: 0.18, w: 0.55, h: 0.55 });
s.addText('ZEOPLE', { x: 1.2, y: 0.18, w: 2.0, h: 0.30,
  fontFace: FONT, fontSize: 10, bold: true, color: C.orange, charSpacing: 4 });
s.addText('PIPELINE · AGENT INTERACTION MAP', { x: 1.2, y: 0.48, w: 6.0, h: 0.25,
  fontFace: FONT, fontSize: 9, color: C.text3, charSpacing: 2 });
s.addText('How the 7-step pipeline calls AI agents', { x: 0.55, y: 0.78, w: W - 1.1, h: 0.25,
  fontFace: FONT, fontSize: 13, color: C.text2 });

// ─── Layout constants ───────────────────────────────────────────────────────
const X_STEP    = 0.55;
const W_STEP    = 2.6;          // step badge column
const X_AGENTS  = X_STEP + W_STEP + 0.25;
const W_AGENTS  = W - X_AGENTS - 0.4;
const ROW_GAP   = 0.10;

// Per-step row heights
const ROW_H = { 1: 0.55, 2: 0.65, 3: 1.05, 4: 0.55, 5: 1.95, 6: 0.85, 7: 0.55 };

// ─── Helpers ────────────────────────────────────────────────────────────────
function drawStepBadge(x, y, w, h, n, name, note, hasAgents) {
  // Step block
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h,
    fill: { color: hasAgents ? C.navy : C.muted },
    line: { color: hasAgents ? C.navy : C.border, width: 0.5 },
    rectRadius: 0.06,
  });

  // Step number circle
  const cx = x + 0.18, cy = y + h / 2 - 0.21, cw = 0.42;
  s.addShape(pptx.ShapeType.ellipse, { x: cx, y: cy, w: cw, h: cw,
    fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
  s.addText(String(n), { x: cx, y: cy, w: cw, h: cw,
    fontFace: FONT, fontSize: 14, bold: true, color: C.white,
    align: 'center', valign: 'middle' });

  // Name + note
  s.addText(name, { x: x + 0.72, y: y + 0.10, w: w - 0.85, h: 0.32,
    fontFace: FONT, fontSize: 13, bold: true,
    color: hasAgents ? C.white : C.text2, valign: 'middle' });
  s.addText(note, { x: x + 0.72, y: y + 0.40, w: w - 0.85, h: h - 0.45,
    fontFace: FONT, fontSize: 9, color: hasAgents ? 'CBD5E1' : C.text3,
    valign: 'top' });
}

function drawAgentCard(x, y, w, h, agent) {
  const m = MODEL[agent.model];
  // Card body
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h,
    fill: { color: C.card },
    line: { color: C.border, width: 0.5 },
    rectRadius: 0.06,
  });
  // Left model strip
  s.addShape(pptx.ShapeType.rect, { x, y, w: 0.10, h, fill: { color: m.color } });

  // Agent name
  s.addText(agent.name, { x: x + 0.22, y: y + 0.05, w: w * 0.52, h: 0.26,
    fontFace: FONT, fontSize: 11, bold: true, color: C.text1, valign: 'middle' });
  // Model pill (right)
  const pillW = 1.15;
  s.addShape(pptx.ShapeType.roundRect, { x: x + w - pillW - 0.1, y: y + 0.07, w: pillW, h: 0.24,
    fill: { color: m.color }, line: { color: m.color, width: 0 }, rectRadius: 0.04 });
  s.addText(m.label, { x: x + w - pillW - 0.1, y: y + 0.07, w: pillW, h: 0.24,
    fontFace: FONT, fontSize: 8, bold: true, color: C.white, align: 'center', valign: 'middle', charSpacing: 2 });

  // Endpoint
  s.addText(agent.endpoint, { x: x + 0.22, y: y + 0.30, w: w - 0.4, h: 0.22,
    fontFace: 'Consolas', fontSize: 8.5, color: C.text3, valign: 'middle' });

  // Produces
  if (agent.produces) {
    s.addText(agent.produces, { x: x + 0.22, y: y + 0.50, w: w - 0.4, h: h - 0.55,
      fontFace: FONT, fontSize: 9, color: C.text2, valign: 'top', italic: true });
  }
}

function drawNoAgentBadge(x, y, w, h, text) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h,
    fill: { color: C.muted },
    line: { color: C.border, width: 0.5, dashType: 'dash' },
    rectRadius: 0.06,
  });
  s.addText(text, { x, y, w, h,
    fontFace: FONT, fontSize: 10, color: C.text3, italic: true,
    align: 'center', valign: 'middle' });
}

// ─── Render rows ────────────────────────────────────────────────────────────
let y = 1.18;
STEPS.forEach((step) => {
  const h = ROW_H[step.n];
  const hasAgents = (step.agents && step.agents.length > 0) || !!step.branches;
  drawStepBadge(X_STEP, y, W_STEP, h, step.n, step.name, step.note, hasAgents);

  // ── Right side: agents
  if (step.branches) {
    // Step 5: 3 sub-tracks
    const subRowH = 0.55;
    const subGap  = 0.07;
    step.branches.forEach((br, bi) => {
      const ySub = y + bi * (subRowH + subGap);
      // Track label (left)
      s.addText(br.label, { x: X_AGENTS, y: ySub, w: 1.55, h: subRowH,
        fontFace: FONT, fontSize: 9, bold: true, color: C.orange, charSpacing: 2,
        align: 'left', valign: 'middle' });
      // Two agent cards side by side
      const agentsX = X_AGENTS + 1.55;
      const agentsW = W_AGENTS - 1.55;
      const cardW = (agentsW - 0.15) / 2;
      br.agents.forEach((a, ai) => {
        drawAgentCard(agentsX + ai * (cardW + 0.15), ySub, cardW, subRowH, a);
      });
    });
  } else if (step.agents.length === 0) {
    drawNoAgentBadge(X_AGENTS, y, W_AGENTS, h, '— no AI agent · manual step —');
  } else {
    // 1+ agents stacked or side by side
    if (step.agents.length === 1) {
      drawAgentCard(X_AGENTS, y, W_AGENTS, h, step.agents[0]);
    } else {
      // 2 agents — side-by-side or stacked depending on row height
      const cardW = (W_AGENTS - 0.15) / step.agents.length;
      step.agents.forEach((a, i) => {
        drawAgentCard(X_AGENTS + i * (cardW + 0.15), y, cardW, h, a);
      });
    }
  }

  y += h + ROW_GAP;
});

// ─── Bottom legend ──────────────────────────────────────────────────────────
const LY = H - 0.55;
s.addShape(pptx.ShapeType.line, { x: 0.55, y: LY - 0.1, w: W - 1.1, h: 0,
  line: { color: C.border, width: 0.75 } });

s.addText('MODEL LEGEND', { x: 0.55, y: LY, w: 1.7, h: 0.3,
  fontFace: FONT, fontSize: 9, bold: true, color: C.text3, charSpacing: 2, valign: 'middle' });

let lx = 2.3;
const legendPill = (label, color) => {
  s.addShape(pptx.ShapeType.rect, { x: lx, y: LY + 0.08, w: 0.18, h: 0.18, fill: { color }, line: { color, width: 0 } });
  s.addText(label, { x: lx + 0.25, y: LY, w: 1.4, h: 0.3,
    fontFace: FONT, fontSize: 10, color: C.text2, valign: 'middle' });
  lx += 1.55;
};
legendPill('Claude Opus 4.6 · highest reasoning', C.purple);
legendPill('Claude Sonnet 4.6 · balanced', C.orange);
legendPill('Claude Haiku 4.5 · fast / async', C.blue);

// Right footer
s.addText('Total agents per full pipeline: 7–12 calls · branching depends on assessment type chosen',
  { x: 0.55, y: H - 0.28, w: W - 1.1, h: 0.22,
    fontFace: FONT, fontSize: 8.5, color: C.text3, italic: true, align: 'right' });

// ─── Write ──────────────────────────────────────────────────────────────────
pptx.writeFile({ fileName: OUT })
  .then((file) => console.log('✅ Wrote ' + file))
  .catch((err) => { console.error('❌ Failed:', err); process.exit(1); });
