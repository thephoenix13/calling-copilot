// Generate the Zeople RecruiterOS product-overview deck as a native .pptx.
// Usage: node scripts/generate-presentation-pptx.js
//
// All positioning is in inches against a 13.333 x 7.5 (16:9 widescreen) canvas.
// Brand palette mirrors client/src/App.css.

const path = require('path');
const pptxgen = require('pptxgenjs');

const C = {
  brand:      'E8335A',
  brandDeep:  'C71F45',
  brandSoft:  'FCE4EB',
  accent:     'F97316',
  accentDark: 'EA580C',
  accentSoft: 'FFEDDB',
  navy:       '1A2B4A',
  navyDeep:   '0F1E35',
  bg:         'F5F7FA',
  bgCard:     'FFFFFF',
  bgSoft:     'FAFBFD',
  border:     'E4E8EE',
  borderStr:  'CBD5E1',
  text1:      '0F172A',
  text2:      '475569',
  text3:      '94A3B8',
  invText:    'F1F5F9',
  green:      '16A34A',
  greenSoft:  'DCFCE7',
  red:        'DC2626',
  amber:      'F59E0B',
  amberSoft:  'FEF3C7',
};

const FONT = 'Calibri';
const LOGO = path.resolve(__dirname, '..', 'docs', 'product', 'zeople-logo.png');
const OUT  = path.resolve(__dirname, '..', 'docs', 'product', 'Zeople-Overview-Presentation.pptx');

const W = 13.333;
const H = 7.5;
const M = 0.6;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'Zeople RecruiterOS — Product Overview';
pres.author = 'Zeople';
pres.company = 'Zeople';

// ============================================================================
// Helpers
// ============================================================================
function themeColors(theme) {
  switch (theme) {
    case 'navy':
      return { bg: C.navyDeep, text: 'FFFFFF', mute: 'CBD5E1', sub: '94A3B8', wordmark: 'FFFFFF', label: '94A3B8', footer: '64748B' };
    case 'brand':
      return { bg: C.brand, text: 'FFFFFF', mute: 'F8E2E9', sub: 'F0CBD5', wordmark: 'FFFFFF', label: 'FFFFFF', footer: 'F5C2CD' };
    case 'orange':
      return { bg: C.accent, text: 'FFFFFF', mute: 'FFEDDB', sub: 'FFD9B3', wordmark: 'FFFFFF', label: 'FFFFFF', footer: 'FFD9B3' };
    default:
      return { bg: C.bg, text: C.text1, mute: C.text2, sub: C.text3, wordmark: C.text1, label: C.text2, footer: C.text3 };
  }
}

function newSlide(theme) {
  const t = themeColors(theme);
  const slide = pres.addSlide();
  slide.background = { color: t.bg };
  return { slide, t, theme };
}

function addBrandHeader(slide, sectionLabel, t) {
  // Logo
  slide.addImage({ path: LOGO, x: M, y: 0.32, w: 0.38, h: 0.38 });
  // Wordmark
  slide.addText(
    [
      { text: 'Zeople ',     options: { fontFace: FONT, fontSize: 12, bold: true, color: t.wordmark } },
      { text: 'RecruiterOS', options: { fontFace: FONT, fontSize: 12, bold: true, color: C.accent } },
    ],
    { x: M + 0.5, y: 0.36, w: 4, h: 0.4, valign: 'middle' }
  );
  // Section label
  slide.addText(sectionLabel.toUpperCase(), {
    x: W - M - 5, y: 0.36, w: 5, h: 0.4,
    fontFace: FONT, fontSize: 10, bold: true,
    color: t.label, charSpacing: 4,
    align: 'right', valign: 'middle',
  });
}

function addFooter(slide, num, t) {
  slide.addText('ZEOPLE  ·  PRODUCT OVERVIEW  ·  2026', {
    x: M, y: H - 0.45, w: 6, h: 0.3,
    fontFace: FONT, fontSize: 8, bold: true, charSpacing: 4,
    color: t.footer, valign: 'middle',
  });
  slide.addText(String(num).padStart(2, '0'), {
    x: W - M - 1, y: H - 0.45, w: 1, h: 0.3,
    fontFace: FONT, fontSize: 8, bold: true, charSpacing: 4,
    color: t.footer, align: 'right', valign: 'middle',
  });
}

// Pill-style eyebrow with backdrop + border. Auto-sizes width to text length unless `w` is overridden.
function addEyebrow(slide, text, x, y, opts = {}) {
  const variant = opts.variant || 'accent';
  const onDark = opts.dark || false;
  const fg = variant === 'brand' ? (onDark ? 'FF8FAA' : C.brand) : (onDark ? 'FFB47A' : C.accent);

  // On dark theme: subtle tinted backdrop + visible border in the highlight color
  // On light theme: soft tint backdrop + matching saturated border
  const bgColor = onDark
    ? (variant === 'brand' ? '3A1820' : '3A2410')
    : (variant === 'brand' ? C.brandSoft : C.accentSoft);
  const borderColor = onDark ? fg : (variant === 'brand' ? C.brand : C.accent);

  // Estimate pill width based on text length, with sensible cap.
  const estW = Math.min(text.length * 0.085 + 0.45, 5.5);
  const w = opts.w || estW;
  const h = 0.34;

  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.17,
    fill: { color: bgColor },
    line: { color: borderColor, width: 1 },
  });
  slide.addText(text.toUpperCase(), {
    x, y, w, h,
    fontFace: FONT, fontSize: 9, bold: true, charSpacing: 4,
    color: fg, align: 'center', valign: 'middle',
  });
}

function addCard(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.12,
    fill: { color: opts.fill || C.bgCard },
    line: { color: opts.borderColor || C.border, width: opts.borderWidth || 0.75 },
    shadow: opts.shadow ? { type: 'outer', blur: 18, offset: 4, color: '0F1E35', opacity: 0.10 } : undefined,
  });
  // Top stripe
  if (opts.topColor) {
    slide.addShape(pres.ShapeType.rect, {
      x, y, w, h: 0.07,
      fill: { color: opts.topColor },
      line: { type: 'none' },
    });
  }
}

function addPill(slide, text, x, y, w, opts = {}) {
  const fillMap = { accent: C.accentSoft, brand: C.brandSoft, green: C.greenSoft, amber: C.amberSoft, red: 'FEE2E2', navy: 'E2E8F0' };
  const fgMap   = { accent: C.accent,    brand: C.brand,     green: C.green,     amber: 'B45309',  red: C.red,    navy: C.navy };
  const variant = opts.variant || 'accent';
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h: 0.28,
    rectRadius: 0.14,
    fill: { color: fillMap[variant] },
    line: { type: 'none' },
  });
  slide.addText(text.toUpperCase(), {
    x, y, w, h: 0.28,
    fontFace: FONT, fontSize: 9, bold: true, charSpacing: 4,
    color: fgMap[variant],
    align: 'center', valign: 'middle',
  });
}

function addH2(slide, text, x, y, w, color, opts = {}) {
  slide.addText(text, {
    x, y, w, h: opts.h || 1.4,
    fontFace: FONT, fontSize: opts.fontSize || 38, bold: true,
    color, valign: 'top',
    paraSpaceBefore: 0, paraSpaceAfter: 0,
    charSpacing: -1,
  });
}

// ============================================================================
// SLIDE 1 — TITLE
// ============================================================================
{
  const { slide, t } = newSlide('navy');

  // Decorative radial gradient (faux): a large semi-transparent shape
  slide.addShape(pres.ShapeType.ellipse, {
    x: 9.5, y: 3.5, w: 6, h: 6,
    fill: { color: C.brand, transparency: 88 },
    line: { type: 'none' },
  });

  // Hero logo
  slide.addImage({ path: LOGO, x: 1.0, y: 1.7, w: 0.95, h: 0.95 });

  // Product name
  slide.addText(
    [
      { text: 'Zeople ',     options: { fontFace: FONT, fontSize: 80, bold: true, color: 'FFFFFF', charSpacing: -3 } },
      { text: 'RecruiterOS', options: { fontFace: FONT, fontSize: 80, bold: true, color: C.accent, charSpacing: -3 } },
    ],
    { x: 1.0, y: 2.9, w: 12, h: 1.6, valign: 'top' }
  );

  // Tagline
  slide.addText('The AI Co-Pilot for Recruiting Agencies', {
    x: 1.0, y: 4.5, w: 12, h: 0.6,
    fontFace: FONT, fontSize: 28, bold: false,
    color: C.accent, valign: 'top',
  });

  // Subtagline
  slide.addText("Protecting agency revenue from the first recruiter call to the candidate's first day on the job.", {
    x: 1.0, y: 5.15, w: 8.5, h: 1.3,
    fontFace: FONT, fontSize: 16,
    color: '94A3B8', valign: 'top',
  });

  addFooter(slide, 1, t);
}

// ============================================================================
// SLIDE 2 — BIG STAT
// ============================================================================
{
  const { slide, t } = newSlide('brand');
  addBrandHeader(slide, 'The Problem', t);

  // Big number
  slide.addText('30–50%', {
    x: M, y: 1.8, w: 12, h: 2.6,
    fontFace: FONT, fontSize: 200, bold: true,
    color: 'FFFFFF', valign: 'top', charSpacing: -10,
  });

  // Caption
  slide.addText('of accepted offers never become a Day-1 join.', {
    x: M, y: 4.55, w: 12, h: 0.8,
    fontFace: FONT, fontSize: 30, bold: true,
    color: 'FFFFFF', valign: 'top', charSpacing: -1,
  });

  // Subtext
  slide.addText(
    'Counter-offers. BGV failures. Multiple-offer juggling. Notice-period games. Ghosting. Every dropped offer is paid-for-zero work for the agency that earned it.',
    {
      x: M, y: 5.6, w: 11, h: 1.2,
      fontFace: FONT, fontSize: 14,
      color: 'FBE4EA', valign: 'top',
    }
  );

  addFooter(slide, 2, t);
}

// ============================================================================
// SLIDE 3 — REVENUE EQUATION + FUNNEL
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'The Revenue Equation', t);

  addEyebrow(slide, 'How agencies actually get paid', M, 1.1, { dark: true });
  addH2(slide, 'Agencies are paid on joins.\nNot on calls. Not on offers.', M, 1.55, 12, 'FFFFFF', { fontSize: 36, h: 1.8 });

  // Funnel
  const labels = ['Calls', 'Submission', 'Interview', 'Offer', 'Join'];
  const subs   = ['Sourcing &\nscreening', 'Resume sent\nto client', 'Client\nevaluation', 'Accepted by\ncandidate', 'The only\npaid step'];
  const steps  = ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Paid Step'];
  const startX = M;
  const totalW = W - 2 * M;
  const gap = 0.15;
  const boxW = (totalW - 4 * gap) / 5;
  const boxY = 3.9;
  const boxH = 1.7;

  for (let i = 0; i < 5; i++) {
    const x = startX + i * (boxW + gap);
    const isPaid = i === 4;
    slide.addShape(pres.ShapeType.roundRect, {
      x, y: isPaid ? boxY - 0.1 : boxY, w: boxW, h: isPaid ? boxH + 0.2 : boxH,
      rectRadius: 0.10,
      fill: { color: isPaid ? C.brand : 'FFFFFF', transparency: isPaid ? 0 : 92 },
      line: { color: isPaid ? C.brand : 'FFFFFF', width: 0.75, transparency: isPaid ? 0 : 80 },
    });
    slide.addText(steps[i].toUpperCase(), {
      x, y: (isPaid ? boxY - 0.1 : boxY) + 0.18, w: boxW, h: 0.3,
      fontFace: FONT, fontSize: 9, bold: true, charSpacing: 5,
      color: isPaid ? 'FFFFFF' : '94A3B8',
      align: 'center', valign: 'top',
    });
    slide.addText(labels[i], {
      x, y: (isPaid ? boxY - 0.1 : boxY) + 0.55, w: boxW, h: 0.55,
      fontFace: FONT, fontSize: 22, bold: true,
      color: 'FFFFFF',
      align: 'center', valign: 'top',
    });
    slide.addText(subs[i], {
      x, y: (isPaid ? boxY - 0.1 : boxY) + 1.15, w: boxW, h: 0.6,
      fontFace: FONT, fontSize: 11,
      color: isPaid ? 'FFD9D9' : '94A3B8',
      align: 'center', valign: 'top',
    });
  }

  slide.addText('Modern ATSes optimize for the steps to the left. Zeople optimizes for the only step the agency is paid for.', {
    x: M, y: 6.0, w: 12, h: 0.5,
    fontFace: FONT, fontSize: 13, italic: true,
    color: '94A3B8', align: 'center', valign: 'top',
  });

  addFooter(slide, 3, t);
}

// ============================================================================
// SLIDE 4 — TWO BREAKDOWNS
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'Two Breakdowns', t);

  addEyebrow(slide, 'Where agency revenue actually leaks', M, 1.1, { variant: 'brand' });
  addH2(slide, 'The funnel breaks on both ends —\nand no one has fixed either.', M, 1.55, 12, C.text1, { fontSize: 36, h: 1.6 });

  const cardY = 3.1;
  const cardH = 3.7;
  const cardW = 5.95;
  const gap = 0.25;
  const leftX = M;
  const rightX = M + cardW + gap;

  // LEFT CARD — Top of funnel
  addCard(slide, leftX, cardY, cardW, cardH, { topColor: C.brand, shadow: true });
  addPill(slide, 'Top of Funnel', leftX + 0.35, cardY + 0.28, 1.6, { variant: 'brand' });
  slide.addText("Recruiter calls don't scale.", {
    x: leftX + 0.35, y: cardY + 0.7, w: cardW - 0.7, h: 0.55,
    fontFace: FONT, fontSize: 22, bold: true,
    color: C.text1, valign: 'top', charSpacing: -0.5,
  });
  slide.addText(
    [
      { text: 'Every agency has 1–2 strong recruiters and 8–12 average ones.', options: { bullet: { code: '2022' } } },
      { text: 'Delivery heads listen to 5–10 calls a week out of thousands. Coaching is anecdotal.', options: { bullet: { code: '2022' } } },
      { text: 'AI-generated resumes have broken pre-call signals. The call is the only trustworthy signal.', options: { bullet: { code: '2022' } } },
      { text: 'New-recruiter ramp-up takes 60–90 days with no feedback loop.', options: { bullet: { code: '2022' } } },
    ],
    {
      x: leftX + 0.45, y: cardY + 1.35, w: cardW - 0.85, h: cardH - 1.5,
      fontFace: FONT, fontSize: 14,
      color: C.text1, valign: 'top',
      paraSpaceAfter: 8,
    }
  );

  // RIGHT CARD — Bottom of funnel
  addCard(slide, rightX, cardY, cardW, cardH, { topColor: C.accent, shadow: true });
  addPill(slide, 'Bottom of Funnel', rightX + 0.35, cardY + 0.28, 1.85, { variant: 'accent' });
  slide.addText('Accepted offers silently die.', {
    x: rightX + 0.35, y: cardY + 0.7, w: cardW - 0.7, h: 0.55,
    fontFace: FONT, fontSize: 22, bold: true,
    color: C.text1, valign: 'top', charSpacing: -0.5,
  });
  slide.addText(
    [
      { text: 'Counter-offers from current employers — 30–40% of accepts.', options: { bullet: { code: '2022' } } },
      { text: 'BGV failures — discrepancies in dates, education, criminal checks.', options: { bullet: { code: '2022' } } },
      { text: 'Multiple-offer juggling — candidates pick one closer to joining.', options: { bullet: { code: '2022' } } },
      { text: 'Notice-period erosion in 60–90 day markets.', options: { bullet: { code: '2022' } } },
      { text: 'Post-acceptance ghosting — silent right up to Day-1.', options: { bullet: { code: '2022' } } },
    ],
    {
      x: rightX + 0.45, y: cardY + 1.35, w: cardW - 0.85, h: cardH - 1.5,
      fontFace: FONT, fontSize: 14,
      color: C.text1, valign: 'top',
      paraSpaceAfter: 8,
    }
  );

  addFooter(slide, 4, t);
}

// ============================================================================
// SLIDE 5 — EXISTING TOOLS GAP
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'The Tool Gap', t);

  addEyebrow(slide, 'Why nobody fixes this', M, 1.1, { variant: 'brand' });
  addH2(slide, 'Existing tools were never built\nfor agency economics.', M, 1.55, 12, C.text1, { fontSize: 36, h: 1.6 });

  const rows = [
    [
      { text: 'Modern ATS', options: { bold: true, color: C.text1 } },
      { text: 'Greenhouse, Lever, Ashby', options: { color: C.text2 } },
      { text: 'Req management for in-house teams', options: { color: C.text2 } },
      { text: 'Not built for agencies; no call intelligence; no offer protection', options: { color: C.text1 } },
    ],
    [
      { text: 'Legacy Agency ATS', options: { bold: true, color: C.text1 } },
      { text: 'Bullhorn, Zoho Recruit, JobDiva', options: { color: C.text2 } },
      { text: 'Fee / submission data model', options: { color: C.text2 } },
      { text: 'No AI-native evaluation; no offer protection; dated UX', options: { color: C.text1 } },
    ],
    [
      { text: 'Call Intelligence', options: { bold: true, color: C.text1 } },
      { text: 'Metaview, Sybill, Gong', options: { color: C.text2 } },
      { text: 'Transcription, summaries', options: { color: C.text2 } },
      { text: 'Sales-origin; standalone; no candidate eval; no workflow', options: { color: C.text1 } },
    ],
    [
      { text: 'Engagement / Drip', options: { bold: true, color: C.text1 } },
      { text: 'Sense, GoodTime, generic CRM', options: { color: C.text2 } },
      { text: 'Email automation', options: { color: C.text2 } },
      { text: 'Generic; no risk scoring; no post-offer state model', options: { color: C.text1 } },
    ],
  ];

  slide.addTable(
    [
      [
        { text: 'CATEGORY',           options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 11, valign: 'middle' } },
        { text: 'EXAMPLES',           options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 11, valign: 'middle' } },
        { text: 'WHAT THEY DO WELL',  options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 11, valign: 'middle' } },
        { text: 'WHAT THEY MISS',     options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 11, valign: 'middle' } },
      ],
      ...rows.map((row, i) =>
        row.map((cell) => ({
          text: cell.text,
          options: { ...cell.options, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 11, valign: 'middle' },
        }))
      ),
    ],
    {
      x: M, y: 2.95, w: W - 2 * M,
      colW: [2.2, 2.6, 3.4, 3.93],
      rowH: 0.55,
      fontFace: FONT,
      border: { type: 'solid', color: C.border, pt: 0.5 },
      margin: 0.10,
    }
  );

  slide.addText(
    [
      { text: 'No product packages call intelligence and post-offer protection ', options: { color: C.text1, bold: true } },
      { text: 'inside the agency workflow.', options: { color: C.text2 } },
    ],
    {
      x: M, y: 6.25, w: 12, h: 0.5,
      fontFace: FONT, fontSize: 14,
      align: 'center', valign: 'top',
    }
  );

  addFooter(slide, 5, t);
}

// ============================================================================
// SLIDE 6 — WHY NOW
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'Why Now', t);

  addEyebrow(slide, 'Two AI breakthroughs in 18 months', M, 1.1, { dark: true });
  addH2(slide, 'For the first time, both breakdowns are\nsolvable in production.', M, 1.55, 12, 'FFFFFF', { fontSize: 36, h: 1.8 });

  const cardY = 3.5;
  const cardH = 2.3;
  const cardW = 5.95;
  const gap = 0.25;
  const leftX = M;
  const rightX = M + cardW + gap;

  // Card 1
  slide.addShape(pres.ShapeType.roundRect, {
    x: leftX, y: cardY, w: cardW, h: cardH,
    rectRadius: 0.14,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { color: 'FFFFFF', width: 0.75, transparency: 85 },
  });
  // Number circle
  slide.addShape(pres.ShapeType.ellipse, {
    x: leftX + 0.4, y: cardY + 0.4, w: 0.7, h: 0.7,
    fill: { color: C.accent },
    line: { type: 'none' },
  });
  slide.addText('1', {
    x: leftX + 0.4, y: cardY + 0.4, w: 0.7, h: 0.7,
    fontFace: FONT, fontSize: 22, bold: true,
    color: 'FFFFFF', align: 'center', valign: 'middle',
  });
  slide.addText('Real-time call evaluation is production-grade.', {
    x: leftX + 0.4, y: cardY + 1.2, w: cardW - 0.8, h: 0.5,
    fontFace: FONT, fontSize: 18, bold: true,
    color: 'FFFFFF', valign: 'top', charSpacing: -0.5,
  });
  slide.addText(
    'Modern LLMs can transcribe a call, surface in-call guidance, and produce a structured post-call evaluation — at a cost low enough to run on every single call, not just a sampled few.',
    {
      x: leftX + 0.4, y: cardY + 1.65, w: cardW - 0.8, h: 0.65,
      fontFace: FONT, fontSize: 12,
      color: 'CBD5E1', valign: 'top',
    }
  );

  // Card 2
  slide.addShape(pres.ShapeType.roundRect, {
    x: rightX, y: cardY, w: cardW, h: cardH,
    rectRadius: 0.14,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { color: 'FFFFFF', width: 0.75, transparency: 85 },
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: rightX + 0.4, y: cardY + 0.4, w: 0.7, h: 0.7,
    fill: { color: C.accent },
    line: { type: 'none' },
  });
  slide.addText('2', {
    x: rightX + 0.4, y: cardY + 0.4, w: 0.7, h: 0.7,
    fontFace: FONT, fontSize: 22, bold: true,
    color: 'FFFFFF', align: 'center', valign: 'middle',
  });
  slide.addText('Behavioral signal from candidate comms is reliable.', {
    x: rightX + 0.4, y: cardY + 1.2, w: cardW - 0.8, h: 0.5,
    fontFace: FONT, fontSize: 18, bold: true,
    color: 'FFFFFF', valign: 'top', charSpacing: -0.5,
  });
  slide.addText(
    "AI can read a candidate's response (or non-response) to a post-offer check-in, infer engagement or hesitation, and trigger interventions early enough to save the placement.",
    {
      x: rightX + 0.4, y: cardY + 1.65, w: cardW - 0.8, h: 0.65,
      fontFace: FONT, fontSize: 12,
      color: 'CBD5E1', valign: 'top',
    }
  );

  // Statement
  slide.addShape(pres.ShapeType.rect, {
    x: M, y: 6.15, w: 0.06, h: 0.7,
    fill: { color: C.accent }, line: { type: 'none' },
  });
  slide.addText(
    [
      { text: 'Neither was true 18 months ago. Both are true now. ', options: { color: 'FFFFFF' } },
      { text: 'Zeople is the first product ', options: { color: C.accent, bold: true } },
      { text: 'to package them into a single workflow for recruiting agencies.', options: { color: 'FFFFFF' } },
    ],
    {
      x: M + 0.2, y: 6.15, w: 12, h: 0.7,
      fontFace: FONT, fontSize: 14,
      valign: 'middle',
    }
  );

  addFooter(slide, 6, t);
}

// ============================================================================
// SLIDE 7 — THE TWO PILLARS (BOOKEND)
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'The Solution', t);

  addEyebrow(slide, 'The Zeople thesis', M, 1.1, { dark: true });
  addH2(slide, 'Two pillars wrap around the\nagency revenue equation.', M, 1.55, 12, 'FFFFFF', { fontSize: 34, h: 1.6 });

  const boxY = 3.55;
  const boxH = 2.6;
  const boxW = 5.2;
  const leftX = M + 0.3;
  const rightX = W - M - 0.3 - boxW;
  const arrowX = (leftX + boxW + rightX) / 2 - 0.4;

  // LEFT BOX
  slide.addShape(pres.ShapeType.roundRect, {
    x: leftX, y: boxY, w: boxW, h: boxH,
    rectRadius: 0.18,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { color: 'FFFFFF', width: 0.75, transparency: 80 },
  });
  // top stripe
  slide.addShape(pres.ShapeType.rect, {
    x: leftX, y: boxY, w: boxW, h: 0.10,
    fill: { color: C.brand }, line: { type: 'none' },
  });
  // PILLAR 1 pill
  const pillW = 1.3;
  addPill(slide, 'Pillar 1', leftX + (boxW - pillW) / 2, boxY + 0.27, pillW, { variant: 'brand' });
  slide.addText('Calling CoPilot', {
    x: leftX, y: boxY + 0.75, w: boxW, h: 0.7,
    fontFace: FONT, fontSize: 30, bold: true,
    color: 'FFFFFF', align: 'center', valign: 'top', charSpacing: -1,
  });
  slide.addText('Make more offers happen.', {
    x: leftX, y: boxY + 1.45, w: boxW, h: 0.4,
    fontFace: FONT, fontSize: 15,
    color: 'FFFFFF', align: 'center', valign: 'top',
  });
  slide.addText('Live AI on every call. Coaching at scale.\nEvery candidate evaluated.', {
    x: leftX + 0.3, y: boxY + 1.95, w: boxW - 0.6, h: 0.6,
    fontFace: FONT, fontSize: 12,
    color: '94A3B8', align: 'center', valign: 'top',
  });

  // RIGHT BOX
  slide.addShape(pres.ShapeType.roundRect, {
    x: rightX, y: boxY, w: boxW, h: boxH,
    rectRadius: 0.18,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { color: 'FFFFFF', width: 0.75, transparency: 80 },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: rightX, y: boxY, w: boxW, h: 0.10,
    fill: { color: C.accent }, line: { type: 'none' },
  });
  // PILLAR 2 pill
  addPill(slide, 'Pillar 2', rightX + (boxW - pillW) / 2, boxY + 0.27, pillW, { variant: 'accent' });
  slide.addText('Post-Offer Follow-Up', {
    x: rightX, y: boxY + 0.75, w: boxW, h: 0.7,
    fontFace: FONT, fontSize: 30, bold: true,
    color: 'FFFFFF', align: 'center', valign: 'top', charSpacing: -1,
  });
  slide.addText('Make sure offers convert to joins.', {
    x: rightX, y: boxY + 1.45, w: boxW, h: 0.4,
    fontFace: FONT, fontSize: 15,
    color: 'FFFFFF', align: 'center', valign: 'top',
  });
  slide.addText('Active engagement. Drop-risk scoring.\nIntervention before the loss.', {
    x: rightX + 0.3, y: boxY + 1.95, w: boxW - 0.6, h: 0.6,
    fontFace: FONT, fontSize: 12,
    color: '94A3B8', align: 'center', valign: 'top',
  });

  // ARROW
  slide.addShape(pres.ShapeType.rightArrow, {
    x: arrowX, y: boxY + 1.2, w: 0.8, h: 0.4,
    fill: { color: C.accent }, line: { type: 'none' },
  });

  // Statement
  slide.addShape(pres.ShapeType.rect, {
    x: M, y: 6.5, w: 0.06, h: 0.55,
    fill: { color: C.accent }, line: { type: 'none' },
  });
  slide.addText(
    [
      { text: 'Front end: ', options: { color: 'CBD5E1' } },
      { text: 'stronger candidates, better offers. ', options: { color: 'FFFFFF', bold: true } },
      { text: '·  Back end: ', options: { color: 'CBD5E1' } },
      { text: 'offers that become paid placements.', options: { color: 'FFFFFF', bold: true } },
    ],
    {
      x: M + 0.2, y: 6.5, w: 12, h: 0.55,
      fontFace: FONT, fontSize: 14,
      valign: 'middle',
    }
  );

  addFooter(slide, 7, t);
}

// ============================================================================
// SLIDE 8 — COPILOT CAPABILITIES (4 CARDS)
// ============================================================================
function fourCardSlide(opts) {
  const { slide, t } = newSlide(opts.theme || 'light');
  addBrandHeader(slide, opts.section, t);
  addEyebrow(slide, opts.eyebrow, M, 1.1, { variant: opts.eyebrowVariant || 'accent', dark: opts.theme === 'navy' });
  addH2(slide, opts.title, M, 1.55, 12, opts.theme === 'navy' ? 'FFFFFF' : C.text1, { fontSize: 36, h: 1.6 });

  const cardY = 3.2;
  const cardH = 2.8;
  const totalW = W - 2 * M;
  const gap = 0.18;
  const cardW = (totalW - 3 * gap) / 4;

  const iconBg   = opts.iconVariant === 'brand' ? C.brandSoft : C.accentSoft;
  const iconFg   = opts.iconVariant === 'brand' ? C.brand : C.accent;
  const topColor = opts.iconVariant === 'brand' ? C.brand : C.accent;

  for (let i = 0; i < 4; i++) {
    const x = M + i * (cardW + gap);
    addCard(slide, x, cardY, cardW, cardH, { topColor, shadow: true });
    // Number pill (landscape, matches IP slide style)
    slide.addShape(pres.ShapeType.roundRect, {
      x: x + 0.3, y: cardY + 0.35, w: 0.85, h: 0.38,
      rectRadius: 0.07,
      fill: { color: iconFg }, line: { type: 'none' },
    });
    slide.addText(String(i + 1).padStart(2, '0'), {
      x: x + 0.3, y: cardY + 0.35, w: 0.85, h: 0.38,
      fontFace: FONT, fontSize: 12, bold: true, charSpacing: 4,
      color: 'FFFFFF', align: 'center', valign: 'middle',
    });
    // Title
    slide.addText(opts.cards[i].title, {
      x: x + 0.3, y: cardY + 0.95, w: cardW - 0.6, h: 0.65,
      fontFace: FONT, fontSize: 16, bold: true,
      color: C.text1, valign: 'top', charSpacing: -0.5,
    });
    // Body
    slide.addText(opts.cards[i].body, {
      x: x + 0.3, y: cardY + 1.65, w: cardW - 0.6, h: 1.05,
      fontFace: FONT, fontSize: 11,
      color: C.text2, valign: 'top',
    });
  }

  if (opts.subtext) {
    slide.addText(opts.subtext, {
      x: M, y: 6.3, w: 12, h: 0.4,
      fontFace: FONT, fontSize: 13, italic: true,
      color: opts.theme === 'navy' ? '94A3B8' : C.text2,
      align: 'center', valign: 'top',
    });
  }

  addFooter(slide, opts.num, t);
}

fourCardSlide({
  theme: 'light',
  section: 'Pillar 1 · Calling CoPilot',
  eyebrow: 'Calling CoPilot',
  eyebrowVariant: 'brand',
  title: 'Live AI on every call —\nfrom dial-out to wrap-up.',
  iconVariant: 'brand',
  cards: [
    { title: 'Live Transcription', body: 'Dual-track audio via Deepgram. Recruiter and candidate on separate streams. Real-time display in the browser.' },
    { title: 'In-Call Guidance',   body: 'Claude monitors the transcript live and surfaces context-aware nudges — what to probe, red flags, skills not yet covered.' },
    { title: 'Post-Call Evaluation', body: 'Two structured reports per call — recruiter QA scorecard and candidate evaluation — generated automatically.' },
    { title: 'Auto-Demo Mode',     body: 'Fully simulated recruiter-candidate conversation with AI on both sides — for training, demos, and onboarding.' },
  ],
  subtext: 'Not optional. Not sampled. Every call gets the full treatment.',
  num: 8,
});

// ============================================================================
// SLIDE 9 — TWO REPORTS PER CALL
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'Pillar 1 · Two Reports Per Call', t);

  addEyebrow(slide, 'Every call · two artifacts', M, 1.1, { variant: 'brand' });
  addH2(slide, 'Recruiter and candidate,\nscored together.', M, 1.55, 12, C.text1, { fontSize: 36, h: 1.6 });

  const cardY = 3.15;
  const cardH = 3.65;
  const cardW = 5.95;
  const gap = 0.25;
  const leftX = M;
  const rightX = M + cardW + gap;

  // LEFT — Per-Call QA
  addCard(slide, leftX, cardY, cardW, cardH, { topColor: C.brand, shadow: true });
  addPill(slide, 'Recruiter-Facing', leftX + 0.35, cardY + 0.28, 1.85, { variant: 'brand' });
  slide.addText('Per-Call QA Report', {
    x: leftX + 0.35, y: cardY + 0.7, w: cardW - 0.7, h: 0.55,
    fontFace: FONT, fontSize: 22, bold: true,
    color: C.text1, valign: 'top', charSpacing: -0.5,
  });
  slide.addText('Scores the recruiter across five dimensions:', {
    x: leftX + 0.35, y: cardY + 1.25, w: cardW - 0.7, h: 0.35,
    fontFace: FONT, fontSize: 13,
    color: C.text2, valign: 'top',
  });
  slide.addText(
    [
      { text: 'Coverage — was every required area probed?',           options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Structure — was the call well-organized?',              options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Tone & empathy — did the candidate feel respected?',    options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Probing depth — surface answers vs. real signal?',      options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Closing — next steps clearly set?',                     options: { bullet: { code: '2022' }, color: C.text1 } },
    ],
    {
      x: leftX + 0.5, y: cardY + 1.65, w: cardW - 0.85, h: 1.65,
      fontFace: FONT, fontSize: 13,
      valign: 'top', paraSpaceAfter: 5,
    }
  );
  slide.addText('Color-coded · evidence-grounded · weakest dimension flagged · coaching nudges.', {
    x: leftX + 0.35, y: cardY + 3.25, w: cardW - 0.7, h: 0.3,
    fontFace: FONT, fontSize: 10, italic: true,
    color: C.text3, valign: 'top',
  });

  // RIGHT — Candidate Eval
  addCard(slide, rightX, cardY, cardW, cardH, { topColor: C.accent, shadow: true });
  addPill(slide, 'Candidate-Facing', rightX + 0.35, cardY + 0.28, 1.85, { variant: 'accent' });
  slide.addText('Candidate Evaluation Report', {
    x: rightX + 0.35, y: cardY + 0.7, w: cardW - 0.7, h: 0.55,
    fontFace: FONT, fontSize: 22, bold: true,
    color: C.text1, valign: 'top', charSpacing: -0.5,
  });
  slide.addText('Structured assessment of fit based on what was actually said:', {
    x: rightX + 0.35, y: cardY + 1.25, w: cardW - 0.7, h: 0.35,
    fontFace: FONT, fontSize: 13,
    color: C.text2, valign: 'top',
  });
  slide.addText(
    [
      { text: 'Skill match against required and preferred skills',  options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Experience alignment — depth, relevance, recency',   options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Motivation signals — genuine interest vs. fishing',  options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Red flags — inconsistencies, hesitation',            options: { bullet: { code: '2022' }, color: C.text1 } },
      { text: 'Submission verdict — proceed / hold / reject',       options: { bullet: { code: '2022' }, color: C.text1 } },
    ],
    {
      x: rightX + 0.5, y: cardY + 1.65, w: cardW - 0.85, h: 1.65,
      fontFace: FONT, fontSize: 13,
      valign: 'top', paraSpaceAfter: 5,
    }
  );
  slide.addText('Powers the pipeline decision · submission notes write themselves.', {
    x: rightX + 0.35, y: cardY + 3.25, w: cardW - 0.7, h: 0.3,
    fontFace: FONT, fontSize: 10, italic: true,
    color: C.text3, valign: 'top',
  });

  addFooter(slide, 9, t);
}

// ============================================================================
// SLIDE 10 — COACHING LOOP (BEFORE / AFTER)
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'Pillar 1 · Coaching at Scale', t);

  addEyebrow(slide, 'Recruiter QA', M, 1.1, { dark: true });
  addH2(slide, 'Coaching at scale,\nfor the first time.', M, 1.55, 12, 'FFFFFF', { fontSize: 36, h: 1.6 });

  const cardY = 3.1;
  const cardH = 2.9;
  const cardW = 5.95;
  const gap = 0.25;
  const leftX = M;
  const rightX = M + cardW + gap;

  // BEFORE
  slide.addShape(pres.ShapeType.roundRect, {
    x: leftX, y: cardY, w: cardW, h: cardH,
    rectRadius: 0.15,
    fill: { color: 'FFFFFF', transparency: 94 },
    line: { color: 'FFFFFF', width: 0.5, transparency: 85 },
  });
  slide.addText('BEFORE ZEOPLE', {
    x: leftX + 0.35, y: cardY + 0.3, w: cardW - 0.7, h: 0.4,
    fontFace: FONT, fontSize: 12, bold: true, charSpacing: 5,
    color: '94A3B8', valign: 'top',
  });
  slide.addText(
    [
      { text: 'Delivery head listens to 5–10 calls a week out of thousands.', options: { bullet: { code: '2022' }, color: 'E2E8F0' } },
      { text: 'Coaching is anecdotal — whoever happened to be overheard.',     options: { bullet: { code: '2022' }, color: 'E2E8F0' } },
      { text: 'New-recruiter ramp-up: 60–90 days.',                            options: { bullet: { code: '2022' }, color: 'E2E8F0' } },
      { text: 'No way to spot who needs help on which dimension.',             options: { bullet: { code: '2022' }, color: 'E2E8F0' } },
    ],
    {
      x: leftX + 0.5, y: cardY + 0.85, w: cardW - 0.85, h: cardH - 1.1,
      fontFace: FONT, fontSize: 14,
      valign: 'top', paraSpaceAfter: 10,
    }
  );

  // AFTER
  slide.addShape(pres.ShapeType.roundRect, {
    x: rightX, y: cardY, w: cardW, h: cardH,
    rectRadius: 0.15,
    fill: { color: C.accent, transparency: 82 },
    line: { color: C.accent, width: 0.75, transparency: 60 },
  });
  slide.addText('WITH ZEOPLE', {
    x: rightX + 0.35, y: cardY + 0.3, w: cardW - 0.7, h: 0.4,
    fontFace: FONT, fontSize: 12, bold: true, charSpacing: 5,
    color: 'FFB47A', valign: 'top',
  });
  slide.addText(
    [
      { text: 'Every call scored on the same five dimensions.',          options: { bullet: { code: '2022' }, color: 'FFFFFF' } },
      { text: "Team-wide view: who's strong where, who's weak where.",   options: { bullet: { code: '2022' }, color: 'FFFFFF' } },
      { text: 'KPI strip: avg score, "needs coaching" %, weak dimension.', options: { bullet: { code: '2022' }, color: 'FFFFFF' } },
      { text: 'Drill into any call — scorecard, transcript, nudges.',    options: { bullet: { code: '2022' }, color: 'FFFFFF' } },
    ],
    {
      x: rightX + 0.5, y: cardY + 0.85, w: cardW - 0.85, h: cardH - 1.1,
      fontFace: FONT, fontSize: 14,
      valign: 'top', paraSpaceAfter: 10,
    }
  );

  // Statement
  slide.addShape(pres.ShapeType.rect, {
    x: M, y: 6.3, w: 0.06, h: 0.7,
    fill: { color: C.accent }, line: { type: 'none' },
  });
  slide.addText(
    [
      { text: 'A delivery head can effectively oversee ', options: { color: 'FFFFFF' } },
      { text: '30 recruiters ', options: { color: C.accent, bold: true, fontSize: 22 } },
      { text: 'with the same effort previously spent on ', options: { color: 'FFFFFF' } },
      { text: '8.', options: { color: 'FFFFFF', bold: true } },
    ],
    {
      x: M + 0.2, y: 6.3, w: 12, h: 0.7,
      fontFace: FONT, fontSize: 16,
      valign: 'middle',
    }
  );

  addFooter(slide, 10, t);
}

// ============================================================================
// SLIDE 11 — POFU CAPABILITIES (4 CARDS)
// ============================================================================
fourCardSlide({
  theme: 'light',
  section: 'Pillar 2 · Post-Offer Follow-Up',
  eyebrow: 'Post-Offer Follow-Up',
  eyebrowVariant: 'accent',
  title: 'The risk window\nno ATS protects.',
  iconVariant: 'accent',
  cards: [
    { title: 'Automated Check-ins', body: 'Personalized emails at the right intervals — T+3 days, T+1 week, mid-notice, T-7 before joining.' },
    { title: 'State Tracking',      body: 'Captures progression: Resigned → BGV → Joining date → Joined. Missing milestones are signals.' },
    { title: 'AI Risk Scoring',     body: 'Continuously updated low/medium/high risk. Inferred from response latency, sentiment, delays.' },
    { title: 'Intervention Nudges', body: 'When risk crosses a threshold, the system surfaces the candidate with a recommended action.' },
  ],
  subtext: 'Background engine runs every 6 hours · fully autonomous in steady state.',
  num: 11,
});

// ============================================================================
// SLIDE 12 — POFU RISK WINDOW (TIMELINE)
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'Pillar 2 · The Risk Window', t);

  addEyebrow(slide, 'The post-offer journey', M, 1.1, { dark: true });
  addH2(slide, 'From accept to Day-1 —\nevery milestone is a risk peak.', M, 1.55, 12, 'FFFFFF', { fontSize: 34, h: 1.6 });

  // Timeline line
  const tlY = 3.7;
  slide.addShape(pres.ShapeType.rect, {
    x: M + 0.8, y: tlY, w: W - 2 * M - 1.6, h: 0.04,
    fill: { color: C.accent }, line: { type: 'none' },
  });

  // Nodes
  const steps = [
    { title: 'Offer Accepted', desc: 'T+0', kind: 'start' },
    { title: 'Resigned', desc: 'Counter-offer peak', kind: 'risk' },
    { title: 'BGV Verified', desc: 'Verification failures', kind: 'risk' },
    { title: 'Joining Confirmed', desc: 'Multi-offer juggling', kind: 'risk' },
    { title: 'Day-1 Join', desc: 'Paid placement', kind: 'end' },
  ];
  const totalW = W - 2 * M;
  const stepW = totalW / 5;
  for (let i = 0; i < 5; i++) {
    const cx = M + stepW * i + stepW / 2;
    const isRisk = steps[i].kind === 'risk';
    const isEnd = steps[i].kind === 'end';
    const nodeColor = isRisk ? C.brand : (isEnd ? C.accent : 'FFFFFF');
    // Halo for risk
    if (isRisk || isEnd) {
      slide.addShape(pres.ShapeType.ellipse, {
        x: cx - 0.32, y: tlY - 0.28, w: 0.64, h: 0.64,
        fill: { color: nodeColor, transparency: 75 },
        line: { type: 'none' },
      });
    }
    // Dot
    slide.addShape(pres.ShapeType.ellipse, {
      x: cx - 0.16, y: tlY - 0.12, w: 0.32, h: 0.32,
      fill: { color: nodeColor },
      line: { color: nodeColor, width: 0.5 },
    });

    slide.addText(steps[i].title, {
      x: cx - stepW / 2 + 0.1, y: tlY + 0.4, w: stepW - 0.2, h: 0.4,
      fontFace: FONT, fontSize: 14, bold: true,
      color: 'FFFFFF', align: 'center', valign: 'top',
    });
    slide.addText(steps[i].desc, {
      x: cx - stepW / 2 + 0.1, y: tlY + 0.8, w: stepW - 0.2, h: 0.35,
      fontFace: FONT, fontSize: 11,
      color: '94A3B8', align: 'center', valign: 'top',
    });
  }

  // Cards below — shrunk + raised to leave breathing room above the footer.
  const cardY = 5.25;
  const cardH = 1.4;
  const cardW = 5.95;
  const gap = 0.25;

  slide.addShape(pres.ShapeType.roundRect, {
    x: M, y: cardY, w: cardW, h: cardH,
    rectRadius: 0.12,
    fill: { color: 'FFFFFF', transparency: 94 },
    line: { color: 'FFFFFF', width: 0.5, transparency: 85 },
  });
  slide.addText('WHAT POFU MOVES', {
    x: M + 0.3, y: cardY + 0.15, w: cardW - 0.6, h: 0.28,
    fontFace: FONT, fontSize: 11, bold: true, charSpacing: 5,
    color: 'FFB47A', valign: 'top',
  });
  slide.addText(
    [
      { text: 'Offer-to-join conversion ', options: { bullet: { code: '2022' }, color: 'FFFFFF', bold: true } },
      { text: '— target: +10 percentage points', options: { color: 'CBD5E1' } },
    ],
    { x: M + 0.4, y: cardY + 0.48, w: cardW - 0.6, h: 0.3, fontFace: FONT, fontSize: 12 }
  );
  slide.addText(
    [
      { text: 'Time-to-detect risk ', options: { bullet: { code: '2022' }, color: 'FFFFFF', bold: true } },
      { text: '— flagged at week 2, not Day-1', options: { color: 'CBD5E1' } },
    ],
    { x: M + 0.4, y: cardY + 0.78, w: cardW - 0.6, h: 0.3, fontFace: FONT, fontSize: 12 }
  );
  slide.addText(
    [
      { text: 'Revenue per offer ', options: { bullet: { code: '2022' }, color: 'FFFFFF', bold: true } },
      { text: '— same offers, more paid placements', options: { color: 'CBD5E1' } },
    ],
    { x: M + 0.4, y: cardY + 1.08, w: cardW - 0.6, h: 0.3, fontFace: FONT, fontSize: 12 }
  );

  const rightX = M + cardW + gap;
  slide.addShape(pres.ShapeType.roundRect, {
    x: rightX, y: cardY, w: cardW, h: cardH,
    rectRadius: 0.12,
    fill: { color: 'FFFFFF', transparency: 94 },
    line: { color: 'FFFFFF', width: 0.5, transparency: 85 },
  });
  slide.addText("WHY IT'S DEFENSIBLE", {
    x: rightX + 0.3, y: cardY + 0.15, w: cardW - 0.6, h: 0.28,
    fontFace: FONT, fontSize: 11, bold: true, charSpacing: 5,
    color: 'FFB47A', valign: 'top',
  });
  slide.addText(
    [
      { text: 'Proprietary outcome data sharpens the risk model over time.', options: { bullet: { code: '2022' }, color: 'E2E8F0' } },
      { text: 'Workflow-aware — understands resign / BGV / joining states.',  options: { bullet: { code: '2022' }, color: 'E2E8F0' } },
      { text: 'The only module that directly affects what agencies are paid for.', options: { bullet: { code: '2022' }, color: 'E2E8F0' } },
    ],
    {
      x: rightX + 0.4, y: cardY + 0.48, w: cardW - 0.6, h: 0.85,
      fontFace: FONT, fontSize: 12,
      valign: 'top', paraSpaceAfter: 3,
    }
  );

  addFooter(slide, 12, t);
}

// ============================================================================
// SLIDE 13 — WHY BOTH WIN TOGETHER
// ============================================================================
{
  const { slide, t } = newSlide('orange');
  addBrandHeader(slide, 'The Combination', t);

  slide.addText(
    [
      { text: 'CoPilot and POFU are the\n', options: { color: 'FFFFFF' } },
      { text: 'bookends', options: { color: C.navyDeep, highlight: 'FFFFFF' } },
      { text: ' of agency revenue.', options: { color: 'FFFFFF' } },
    ],
    {
      x: M, y: 1.4, w: 12, h: 1.8,
      fontFace: FONT, fontSize: 38, bold: true,
      valign: 'top', charSpacing: -1,
    }
  );

  slide.addTable(
    [
      [
        { text: 'STAGE OF REVENUE CYCLE', options: { bold: true, color: 'FFFFFF', fill: { color: '0F1E35' }, fontSize: 11, valign: 'middle' } },
        { text: 'MODULE',                  options: { bold: true, color: 'FFFFFF', fill: { color: '0F1E35' }, fontSize: 11, valign: 'middle' } },
        { text: 'WHAT IT PROTECTS',        options: { bold: true, color: 'FFFFFF', fill: { color: '0F1E35' }, fontSize: 11, valign: 'middle' } },
      ],
      [
        { text: 'Recruiter call → submission', options: { color: 'FFFFFF', fill: { color: 'FFFFFF', transparency: 88 }, fontSize: 14, valign: 'middle' } },
        { text: 'CoPilot',                      options: { color: 'FFFFFF', bold: true, fill: { color: 'FFFFFF', transparency: 88 }, fontSize: 14, valign: 'middle' } },
        { text: 'Submission quality, candidate fit signal', options: { color: 'FFFFFF', fill: { color: 'FFFFFF', transparency: 88 }, fontSize: 14, valign: 'middle' } },
      ],
      [
        { text: 'Submission → offer', options: { color: 'FFFFFF', fill: { color: 'FFFFFF', transparency: 82 }, fontSize: 14, valign: 'middle' } },
        { text: 'Workflow + CoPilot',  options: { color: 'FFFFFF', bold: true, fill: { color: 'FFFFFF', transparency: 82 }, fontSize: 14, valign: 'middle' } },
        { text: 'Decision quality',    options: { color: 'FFFFFF', fill: { color: 'FFFFFF', transparency: 82 }, fontSize: 14, valign: 'middle' } },
      ],
      [
        { text: 'Offer → Day-1 join', options: { color: 'FFFFFF', fill: { color: 'FFFFFF', transparency: 88 }, fontSize: 14, valign: 'middle' } },
        { text: 'POFU',                options: { color: 'FFFFFF', bold: true, fill: { color: 'FFFFFF', transparency: 88 }, fontSize: 14, valign: 'middle' } },
        { text: 'The placement fee itself', options: { color: 'FFFFFF', fill: { color: 'FFFFFF', transparency: 88 }, fontSize: 14, valign: 'middle' } },
      ],
    ],
    {
      x: M, y: 3.6, w: W - 2 * M,
      colW: [4.5, 3.0, 4.633],
      rowH: 0.6,
      fontFace: FONT,
      border: { type: 'solid', color: 'FFFFFF', pt: 0.5 },
      margin: 0.12,
    }
  );

  slide.addText(
    [
      { text: 'In isolation, each pillar has competitors. ', options: { color: 'FFFFFF' } },
      { text: 'Together — packaged for the agency workflow on shared infrastructure — nothing else exists.', options: { color: 'FFFFFF', bold: true } },
    ],
    {
      x: M, y: 6.3, w: 12, h: 0.6,
      fontFace: FONT, fontSize: 14,
      valign: 'top',
    }
  );

  addFooter(slide, 13, t);
}

// ============================================================================
// SLIDE 14 — THE SUPPORTING SYSTEM (LAYER STACK)
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'The Supporting System', t);

  addEyebrow(slide, 'Around the two pillars', M, 1.1);
  addH2(slide, 'A full agency workflow —\nbuilt so the pillars actually work.', M, 1.55, 12, C.text1, { fontSize: 34, h: 1.5 });

  const rows = [
    { tag: 'PILLAR 1', name: 'Calling CoPilot', desc: 'Live transcription · in-call guidance · post-call evaluation · Recruiter QA', pillar: 'brand' },
    { name: 'Workflow Spine — Pipeline Sessions', desc: '7-step pipeline: Select JD → Enhance → Source → Screen → Assess → Decide → Track' },
    { name: 'Funnel Modules', desc: 'Jobs · JD Enhancer · Candidate Database · Hiring Manager Portal' },
    { name: 'Filter Modules', desc: 'Video Interviews · MCQ Assessments · Coding Assessments — AI-evaluated' },
    { name: 'Measurement', desc: 'Reports & Analytics — 8 tabs · KPI strip · drill-down to candidate' },
    { name: 'Intelligence', desc: 'Market Intelligence — 4-stage Claude research · salary, demand, competitor activity' },
    { tag: 'PILLAR 2', name: 'Post-Offer Follow-Up', desc: 'Automated check-ins · state tracking · AI risk scoring · intervention nudges', pillar: 'accent' },
    { name: 'Platform', desc: 'Dashboard · Activity Feed · Settings · 6-role permissions · company isolation' },
  ];

  // Variable-height layers; track running y so pillars don't collide with their neighbours.
  const baseH = 0.4;
  const pillarH = 0.52;
  const gap = 0.06;
  let cy = 3.1;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isPillar = !!r.pillar;
    const h = isPillar ? pillarH : baseH;
    const y = cy;
    const stripeColor = r.pillar === 'brand' ? C.brand : r.pillar === 'accent' ? C.accent : C.borderStr;

    // Background
    slide.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: W - 2 * M, h,
      rectRadius: 0.06,
      fill: { color: 'FFFFFF' },
      line: { color: C.border, width: 0.5 },
      shadow: isPillar ? { type: 'outer', blur: 12, offset: 2, color: '0F1E53', opacity: 0.08 } : undefined,
    });
    // Left stripe
    slide.addShape(pres.ShapeType.rect, {
      x: M, y, w: 0.08, h,
      fill: { color: stripeColor }, line: { type: 'none' },
    });

    if (isPillar) {
      // Pillar tag
      slide.addShape(pres.ShapeType.roundRect, {
        x: M + 0.25, y: y + (h - 0.28) / 2, w: 0.85, h: 0.28,
        rectRadius: 0.14,
        fill: { color: stripeColor }, line: { type: 'none' },
      });
      slide.addText(r.tag, {
        x: M + 0.25, y: y + (h - 0.28) / 2, w: 0.85, h: 0.28,
        fontFace: FONT, fontSize: 9, bold: true, charSpacing: 4,
        color: 'FFFFFF', align: 'center', valign: 'middle',
      });
      slide.addText(r.name, {
        x: M + 1.2, y, w: 4.5, h,
        fontFace: FONT, fontSize: 14, bold: true,
        color: C.text1, valign: 'middle',
      });
      slide.addText(r.desc, {
        x: M + 5.7, y, w: W - 2 * M - 5.8, h,
        fontFace: FONT, fontSize: 10.5,
        color: C.text2, valign: 'middle', align: 'right',
      });
    } else {
      slide.addText(r.name, {
        x: M + 0.25, y, w: 5.5, h,
        fontFace: FONT, fontSize: 12, bold: true,
        color: C.text1, valign: 'middle',
      });
      slide.addText(r.desc, {
        x: M + 5.8, y, w: W - 2 * M - 5.9, h,
        fontFace: FONT, fontSize: 10,
        color: C.text2, valign: 'middle', align: 'right',
      });
    }

    cy += h + gap;
  }

  addFooter(slide, 14, t);
}

// ============================================================================
// SLIDE 15 — WHO IT'S FOR
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, "Who It's For", t);

  addEyebrow(slide, 'Target market', M, 1.1);
  addH2(slide, 'Recruiting agencies and\nstaffing firms — globally.', M, 1.55, 12, C.text1, { fontSize: 36, h: 1.55 });

  const tiers = [
    { tier: 'Boutique / Independent', desc: '5–100 person firms · vertical or geo-focused · tens of thousands globally',           ex: 'IT staffing, fintech recruiters, healthcare boutiques', fit: 'PRIMARY WEDGE',   fitColor: 'green' },
    { tier: 'Mid-Market Staffing',    desc: '$50M – $1B revenue · regional or vertical specialists',                                 ex: 'Insight Global, Page Group, Aerotek, Quess, Teamlease', fit: 'EXPAND TARGET',  fitColor: 'accent' },
    { tier: 'Enterprise Staffing',    desc: 'Multi-billion-dollar global firms · SOC2/ISO required · multi-year cycles',             ex: 'Randstad, Adecco, ManpowerGroup, Allegis, Hays',        fit: 'ASPIRATIONAL',   fitColor: 'brand' },
    { tier: 'Executive Search',       desc: 'C-suite / board · low call volume · relationship-driven',                                ex: 'Korn Ferry, Spencer Stuart, Heidrick & Struggles',      fit: 'NOT A FIT',      fitColor: 'red' },
  ];

  slide.addTable(
    [
      [
        { text: 'TIER',        options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 3, valign: 'middle' } },
        { text: 'DESCRIPTION', options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 3, valign: 'middle' } },
        { text: 'EXAMPLES',    options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 3, valign: 'middle' } },
        { text: 'FIT',         options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 3, align: 'center', valign: 'middle' } },
      ],
      ...tiers.map((t2, i) => [
        { text: t2.tier, options: { bold: true,  color: C.text1, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 11, valign: 'middle' } },
        { text: t2.desc, options: { color: C.text2, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 10, valign: 'middle' } },
        { text: t2.ex,   options: { color: C.text2, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 10, valign: 'middle' } },
        { text: t2.fit, options: { bold: true, charSpacing: 3, color: t2.fitColor === 'green' ? C.green : t2.fitColor === 'accent' ? C.accent : t2.fitColor === 'brand' ? C.brand : C.red, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 10, align: 'center', valign: 'middle' } },
      ]),
    ],
    {
      x: M, y: 2.9, w: W - 2 * M,
      colW: [2.7, 4.2, 3.6, 1.633],
      rowH: 0.55,
      fontFace: FONT,
      border: { type: 'solid', color: C.border, pt: 0.5 },
      margin: 0.10,
    }
  );

  slide.addText(
    [
      { text: 'Buyer: ', options: { bold: true, color: C.text1 } },
      { text: 'agency owner / MD   ·   ', options: { color: C.text2 } },
      { text: 'Champion: ', options: { bold: true, color: C.text1 } },
      { text: 'head of delivery   ·   ', options: { color: C.text2 } },
      { text: 'Users: ', options: { bold: true, color: C.text1 } },
      { text: 'recruiters, HR ops   ·   ', options: { color: C.text2 } },
      { text: 'External: ', options: { bold: true, color: C.text1 } },
      { text: 'hiring managers', options: { color: C.text2 } },
    ],
    {
      x: M, y: 6.5, w: 12, h: 0.4,
      fontFace: FONT, fontSize: 12,
      align: 'center', valign: 'middle',
    }
  );

  addFooter(slide, 15, t);
}

// ============================================================================
// SLIDE 16 — COMPETITIVE LANDSCAPE
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'Competitive Landscape', t);

  addEyebrow(slide, 'Where Zeople wins', M, 1.1, { variant: 'brand' });
  addH2(slide, 'An under-served intersection.', M, 1.45, 12, C.text1, { fontSize: 32, h: 0.7 });

  // Vendor-names subline (lets us use single-line headers)
  slide.addText(
    [
      { text: 'Modern ATS ',        options: { bold: true, color: C.text1 } },
      { text: '= Greenhouse, Lever, Ashby   ·   ', options: { color: C.text2 } },
      { text: 'Legacy Agency ATS ', options: { bold: true, color: C.text1 } },
      { text: '= Bullhorn, Zoho, JobDiva   ·   ', options: { color: C.text2 } },
      { text: 'Call Intel ',        options: { bold: true, color: C.text1 } },
      { text: '= Metaview, Sybill, Gong', options: { color: C.text2 } },
    ],
    {
      x: M, y: 2.3, w: 12, h: 0.32,
      fontFace: FONT, fontSize: 10,
      valign: 'middle',
    }
  );

  const caps = [
    'Agency-aware data model (fees, submissions)',
    'AI call evaluation — recruiting-specific',
    'Per-call QA scorecards + coaching nudges',
    'AI candidate evaluation from call',
    'Post-offer state tracking',
    'AI drop-risk scoring + intervention',
    'AI content check on resumes',
    'Market intelligence per role / geography',
    'Integrated workflow (one product, not many)',
  ];
  const cols = [
    ['—', '✓', '—', '—', '—', '—', '—', '—', '✓'],
    ['—', '—', '—', '—', '—', '—', '—', '—', '✓'],
    ['—', '~', '~', '—', '—', '—', '—', '—', '—'],
    ['✓', '✓', '✓', '✓', '✓', '✓', '✓', '✓', '✓'],
  ];

  function symbColor(s) {
    return s === '✓' ? C.green : s === '~' ? C.amber : C.text3;
  }

  const header = [
    { text: 'CAPABILITY',        options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 2, valign: 'middle' } },
    { text: 'MODERN ATS',        options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 2, align: 'center', valign: 'middle' } },
    { text: 'LEGACY ATS',        options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 2, align: 'center', valign: 'middle' } },
    { text: 'CALL INTEL',        options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, charSpacing: 2, align: 'center', valign: 'middle' } },
    { text: 'ZEOPLE',            options: { bold: true, color: 'FFFFFF', fill: { color: C.brand }, fontSize: 12, charSpacing: 3, align: 'center', valign: 'middle' } },
  ];

  const body = caps.map((cap, i) => [
    { text: cap,        options: { color: C.text1, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 10, valign: 'middle' } },
    { text: cols[0][i], options: { color: symbColor(cols[0][i]), bold: true, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 14, align: 'center', valign: 'middle' } },
    { text: cols[1][i], options: { color: symbColor(cols[1][i]), bold: true, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 14, align: 'center', valign: 'middle' } },
    { text: cols[2][i], options: { color: symbColor(cols[2][i]), bold: true, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 14, align: 'center', valign: 'middle' } },
    { text: cols[3][i], options: { color: symbColor(cols[3][i]), bold: true, fill: { color: i % 2 === 0 ? C.brandSoft : 'FBE4EA' }, fontSize: 14, align: 'center', valign: 'middle' } },
  ]);

  slide.addTable(
    [header, ...body],
    {
      x: M, y: 2.75, w: W - 2 * M,
      colW: [5.4, 1.7, 1.7, 1.4, 1.933],
      rowH: 0.36,
      fontFace: FONT,
      border: { type: 'solid', color: C.border, pt: 0.5 },
      margin: 0.08,
    }
  );

  slide.addText(
    [
      { text: '✓', options: { color: C.green, bold: true, fontSize: 13 } },
      { text: ' native   ·   ', options: { color: C.text3 } },
      { text: '~', options: { color: C.amber, bold: true, fontSize: 13 } },
      { text: ' partial / via integrations   ·   ', options: { color: C.text3 } },
      { text: '—', options: { color: C.text3, bold: true, fontSize: 13 } },
      { text: ' not offered', options: { color: C.text3 } },
    ],
    {
      x: M, y: 6.7, w: 12, h: 0.3,
      fontFace: FONT, fontSize: 10,
      align: 'center', valign: 'middle',
    }
  );

  addFooter(slide, 16, t);
}

// ============================================================================
// SLIDE 17 — INTELLECTUAL PROPERTY
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'Intellectual Property', t);

  addEyebrow(slide, 'Provisional Patent · LRM™ Technology', M, 1.1, { dark: true, w: 5.5 });
  addH2(slide, 'A proprietary moat —\nthe Large Recruitment Model (LRM™).', M, 1.55, 12, 'FFFFFF', { fontSize: 32, h: 1.3 });

  slide.addText(
    'Zeople is in the provisional patent stage for the AI-Augmented Human Recruitment Intelligence System that powers our Calling CoPilot — a system where AI collaborates with human recruiters in real time, generating intelligence about both the candidate and the recruiter from every screening conversation.',
    {
      x: M, y: 2.95, w: 12, h: 0.85,
      fontFace: FONT, fontSize: 13,
      color: 'CBD5E1', valign: 'top',
    }
  );

  // Four claim cards
  const cardY = 3.95;
  const cardH = 2.05;
  const totalW = W - 2 * M;
  const gap = 0.18;
  const cardW = (totalW - 3 * gap) / 4;

  const claims = [
    {
      num: '01',
      title: 'Real-Time AI-Guided\nHUMAN Screening',
      body: 'The recruiter stays the primary human interface. AI augments — never replaces — the conversation.',
    },
    {
      num: '02',
      title: 'Large Recruitment\nModel (LRM™)',
      body: 'Domain-specific model purpose-built for job roles, candidate profiles, conversations, and recruiter behavior.',
    },
    {
      num: '03',
      title: 'Dual Intelligence —\nCandidate + Recruiter',
      body: 'A single conversation produces structured intelligence about both the candidate and the recruiter simultaneously.',
    },
    {
      num: '04',
      title: 'Continuous Recruiter\nCoaching Loop',
      body: 'Every call feeds recruiter performance analysis — questioning, communication, engagement — driving data-grounded coaching.',
    },
  ];

  for (let i = 0; i < 4; i++) {
    const x = M + i * (cardW + gap);

    // Card background
    slide.addShape(pres.ShapeType.roundRect, {
      x, y: cardY, w: cardW, h: cardH,
      rectRadius: 0.14,
      fill: { color: 'FFFFFF', transparency: 92 },
      line: { color: 'FFFFFF', width: 0.75, transparency: 80 },
    });

    // Number badge
    slide.addShape(pres.ShapeType.roundRect, {
      x: x + 0.3, y: cardY + 0.3, w: 0.7, h: 0.35,
      rectRadius: 0.06,
      fill: { color: C.accent }, line: { type: 'none' },
    });
    slide.addText(claims[i].num, {
      x: x + 0.3, y: cardY + 0.3, w: 0.7, h: 0.35,
      fontFace: FONT, fontSize: 11, bold: true, charSpacing: 4,
      color: 'FFFFFF', align: 'center', valign: 'middle',
    });

    // Title
    slide.addText(claims[i].title, {
      x: x + 0.3, y: cardY + 0.78, w: cardW - 0.6, h: 0.7,
      fontFace: FONT, fontSize: 14, bold: true,
      color: 'FFFFFF', valign: 'top', charSpacing: -0.3,
    });

    // Body
    slide.addText(claims[i].body, {
      x: x + 0.3, y: cardY + 1.45, w: cardW - 0.6, h: 0.55,
      fontFace: FONT, fontSize: 10.5,
      color: 'CBD5E1', valign: 'top',
    });
  }

  // Metadata strip
  slide.addShape(pres.ShapeType.roundRect, {
    x: M, y: 6.1, w: W - 2 * M, h: 0.5,
    rectRadius: 0.06,
    fill: { color: 'FFFFFF', transparency: 95 },
    line: { color: 'FFFFFF', width: 0.5, transparency: 85 },
  });
  slide.addText(
    [
      { text: 'ASSIGNEE:  ', options: { bold: true, color: 'FFB47A', charSpacing: 3, fontSize: 9 } },
      { text: 'Zeople Corp.    ', options: { color: 'FFFFFF', fontSize: 11 } },
      { text: 'INVENTORS:  ', options: { bold: true, color: 'FFB47A', charSpacing: 3, fontSize: 9 } },
      { text: 'Anuraag Gupta  ·  Divakar Vadlamani  ·  Minnakshi Sharma    ', options: { color: 'FFFFFF', fontSize: 11 } },
      { text: 'STATUS:  ', options: { bold: true, color: 'FFB47A', charSpacing: 3, fontSize: 9 } },
      { text: 'Provisional Patent Application', options: { color: 'FFFFFF', bold: true, fontSize: 11 } },
    ],
    {
      x: M + 0.3, y: 6.1, w: W - 2 * M - 0.6, h: 0.5,
      fontFace: FONT, fontSize: 11,
      valign: 'middle',
    }
  );

  // Forward-looking
  slide.addText(
    'Additional provisional filings planned: POFU drop-risk scoring methodology  ·  Market Intelligence research pipeline.',
    {
      x: M, y: 6.65, w: W - 2 * M, h: 0.3,
      fontFace: FONT, fontSize: 10, italic: true,
      color: '94A3B8', align: 'center', valign: 'middle',
    }
  );

  addFooter(slide, 17, t);
}

// ============================================================================
// SLIDE 18 — NORTH STAR + KPI TREE
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'How We Measure Success', t);

  addEyebrow(slide, 'The North Star', M, 1.1, { dark: true });
  addH2(slide, 'One metric the entire\nproduct is designed to move.', M, 1.55, 12, 'FFFFFF', { fontSize: 34, h: 1.5 });

  // North Star Card
  slide.addShape(pres.ShapeType.roundRect, {
    x: M, y: 3.1, w: W - 2 * M, h: 1.2,
    rectRadius: 0.18,
    fill: { color: C.brand },
    line: { type: 'none' },
    shadow: { type: 'outer', blur: 30, offset: 6, color: C.brandDeep, opacity: 0.5 },
  });
  slide.addText('NORTH STAR METRIC', {
    x: M, y: 3.25, w: W - 2 * M, h: 0.3,
    fontFace: FONT, fontSize: 11, bold: true, charSpacing: 5,
    color: 'F5C2CD', align: 'center', valign: 'middle',
  });
  slide.addText('Placement-to-Join Conversion Rate', {
    x: M, y: 3.55, w: W - 2 * M, h: 0.5,
    fontFace: FONT, fontSize: 32, bold: true,
    color: 'FFFFFF', align: 'center', valign: 'middle', charSpacing: -1,
  });
  slide.addText('(equivalently · the inverse of offer drop rate)', {
    x: M, y: 4.0, w: W - 2 * M, h: 0.3,
    fontFace: FONT, fontSize: 12, italic: true,
    color: 'F0CBD5', align: 'center', valign: 'middle',
  });

  // KPI tree
  slide.addShape(pres.ShapeType.roundRect, {
    x: M, y: 4.55, w: W - 2 * M, h: 2.4,
    rectRadius: 0.14,
    fill: { color: 'FFFFFF', transparency: 94 },
    line: { color: 'FFFFFF', width: 0.5, transparency: 85 },
  });

  const kpiLines = [
    { txt: '↑  Placement-to-Join Conversion Rate', bold: true, color: 'FFFFFF', size: 13 },
    { txt: '├── Top-of-funnel quality  (CoPilot)',  bold: true, color: 'FFFFFF', size: 12 },
    { txt: '│      ├── Avg QA score per recruiter', color: 'CBD5E1', size: 11 },
    { txt: '│      ├── Submission → interview / offer conversion', color: 'CBD5E1', size: 11 },
    { txt: '│      └── AI content-check fail rate', color: 'CBD5E1', size: 11 },
    { txt: '├── Pipeline efficiency  (Workflow)',   bold: true, color: 'FFFFFF', size: 12 },
    { txt: '│      ├── Stage conversion rates + bottleneck detection', color: 'CBD5E1', size: 11 },
    { txt: '│      └── Time-in-stage  ·  time-to-hire', color: 'CBD5E1', size: 11 },
    { txt: '└── Offer protection  (POFU)',          bold: true, color: 'FFFFFF', size: 12 },
    { txt: '       ├── Offer drop rate  (target: cut by 50%)', color: 'FFB47A', bold: true, size: 11 },
    { txt: '       ├── Time-to-detect drop risk', color: 'CBD5E1', size: 11 },
    { txt: '       └── Risk-flagged candidates intervened', color: 'CBD5E1', size: 11 },
  ];

  const startY = 4.65;
  const lineH = 0.18;
  kpiLines.forEach((l, i) => {
    slide.addText(l.txt, {
      x: M + 0.4, y: startY + i * lineH, w: W - 2 * M - 0.6, h: lineH + 0.04,
      fontFace: 'Consolas', fontSize: l.size, bold: !!l.bold,
      color: l.color, valign: 'top',
    });
  });

  addFooter(slide, 18, t);
}

// ============================================================================
// SLIDE 19 — CLOSING
// ============================================================================
{
  const { slide, t } = newSlide('navy');

  // Decorative shape
  slide.addShape(pres.ShapeType.ellipse, {
    x: -3, y: -3, w: 6, h: 6,
    fill: { color: C.accent, transparency: 85 },
    line: { type: 'none' },
  });

  // Logo (centered, large)
  slide.addImage({ path: LOGO, x: W / 2 - 0.55, y: 1.3, w: 1.1, h: 1.1 });

  // Statement
  slide.addText(
    [
      { text: 'Zeople.\n', options: { color: 'FF8FAA', bold: true } },
      { text: 'Protecting agency revenue\nfrom the ', options: { color: 'FFFFFF', bold: true } },
      { text: 'first call', options: { color: C.accent, bold: true } },
      { text: ' to ', options: { color: 'FFFFFF', bold: true } },
      { text: 'Day-1 join.', options: { color: C.accent, bold: true } },
    ],
    {
      x: 1, y: 2.75, w: W - 2, h: 2.6,
      fontFace: FONT, fontSize: 44, bold: true,
      align: 'center', valign: 'top', charSpacing: -1,
    }
  );

  slide.addText('The AI Co-Pilot for Recruiting Agencies and Staffing Firms.', {
    x: 1, y: 5.5, w: W - 2, h: 0.5,
    fontFace: FONT, fontSize: 16,
    color: '94A3B8', align: 'center', valign: 'top',
  });

  // Subtle accent rule above footer to fill empty whitespace
  slide.addShape(pres.ShapeType.rect, {
    x: W / 2 - 0.6, y: 6.25, w: 1.2, h: 0.04,
    fill: { color: C.accent }, line: { type: 'none' },
  });

  addFooter(slide, 19, t);
}

// ============================================================================
pres.writeFile({ fileName: OUT })
  .then((p) => console.log(`[generate-pptx] Wrote ${p}`))
  .catch((err) => { console.error('[generate-pptx] FAILED:', err); process.exit(1); });
