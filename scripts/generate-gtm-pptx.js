// Generate the Zeople RecruiterOS Go-To-Market deck as a native .pptx.
// Usage: node scripts/generate-gtm-pptx.js
//
// 13.333 x 7.5 widescreen canvas. Brand palette mirrors client/src/App.css
// and the product-overview deck (see generate-presentation-pptx.js).

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
  green:      '16A34A',
  greenSoft:  'DCFCE7',
  amber:      'F59E0B',
  amberSoft:  'FEF3C7',
};

const FONT = 'Calibri';
const LOGO = path.resolve(__dirname, '..', 'docs', 'product', 'zeople-logo.png');
const OUT  = path.resolve(__dirname, '..', 'docs', 'gtm', 'Zeople-GTM-Strategy.pptx');

const W = 13.333;
const H = 7.5;
const M = 0.6;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'Zeople RecruiterOS — Go-To-Market Strategy';
pres.author = 'Zeople';
pres.company = 'Zeople';

// ============================================================================
// Helpers (mirrors generate-presentation-pptx.js)
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
  slide.addImage({ path: LOGO, x: M, y: 0.32, w: 0.38, h: 0.38 });
  slide.addText(
    [
      { text: 'Zeople ',     options: { fontFace: FONT, fontSize: 12, bold: true, color: t.wordmark } },
      { text: 'RecruiterOS', options: { fontFace: FONT, fontSize: 12, bold: true, color: C.accent } },
    ],
    { x: M + 0.5, y: 0.36, w: 4, h: 0.4, valign: 'middle' }
  );
  slide.addText(sectionLabel.toUpperCase(), {
    x: W - M - 5, y: 0.36, w: 5, h: 0.4,
    fontFace: FONT, fontSize: 10, bold: true,
    color: t.label, charSpacing: 4,
    align: 'right', valign: 'middle',
  });
}

function addFooter(slide, num, t) {
  slide.addText('ZEOPLE  ·  GO-TO-MARKET  ·  FOUNDING TEAM REVIEW  ·  2026', {
    x: M, y: H - 0.45, w: 8, h: 0.3,
    fontFace: FONT, fontSize: 8, bold: true, charSpacing: 4,
    color: t.footer, valign: 'middle',
  });
  slide.addText(String(num).padStart(2, '0'), {
    x: W - M - 1, y: H - 0.45, w: 1, h: 0.3,
    fontFace: FONT, fontSize: 8, bold: true, charSpacing: 4,
    color: t.footer, align: 'right', valign: 'middle',
  });
}

function addEyebrow(slide, text, x, y, opts = {}) {
  const variant = opts.variant || 'accent';
  const onDark = opts.dark || false;
  const fg = variant === 'brand' ? (onDark ? 'FF8FAA' : C.brand) : (onDark ? 'FFB47A' : C.accent);
  const bgColor = onDark
    ? (variant === 'brand' ? '3A1820' : '3A2410')
    : (variant === 'brand' ? C.brandSoft : C.accentSoft);
  const borderColor = onDark ? fg : (variant === 'brand' ? C.brand : C.accent);
  const estW = Math.min(text.length * 0.085 + 0.45, 5.5);
  const w = opts.w || estW;
  const h = 0.34;
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.17,
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
    x, y, w, h, rectRadius: 0.12,
    fill: { color: opts.fill || C.bgCard },
    line: { color: opts.borderColor || C.border, width: opts.borderWidth || 0.75 },
    shadow: opts.shadow ? { type: 'outer', blur: 18, offset: 4, color: '0F1E35', opacity: 0.10 } : undefined,
  });
  if (opts.topColor) {
    slide.addShape(pres.ShapeType.rect, {
      x, y, w, h: 0.07,
      fill: { color: opts.topColor },
      line: { type: 'none' },
    });
  }
}

function addPill(slide, text, x, y, w, opts = {}) {
  const fillMap = { accent: C.accentSoft, brand: C.brandSoft, green: C.greenSoft, amber: C.amberSoft, navy: 'E2E8F0' };
  const fgMap   = { accent: C.accent,    brand: C.brand,     green: C.green,     amber: 'B45309',  navy: C.navy };
  const variant = opts.variant || 'accent';
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h: 0.28, rectRadius: 0.14,
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

  slide.addShape(pres.ShapeType.ellipse, {
    x: 9.5, y: 3.5, w: 6, h: 6,
    fill: { color: C.brand, transparency: 88 },
    line: { type: 'none' },
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: -2, y: -2, w: 6, h: 6,
    fill: { color: C.accent, transparency: 92 },
    line: { type: 'none' },
  });

  slide.addImage({ path: LOGO, x: 1.0, y: 1.5, w: 0.95, h: 0.95 });

  slide.addText(
    [
      { text: 'Zeople ',     options: { fontFace: FONT, fontSize: 64, bold: true, color: 'FFFFFF', charSpacing: -2 } },
      { text: 'RecruiterOS', options: { fontFace: FONT, fontSize: 64, bold: true, color: C.accent, charSpacing: -2 } },
    ],
    { x: 1.0, y: 2.7, w: 12, h: 1.3, valign: 'top' }
  );

  slide.addText('Go-To-Market Strategy', {
    x: 1.0, y: 4.0, w: 12, h: 0.9,
    fontFace: FONT, fontSize: 44, bold: true,
    color: 'FFFFFF', valign: 'top', charSpacing: -1,
  });

  slide.addText('How Zeople wins the recruiting-agency market — wedge, ICP, motion, and the first 90 days.', {
    x: 1.0, y: 5.0, w: 10, h: 0.8,
    fontFace: FONT, fontSize: 18,
    color: '94A3B8', valign: 'top',
  });

  slide.addShape(pres.ShapeType.rect, {
    x: 1.0, y: 6.0, w: 1.2, h: 0.04,
    fill: { color: C.accent }, line: { type: 'none' },
  });
  slide.addText('PREPARED FOR THE ZEOPLE FOUNDING TEAM  ·  MAY 2026', {
    x: 1.0, y: 6.15, w: 10, h: 0.4,
    fontFace: FONT, fontSize: 11, bold: true, charSpacing: 4,
    color: '94A3B8', valign: 'top',
  });

  addFooter(slide, 1, t);
}

// ============================================================================
// SLIDE 2 — STRATEGIC FRAME
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'The Frame', t);

  addEyebrow(slide, 'Why GTM clarity matters now', M, 1.1, { variant: 'brand' });
  addH2(slide, 'We have product. We have IP.\nThe next constraint is distribution.', M, 1.55, 12, C.text1, { fontSize: 34, h: 1.7 });

  const cards = [
    {
      pill: 'Product',
      pillVar: 'brand',
      title: 'Calling CoPilot is live.',
      body: 'Live transcription, AI guidance, post-call scoring, recruiter QA — already shipped and in use.',
    },
    {
      pill: 'IP',
      pillVar: 'accent',
      title: 'LRM™ provisional filed.',
      body: 'Provisional patent on AI-augmented human screening using the Large Recruitment Model. POFU + MI filings in pipeline.',
    },
    {
      pill: 'Gap',
      pillVar: 'amber',
      title: 'Distribution is unsolved.',
      body: 'No defined ICP, no repeatable motion, no pricing in market. This deck closes that gap.',
    },
  ];

  const cardY = 3.5;
  const cardH = 2.7;
  const cardW = (W - 2 * M - 0.4) / 3;
  const gap = 0.2;
  cards.forEach((c, i) => {
    const x = M + i * (cardW + gap);
    addCard(slide, x, cardY, cardW, cardH, { topColor: i === 0 ? C.brand : (i === 1 ? C.accent : C.amber), shadow: true });
    addPill(slide, c.pill, x + 0.3, cardY + 0.3, 1.4, { variant: c.pillVar });
    slide.addText(c.title, {
      x: x + 0.3, y: cardY + 0.75, w: cardW - 0.6, h: 0.7,
      fontFace: FONT, fontSize: 20, bold: true,
      color: C.text1, valign: 'top', charSpacing: -0.5,
    });
    slide.addText(c.body, {
      x: x + 0.3, y: cardY + 1.55, w: cardW - 0.6, h: cardH - 1.7,
      fontFace: FONT, fontSize: 13,
      color: C.text2, valign: 'top',
    });
  });

  slide.addText(
    [
      { text: 'This document answers: ', options: { color: C.text2 } },
      { text: 'who we sell to first, what we sell them, how we reach them, what we charge, and what to do in the next 90 days.', options: { color: C.text1, bold: true } },
    ],
    {
      x: M, y: 6.5, w: 12, h: 0.5,
      fontFace: FONT, fontSize: 13,
      align: 'center', valign: 'top',
    }
  );

  addFooter(slide, 2, t);
}

// ============================================================================
// SLIDE 3 — MARKET OPPORTUNITY
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'The Opportunity', t);

  addEyebrow(slide, 'Where the money is', M, 1.1, { dark: true });
  addH2(slide, 'India recruiting agencies are the\nfirst beachhead. Global is next.', M, 1.55, 12, 'FFFFFF', { fontSize: 34, h: 1.7 });

  // 3 stat blocks
  const stats = [
    { num: '15K+', label: 'Recruiting & staffing agencies in India', sub: 'Tech, GCC, IT services, BFSI, healthcare' },
    { num: '~₹40K Cr', label: 'Estimated India placement-fee market', sub: 'Conservative blend of perm + contract revenue' },
    { num: '$200B+', label: 'Global agency recruiting TAM', sub: 'SIA-tracked staffing & search revenue worldwide' },
  ];
  const cardY = 3.5;
  const cardH = 2.0;
  const cardW = (W - 2 * M - 0.4) / 3;
  const gap = 0.2;
  stats.forEach((s, i) => {
    const x = M + i * (cardW + gap);
    slide.addShape(pres.ShapeType.roundRect, {
      x, y: cardY, w: cardW, h: cardH, rectRadius: 0.14,
      fill: { color: 'FFFFFF', transparency: 92 },
      line: { color: 'FFFFFF', width: 0.5, transparency: 80 },
    });
    slide.addText(s.num, {
      x: x + 0.3, y: cardY + 0.25, w: cardW - 0.6, h: 0.85,
      fontFace: FONT, fontSize: 48, bold: true,
      color: C.accent, valign: 'top', charSpacing: -1.5,
    });
    slide.addText(s.label, {
      x: x + 0.3, y: cardY + 1.15, w: cardW - 0.6, h: 0.45,
      fontFace: FONT, fontSize: 13, bold: true,
      color: 'FFFFFF', valign: 'top',
    });
    slide.addText(s.sub, {
      x: x + 0.3, y: cardY + 1.55, w: cardW - 0.6, h: 0.4,
      fontFace: FONT, fontSize: 10,
      color: '94A3B8', valign: 'top',
    });
  });

  slide.addText(
    [
      { text: 'Beachhead logic: ', options: { color: C.accent, bold: true } },
      { text: 'India agencies have higher call volume, higher drop-rates, and cheaper ACV experiments than the West. Win here, then take the playbook global with a 5–8× ACV uplift.', options: { color: 'CBD5E1' } },
    ],
    {
      x: M, y: 6.0, w: 12, h: 0.8,
      fontFace: FONT, fontSize: 13, valign: 'top',
    }
  );

  addFooter(slide, 3, t);
}

// ============================================================================
// SLIDE 4 — ICP (IDEAL CUSTOMER PROFILE)
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'Ideal Customer', t);

  addEyebrow(slide, 'Where we win fastest', M, 1.1, { variant: 'brand' });
  addH2(slide, 'Mid-market India tech-staffing\nagencies, 20–150 recruiters.', M, 1.55, 12, C.text1, { fontSize: 32, h: 1.6 });

  // Left: ICP attributes
  addCard(slide, M, 3.4, 6.0, 3.5, { shadow: true });
  addPill(slide, 'Profile', M + 0.3, 3.65, 1.3, { variant: 'brand' });
  slide.addText('The agency that bleeds the most without us.', {
    x: M + 0.3, y: 4.05, w: 5.4, h: 0.5,
    fontFace: FONT, fontSize: 16, bold: true,
    color: C.text1, valign: 'top', charSpacing: -0.3,
  });
  slide.addText(
    [
      { text: '20–150 active recruiters on the floor.', options: { bullet: { code: '2022' } } },
      { text: 'Tech / GCC / IT-services hiring — high call volume, high drop-rate.', options: { bullet: { code: '2022' } } },
      { text: '₹5–50 Cr annual placement revenue (sweet spot for our ACV).', options: { bullet: { code: '2022' } } },
      { text: 'Owner-operated or first-generation professional CEO.', options: { bullet: { code: '2022' } } },
      { text: 'Already on Zoho Recruit / Naukri RMS / spreadsheets — no AI in workflow.', options: { bullet: { code: '2022' } } },
      { text: 'Delivery head + Founder are the buying committee.', options: { bullet: { code: '2022' } } },
    ],
    {
      x: M + 0.4, y: 4.6, w: 5.2, h: 2.2,
      fontFace: FONT, fontSize: 12,
      color: C.text1, valign: 'top', paraSpaceAfter: 6,
    }
  );

  // Right: Disqualifiers
  addCard(slide, M + 6.3, 3.4, 6.0, 3.5, { shadow: true });
  addPill(slide, 'Disqualifiers', M + 6.6, 3.65, 1.9, { variant: 'amber' });
  slide.addText('Where we do NOT chase, yet.', {
    x: M + 6.6, y: 4.05, w: 5.4, h: 0.5,
    fontFace: FONT, fontSize: 16, bold: true,
    color: C.text1, valign: 'top', charSpacing: -0.3,
  });
  slide.addText(
    [
      { text: 'In-house TA teams (different workflow, different buyer).', options: { bullet: { code: '2022' } } },
      { text: 'Sub-10 recruiter agencies (ACV too small, churn risk too high).', options: { bullet: { code: '2022' } } },
      { text: 'Pure RPO operators (their margin model fights ours).', options: { bullet: { code: '2022' } } },
      { text: 'Non-tech hiring agencies (BPO, blue-collar) — Phase 2 segment.', options: { bullet: { code: '2022' } } },
      { text: 'US/UK agencies — Phase 2 (10× ACV but 6× sales cycle).', options: { bullet: { code: '2022' } } },
      { text: 'Enterprise-procurement-heavy buyers — Phase 3.', options: { bullet: { code: '2022' } } },
    ],
    {
      x: M + 6.7, y: 4.6, w: 5.2, h: 2.2,
      fontFace: FONT, fontSize: 12,
      color: C.text1, valign: 'top', paraSpaceAfter: 6,
    }
  );

  addFooter(slide, 4, t);
}

// ============================================================================
// SLIDE 5 — THE WEDGE
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'The Wedge', t);

  addEyebrow(slide, 'What we sell first', M, 1.1, { variant: 'brand' });
  addH2(slide, 'Lead with Calling CoPilot.\nLand the seat. Then expand.', M, 1.55, 12, C.text1, { fontSize: 32, h: 1.6 });

  // 3-step land-expand visual
  const steps = [
    {
      n: '1',
      pill: 'Land',
      pillVar: 'brand',
      title: 'Calling CoPilot',
      body: 'Live AI on every recruiter call. Shipped, patent-pending, immediately demoable. Highest "wow" → lowest friction sale.',
      tag: 'Pillar 1 · Live',
    },
    {
      n: '2',
      pill: 'Expand',
      pillVar: 'accent',
      title: 'Post-Offer Follow-Up',
      body: 'Drop-risk scoring + intervention nudges between offer and joining. Same buyer, second pain, sticky usage.',
      tag: 'Pillar 2 · Beta',
    },
    {
      n: '3',
      pill: 'Lock',
      pillVar: 'navy',
      title: 'Pipeline + Assessments + MI',
      body: 'Sessions, JD enhancer, MCQ/coding/video, market intelligence. Becomes the agency operating system. Replaces the ATS.',
      tag: 'RecruiterOS',
    },
  ];

  const stepY = 3.3;
  const stepH = 3.4;
  const stepW = (W - 2 * M - 0.4) / 3;
  const gap = 0.2;
  steps.forEach((s, i) => {
    const x = M + i * (stepW + gap);
    const topColor = i === 0 ? C.brand : (i === 1 ? C.accent : C.navy);
    addCard(slide, x, stepY, stepW, stepH, { topColor, shadow: true });

    // Number circle
    slide.addShape(pres.ShapeType.ellipse, {
      x: x + 0.3, y: stepY + 0.3, w: 0.55, h: 0.55,
      fill: { color: topColor }, line: { type: 'none' },
    });
    slide.addText(s.n, {
      x: x + 0.3, y: stepY + 0.3, w: 0.55, h: 0.55,
      fontFace: FONT, fontSize: 18, bold: true,
      color: 'FFFFFF', align: 'center', valign: 'middle',
    });

    addPill(slide, s.pill, x + 0.95, stepY + 0.4, 1.1, { variant: s.pillVar });

    slide.addText(s.title, {
      x: x + 0.3, y: stepY + 1.05, w: stepW - 0.6, h: 0.55,
      fontFace: FONT, fontSize: 19, bold: true,
      color: C.text1, valign: 'top', charSpacing: -0.5,
    });
    slide.addText(s.body, {
      x: x + 0.3, y: stepY + 1.65, w: stepW - 0.6, h: 1.5,
      fontFace: FONT, fontSize: 12,
      color: C.text2, valign: 'top',
    });
    slide.addText(s.tag.toUpperCase(), {
      x: x + 0.3, y: stepH + stepY - 0.5, w: stepW - 0.6, h: 0.3,
      fontFace: FONT, fontSize: 9, bold: true, charSpacing: 3,
      color: topColor, valign: 'middle',
    });
  });

  slide.addText(
    [
      { text: 'Why CoPilot first: ', options: { color: C.brand, bold: true } },
      { text: 'shortest demo (5 min), highest emotional hook ("you just heard your own recruiter"), and the LRM™ filing makes it defensible.', options: { color: C.text1 } },
    ],
    {
      x: M, y: 6.9, w: 12, h: 0.4,
      fontFace: FONT, fontSize: 12, valign: 'top', align: 'center',
    }
  );

  addFooter(slide, 5, t);
}

// ============================================================================
// SLIDE 6 — POSITIONING
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'Positioning', t);

  addEyebrow(slide, 'How we beat the alternatives', M, 1.1, { variant: 'brand' });
  addH2(slide, 'The only AI built for the agency\nrevenue equation — not for sales, not for in-house TA.', M, 1.55, 12, C.text1, { fontSize: 28, h: 1.7 });

  const rows = [
    [
      { text: 'Agency ATS', options: { bold: true, color: C.text1 } },
      { text: 'Bullhorn, Zoho Recruit', options: { color: C.text2 } },
      { text: 'System of record', options: { color: C.text2 } },
      { text: 'No AI on calls. No offer protection. Dated UX.', options: { color: C.text1 } },
      { text: 'Zeople sits above and replaces over time', options: { color: C.brand, bold: true } },
    ],
    [
      { text: 'Sales Call AI', options: { bold: true, color: C.text1 } },
      { text: 'Gong, Wingman, Sybill', options: { color: C.text2 } },
      { text: 'Sales-call insights', options: { color: C.text2 } },
      { text: 'Built for SDR/AE, not recruiters. No candidate evaluation.', options: { color: C.text1 } },
      { text: 'Wrong category. Demo kills them in 60s.', options: { color: C.brand, bold: true } },
    ],
    [
      { text: 'Recruiting Call AI', options: { bold: true, color: C.text1 } },
      { text: 'Metaview, BrightHire', options: { color: C.text2 } },
      { text: 'Interview transcription', options: { color: C.text2 } },
      { text: 'In-house TA focus. Standalone tool. No POFU. No agency workflow.', options: { color: C.text1 } },
      { text: 'Zeople is the agency-native version', options: { color: C.brand, bold: true } },
    ],
    [
      { text: 'Engagement / Drip', options: { bold: true, color: C.text1 } },
      { text: 'Sense, GoodTime', options: { color: C.text2 } },
      { text: 'Candidate nurture email', options: { color: C.text2 } },
      { text: 'Generic. No drop-risk model. No post-offer state engine.', options: { color: C.text1 } },
      { text: 'POFU is purpose-built for the gap', options: { color: C.brand, bold: true } },
    ],
  ];

  slide.addTable(
    [
      [
        { text: 'CATEGORY',     options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, valign: 'middle' } },
        { text: 'EXAMPLES',     options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, valign: 'middle' } },
        { text: 'POSITIONED AS',options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, valign: 'middle' } },
        { text: 'WHY THEY LOSE',options: { bold: true, color: 'FFFFFF', fill: { color: C.navy }, fontSize: 10, valign: 'middle' } },
        { text: 'ZEOPLE EDGE',  options: { bold: true, color: 'FFFFFF', fill: { color: C.brand }, fontSize: 10, valign: 'middle' } },
      ],
      ...rows.map((row, i) =>
        row.map((cell) => ({
          text: cell.text,
          options: { ...cell.options, fill: { color: i % 2 === 0 ? 'FFFFFF' : C.bgSoft }, fontSize: 10, valign: 'middle' },
        }))
      ),
    ],
    {
      x: M, y: 3.4, w: W - 2 * M,
      colW: [1.8, 2.0, 2.0, 3.5, 2.83],
      rowH: 0.55,
      fontFace: FONT,
      border: { type: 'solid', color: C.border, pt: 0.5 },
      margin: 0.10,
    }
  );

  slide.addText(
    [
      { text: 'One-line positioning: ', options: { color: C.text2 } },
      { text: '"Zeople is the AI Co-Pilot for recruiting agencies — protecting revenue from the first call to Day-1 joining."', options: { color: C.text1, bold: true, italic: true } },
    ],
    {
      x: M, y: 6.4, w: 12, h: 0.5,
      fontFace: FONT, fontSize: 13, valign: 'top', align: 'center',
    }
  );

  addFooter(slide, 6, t);
}

// ============================================================================
// SLIDE 7 — PRICING & PACKAGING
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'Pricing & Packaging', t);

  addEyebrow(slide, 'How we charge', M, 1.1, { variant: 'brand' });
  addH2(slide, 'Per-recruiter SaaS, with usage uplift on calls.\nThree tiers. India ₹, global $.', M, 1.55, 12, C.text1, { fontSize: 28, h: 1.7 });

  const tiers = [
    {
      name: 'Starter',
      price: '₹1,499',
      sub: 'per recruiter / month',
      target: 'Sub-25 recruiter agencies',
      features: [
        'Calling CoPilot (300 calls/mo)',
        'Candidate database + jobs',
        'JD Enhancer',
        'Reports & analytics',
      ],
      color: C.navy,
      cta: 'Land',
    },
    {
      name: 'Pro',
      price: '₹2,999',
      sub: 'per recruiter / month',
      target: 'Our ICP — 25-100 recruiters',
      features: [
        'Everything in Starter',
        'Unlimited calls + Recruiter QA',
        'Pipeline Sessions',
        'MCQ + Coding + Video assessments',
        'POFU (drop-risk scoring)',
      ],
      color: C.brand,
      featured: true,
      cta: 'Sweet spot',
    },
    {
      name: 'Scale',
      price: 'Custom',
      sub: 'volume pricing',
      target: '100+ recruiters / multi-office',
      features: [
        'Everything in Pro',
        'Market Intelligence',
        'Hiring Manager workspace',
        'SSO, audit log, custom roles',
        'Dedicated CSM',
      ],
      color: C.accent,
      cta: 'Expand',
    },
  ];

  const tierY = 3.3;
  const tierH = 3.6;
  const tierW = (W - 2 * M - 0.5) / 3;
  const gap = 0.25;
  tiers.forEach((tier, i) => {
    const x = M + i * (tierW + gap);
    const featured = !!tier.featured;
    addCard(slide, x, featured ? tierY - 0.15 : tierY, tierW, featured ? tierH + 0.3 : tierH, {
      topColor: tier.color, shadow: true,
      borderColor: featured ? tier.color : C.border,
      borderWidth: featured ? 2 : 0.75,
    });

    const titleY = (featured ? tierY - 0.15 : tierY) + 0.3;
    slide.addText(tier.name, {
      x: x + 0.3, y: titleY, w: tierW - 0.6, h: 0.5,
      fontFace: FONT, fontSize: 22, bold: true,
      color: C.text1, valign: 'top', charSpacing: -0.5,
    });
    slide.addText(tier.target.toUpperCase(), {
      x: x + 0.3, y: titleY + 0.45, w: tierW - 0.6, h: 0.3,
      fontFace: FONT, fontSize: 9, bold: true, charSpacing: 2,
      color: tier.color, valign: 'top',
    });
    slide.addText(tier.price, {
      x: x + 0.3, y: titleY + 0.85, w: tierW - 0.6, h: 0.7,
      fontFace: FONT, fontSize: 32, bold: true,
      color: C.text1, valign: 'top', charSpacing: -1,
    });
    slide.addText(tier.sub, {
      x: x + 0.3, y: titleY + 1.55, w: tierW - 0.6, h: 0.3,
      fontFace: FONT, fontSize: 11,
      color: C.text2, valign: 'top',
    });
    slide.addText(
      tier.features.map((f) => ({ text: f, options: { bullet: { code: '2713' } } })),
      {
        x: x + 0.3, y: titleY + 1.95, w: tierW - 0.6, h: 1.6,
        fontFace: FONT, fontSize: 11,
        color: C.text1, valign: 'top', paraSpaceAfter: 4,
      }
    );
  });

  slide.addText(
    [
      { text: 'Anchor strategy: ', options: { color: C.brand, bold: true } },
      { text: 'Pro is priced to be the default. Starter exists to disqualify hagglers. Scale exists to expand top accounts. ', options: { color: C.text2 } },
      { text: 'Global pricing: ', options: { color: C.brand, bold: true } },
      { text: '$59 / $99 / Custom per seat.', options: { color: C.text2 } },
    ],
    {
      x: M, y: 7.0, w: 12, h: 0.4,
      fontFace: FONT, fontSize: 11, valign: 'top', align: 'center',
    }
  );

  addFooter(slide, 7, t);
}

// ============================================================================
// SLIDE 8 — GO-TO-MARKET MOTION
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'The Motion', t);

  addEyebrow(slide, 'How we sell, in three phases', M, 1.1, { dark: true });
  addH2(slide, 'Founder-led design partners.\nThen outbound. Then channel.', M, 1.55, 12, 'FFFFFF', { fontSize: 32, h: 1.7 });

  const phases = [
    {
      tag: 'Phase 1 · Now → Month 3',
      title: 'Founder-led design partners',
      body: '10 hand-picked agencies. Free or deeply discounted. White-glove onboarding by founders. Goal: 10 case studies, 5 referenceable logos, refined product-market fit.',
      kpi: '10 design partners signed',
      color: C.brand,
    },
    {
      tag: 'Phase 2 · Month 3 → 9',
      title: 'Outbound SDR + content',
      body: 'Hire 2 SDRs (Bangalore/Mumbai). Outbound to ICP agency delivery heads. Founder closes. LinkedIn content from Anuraag/Divakar/Minnakshi as recruiting-AI POV.',
      kpi: '₹2 Cr ARR, 30 paying logos',
      color: C.accent,
    },
    {
      tag: 'Phase 3 · Month 9 → 18',
      title: 'Channel + global expansion',
      body: 'Partner with India recruitment associations (ERA, NHRDN), ATS integrators, and "ex-Naukri" influencer network. Open US beachhead via Indian-founded US agencies.',
      kpi: '₹15 Cr ARR, US v1 pilots',
      color: '60A5FA',
    },
  ];

  const phY = 3.5;
  const phH = 3.0;
  const phW = (W - 2 * M - 0.5) / 3;
  const gap = 0.25;
  phases.forEach((p, i) => {
    const x = M + i * (phW + gap);
    slide.addShape(pres.ShapeType.roundRect, {
      x, y: phY, w: phW, h: phH, rectRadius: 0.14,
      fill: { color: 'FFFFFF', transparency: 92 },
      line: { color: p.color, width: 1.5 },
    });
    // Top accent stripe
    slide.addShape(pres.ShapeType.rect, {
      x, y: phY, w: phW, h: 0.06,
      fill: { color: p.color }, line: { type: 'none' },
    });
    slide.addText(p.tag.toUpperCase(), {
      x: x + 0.3, y: phY + 0.2, w: phW - 0.6, h: 0.3,
      fontFace: FONT, fontSize: 9, bold: true, charSpacing: 3,
      color: p.color, valign: 'top',
    });
    slide.addText(p.title, {
      x: x + 0.3, y: phY + 0.55, w: phW - 0.6, h: 0.65,
      fontFace: FONT, fontSize: 19, bold: true,
      color: 'FFFFFF', valign: 'top', charSpacing: -0.5,
    });
    slide.addText(p.body, {
      x: x + 0.3, y: phY + 1.3, w: phW - 0.6, h: 1.2,
      fontFace: FONT, fontSize: 11,
      color: 'CBD5E1', valign: 'top',
    });
    // KPI footer
    slide.addShape(pres.ShapeType.rect, {
      x: x + 0.3, y: phY + phH - 0.55, w: phW - 0.6, h: 0.02,
      fill: { color: p.color, transparency: 50 }, line: { type: 'none' },
    });
    slide.addText('KPI · ' + p.kpi, {
      x: x + 0.3, y: phY + phH - 0.45, w: phW - 0.6, h: 0.3,
      fontFace: FONT, fontSize: 10, bold: true,
      color: p.color, valign: 'top',
    });
  });

  slide.addText(
    [
      { text: 'Why this order: ', options: { color: C.accent, bold: true } },
      { text: 'we have a product but no proof. Design partners produce proof. Proof unlocks outbound. Outbound earns the right to channel.', options: { color: 'CBD5E1' } },
    ],
    {
      x: M, y: 6.8, w: 12, h: 0.4,
      fontFace: FONT, fontSize: 12, valign: 'top', align: 'center',
    }
  );

  addFooter(slide, 8, t);
}

// ============================================================================
// SLIDE 9 — ACQUISITION CHANNELS
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, 'Channels', t);

  addEyebrow(slide, 'Where the pipeline comes from', M, 1.1, { variant: 'brand' });
  addH2(slide, 'Five channels, ranked by\nbelievability at our stage.', M, 1.55, 12, C.text1, { fontSize: 30, h: 1.7 });

  const channels = [
    { rank: '1', name: 'Founder network',  body: 'Anuraag, Divakar, Minnakshi — direct intros into 30+ agency founders/delivery heads. Highest conversion, zero CAC.', tag: 'Now', color: C.brand },
    { rank: '2', name: 'Targeted outbound', body: 'LinkedIn + email sequences to delivery heads at named ICP accounts. Demo-led, recruiter-mentor tone (not SaaS pitch).', tag: 'Month 2+', color: C.accent },
    { rank: '3', name: 'Thought-leadership content', body: 'Weekly posts: "What we learned listening to 10,000 recruiter calls." Anuraag/Divakar/Minnakshi as bylines. Recruiting-AI POV.', tag: 'Month 1+', color: C.navy },
    { rank: '4', name: 'Customer referrals', body: 'Once 10 logos live, formalize referral fee (1 month free per referral that converts). Agency owners talk to each other.', tag: 'Month 4+', color: '60A5FA' },
    { rank: '5', name: 'Industry partnerships', body: 'ERA, NHRDN, recruiting podcasts, ATS integration marketplaces. Slow burn, opens at Phase 3.', tag: 'Month 9+', color: '94A3B8' },
  ];

  const chY = 3.4;
  const chRowH = 0.65;
  channels.forEach((c, i) => {
    const y = chY + i * chRowH;
    slide.addShape(pres.ShapeType.rect, {
      x: M, y: y + 0.04, w: 0.06, h: chRowH - 0.15,
      fill: { color: c.color }, line: { type: 'none' },
    });
    slide.addText(c.rank, {
      x: M + 0.2, y, w: 0.5, h: chRowH,
      fontFace: FONT, fontSize: 24, bold: true,
      color: c.color, valign: 'middle', charSpacing: -1,
    });
    slide.addText(c.name, {
      x: M + 0.75, y, w: 3.0, h: chRowH,
      fontFace: FONT, fontSize: 14, bold: true,
      color: C.text1, valign: 'middle',
    });
    slide.addText(c.body, {
      x: M + 3.8, y, w: 7.2, h: chRowH,
      fontFace: FONT, fontSize: 11,
      color: C.text2, valign: 'middle',
    });
    addPill(slide, c.tag, M + 11.05, y + 0.17, 1.05, { variant: i === 0 ? 'brand' : (i === 1 ? 'accent' : 'navy') });
  });

  addFooter(slide, 9, t);
}

// ============================================================================
// SLIDE 10 — 90-DAY PLAN
// ============================================================================
{
  const { slide, t } = newSlide('light');
  addBrandHeader(slide, '90-Day Plan', t);

  addEyebrow(slide, 'What we do, week by week', M, 1.1, { variant: 'brand' });
  addH2(slide, 'The next 90 days are about proof,\nnot scale.', M, 1.55, 12, C.text1, { fontSize: 32, h: 1.7 });

  const months = [
    {
      label: 'Days 1–30',
      title: 'Foundations',
      items: [
        'Lock ICP, messaging, pricing (this deck).',
        'Build 10-deck demo flow + 2-min product video.',
        'Set up CRM (HubSpot Free), pipeline, dashboards.',
        'Identify 30 design-partner targets from network.',
        'Founder reach-out: 30 conversations, 15 demos.',
      ],
      color: C.brand,
    },
    {
      label: 'Days 31–60',
      title: 'Design Partners',
      items: [
        'Onboard 5 paying or pilot design partners.',
        'Ship 3 product fixes from real usage feedback.',
        'Publish first 4 thought-leadership posts.',
        'Draft Pro-tier contract template.',
        'Hire #1 SDR; founder defines outbound playbook.',
      ],
      color: C.accent,
    },
    {
      label: 'Days 61–90',
      title: 'Repeatable Motion',
      items: [
        'Reach 10 live design partners with logos to share.',
        'First 3 case studies published.',
        'Outbound machine producing 5 SQLs/week.',
        'Ship POFU v1 enhancements from partner asks.',
        'Founding-team review: green-light Phase 2 spend.',
      ],
      color: C.navy,
    },
  ];

  const mY = 3.3;
  const mH = 3.6;
  const mW = (W - 2 * M - 0.5) / 3;
  const gap = 0.25;
  months.forEach((m, i) => {
    const x = M + i * (mW + gap);
    addCard(slide, x, mY, mW, mH, { topColor: m.color, shadow: true });
    slide.addText(m.label.toUpperCase(), {
      x: x + 0.3, y: mY + 0.25, w: mW - 0.6, h: 0.3,
      fontFace: FONT, fontSize: 10, bold: true, charSpacing: 3,
      color: m.color, valign: 'top',
    });
    slide.addText(m.title, {
      x: x + 0.3, y: mY + 0.6, w: mW - 0.6, h: 0.55,
      fontFace: FONT, fontSize: 22, bold: true,
      color: C.text1, valign: 'top', charSpacing: -0.5,
    });
    slide.addText(
      m.items.map((it) => ({ text: it, options: { bullet: { code: '2022' } } })),
      {
        x: x + 0.4, y: mY + 1.25, w: mW - 0.8, h: mH - 1.4,
        fontFace: FONT, fontSize: 11,
        color: C.text1, valign: 'top', paraSpaceAfter: 6,
      }
    );
  });

  slide.addText(
    [
      { text: 'Single success metric for Day 90: ', options: { color: C.text2 } },
      { text: '10 live design partners, 3 referenceable case studies, ₹25–40 L committed ARR.', options: { color: C.brand, bold: true } },
    ],
    {
      x: M, y: 7.05, w: 12, h: 0.4,
      fontFace: FONT, fontSize: 12, valign: 'top', align: 'center',
    }
  );

  addFooter(slide, 10, t);
}

// ============================================================================
// SLIDE 11 — METRICS WE TRACK
// ============================================================================
{
  const { slide, t } = newSlide('navy');
  addBrandHeader(slide, 'Metrics', t);

  addEyebrow(slide, 'What we measure to know we are winning', M, 1.1, { dark: true });
  addH2(slide, 'Four numbers on the founders\' dashboard.', M, 1.55, 12, 'FFFFFF', { fontSize: 32, h: 1.5 });

  const metrics = [
    { num: 'ARR',     label: 'Committed Annual Recurring Revenue', sub: 'Primary north star. Target: ₹2 Cr by Month 9.' },
    { num: 'Logos',   label: 'Paying recruiting-agency logos',     sub: 'Counted only when invoice paid. Target: 30 by Month 9.' },
    { num: 'Call %',  label: 'Calls running through CoPilot',      sub: 'Activation proxy. Target: 60% of recruiter calls inside an account.' },
    { num: 'NRR',     label: 'Net Revenue Retention',              sub: 'Land-expand proof. Target: 120%+ from Month 6 cohorts.' },
  ];

  const mY = 3.2;
  const mH = 1.6;
  const mW = (W - 2 * M - 0.6) / 4;
  const gap = 0.2;
  metrics.forEach((m, i) => {
    const x = M + i * (mW + gap);
    slide.addShape(pres.ShapeType.roundRect, {
      x, y: mY, w: mW, h: mH, rectRadius: 0.14,
      fill: { color: 'FFFFFF', transparency: 92 },
      line: { color: C.accent, width: 0.75, transparency: 60 },
    });
    slide.addText(m.num, {
      x: x + 0.25, y: mY + 0.25, w: mW - 0.5, h: 0.7,
      fontFace: FONT, fontSize: 30, bold: true,
      color: C.accent, valign: 'top', charSpacing: -1,
    });
    slide.addText(m.label, {
      x: x + 0.25, y: mY + 0.95, w: mW - 0.5, h: 0.5,
      fontFace: FONT, fontSize: 11, bold: true,
      color: 'FFFFFF', valign: 'top',
    });
  });

  // Sub explanations under each
  metrics.forEach((m, i) => {
    const x = M + i * (mW + gap);
    slide.addText(m.sub, {
      x, y: mY + mH + 0.15, w: mW, h: 1.2,
      fontFace: FONT, fontSize: 10,
      color: '94A3B8', valign: 'top',
    });
  });

  // Leading indicators row
  addEyebrow(slide, 'Leading indicators (watch weekly)', M, 6.4, { dark: true });
  slide.addText(
    [
      { text: 'Demos booked  ·  ', options: { color: 'FFFFFF', bold: true } },
      { text: 'Demo → pilot conversion  ·  ', options: { color: 'CBD5E1' } },
      { text: 'Pilot → paid conversion  ·  ', options: { color: 'FFFFFF', bold: true } },
      { text: 'Time-to-first-call inside account  ·  ', options: { color: 'CBD5E1' } },
      { text: 'CSAT from Delivery Heads', options: { color: 'FFFFFF', bold: true } },
    ],
    {
      x: M, y: 6.85, w: 12, h: 0.4,
      fontFace: FONT, fontSize: 11, valign: 'top',
    }
  );

  addFooter(slide, 11, t);
}

// ============================================================================
// SLIDE 12 — ASKS FROM FOUNDING TEAM
// ============================================================================
{
  const { slide, t } = newSlide('brand');
  addBrandHeader(slide, 'Asks', t);

  addEyebrow(slide, 'What we need from you', M, 1.1, { dark: true });
  addH2(slide, 'Three decisions and three intros\nbefore we start dialing.', M, 1.55, 12, 'FFFFFF', { fontSize: 32, h: 1.7 });

  // Decisions card
  slide.addShape(pres.ShapeType.roundRect, {
    x: M, y: 3.4, w: 6.0, h: 3.4, rectRadius: 0.14,
    fill: { color: 'FFFFFF', transparency: 90 },
    line: { color: 'FFFFFF', width: 1, transparency: 70 },
  });
  slide.addText('DECISIONS', {
    x: M + 0.3, y: 3.6, w: 5.4, h: 0.3,
    fontFace: FONT, fontSize: 10, bold: true, charSpacing: 4,
    color: 'FFFFFF', valign: 'top',
  });
  slide.addText('Three calls only the founders can make.', {
    x: M + 0.3, y: 3.95, w: 5.4, h: 0.5,
    fontFace: FONT, fontSize: 17, bold: true,
    color: 'FFFFFF', valign: 'top',
  });
  slide.addText(
    [
      { text: 'Approve pricing tiers (₹1.5K / ₹3K / Custom) as default.', options: { bullet: { code: '2713' } } },
      { text: 'Approve Pro as the anchor — discounting only for design partners.', options: { bullet: { code: '2713' } } },
      { text: 'Confirm India-first beachhead; US engagement only via warm intros until Month 9.', options: { bullet: { code: '2713' } } },
    ],
    {
      x: M + 0.45, y: 4.55, w: 5.3, h: 2.1,
      fontFace: FONT, fontSize: 12,
      color: 'FFFFFF', valign: 'top', paraSpaceAfter: 8,
    }
  );

  // Intros card
  slide.addShape(pres.ShapeType.roundRect, {
    x: M + 6.3, y: 3.4, w: 6.0, h: 3.4, rectRadius: 0.14,
    fill: { color: 'FFFFFF', transparency: 90 },
    line: { color: 'FFFFFF', width: 1, transparency: 70 },
  });
  slide.addText('INTROS', {
    x: M + 6.6, y: 3.6, w: 5.4, h: 0.3,
    fontFace: FONT, fontSize: 10, bold: true, charSpacing: 4,
    color: 'FFFFFF', valign: 'top',
  });
  slide.addText('Warm doors only founders can open.', {
    x: M + 6.6, y: 3.95, w: 5.4, h: 0.5,
    fontFace: FONT, fontSize: 17, bold: true,
    color: 'FFFFFF', valign: 'top',
  });
  slide.addText(
    [
      { text: '5 agency founders in your network for design-partner conversations this month.', options: { bullet: { code: '2192' } } },
      { text: '2 ex-Naukri / ex-Quess / ex-Randstad leaders as advisors or angels.', options: { bullet: { code: '2192' } } },
      { text: '1 LinkedIn-influencer recruiter to amplify thought-leadership posts.', options: { bullet: { code: '2192' } } },
    ],
    {
      x: M + 6.75, y: 4.55, w: 5.3, h: 2.1,
      fontFace: FONT, fontSize: 12,
      color: 'FFFFFF', valign: 'top', paraSpaceAfter: 8,
    }
  );

  // Closing line
  slide.addShape(pres.ShapeType.rect, {
    x: M, y: 7.0, w: 0.06, h: 0.45,
    fill: { color: 'FFFFFF' }, line: { type: 'none' },
  });
  slide.addText(
    'Give us these six things and we hand back: 10 design partners, 3 case studies, and ₹25–40L committed ARR in 90 days.',
    {
      x: M + 0.15, y: 7.0, w: 12, h: 0.45,
      fontFace: FONT, fontSize: 13, italic: true, bold: true,
      color: 'FFFFFF', valign: 'middle',
    }
  );

  addFooter(slide, 12, t);
}

// ============================================================================
// SLIDE 13 — CLOSING
// ============================================================================
{
  const { slide, t } = newSlide('navy');

  // Decorative gradient blobs
  slide.addShape(pres.ShapeType.ellipse, {
    x: -2, y: 4, w: 6, h: 6,
    fill: { color: C.brand, transparency: 92 },
    line: { type: 'none' },
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: 9, y: -2, w: 7, h: 7,
    fill: { color: C.accent, transparency: 92 },
    line: { type: 'none' },
  });

  slide.addImage({ path: LOGO, x: W / 2 - 0.5, y: 1.2, w: 1.0, h: 1.0 });

  slide.addText(
    [
      { text: 'Zeople ',     options: { fontFace: FONT, fontSize: 44, bold: true, color: 'FFFFFF', charSpacing: -1.5 } },
      { text: 'RecruiterOS', options: { fontFace: FONT, fontSize: 44, bold: true, color: C.accent, charSpacing: -1.5 } },
    ],
    { x: 1, y: 2.5, w: W - 2, h: 0.9, valign: 'top', align: 'center' }
  );

  slide.addText('Win the call. Save the offer. Own the agency OS.', {
    x: 1, y: 3.6, w: W - 2, h: 1.0,
    fontFace: FONT, fontSize: 32, bold: true,
    color: 'FFFFFF', align: 'center', valign: 'top', charSpacing: -0.5,
  });

  slide.addText('We have the product. We have the IP. Now we go win the market.', {
    x: 1, y: 4.8, w: W - 2, h: 0.6,
    fontFace: FONT, fontSize: 18,
    color: '94A3B8', align: 'center', valign: 'top',
  });

  slide.addShape(pres.ShapeType.rect, {
    x: W / 2 - 0.6, y: 5.7, w: 1.2, h: 0.04,
    fill: { color: C.accent }, line: { type: 'none' },
  });

  slide.addText('THE AI CO-PILOT FOR RECRUITING AGENCIES', {
    x: 1, y: 5.9, w: W - 2, h: 0.4,
    fontFace: FONT, fontSize: 11, bold: true, charSpacing: 4,
    color: '94A3B8', align: 'center', valign: 'top',
  });

  addFooter(slide, 13, t);
}

// ============================================================================
pres.writeFile({ fileName: OUT })
  .then((p) => console.log(`[generate-gtm-pptx] Wrote ${p}`))
  .catch((err) => { console.error('[generate-gtm-pptx] Failed:', err); process.exit(1); });
