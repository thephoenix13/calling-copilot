// Generate the Zeople RecruiterOS Go-To-Market document as a native .docx.
// Usage: node scripts/generate-gtm-docx.js
//
// Branded with the same palette as the web app and the overview deck:
// brand pink #E8335A, accent orange #F97316, navy #1A2B4A.

const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageBreak,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  TabStopType,
  TabStopPosition,
  LevelFormat,
  convertInchesToTwip,
} = require('docx');

const C = {
  brand:    'E8335A',
  brandDeep:'C71F45',
  brandSoft:'FCE4EB',
  accent:   'F97316',
  accentSoft:'FFEDDB',
  navy:     '1A2B4A',
  navyDeep: '0F1E35',
  bgSoft:   'FAFBFD',
  border:   'E4E8EE',
  text1:    '0F172A',
  text2:    '475569',
  text3:    '94A3B8',
  white:    'FFFFFF',
};

const FONT = 'Calibri';
const LOGO_PATH = path.resolve(__dirname, '..', 'docs', 'product', 'zeople-logo.png');
const OUT = path.resolve(__dirname, '..', 'docs', 'gtm', 'Zeople-GTM-Strategy.docx');

const logoBytes = fs.readFileSync(LOGO_PATH);

// ============================================================================
// Helpers
// ============================================================================
function text(content, opts = {}) {
  return new TextRun({
    text: content,
    font: FONT,
    size: opts.size || 22,
    bold: opts.bold || false,
    italic: opts.italic || false,
    color: opts.color || C.text1,
    break: opts.break || 0,
  });
}

function para(children, opts = {}) {
  const runs = Array.isArray(children)
    ? children.map((c) => (typeof c === 'string' ? text(c, opts) : c))
    : [typeof children === 'string' ? text(children, opts) : children];
  return new Paragraph({
    children: runs,
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: opts.line || 320 },
    indent: opts.indent,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    border: opts.border,
  });
}

function h1(label) {
  return new Paragraph({
    children: [new TextRun({ text: label, font: FONT, size: 48, bold: true, color: C.text1 })],
    spacing: { before: 360, after: 160, line: 320 },
    heading: HeadingLevel.HEADING_1,
    border: { bottom: { color: C.brand, size: 18, space: 4, style: BorderStyle.SINGLE } },
  });
}

function h2(label) {
  return new Paragraph({
    children: [new TextRun({ text: label, font: FONT, size: 30, bold: true, color: C.navy })],
    spacing: { before: 280, after: 120, line: 320 },
    heading: HeadingLevel.HEADING_2,
  });
}

function h3(label) {
  return new Paragraph({
    children: [new TextRun({ text: label, font: FONT, size: 24, bold: true, color: C.brand })],
    spacing: { before: 200, after: 80, line: 320 },
    heading: HeadingLevel.HEADING_3,
  });
}

function eyebrow(label) {
  return new Paragraph({
    children: [new TextRun({ text: label.toUpperCase(), font: FONT, size: 16, bold: true, color: C.accent, characterSpacing: 60 })],
    spacing: { before: 200, after: 40, line: 240 },
  });
}

function bullet(content, opts = {}) {
  const runs = Array.isArray(content) ? content : [text(content, opts)];
  return new Paragraph({
    children: runs.map((r) => (typeof r === 'string' ? text(r, opts) : r)),
    bullet: { level: opts.level || 0 },
    spacing: { before: 40, after: 40, line: 300 },
  });
}

function calloutBlock(title, body, color = C.brand) {
  return [
    new Paragraph({
      children: [new TextRun({ text: title, font: FONT, size: 22, bold: true, color: C.white })],
      spacing: { before: 200, after: 0, line: 280 },
      shading: { type: ShadingType.CLEAR, fill: color, color: 'auto' },
      indent: { left: 200, right: 200 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: color },
        bottom: { style: BorderStyle.NIL },
        left: { style: BorderStyle.SINGLE, size: 4, color: color },
        right: { style: BorderStyle.SINGLE, size: 4, color: color },
      },
    }),
    new Paragraph({
      children: [new TextRun({ text: body, font: FONT, size: 20, color: C.text1 })],
      spacing: { before: 60, after: 200, line: 300 },
      shading: { type: ShadingType.CLEAR, fill: C.bgSoft, color: 'auto' },
      indent: { left: 200, right: 200 },
      border: {
        top: { style: BorderStyle.NIL },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: color },
        left: { style: BorderStyle.SINGLE, size: 4, color: color },
        right: { style: BorderStyle.SINGLE, size: 4, color: color },
      },
    }),
  ];
}

function tableCell(content, opts = {}) {
  const runs = Array.isArray(content) ? content : [content];
  return new TableCell({
    children: [
      new Paragraph({
        children: runs.map((r) => {
          if (typeof r === 'string') {
            return new TextRun({
              text: r,
              font: FONT,
              size: opts.size || 18,
              bold: opts.bold || false,
              color: opts.color || C.text1,
            });
          }
          return r;
        }),
        alignment: opts.align || AlignmentType.LEFT,
        spacing: { before: 60, after: 60, line: 280 },
      }),
    ],
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: 'center',
  });
}

function headerCell(label, width) {
  return tableCell(label, { fill: C.navy, color: C.white, bold: true, width });
}

function thinBorders(color = C.border) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

// ============================================================================
// Header (every page) — logo + wordmark + section label
// ============================================================================
const pageHeader = new Header({
  children: [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new ImageRun({ data: logoBytes, transformation: { width: 22, height: 22 } }),
        new TextRun({ text: '  Zeople ', font: FONT, size: 18, bold: true, color: C.text1 }),
        new TextRun({ text: 'RecruiterOS', font: FONT, size: 18, bold: true, color: C.accent }),
        new TextRun({ text: '\tGO-TO-MARKET STRATEGY', font: FONT, size: 14, bold: true, color: C.text3, characterSpacing: 60 }),
      ],
      spacing: { after: 40 },
      border: { bottom: { color: C.border, size: 6, space: 4, style: BorderStyle.SINGLE } },
    }),
  ],
});

const pageFooter = new Footer({
  children: [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: 'ZEOPLE CORP  ·  FOUNDING TEAM REVIEW  ·  MAY 2026', font: FONT, size: 14, bold: true, color: C.text3, characterSpacing: 60 }),
        new TextRun({ text: '\t', font: FONT, size: 14 }),
        new TextRun({ children: ['Page ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], font: FONT, size: 14, bold: true, color: C.text3 }),
      ],
    }),
  ],
});

// ============================================================================
// COVER
// ============================================================================
const cover = [
  new Paragraph({
    children: [new ImageRun({ data: logoBytes, transformation: { width: 72, height: 72 } })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 1200, after: 200 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: 'Zeople ', font: FONT, size: 80, bold: true, color: C.navy }),
      new TextRun({ text: 'RecruiterOS', font: FONT, size: 80, bold: true, color: C.accent }),
    ],
    spacing: { before: 100, after: 100, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Go-To-Market Strategy', font: FONT, size: 56, bold: true, color: C.text1 })],
    spacing: { before: 80, after: 160, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({
      text: 'How Zeople wins the recruiting-agency market — wedge, ICP, motion, and the first 90 days.',
      font: FONT, size: 26, color: C.text2,
    })],
    spacing: { before: 80, after: 240, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: '', font: FONT, size: 14 })],
    border: { bottom: { color: C.accent, size: 24, space: 4, style: BorderStyle.SINGLE } },
    spacing: { after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'PREPARED FOR  ·  ZEOPLE FOUNDING TEAM', font: FONT, size: 16, bold: true, color: C.text2, characterSpacing: 80 })],
    spacing: { before: 80, after: 40, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'PREPARED BY  ·  PRODUCT & GTM', font: FONT, size: 16, bold: true, color: C.text2, characterSpacing: 80 })],
    spacing: { before: 40, after: 40, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'DATE  ·  MAY 2026', font: FONT, size: 16, bold: true, color: C.text2, characterSpacing: 80 })],
    spacing: { before: 40, after: 40, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'STATUS  ·  CONFIDENTIAL  ·  INTERNAL', font: FONT, size: 16, bold: true, color: C.brand, characterSpacing: 80 })],
    spacing: { before: 40, after: 800, line: 320 },
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ============================================================================
// SECTION 1 — EXECUTIVE SUMMARY
// ============================================================================
const section1 = [
  eyebrow('1 · Executive Summary'),
  h1('Where we are, and what comes next'),
  para([
    text('Zeople has built a production-grade AI Co-Pilot for recruiting agencies. ', { color: C.text1 }),
    text('Calling CoPilot is live, the LRM™ provisional patent is filed, and the broader RecruiterOS surface — pipeline sessions, JD enhancer, MCQ/coding/video assessments, market intelligence, and Post-Offer Follow-Up — runs in production. ', { color: C.text1 }),
    text('What is missing is distribution: a defined ICP, a repeatable sales motion, public pricing, and the first ten reference customers.', { color: C.text1, bold: true }),
  ]),
  para([
    text('This document is the operating GTM plan for the next ninety days and the eighteen months that follow. The central thesis: ', { color: C.text1 }),
    text('lead with Calling CoPilot into mid-market India tech-staffing agencies, land the seat with the patented pillar, expand into POFU and the broader operating system, then take the validated playbook global.', { color: C.brand, bold: true }),
  ]),
  ...calloutBlock(
    'The 90-day commitment',
    '10 paying or pilot design partners. 3 referenceable case studies. ₹25–40L of committed annual recurring revenue. A repeatable demo, a tested pricing anchor, and the first outbound playbook in the hands of one SDR.',
    C.brand
  ),
  para([text('The asks from the founding team — three decisions and three intros — are listed in §10 of this document.', { color: C.text2, italic: true })]),
];

// ============================================================================
// SECTION 2 — STRATEGIC FRAME
// ============================================================================
const section2 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('2 · Strategic Frame'),
  h1('Product exists. IP is filed. Distribution is the gap.'),
  para([text('Three independent realities define what GTM has to solve.', { color: C.text2 })]),

  h3('Product · Calling CoPilot is shipped'),
  para([
    text('Live transcription on every recruiter call, in-call AI guidance, post-call structured candidate evaluation, recruiter scoring, and a coaching loop — already in production behind authentication, with Twilio voice, Deepgram transcription, and Claude reasoning. The full RecruiterOS surface is ', { color: C.text1 }),
    text('not a roadmap promise — it is functioning software our team uses every day.', { color: C.text1, bold: true }),
  ]),

  h3('IP · LRM™ provisional filed'),
  para([
    text('A provisional patent application has been filed on the ', { color: C.text1 }),
    text('Large Recruitment Model (LRM™) ', { color: C.text1, bold: true }),
    text('approach — an AI-augmented human recruitment intelligence system for real-time candidate screening and continuous recruiter skill intelligence. POFU and Market Intelligence have separate provisional filings in pipeline.', { color: C.text1 }),
  ]),

  h3('Gap · No distribution machine yet'),
  para([
    text('We do not have a written ICP, public pricing, an outbound playbook, or referenceable logos. ', { color: C.text1 }),
    text('Every other constraint — product, IP, technical depth — has been solved. Distribution is now the binding one. This document closes it.', { color: C.text1, bold: true }),
  ]),
];

// ============================================================================
// SECTION 3 — MARKET OPPORTUNITY
// ============================================================================
const opportunityTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: thinBorders(),
  rows: [
    new TableRow({
      children: [
        headerCell('SEGMENT', 30),
        headerCell('SIZE / SIGNAL', 30),
        headerCell('WHY IT MATTERS NOW', 40),
      ],
    }),
    new TableRow({
      children: [
        tableCell('India recruiting & staffing agencies', { bold: true }),
        tableCell('15,000+ active agencies'),
        tableCell('High call volume, high drop rates, fastest experimentation loop. The beachhead.'),
      ],
    }),
    new TableRow({
      children: [
        tableCell('India placement-fee market', { bold: true, fill: C.bgSoft }),
        tableCell('~₹40,000 Cr annual revenue pool', { fill: C.bgSoft }),
        tableCell('A 1% capture is a ₹400 Cr ARR opportunity — and we sell to the agency, not the placement.', { fill: C.bgSoft }),
      ],
    }),
    new TableRow({
      children: [
        tableCell('Global agency recruiting TAM', { bold: true }),
        tableCell('$200B+ (SIA)'),
        tableCell('US/UK ACVs are 5–8× India. Phase 3 expansion once playbook is proven at home.'),
      ],
    }),
  ],
});

const section3 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('3 · Market Opportunity'),
  h1('India first, global next — the beachhead is clear'),
  para([
    text('Indian agencies have three properties that make them the right first market: ', { color: C.text1 }),
    text('(1) high call volume, (2) high post-offer drop rates that make POFU obviously valuable, and (3) shorter sales cycles with founder-to-founder buying.', { color: C.text1, bold: true }),
    text(' Once we have the playbook here, the same product commands a 5–8× ACV in the US and UK with minimal product change.', { color: C.text1 }),
  ]),
  opportunityTable,
  para([
    text('Beachhead logic: ', { color: C.brand, bold: true }),
    text('we are not trying to win the world. We are trying to win 30 agencies in Bangalore, Pune, Hyderabad, NCR, and Mumbai. Every other geographic expansion is downstream of that.', { color: C.text2 }),
  ]),
];

// ============================================================================
// SECTION 4 — ICP
// ============================================================================
const icpTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: thinBorders(),
  rows: [
    new TableRow({
      children: [
        headerCell('ATTRIBUTE', 25),
        headerCell('IDEAL', 38),
        headerCell('WHY', 37),
      ],
    }),
    new TableRow({ children: [
      tableCell('Recruiter headcount', { bold: true }),
      tableCell('20–150 active recruiters'),
      tableCell('Big enough for meaningful ACV. Small enough that founders still buy.'),
    ]}),
    new TableRow({ children: [
      tableCell('Verticals served', { bold: true, fill: C.bgSoft }),
      tableCell('Tech, GCC, IT services, BFSI', { fill: C.bgSoft }),
      tableCell('Highest call volume and worst drop rates → strongest pain.', { fill: C.bgSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('Annual revenue', { bold: true }),
      tableCell('₹5–50 Cr placement revenue'),
      tableCell('Sweet spot for our Pro tier ACV.'),
    ]}),
    new TableRow({ children: [
      tableCell('Buying committee', { bold: true, fill: C.bgSoft }),
      tableCell('Founder + Delivery Head', { fill: C.bgSoft }),
      tableCell('Two-person committee. No procurement. Closes in 2–4 weeks.', { fill: C.bgSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('Tech stack today', { bold: true }),
      tableCell('Zoho Recruit / Naukri RMS / spreadsheets'),
      tableCell('No AI in the workflow. Demo lands as a leap, not a feature.'),
    ]}),
    new TableRow({ children: [
      tableCell('Geography (Phase 1)', { bold: true, fill: C.bgSoft }),
      tableCell('Bangalore, Pune, Hyderabad, NCR, Mumbai', { fill: C.bgSoft }),
      tableCell('Highest density of ICP accounts. Founders can fly in for onboarding.', { fill: C.bgSoft }),
    ]}),
  ],
});

const section4 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('4 · Ideal Customer Profile'),
  h1('Mid-market India tech-staffing agencies'),
  para([
    text('The ICP is deliberately narrow. ', { color: C.text1 }),
    text('A narrow ICP wins more than a broad one because the demo, the pricing, the case study, and the outbound message all align on the same persona.', { color: C.text1, bold: true }),
  ]),
  icpTable,

  h3('Out of scope — for now'),
  para([text('We turn down well-fitting buyers here on purpose, to preserve focus.', { color: C.text2 })]),
  bullet('In-house TA teams — different workflow, different buyer, different ATS landscape.'),
  bullet('Sub-10-recruiter agencies — ACV too small to support our cost of sale.'),
  bullet('Pure RPO operators — their margin model fights our SaaS model.'),
  bullet('Blue-collar and BPO hiring — Phase 2 segment, not Phase 1.'),
  bullet('US / UK agencies — Phase 2 (10× ACV but 6× sales cycle, needs reference logos first).'),
];

// ============================================================================
// SECTION 5 — THE WEDGE
// ============================================================================
const section5 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('5 · The Wedge'),
  h1('Lead with Calling CoPilot. Expand into the OS.'),
  para([
    text('We have a product surface that could be sold five different ways. We will sell it one way: ', { color: C.text1 }),
    text('Calling CoPilot first, POFU second, the rest of RecruiterOS third.', { color: C.brand, bold: true }),
  ]),

  h3('Why Calling CoPilot leads'),
  bullet([
    text('Shortest demo. ', { bold: true, color: C.text1 }),
    text('A 5-minute live call replay creates immediate emotional impact — the buyer hears their own recruiter being scored in real time.', { color: C.text1 }),
  ]),
  bullet([
    text('Defensible. ', { bold: true, color: C.text1 }),
    text('LRM™ provisional patent makes the underlying approach hard to copy.', { color: C.text1 }),
  ]),
  bullet([
    text('Solo-feature value. ', { bold: true, color: C.text1 }),
    text('It produces ROI even if the buyer never uses anything else, which removes adoption risk.', { color: C.text1 }),
  ]),
  bullet([
    text('Recruiter-first, not founder-first. ', { bold: true, color: C.text1 }),
    text('Floor recruiters become advocates within 7 days. That kills churn.', { color: C.text1 }),
  ]),

  h3('Then expand into POFU'),
  para([
    text('Once Calling CoPilot is live in an account, the same buyer (Delivery Head + Founder) sees the bottom-of-funnel leakage — ', { color: C.text1 }),
    text('30–50% of accepted offers never become Day-1 joins. ', { color: C.text1, bold: true }),
    text('POFU is the natural cross-sell: same buyer, second pain, sticky usage that touches every offer the agency makes.', { color: C.text1 }),
  ]),

  h3('Then lock with the operating system'),
  para([
    text('Pipeline Sessions, JD Enhancer, MCQ/Coding/Video assessments, Market Intelligence, and the Hiring Manager workspace turn Zeople into the agency operating system — at which point the ATS becomes the part the customer wants to remove, not us.', { color: C.text1 }),
  ]),
];

// ============================================================================
// SECTION 6 — POSITIONING
// ============================================================================
const positioningTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: thinBorders(),
  rows: [
    new TableRow({ children: [
      headerCell('CATEGORY', 18),
      headerCell('EXAMPLES', 22),
      headerCell('WHY THEY LOSE TO US', 35),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'ZEOPLE EDGE', font: FONT, size: 18, bold: true, color: C.white })], alignment: AlignmentType.LEFT })],
        shading: { type: ShadingType.CLEAR, fill: C.brand, color: 'auto' },
        verticalAlign: 'center',
        width: { size: 25, type: WidthType.PERCENTAGE },
      }),
    ]}),
    new TableRow({ children: [
      tableCell('Agency ATS', { bold: true }),
      tableCell('Bullhorn, Zoho Recruit'),
      tableCell('No AI on calls. No offer protection. Dated UX.'),
      tableCell('Zeople sits above and replaces over time.', { color: C.brand, bold: true }),
    ]}),
    new TableRow({ children: [
      tableCell('Sales Call AI', { bold: true, fill: C.bgSoft }),
      tableCell('Gong, Wingman, Sybill', { fill: C.bgSoft }),
      tableCell('Built for SDR/AE workflows. No candidate evaluation primitives.', { fill: C.bgSoft }),
      tableCell('Wrong category. The demo kills them in sixty seconds.', { color: C.brand, bold: true, fill: C.bgSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('Recruiting Call AI', { bold: true }),
      tableCell('Metaview, BrightHire'),
      tableCell('In-house TA focus. Standalone tool. No POFU. No agency workflow.'),
      tableCell('Zeople is the agency-native version of the same idea.', { color: C.brand, bold: true }),
    ]}),
    new TableRow({ children: [
      tableCell('Engagement / Drip', { bold: true, fill: C.bgSoft }),
      tableCell('Sense, GoodTime', { fill: C.bgSoft }),
      tableCell('Generic nurture. No drop-risk model. No post-offer state engine.', { fill: C.bgSoft }),
      tableCell('POFU is purpose-built for the gap they leave.', { color: C.brand, bold: true, fill: C.bgSoft }),
    ]}),
  ],
});

const section6 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('6 · Positioning'),
  h1('The only AI built for the agency revenue equation'),
  ...calloutBlock(
    'One-line positioning',
    'Zeople is the AI Co-Pilot for recruiting agencies — protecting revenue from the first recruiter call to the candidate\'s first day on the job.',
    C.brand
  ),
  para([
    text('Every competitor was built for someone else: ATSes for in-house TA, call-AI for sales, engagement for marketers. None of them optimize for the agency revenue equation, which is the single number our buyer cares about: ', { color: C.text1 }),
    text('placements that result in Day-1 joins.', { color: C.brand, bold: true }),
  ]),
  positioningTable,
  para([
    text('In conversation, we lead with a question, not a feature: ', { color: C.text2 }),
    text('"How many of last quarter\'s offers actually joined on Day 1?" ', { color: C.text1, bold: true, italic: true }),
    text('Most founders cannot answer it from their ATS. That moment is the wedge.', { color: C.text2 }),
  ]),
];

// ============================================================================
// SECTION 7 — PRICING & PACKAGING
// ============================================================================
const pricingTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: thinBorders(),
  rows: [
    new TableRow({ children: [
      headerCell('TIER', 18),
      headerCell('TARGET', 28),
      headerCell('INDIA PRICE', 18),
      headerCell('GLOBAL', 16),
      headerCell('CORE INCLUSIONS', 20),
    ]}),
    new TableRow({ children: [
      tableCell('Starter', { bold: true, color: C.navy }),
      tableCell('Sub-25 recruiter agencies'),
      tableCell('₹1,499 / recruiter / mo', { bold: true }),
      tableCell('$59 / seat / mo'),
      tableCell('CoPilot (300 calls/mo), Candidates, Jobs, JD Enhancer, Reports'),
    ]}),
    new TableRow({ children: [
      tableCell('Pro', { bold: true, color: C.brand, fill: C.brandSoft }),
      tableCell('Our ICP — 25–100 recruiters', { fill: C.brandSoft }),
      tableCell('₹2,999 / recruiter / mo', { bold: true, fill: C.brandSoft }),
      tableCell('$99 / seat / mo', { fill: C.brandSoft }),
      tableCell('Everything in Starter + unlimited calls, Recruiter QA, Pipeline Sessions, Assessments, POFU', { fill: C.brandSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('Scale', { bold: true, color: C.accent }),
      tableCell('100+ recruiters / multi-office'),
      tableCell('Custom', { bold: true }),
      tableCell('Custom'),
      tableCell('Everything in Pro + Market Intelligence, HM workspace, SSO, audit, dedicated CSM'),
    ]}),
  ],
});

const section7 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('7 · Pricing & Packaging'),
  h1('Per-recruiter SaaS, with Pro as the anchor'),
  para([
    text('Three tiers. ', { color: C.text1 }),
    text('Pro is priced to be the default. Starter exists to disqualify hagglers — not to make money. Scale exists to expand the top of the book.', { color: C.text1, bold: true }),
  ]),
  pricingTable,

  h3('Pricing principles'),
  bullet([
    text('Pro is the anchor. ', { bold: true }),
    text('Every demo, deck, and outbound email defaults to Pro pricing. Starter is mentioned only on request.', {}),
  ]),
  bullet([
    text('No discounting outside design partners. ', { bold: true }),
    text('Discount erodes the anchor. Design-partner pricing is documented as a finite-time pilot, not a discount.', {}),
  ]),
  bullet([
    text('Annual billing default. ', { bold: true }),
    text('Quarterly available with a 10% surcharge. Monthly only for Starter.', {}),
  ]),
  bullet([
    text('Usage uplift on volume. ', { bold: true }),
    text('Pro is unlimited calls below 1,000/recruiter/mo; above that triggers an enterprise conversation.', {}),
  ]),
];

// ============================================================================
// SECTION 8 — GO-TO-MARKET MOTION
// ============================================================================
const section8 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('8 · Go-To-Market Motion'),
  h1('Founder-led. Then outbound. Then channel.'),
  para([
    text('The motion evolves in three phases. Each phase exists to earn the right to the next.', { color: C.text1 }),
  ]),

  ...calloutBlock(
    'Phase 1  ·  Now → Month 3  ·  Founder-led design partners',
    '10 hand-picked agencies, sold by the founders, onboarded white-glove. Free or deeply discounted. Goal: produce 10 case studies, 5 referenceable logos, and a refined product-market fit before any non-founder seller is hired.',
    C.brand
  ),
  ...calloutBlock(
    'Phase 2  ·  Month 3 → 9  ·  Outbound SDR + content',
    'Hire 2 SDRs in Bangalore/Mumbai. Outbound LinkedIn + email to named ICP delivery heads. Founders still close. Anuraag, Divakar and Minnakshi publish weekly recruiting-AI POV content. KPI: ₹2 Cr ARR and 30 paying logos by end of Phase 2.',
    C.accent
  ),
  ...calloutBlock(
    'Phase 3  ·  Month 9 → 18  ·  Channel + global expansion',
    'Partner with industry bodies (ERA, NHRDN), ATS integrators, and ex-Naukri/Quess/Randstad influencers. Open a US beachhead through India-founded US agencies. KPI: ₹15 Cr ARR and US v1 pilots live.',
    C.navy
  ),

  h3('Why this order'),
  para([
    text('We have a product but not yet public proof. ', { color: C.text1 }),
    text('Design partners produce proof. Proof unlocks outbound. Outbound earns the right to channel.', { color: C.text1, bold: true }),
    text(' Trying to skip a phase — outbound before proof, channel before motion — is the most common reason early SaaS GTM fails.', { color: C.text1 }),
  ]),
];

// ============================================================================
// SECTION 9 — ACQUISITION CHANNELS
// ============================================================================
const channelsTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: thinBorders(),
  rows: [
    new TableRow({ children: [
      headerCell('RANK', 8),
      headerCell('CHANNEL', 22),
      headerCell('WHY IT WORKS NOW', 50),
      headerCell('WHEN IT LIGHTS UP', 20),
    ]}),
    new TableRow({ children: [
      tableCell('1', { bold: true, color: C.brand, align: AlignmentType.CENTER, size: 24 }),
      tableCell('Founder network', { bold: true }),
      tableCell('Direct intros from Anuraag, Divakar, and Minnakshi into 30+ agency founders and delivery heads. Highest conversion. Zero CAC.'),
      tableCell('Now', { color: C.brand, bold: true }),
    ]}),
    new TableRow({ children: [
      tableCell('2', { bold: true, color: C.accent, align: AlignmentType.CENTER, size: 24, fill: C.bgSoft }),
      tableCell('Targeted outbound', { bold: true, fill: C.bgSoft }),
      tableCell('LinkedIn + email sequences to delivery heads at named ICP accounts. Demo-led, recruiter-mentor tone (not SaaS pitch).', { fill: C.bgSoft }),
      tableCell('Month 2+', { color: C.accent, bold: true, fill: C.bgSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('3', { bold: true, color: C.navy, align: AlignmentType.CENTER, size: 24 }),
      tableCell('Thought leadership', { bold: true }),
      tableCell('Weekly bylined posts: "What we learned listening to ten thousand recruiter calls." Founders as the voice. Recruiting-AI POV, not product pitch.'),
      tableCell('Month 1+', { color: C.navy, bold: true }),
    ]}),
    new TableRow({ children: [
      tableCell('4', { bold: true, color: C.navy, align: AlignmentType.CENTER, size: 24, fill: C.bgSoft }),
      tableCell('Customer referrals', { bold: true, fill: C.bgSoft }),
      tableCell('Once 10 logos live, formalize referral fee (one month free per referral that converts). Agency owners talk to each other.', { fill: C.bgSoft }),
      tableCell('Month 4+', { color: C.navy, bold: true, fill: C.bgSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('5', { bold: true, color: C.text3, align: AlignmentType.CENTER, size: 24 }),
      tableCell('Industry partnerships', { bold: true }),
      tableCell('ERA, NHRDN, recruiting podcasts, ATS marketplaces. Slow burn, compounds in Phase 3.'),
      tableCell('Month 9+', { color: C.text3, bold: true }),
    ]}),
  ],
});

const section9 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('9 · Acquisition Channels'),
  h1('Five channels — ranked by believability'),
  para([
    text('Channels are ranked by what is believable at our stage, not by what will be biggest at scale. ', { color: C.text1 }),
    text('Founder network produces the first 10 logos. Everything else is downstream.', { color: C.text1, bold: true }),
  ]),
  channelsTable,
];

// ============================================================================
// SECTION 10 — 90-DAY PLAN
// ============================================================================
const planTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: thinBorders(),
  rows: [
    new TableRow({ children: [
      headerCell('PHASE', 18),
      headerCell('THEME', 22),
      headerCell('KEY ACTIONS', 45),
      headerCell('EXIT CRITERIA', 15),
    ]}),
    new TableRow({ children: [
      tableCell('Days 1–30', { bold: true, color: C.brand }),
      tableCell('Foundations', { bold: true }),
      tableCell('Lock ICP, messaging, pricing. Build 10-slide demo flow + 2-min product video. Set up HubSpot CRM + pipeline. Identify 30 design-partner targets. 30 founder conversations → 15 demos.'),
      tableCell('15 demos delivered'),
    ]}),
    new TableRow({ children: [
      tableCell('Days 31–60', { bold: true, color: C.accent, fill: C.bgSoft }),
      tableCell('Design Partners', { bold: true, fill: C.bgSoft }),
      tableCell('Onboard 5 paying or pilot partners. Ship 3 product fixes from real usage. Publish first 4 thought-leadership posts. Draft Pro-tier contract template. Hire SDR #1.', { fill: C.bgSoft }),
      tableCell('5 live accounts', { fill: C.bgSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('Days 61–90', { bold: true, color: C.navy }),
      tableCell('Repeatable Motion', { bold: true }),
      tableCell('Reach 10 live design partners. Publish first 3 case studies. Outbound machine producing 5 SQLs/week. Ship POFU v1 enhancements from partner asks. Founding-team review to green-light Phase 2 spend.'),
      tableCell('10 live + 3 cases'),
    ]}),
  ],
});

const section10 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('10 · 90-Day Plan'),
  h1('The next 90 days are about proof, not scale'),
  para([
    text('We do not need to be big in 90 days. We need to be ', { color: C.text1 }),
    text('undeniable.', { color: C.brand, bold: true, italic: true }),
    text(' Ten live design partners, three case studies, and one outbound playbook is enough to earn the right to spend on Phase 2.', { color: C.text1 }),
  ]),
  planTable,
  ...calloutBlock(
    'Day-90 success metric (single number)',
    '10 live design partners. 3 referenceable case studies published. ₹25–40L of committed annual recurring revenue. If we hit this, we green-light Phase 2 hiring. If we miss, we extend Phase 1 by 60 days before scaling.',
    C.brand
  ),
];

// ============================================================================
// SECTION 11 — METRICS
// ============================================================================
const metricsTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: thinBorders(),
  rows: [
    new TableRow({ children: [
      headerCell('METRIC', 22),
      headerCell('DEFINITION', 38),
      headerCell('MONTH 3', 13),
      headerCell('MONTH 9', 13),
      headerCell('MONTH 18', 14),
    ]}),
    new TableRow({ children: [
      tableCell('Committed ARR', { bold: true }),
      tableCell('Annualized contracted recurring revenue, paid or invoiced'),
      tableCell('₹25–40L', { bold: true, color: C.brand }),
      tableCell('₹2 Cr', { bold: true, color: C.brand }),
      tableCell('₹15 Cr', { bold: true, color: C.brand }),
    ]}),
    new TableRow({ children: [
      tableCell('Paying agency logos', { bold: true, fill: C.bgSoft }),
      tableCell('Counted only when invoice paid', { fill: C.bgSoft }),
      tableCell('10', { bold: true, color: C.accent, fill: C.bgSoft }),
      tableCell('30', { bold: true, color: C.accent, fill: C.bgSoft }),
      tableCell('120', { bold: true, color: C.accent, fill: C.bgSoft }),
    ]}),
    new TableRow({ children: [
      tableCell('Call activation %', { bold: true }),
      tableCell('% of recruiter calls running through CoPilot inside an account'),
      tableCell('40%', { bold: true }),
      tableCell('60%', { bold: true }),
      tableCell('80%', { bold: true }),
    ]}),
    new TableRow({ children: [
      tableCell('Net Revenue Retention', { bold: true, fill: C.bgSoft }),
      tableCell('Expansion + contraction + churn, by cohort', { fill: C.bgSoft }),
      tableCell('—', { fill: C.bgSoft }),
      tableCell('120%', { bold: true, color: C.brand, fill: C.bgSoft }),
      tableCell('130%+', { bold: true, color: C.brand, fill: C.bgSoft }),
    ]}),
  ],
});

const section11 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('11 · Metrics That Matter'),
  h1('Four numbers on the founders\' dashboard'),
  para([
    text('We track many metrics. We are paid by four: ', { color: C.text1 }),
    text('Committed ARR, Paying Logos, Call Activation %, and Net Revenue Retention.', { color: C.brand, bold: true }),
    text(' Everything else is a leading indicator.', { color: C.text1 }),
  ]),
  metricsTable,

  h3('Leading indicators (watched weekly)'),
  bullet([text('Demos booked per week', { bold: true })]),
  bullet([text('Demo → pilot conversion rate', { bold: true })]),
  bullet([text('Pilot → paid conversion rate', { bold: true })]),
  bullet([text('Time-to-first-call inside an account', { bold: true }), text(' (activation health)', {})]),
  bullet([text('CSAT from Delivery Heads', { bold: true }), text(' (expansion + retention proxy)', {})]),
];

// ============================================================================
// SECTION 12 — FOUNDING-TEAM ASKS
// ============================================================================
const section12 = [
  new Paragraph({ children: [new PageBreak()] }),
  eyebrow('12 · Asks from the Founding Team'),
  h1('Three decisions and three intros'),
  para([
    text('Everything in this plan is executable by the GTM team — except six things only the founders can do. ', { color: C.text1 }),
    text('Confirming these unblocks every other workstream.', { color: C.text1, bold: true }),
  ]),

  h3('Decisions (this week)'),
  bullet([
    text('Approve pricing tiers ', { bold: true }),
    text('(₹1,499 / ₹2,999 / Custom) as the public default. Pro is the anchor.', {}),
  ]),
  bullet([
    text('Approve Pro as the only anchor ', { bold: true }),
    text('— discounting limited to design partners with finite-time pilot agreements.', {}),
  ]),
  bullet([
    text('Confirm India-first beachhead ', { bold: true }),
    text('— US engagements only via warm intros until Month 9.', {}),
  ]),

  h3('Intros (this month)'),
  bullet([
    text('5 agency founders ', { bold: true, color: C.accent }),
    text('in your network for design-partner conversations.', {}),
  ]),
  bullet([
    text('2 ex-Naukri / Quess / Randstad leaders ', { bold: true, color: C.accent }),
    text('as advisors or angels with industry credibility.', {}),
  ]),
  bullet([
    text('1 LinkedIn-influencer recruiter ', { bold: true, color: C.accent }),
    text('to amplify the thought-leadership flywheel.', {}),
  ]),

  ...calloutBlock(
    'The trade',
    'Give us these six things — three decisions, three intros — and we hand back ten design partners, three case studies, and ₹25–40L of committed ARR in ninety days.',
    C.brand
  ),
];

// ============================================================================
// SECTION 13 — CLOSING
// ============================================================================
const section13 = [
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({
    children: [new ImageRun({ data: logoBytes, transformation: { width: 64, height: 64 } })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 200 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: 'Zeople ', font: FONT, size: 56, bold: true, color: C.navy }),
      new TextRun({ text: 'RecruiterOS', font: FONT, size: 56, bold: true, color: C.accent }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Win the call. Save the offer. Own the agency OS.', font: FONT, size: 40, bold: true, color: C.text1 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'We have the product. We have the IP. Now we go win the market.', font: FONT, size: 22, color: C.text2 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 360, line: 320 },
  }),
  new Paragraph({
    children: [new TextRun({ text: '', font: FONT })],
    border: { bottom: { color: C.accent, size: 24, space: 4, style: BorderStyle.SINGLE } },
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    children: [new TextRun({ text: 'THE AI CO-PILOT FOR RECRUITING AGENCIES', font: FONT, size: 14, bold: true, color: C.text3, characterSpacing: 80 })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 80 },
  }),
];

// ============================================================================
// Document
// ============================================================================
const doc = new Document({
  creator: 'Zeople',
  title: 'Zeople RecruiterOS — Go-To-Market Strategy',
  description: 'Internal GTM strategy document for the Zeople founding team.',
  styles: {
    default: {
      document: { run: { font: FONT, size: 22, color: C.text1 } },
    },
  },
  sections: [
    {
      headers: { default: pageHeader },
      footers: { default: pageFooter },
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.9),
            right: convertInchesToTwip(0.9),
            bottom: convertInchesToTwip(0.9),
            left: convertInchesToTwip(0.9),
            header: convertInchesToTwip(0.4),
            footer: convertInchesToTwip(0.4),
          },
        },
      },
      children: [
        ...cover,
        ...section1,
        ...section2,
        ...section3,
        ...section4,
        ...section5,
        ...section6,
        ...section7,
        ...section8,
        ...section9,
        ...section10,
        ...section11,
        ...section12,
        ...section13,
      ],
    },
  ],
});

Packer.toBuffer(doc)
  .then((buf) => {
    fs.writeFileSync(OUT, buf);
    console.log(`[generate-gtm-docx] Wrote ${OUT}`);
  })
  .catch((err) => { console.error('[generate-gtm-docx] Failed:', err); process.exit(1); });
