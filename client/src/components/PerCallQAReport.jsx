import { useState, useRef } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────
const reportData = {
  meta: {
    recruiter: "Komal Sharma",
    recruiterInitials: "KS",
    date: "March 2026",
    time: "11:42 AM",
    duration: "8 min 34 sec",
    candidate: "Arjun Mehta",
    role: "Dell Boomi Developer",
    client: "Capgemini",
    callId: "CALL-2026-0341",
  },
  summary: {
    score: 46,
    rawScore: 30,
    maxScore: 100,
    verdict: "NOT READY",
    riskLevel: "HIGH",
    outcome: "Critical Fail",
  },
  scorecard: [
    {
      id: 1,
      dimension: "Opening & Positioning",
      weight: "10%",
      score: 4,
      max: 15,
      pct: 27,
      evidence: "Basic greeting but informal and repetitive. No consent, no time check, no call purpose framing.",
      quote: "Hi, this is Komal, calling you regarding the job opportunity.",
      status: "fail",
    },
    {
      id: 2,
      dimension: "Communication & Clarity",
      weight: "15%",
      score: 9,
      max: 20,
      pct: 45,
      evidence: "Polite but low confidence. Frequent grammatical errors, unclear phrasing ('CDC', 'GD'). Candidate drove parts of the call.",
      quote: "We have opening in a Capgemini company for Delhi-Bhumi developer position.",
      status: "warn",
    },
    {
      id: 3,
      dimension: "Role Selling & Value Prop",
      weight: "15%",
      score: 3,
      max: 20,
      pct: 15,
      evidence: "Only company name stated. No role responsibilities, no WIIFM, no project value discussed. Location concern not handled.",
      quote: "We have opening in a Capgemini company for Delhi-Bhumi developer position.",
      status: "fail",
    },
    {
      id: 4,
      dimension: "Technical / Functional Screening",
      weight: "25%",
      score: 11,
      max: 30,
      pct: 37,
      evidence: "Dell Boomi mentioned but zero skill probing. No project discussion. Compensation captured well. Location discussed but relocation not validated.",
      quote: "Managing my team, keeping an eye in all the track…",
      status: "fail",
    },
    {
      id: 5,
      dimension: "Candidate Control",
      weight: "10%",
      score: 2,
      max: 5,
      pct: 40,
      evidence: "Candidate drove several segments — JD request accepted without steering. Recruiter did not maintain call structure.",
      quote: "Can you send me the JD first?",
      status: "warn",
    },
    {
      id: 6,
      dimension: "Closing Effectiveness",
      weight: "10%",
      score: 3,
      max: 15,
      pct: 20,
      evidence: "Interview process vague. No timeline shared. CTA weak — recruiter offered to send JD but no next-step ownership.",
      quote: "Once your profile is shortlisted, I will let you know regarding an interview process.",
      status: "fail",
    },
    {
      id: 7,
      dimension: "Data Accuracy",
      weight: "5%",
      score: 2,
      max: 5,
      pct: 40,
      evidence: "Notice period (LWD 6th Aug) captured. Current & expected CTC noted. Role title unclear in transcript.",
      quote: "Your last working day is 6th August?",
      status: "warn",
    },
    {
      id: 8,
      dimension: "Conversion Readiness",
      weight: "10%",
      score: 2,
      max: 5,
      pct: 40,
      evidence: "Active offer with joining date not managed. Salary fit vs client band unconfirmed. Submission risk high.",
      quote: "I have an offer in hand already.",
      status: "fail",
    },
  ],
  redFlags: [
    { severity: "critical", text: "No validation of Dell Boomi expertise — role is niche, zero skill probing conducted" },
    { severity: "critical", text: "No project, integration, or architecture discussion despite 7 years experience" },
    { severity: "critical", text: "Candidate has active offer & joining date — urgency not acknowledged or managed" },
    { severity: "high", text: "Salary fit vs client band never confirmed — submission without this is high risk" },
    { severity: "high", text: "Weak brand representation — may reduce candidate's confidence in the opportunity" },
  ],
  nudges: [
    {
      label: "Technical Depth",
      icon: "⚙",
      weak: "Do you have Dell Boomi experience?",
      better: "Walk me through the last integration you built on Dell Boomi — what connectors did you use and what was the data volume?",
      why: "Yes/no tech questions give you zero signal. Project walk-throughs reveal actual depth within 60 seconds.",
    },
    {
      label: "Role Selling",
      icon: "🎯",
      weak: "We have an opening in Capgemini for Delhi-Boomi developer.",
      better: "This is a Boomi integration role at Capgemini's digital engineering unit — you'd be owning the API and middleware layer for a large banking client. Given your background it's a strong fit.",
      why: "Candidates decide in the first 90 seconds whether the call is worth their time. Give them a reason to stay.",
    },
    {
      label: "Closing with Clarity",
      icon: "🏁",
      weak: "Once your profile is shortlisted, I will let you know.",
      better: "Next step is a technical interview with Capgemini's lead architect — typically within 5 working days. I'm targeting shortlist sign-off by end of this week. Can I lock in your availability?",
      why: "Vague closes create dropout risk, especially when the candidate already has an offer on the table.",
    },
  ],
};

// ─── COLORS (light theme) ─────────────────────────────────────────────────────
const C = {
  pageBg:      "#f4f6fb",
  cardBg:      "#ffffff",
  innerBg:     "#f8fafc",
  openRowBg:   "#f0f4ff",
  border:      "#e2e8f0",
  borderLight: "#edf1f7",
  ringTrack:   "#e8ecf0",
  text:        "#1e293b",
  textSub:     "#475569",
  textMuted:   "#64748b",
  textFaint:   "#94a3b8",
  divider:     "#cbd5e1",
  accent:      "#e8560a",
  green:       "#059669",
  amber:       "#d97706",
  red:         "#dc2626",
  greenBg:     "rgba(5,150,105,0.08)",
  amberBg:     "rgba(217,119,6,0.08)",
  redBg:       "rgba(220,38,38,0.08)",
  greenBorder: "rgba(5,150,105,0.2)",
  amberBorder: "rgba(217,119,6,0.2)",
  redBorder:   "rgba(220,38,38,0.2)",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const getBarColor   = (pct) => pct >= 70 ? C.green : pct >= 45 ? C.amber : C.red;
const getStatusDot  = (s)   => s === "fail" ? C.red : s === "warn" ? C.amber : C.green;

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
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
  const color = score >= 70 ? C.green : score >= 45 ? C.amber : C.red;
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

function DimensionRow({ d, idx }) {
  const [open, setOpen] = useState(false);
  const barColor  = getBarColor(d.pct);
  const statusDot = getStatusDot(d.status);
  return (
    <div style={{
      background: open ? C.openRowBg : C.cardBg,
      border: `1px solid ${open ? "#c7d4f0" : C.border}`,
      borderRadius: 10, marginBottom: 6, overflow: "hidden", transition: "background 0.2s",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", cursor: "pointer",
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6, background: C.innerBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: C.textFaint, fontFamily: "monospace", flexShrink: 0,
        }}>{idx}</span>

        <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>
          {d.dimension}
        </span>

        <span style={{
          fontSize: 10, color: C.textMuted, background: C.innerBg,
          padding: "2px 7px", borderRadius: 20, marginRight: 8, border: `1px solid ${C.border}`,
        }}>{d.weight}</span>

        <span style={{ fontSize: 13, fontWeight: 700, color: barColor, minWidth: 48, textAlign: "right" }}>
          {d.score}<span style={{ color: C.divider, fontWeight: 400 }}>/{d.max}</span>
        </span>

        <div style={{ width: 80, height: 5, background: C.borderLight, borderRadius: 3, margin: "0 12px", flexShrink: 0 }}>
          <div style={{ width: `${d.pct}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.8s ease" }} />
        </div>

        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
        <span style={{ color: C.divider, fontSize: 11, marginLeft: 4, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </div>

      {open && (
        <div style={{ padding: "0 16px 14px 52px", borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6, margin: "12px 0 8px" }}>{d.evidence}</p>
          {d.quote && (
            <div style={{
              background: C.innerBg, borderLeft: `3px solid ${C.divider}`,
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

function RedFlag({ flag }) {
  const isCritical = flag.severity === "critical";
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: "10px 14px",
      background: isCritical ? C.redBg : C.amberBg,
      border: `1px solid ${isCritical ? C.redBorder : C.amberBorder}`,
      borderRadius: 8, marginBottom: 6,
    }}>
      <span style={{ fontSize: 13, marginTop: 1, flexShrink: 0 }}>{isCritical ? "🔴" : "🟡"}</span>
      <span style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.5 }}>{flag.text}</span>
    </div>
  );
}

function NudgeCard({ nudge }) {
  const [flip, setFlip] = useState(false);
  return (
    <div style={{
      background: C.cardBg, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: 16, flex: 1, minWidth: 220,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>{nudge.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {nudge.label}
        </span>
      </div>

      <div style={{ display: "flex", background: C.innerBg, borderRadius: 8, padding: 3, marginBottom: 12, border: `1px solid ${C.border}` }}>
        {["❌ Weak", "✅ Better"].map((label, i) => (
          <button key={i} onClick={() => setFlip(i === 1)} style={{
            flex: 1, padding: "5px 0", border: "none", borderRadius: 6, cursor: "pointer",
            fontSize: 11, fontWeight: 600, transition: "all 0.2s",
            background: (i === 0 && !flip) ? C.cardBg : (i === 1 && flip) ? C.green : "transparent",
            color: (i === 0 && !flip) ? C.text : (i === 1 && flip) ? "#fff" : C.textFaint,
            boxShadow: ((i === 0 && !flip) || (i === 1 && flip)) ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>{label}</button>
        ))}
      </div>

      <div style={{
        background: C.innerBg, borderRadius: 8, padding: "10px 12px",
        fontSize: 12, color: flip ? C.green : C.red,
        lineHeight: 1.6, fontStyle: "italic", minHeight: 72,
        borderLeft: `3px solid ${flip ? C.green : C.red}`,
      }}>
        "{flip ? nudge.better : nudge.weak}"
      </div>

      <p style={{ fontSize: 11, color: C.textFaint, margin: "10px 0 0", lineHeight: 1.5 }}>
        💡 {nudge.why}
      </p>
    </div>
  );
}

// ─── MAIN REPORT ─────────────────────────────────────────────────────────────
export default function PerCallQAReport({ reportData: propData }) {
  const { meta, summary, scorecard, redFlags, nudges } = propData ?? reportData;
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin:      [10, 10, 10, 10],
          filename:    `QA-Report-${meta.callId}.pdf`,
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

  return (
    <div style={{ background: C.pageBg, minHeight: "100vh", padding: "24px 20px", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <div ref={reportRef} style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* ── TOP HEADER BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: C.accent, color: "#fff", fontWeight: 800,
              fontSize: 14, padding: "4px 10px", borderRadius: 6, letterSpacing: "0.08em",
            }}>ZEOPLE</div>
            <span style={{ color: C.divider, fontSize: 12 }}>·</span>
            <span style={{ color: C.textMuted, fontSize: 12 }}>Per-Call QA Report</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.textFaint, fontFamily: "monospace" }}>{meta.callId}</span>
            <span style={{
              fontSize: 11, padding: "3px 9px", borderRadius: 20,
              background: "rgba(232,86,10,0.08)", color: C.accent, border: "1px solid rgba(232,86,10,0.2)",
            }}>MVP</span>
            {/* ── EXPORT PDF BUTTON ── */}
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, cursor: exporting ? "not-allowed" : "pointer",
                background: exporting ? C.innerBg : C.accent,
                border: `1px solid ${exporting ? C.border : C.accent}`,
                color: exporting ? C.textMuted : "#fff",
                fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? "⏳ Exporting…" : "⬇ Export PDF"}
            </button>
          </div>
        </div>

        {/* ── CALL INFO ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "18px 20px",
          display: "grid", gridTemplateColumns: "auto 1fr auto",
          gap: 20, alignItems: "center", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "linear-gradient(135deg, #E8560A, #FF7043)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "#fff",
            }}>{meta.recruiterInitials}</div>
            <span style={{ fontSize: 10, color: C.textFaint }}>Recruiter</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 20px" }}>
            {[
              ["Recruiter", meta.recruiter],
              ["Candidate", meta.candidate],
              ["Role", meta.role],
              ["Client", meta.client],
              ["Date", `${meta.date} · ${meta.time}`],
              ["Duration", meta.duration],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
            <ScoreRing score={summary.score} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.red, lineHeight: 1 }}>{summary.score}</div>
              <div style={{ fontSize: 9, color: C.textFaint }}>/ 100</div>
            </div>
            <span style={{ fontSize: 10, color: C.textMuted }}>QA Score</span>
          </div>
        </div>

        {/* ── VERDICT ROW ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div style={{
            flex: 1, background: C.redBg, border: `1px solid ${C.redBorder}`,
            borderRadius: 12, padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(220,38,38,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>❌</div>
            <div>
              <div style={{ fontSize: 10, color: C.red, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Submission Verdict</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.red }}>NOT READY FOR CLIENT</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>No functional screening · No role understanding validated</div>
            </div>
          </div>

          <div style={{
            background: C.redBg, border: `1px solid ${C.redBorder}`,
            borderRadius: 12, padding: "14px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 100,
          }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Risk</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.red }}>HIGH</div>
          </div>

          <div style={{
            background: C.cardBg, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "14px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 100,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Raw Score</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.amber }}>30<span style={{ fontSize: 12, color: C.divider }}>/100</span></div>
            <div style={{ fontSize: 9, color: C.textFaint }}>Adjusted: 46</div>
          </div>
        </div>

        {/* ── SCORECARD ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader icon="📊" label="QA Scorecard" sub="Click any dimension to view evidence" />
          {scorecard.map((d, i) => <DimensionRow key={d.id} d={d} idx={i + 1} />)}
        </div>

        {/* ── RED FLAGS ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader
            icon="⚠️" label="Red Flags & Risks"
            sub={`${redFlags.filter(f => f.severity === "critical").length} critical · ${redFlags.filter(f => f.severity === "high").length} high`}
          />
          {redFlags.map((f, i) => <RedFlag key={i} flag={f} />)}
        </div>

        {/* ── COACHING NUDGES ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader icon="🎓" label="Instant Coaching Nudges" sub="Toggle between weak phrasing and the improved version" />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {nudges.map((n, i) => <NudgeCard key={i} nudge={n} />)}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: C.textFaint }}>
            Generated by Zeople AI · Evaluation Agent 6b · {meta.date}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {["Override Score", "Escalate to TL", "Mark Reviewed"].map((label) => (
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
