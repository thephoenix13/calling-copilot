import { useState, useRef } from "react";

// ─── DUMMY DATA ───────────────────────────────────────────────────────────────
const reportData = {
  meta: {
    candidate:       "Vikram Anand",
    initials:        "VA",
    role:            "Senior Java Engineer",
    client:          "Infosys Digital",
    recruiter:       "Komal Sharma",
    date:            "02 April 2026",
    time:            "03:15 PM",
    duration:        "34 min 12 sec",
    reportId:        "CER-2026-0088",
    experience:      "8 years",
    currentCompany:  "Tata Consultancy Services",
    currentTitle:    "Senior Java Developer",
    location:        "Bengaluru (open to Hyderabad)",
    currentCTC:      "₹ 22 LPA",
    expectedCTC:     "₹ 28 LPA",
    budgetRange:     "₹ 26 – 30 LPA",
    noticePeriod:    "60 days (negotiable to 30)",
    linkedIn:        "linkedin.com/in/vikram-anand-java",
  },

  verdict: {
    score:           79,
    label:           "HIRE",
    confidence:      "High",
    nextStep:        "Schedule Technical Panel Interview",
    riskLevel:       "LOW",
    compensationFit: "YES",
  },

  technical: [
    {
      id: 1,
      area:     "Core Java & OOP",
      score:    17, max: 20, pct: 85,
      status:   "pass",
      weight:   "20%",
      notes:    "Demonstrated strong command of Java 11/17 features — records, sealed classes, switch expressions. Explained polymorphism and interface default methods with precise examples from production code.",
      quote:    "We refactored a legacy abstract factory to use sealed interfaces in Java 17 — reduced boilerplate by 40% and made the codebase far more readable.",
    },
    {
      id: 2,
      area:     "Spring Boot & Microservices",
      score:    16, max: 20, pct: 80,
      status:   "pass",
      weight:   "20%",
      notes:    "Solid depth. Led a monolith-to-microservices migration at TCS. Fluent with Spring Cloud Gateway, Eureka, Circuit Breaker (Resilience4j), and Kafka for event-driven communication.",
      quote:    "I owned the migration from monolith to 12 microservices over 6 months — I designed the event contracts in Kafka and handled the strangler fig pattern myself.",
    },
    {
      id: 3,
      area:     "Database / JPA / Hibernate / SQL",
      score:    11, max: 15, pct: 73,
      status:   "pass",
      weight:   "15%",
      notes:    "Good practical knowledge of JPA, Hibernate lazy loading, and N+1 problem resolution. SQL query optimisation answers were solid. Limited exposure to NoSQL beyond basic MongoDB operations.",
      quote:    "I debug N+1 by enabling Hibernate statistics in staging and using @BatchSize or JOIN FETCH depending on the relationship type.",
    },
    {
      id: 4,
      area:     "System Design & Architecture",
      score:    10, max: 15, pct: 67,
      status:   "warn",
      weight:   "15%",
      notes:    "Reasonable answers for service decomposition and API design, but struggled with distributed tracing and CAP theorem trade-offs. Did not proactively introduce CQRS or event sourcing patterns.",
      quote:    "For high availability I'd add load balancers and multiple instances… I haven't worked directly with CAP trade-offs in depth yet.",
    },
    {
      id: 5,
      area:     "Algorithms & Problem Solving",
      score:    9, max: 15, pct: 60,
      status:   "warn",
      weight:   "15%",
      notes:    "Solved the sliding window problem correctly but took 7 minutes to reach optimal approach. Tree traversal was sound. BFS/DFS explanations were accurate, though complexity analysis was hesitant.",
      quote:    "I know the theory of dynamic programming but I don't use it day-to-day so I'm a bit rusty on the formal proof side.",
    },
    {
      id: 6,
      area:     "DevOps / Cloud / CI-CD",
      score:    7, max: 10, pct: 70,
      status:   "pass",
      weight:   "10%",
      notes:    "Worked with Jenkins, Maven, Docker, and AWS (EC2, S3, RDS). No Kubernetes hands-on — self-declared gap and currently learning. CI/CD pipeline setup was well described.",
      quote:    "Kubernetes is the gap I'm closing — I've completed the CKAD course and I'm doing a side project to validate it.",
    },
    {
      id: 7,
      area:     "Communication & Presence",
      score:    4, max: 5, pct: 80,
      status:   "pass",
      weight:   "5%",
      notes:    "Articulate, confident, and concise. Gave structured answers (situation → action → outcome). Listened carefully and asked clarifying questions when needed. Minimal filler words.",
      quote:    "Before I answer that, can I just clarify — are you asking about write-heavy or read-heavy systems specifically?",
    },
  ],

  behavioral: [
    { trait: "Ownership & Initiative",  rating: 5, max: 5,  note: "Led migration project end-to-end. Self-initiated learning for Kubernetes gap." },
    { trait: "Communication Clarity",   rating: 4, max: 5,  note: "Clear, structured answers. Slight hesitation on edge-case scenarios." },
    { trait: "Team Collaboration",      rating: 5, max: 5,  note: "Managed 4 engineers during migration. Mentioned mentoring junior devs." },
    { trait: "Learning Agility",        rating: 4, max: 5,  note: "Proactively acknowledged gaps and provided evidence of self-correction." },
    { trait: "Culture Fit",             rating: 4, max: 5,  note: "Values process discipline and documentation — aligns with Infosys delivery model." },
  ],

  strengths: [
    "Deep, production-proven Spring Boot + Kafka microservices experience — directly relevant to the role",
    "Led a full monolith-to-microservices migration (6 months, 4-person team) — demonstrates architectural ownership",
    "Strong understanding of Java 17 features and design patterns — code quality signal is high",
    "Self-aware about gaps (Kubernetes, CAP theorem) and actively closing them — intellectual honesty",
    "Excellent structured communication — would present well in client-facing technical discussions",
  ],

  concerns: [
    { level: "medium", text: "System design depth is below top-quartile senior level — CAP theorem and CQRS not spontaneously raised" },
    { level: "medium", text: "DSA fluency is moderate — may struggle if Infosys technical panel includes competitive-style coding" },
    { level: "low",    text: "No Kubernetes hands-on — gap acknowledged, but client expects at least conceptual readiness" },
    { level: "medium", text: "60-day notice period may delay onboarding — confirm whether client can wait or needs to negotiate" },
    { level: "low",    text: "NoSQL exposure is limited to basic MongoDB — role may require deeper Cassandra or DynamoDB knowledge" },
  ],

  highlights: [
    { speaker: "Candidate", text: "I owned the migration from monolith to 12 microservices over 6 months — I designed the event contracts in Kafka and handled the strangler-fig pattern myself." },
    { speaker: "Candidate", text: "For N+1 problems I enable Hibernate statistics in staging. Depending on whether it's a collection or single association, I'll use JOIN FETCH or @BatchSize accordingly." },
    { speaker: "Candidate", text: "Kubernetes is the gap I'm actively closing — I've done the CKAD course and I'm running a personal cluster on Linode to build confidence." },
    { speaker: "Recruiter",  text: "How would you design a URL shortener that handles 100 million requests per day?" },
    { speaker: "Candidate", text: "I'd start with a simple hash + Base62 encoding, put Redis in front for hot URLs, shard the DB by hash prefix, and add a CDN for read-heavy traffic. Write path goes async via a queue." },
  ],

  compensation: {
    current:  "₹ 22 LPA",
    expected: "₹ 28 LPA",
    budget:   "₹ 26 – 30 LPA",
    fit:      true,
    note:     "Expected CTC (₹28 LPA) sits within the client's band. No negotiation likely needed. Standard 25% hike from current.",
  },

  recommendation: {
    action:  "PROCEED — Schedule Technical Panel",
    detail:  "Vikram presents a strong match for the Senior Java Engineer role at Infosys Digital. Technical depth on Spring Boot and microservices is production-grade. System design and DSA scores suggest coaching before the panel, but are not disqualifying. Compensation is a clean fit. Recommend a 45-minute technical panel with the Infosys lead architect, with explicit focus on distributed systems design and one live coding problem (medium difficulty).",
    panel:   ["Infosys Lead Architect — system design round", "Senior Java SME — live coding (45 min)", "Delivery Manager — culture & project fit"],
  },
};

// ─── THEME (light, brand orange) ─────────────────────────────────────────────
const C = {
  pageBg:      "#f4f6fb",
  cardBg:      "#ffffff",
  innerBg:     "#f8fafc",
  openRowBg:   "#fff7f0",
  border:      "#e2e8f0",
  borderLight: "#edf1f7",
  ringTrack:   "#e8ecf0",
  text:        "#1e293b",
  textSub:     "#475569",
  textMuted:   "#64748b",
  textFaint:   "#94a3b8",
  divider:     "#cbd5e1",
  accent:      "#FF7300",
  accentDim:   "rgba(255,115,0,0.09)",
  accentBdr:   "rgba(255,115,0,0.25)",
  navy:        "#162759",
  navyLight:   "#1e3470",
  green:       "#059669",
  amber:       "#d97706",
  red:         "#dc2626",
  greenBg:     "rgba(5,150,105,0.07)",
  amberBg:     "rgba(217,119,6,0.07)",
  redBg:       "rgba(220,38,38,0.07)",
  greenBorder: "rgba(5,150,105,0.2)",
  amberBorder: "rgba(217,119,6,0.2)",
  redBorder:   "rgba(220,38,38,0.2)",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const barColor  = (pct) => pct >= 75 ? C.green : pct >= 60 ? C.amber : C.red;
const dotColor  = (s)   => s === "pass" ? C.green : s === "warn" ? C.amber : C.red;
const ratingBar = (r, m) => (r / m) * 100;

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: C.textFaint, marginLeft: 2 }}>— {sub}</span>}
    </div>
  );
}

function ScoreRing({ score, size = 96 }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? C.green : score >= 55 ? C.amber : C.red;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.ringTrack} strokeWidth="7" />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

function TechRow({ d, idx }) {
  const [open, setOpen] = useState(false);
  const bc = barColor(d.pct);
  const dc = dotColor(d.status);
  return (
    <div style={{
      background: open ? C.openRowBg : C.cardBg,
      border: `1px solid ${open ? C.accentBdr : C.border}`,
      borderRadius: 10, marginBottom: 6, overflow: "hidden", transition: "background 0.18s",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 16px", cursor: "pointer",
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6, background: C.innerBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: C.textFaint, fontFamily: "monospace", flexShrink: 0,
        }}>{idx}</span>

        <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{d.area}</span>

        <span style={{
          fontSize: 10, color: C.textMuted, background: C.innerBg,
          padding: "2px 7px", borderRadius: 20, marginRight: 8, border: `1px solid ${C.border}`,
        }}>{d.weight}</span>

        <span style={{ fontSize: 13, fontWeight: 700, color: bc, minWidth: 48, textAlign: "right" }}>
          {d.score}<span style={{ color: C.divider, fontWeight: 400 }}>/{d.max}</span>
        </span>

        <div style={{ width: 80, height: 5, background: C.borderLight, borderRadius: 3, margin: "0 12px", flexShrink: 0 }}>
          <div style={{ width: `${d.pct}%`, height: "100%", background: bc, borderRadius: 3 }} />
        </div>

        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dc, flexShrink: 0 }} />
        <span style={{ color: C.divider, fontSize: 11, marginLeft: 4, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </div>

      {open && (
        <div style={{ padding: "0 16px 14px 52px", borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.65, margin: "12px 0 8px" }}>{d.notes}</p>
          {d.quote && (
            <div style={{
              background: C.innerBg, borderLeft: `3px solid ${C.accent}`,
              padding: "8px 12px", borderRadius: "0 6px 6px 0",
              fontSize: 12, color: C.textMuted, fontStyle: "italic",
            }}>
              "{d.quote}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BehavioralRow({ b }) {
  const pct = ratingBar(b.rating, b.max);
  const bc = pct >= 80 ? C.green : pct >= 60 ? C.amber : C.red;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", background: C.cardBg,
      border: `1px solid ${C.border}`, borderRadius: 9, marginBottom: 5,
    }}>
      <span style={{ flex: "0 0 180px", fontSize: 13, fontWeight: 500, color: C.text }}>{b.trait}</span>
      <div style={{ flex: 1, height: 6, background: C.borderLight, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: bc, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: bc, minWidth: 36, textAlign: "right" }}>
        {b.rating}<span style={{ color: C.divider, fontWeight: 400 }}>/{b.max}</span>
      </span>
      <span style={{ fontSize: 11, color: C.textFaint, flex: "0 0 260px", lineHeight: 1.4 }}>{b.note}</span>
    </div>
  );
}

function ConcernRow({ c }) {
  const isMed = c.level === "medium";
  const isHigh = c.level === "high";
  const bg  = isHigh ? C.redBg   : isMed ? C.amberBg   : C.greenBg;
  const bdr = isHigh ? C.redBorder : isMed ? C.amberBorder : C.greenBorder;
  const col = isHigh ? C.red     : isMed ? C.amber     : C.green;
  const icon = isHigh ? "🔴" : isMed ? "🟡" : "🟢";
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: "10px 14px", background: bg, border: `1px solid ${bdr}`,
      borderRadius: 8, marginBottom: 6,
    }}>
      <span style={{ fontSize: 13, marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <span style={{ fontSize: 10, fontWeight: 700, color: col, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 8 }}>
          {c.level}
        </span>
        <span style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.5 }}>{c.text}</span>
      </div>
    </div>
  );
}

// ─── MAIN REPORT ──────────────────────────────────────────────────────────────
export default function CandidateEvaluationReport() {
  const { meta, verdict, technical, behavioral, strengths, concerns, highlights, compensation, recommendation } = reportData;
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const rawScore = technical.reduce((a, t) => a + t.score, 0);
  const rawMax   = technical.reduce((a, t) => a + t.max, 0);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin:      [10, 10, 10, 10],
          filename:    `CER-${meta.reportId}-${meta.candidate.replace(/\s/g, "-")}.pdf`,
          image:       { type: "jpeg", quality: 0.97 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: C.pageBg },
          jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak:   { mode: ["avoid-all", "css"] },
        })
        .from(reportRef.current)
        .save();
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const verdictColor = verdict.label === "HIRE" || verdict.label === "STRONG HIRE" ? C.green
    : verdict.label === "HOLD" ? C.amber : C.red;

  return (
    <div style={{ background: C.pageBg, minHeight: "100vh", padding: "24px 20px", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <div ref={reportRef} style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* ── HEADER BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: C.navy, color: "#fff", fontWeight: 800,
              fontSize: 13, padding: "4px 10px", borderRadius: 6, letterSpacing: "0.08em",
            }}>ZEOPLE</div>
            <span style={{ color: C.divider }}>·</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>Candidate Evaluation Report</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.textFaint, fontFamily: "monospace" }}>{meta.reportId}</span>
            <button onClick={handleExportPDF} disabled={exporting} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8, cursor: exporting ? "not-allowed" : "pointer",
              background: exporting ? C.innerBg : C.accent,
              border: `1px solid ${exporting ? C.border : C.accent}`,
              color: exporting ? C.textMuted : "#fff",
              fontSize: 12, fontWeight: 600, transition: "all 0.2s", opacity: exporting ? 0.7 : 1,
            }}>
              {exporting ? "⏳ Exporting…" : "⬇ Export PDF"}
            </button>
          </div>
        </div>

        {/* ── CANDIDATE CARD ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "20px 22px", marginBottom: 18,
          display: "grid", gridTemplateColumns: "auto 1fr auto",
          gap: 20, alignItems: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          {/* Avatar */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, fontWeight: 800, color: "#fff", flexShrink: 0,
            }}>{meta.initials}</div>
            <div style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
              color: C.accent, background: C.accentDim, border: `1px solid ${C.accentBdr}`,
              padding: "2px 7px", borderRadius: 10,
            }}>Candidate</div>
          </div>

          {/* Fields grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 22px" }}>
            {[
              ["Candidate",      meta.candidate],
              ["Role Applied",   meta.role],
              ["Client",         meta.client],
              ["Current Company",meta.currentCompany],
              ["Experience",     meta.experience],
              ["Location",       meta.location],
              ["Current CTC",    meta.currentCTC],
              ["Expected CTC",   meta.expectedCTC],
              ["Notice Period",  meta.noticePeriod],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Score ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
            <ScoreRing score={verdict.score} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.green, lineHeight: 1 }}>{verdict.score}</div>
              <div style={{ fontSize: 9, color: C.textFaint }}>/100</div>
            </div>
            <span style={{ fontSize: 10, color: C.textMuted }}>Overall Score</span>
          </div>
        </div>

        {/* ── VERDICT ROW ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div style={{
            flex: 1, background: C.greenBg, border: `1px solid ${C.greenBorder}`,
            borderRadius: 12, padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%", background: "rgba(5,150,105,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
            }}>✅</div>
            <div>
              <div style={{ fontSize: 10, color: C.green, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Recruiter Verdict</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>{verdict.label}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{recommendation.action}</div>
            </div>
          </div>

          {[
            ["Confidence",    verdict.confidence, "high"  ],
            ["Risk Level",    verdict.riskLevel,  "low"   ],
            ["CTC Fit",       verdict.compensationFit ? "YES" : "NO", verdict.compensationFit ? "good" : "bad"],
            ["Raw Score",     `${rawScore}/${rawMax}`, "neutral"],
          ].map(([lbl, val, kind]) => {
            const colMap = { high: C.green, low: C.green, good: C.green, bad: C.red, neutral: C.amber };
            return (
              <div key={lbl} style={{
                background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: "14px 18px", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 4, minWidth: 88,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{lbl}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: colMap[kind] || C.text }}>{val}</div>
              </div>
            );
          })}
        </div>

        {/* ── TECHNICAL ASSESSMENT ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader icon="☕" label="Technical Assessment" sub="Click any area to expand notes & candidate quotes" />
          {technical.map((t, i) => <TechRow key={t.id} d={t} idx={i + 1} />)}
        </div>

        {/* ── BEHAVIORAL / COMPETENCY ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "18px 20px", marginBottom: 24,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <SectionHeader icon="🧠" label="Behavioral Competencies" />
          {behavioral.map((b, i) => <BehavioralRow key={i} b={b} />)}
        </div>

        {/* ── STRENGTHS + CONCERNS side by side ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
          {/* Strengths */}
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <SectionHeader icon="💪" label="Strengths" />
            {strengths.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ color: C.green, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.55 }}>{s}</span>
              </div>
            ))}
          </div>

          {/* Concerns */}
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <SectionHeader icon="⚠️" label="Concerns & Gaps" />
            {concerns.map((c, i) => <ConcernRow key={i} c={c} />)}
          </div>
        </div>

        {/* ── INTERVIEW HIGHLIGHTS ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader icon="🎙️" label="Interview Highlights" sub="Notable exchanges from the call" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {highlights.map((h, i) => {
              const isCandidate = h.speaker === "Candidate";
              return (
                <div key={i} style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  padding: "10px 14px",
                  background: isCandidate ? C.cardBg : C.accentDim,
                  border: `1px solid ${isCandidate ? C.border : C.accentBdr}`,
                  borderLeft: `3px solid ${isCandidate ? C.navy : C.accent}`,
                  borderRadius: "0 10px 10px 0",
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                    color: isCandidate ? C.navy : C.accent, flexShrink: 0, marginTop: 2, minWidth: 60,
                  }}>{h.speaker}</span>
                  <span style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6, fontStyle: "italic" }}>"{h.text}"</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COMPENSATION FIT ── */}
        <div style={{
          background: compensation.fit ? C.greenBg : C.redBg,
          border: `1px solid ${compensation.fit ? C.greenBorder : C.redBorder}`,
          borderRadius: 14, padding: "16px 20px", marginBottom: 24,
          display: "flex", gap: 20, alignItems: "center",
        }}>
          <div style={{ fontSize: 26 }}>{compensation.fit ? "💚" : "❌"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: compensation.fit ? C.green : C.red, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Compensation Fit — {compensation.fit ? "WITHIN BAND" : "OUT OF BAND"}
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {[["Current CTC", compensation.current], ["Expected CTC", compensation.expected], ["Client Budget", compensation.budget]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 8, lineHeight: 1.5 }}>{compensation.note}</div>
          </div>
        </div>

        {/* ── RECOMMENDATION ── */}
        <div style={{
          background: C.cardBg, border: `2px solid ${C.accent}`,
          borderRadius: 14, padding: "20px 22px", marginBottom: 24,
          boxShadow: "0 2px 8px rgba(255,115,0,0.08)",
        }}>
          <SectionHeader icon="📋" label="Recommendation & Next Steps" />
          <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, marginBottom: 16 }}>
            {recommendation.detail}
          </p>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Suggested Interview Panel:</div>
          {recommendation.panel.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: C.accent, background: C.accentDim,
                border: `1px solid ${C.accentBdr}`, borderRadius: 20, padding: "1px 7px", flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, color: C.textSub }}>{p}</span>
            </div>
          ))}
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: C.textFaint }}>
            Prepared by {meta.recruiter} · Zeople AI · {meta.date} · {meta.time}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {["Submit to Client", "Request Second Opinion", "Archive"].map((label) => (
              <button key={label} style={{
                padding: "6px 12px", borderRadius: 7,
                background: C.cardBg, border: `1px solid ${C.border}`,
                color: C.textMuted, fontSize: 11, cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
              >{label}</button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
