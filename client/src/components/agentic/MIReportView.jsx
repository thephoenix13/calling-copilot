/**
 * MIReportView — single-report renderer (the 9-card layout from spec §13)
 *
 * Polls /mi/reports/:id while the report is in flight; renders the full
 * report once status='completed'. Inline-SVG charts (no Recharts dep).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ExportPdfButton } from './MIPdfExporter';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Typography ladder (single source of truth) ───────────────────────────
// Keep this short — every text node in the report should pull from here.
const T = {
  meta:       { fontSize: 11, fontWeight: 400, lineHeight: 1.5,  color: 'var(--text-3, #94A3B8)' },
  metaStrong: { fontSize: 11, fontWeight: 600, lineHeight: 1.5,  color: 'var(--text-2, #64748B)' },
  eyebrow:    { fontSize: 11, fontWeight: 700, lineHeight: 1.5,  color: 'var(--text-3, #94A3B8)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  body:       { fontSize: 13, fontWeight: 400, lineHeight: 1.6,  color: 'var(--text-1)' },
  bodyMuted:  { fontSize: 13, fontWeight: 400, lineHeight: 1.6,  color: 'var(--text-2, #64748B)' },
  bodyStrong: { fontSize: 13, fontWeight: 600, lineHeight: 1.6,  color: 'var(--text-1)' },
  section:    { fontSize: 15, fontWeight: 600, lineHeight: 1.4,  color: 'var(--text-1)' },
  metric:     { fontSize: 18, fontWeight: 700, lineHeight: 1.3,  color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' },
};

// ── Status pill (also used by the progress stepper) ──────────────────────
const STAGES = [
  { key: 'pending',     label: 'Queued' },
  { key: 'researching', label: 'Researching the web' },
  { key: 'structuring', label: 'Structuring data' },
  { key: 'generating',  label: 'Writing summary' },
  { key: 'completed',   label: 'Ready' },
];

const CONFIDENCE_STYLE = {
  high:   { bg: 'rgba(16,185,129,0.10)', color: '#059669', border: 'rgba(16,185,129,0.30)' },
  medium: { bg: 'rgba(245,158,11,0.10)', color: '#d97706', border: 'rgba(245,158,11,0.30)' },
  low:    { bg: 'rgba(100,116,139,0.10)', color: '#64748b', border: 'rgba(100,116,139,0.30)' },
};

const SKILL_TYPE_STYLE = {
  Vanilla:        { bg: 'rgba(59,130,246,0.10)',  color: '#2563eb', border: 'rgba(59,130,246,0.35)',  label: 'Vanilla', help: '10,000+ candidates' },
  Niche:          { bg: 'rgba(245,158,11,0.10)',  color: '#d97706', border: 'rgba(245,158,11,0.35)',  label: 'Niche',   help: '1,000–10,000 candidates' },
  'Super Niche':  { bg: 'rgba(220,38,38,0.10)',   color: '#dc2626', border: 'rgba(220,38,38,0.45)',   label: 'Super Niche', help: '<1,000 candidates' },
};

const fmtDate = (dt) => {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const safeHostname = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
};

// ── Tiny shared components ───────────────────────────────────────────────
function ConfidenceBadge({ value }) {
  if (!value) return null;
  const s = CONFIDENCE_STYLE[value] || CONFIDENCE_STYLE.medium;
  return (
    <span style={{
      ...T.eyebrow,
      color: s.color,
      padding: '3px 9px', borderRadius: 999,
      background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {value} confidence
    </span>
  );
}

function SourceLinks({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const top = sources.slice(0, 4);
  const rest = sources.length - top.length;
  return (
    <div style={{
      borderTop: '1px solid var(--border, #E2E8F0)',
      paddingTop: 10, marginTop: 14,
      display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
      ...T.meta,
    }}>
      <span style={{ marginRight: 4 }}>🌐 Sources:</span>
      {top.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer" style={{
          ...T.meta,
          padding: '2px 8px', borderRadius: 4,
          background: 'var(--muted, #F8FAFC)', color: 'var(--text-2, #64748B)',
          textDecoration: 'none', border: '1px solid var(--border, #E2E8F0)',
        }}>
          {safeHostname(u)}
        </a>
      ))}
      {rest > 0 && <span>+{rest} more</span>}
    </div>
  );
}

function SectionCard({ icon, title, confidence, highlight, children, accent = 'var(--orange, #F97316)' }) {
  return (
    <div style={{
      background: 'var(--surface-1, #fff)',
      border: `1px solid var(--border, #E2E8F0)`,
      borderLeft: highlight ? `4px solid ${accent}` : '1px solid var(--border, #E2E8F0)',
      borderRadius: 12,
      padding: '20px 22px',
      marginBottom: 16,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }} className="mi-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h2 style={{ ...T.section, margin: 0 }}>{title}</h2>
        <div style={{ flex: 1 }} />
        <ConfidenceBadge value={confidence} />
      </div>
      {children}
    </div>
  );
}

function MetricStrip({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12, margin: '12px 0' }}>
      {items.map((it, i) => (
        <div key={i} style={{
          padding: '10px 12px',
          background: 'var(--muted, #F8FAFC)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: 8,
        }}>
          <div style={{ ...T.eyebrow, marginBottom: 4 }}>{it.label}</div>
          <div style={T.metric}>{it.value}</div>
          {it.sub && <div style={{ ...T.meta, marginTop: 2 }}>{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Inline SVG charts ────────────────────────────────────────────────────

function HorizontalBarChart({ data, valueKey = 'value', nameKey = 'name', color = 'var(--orange, #F97316)', maxBars = 10 }) {
  const rows = (data || []).slice(0, maxBars);
  if (rows.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No data.</div>;
  const max = Math.max(...rows.map(r => Number(parseInt(r[valueKey]) || 0)));
  const safeMax = max > 0 ? max : 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0' }}>
      {rows.map((r, i) => {
        const v = Number(parseInt(r[valueKey]) || 0);
        const pct = (v / safeMax) * 100;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 70px', gap: 10, alignItems: 'center' }}>
            <div style={{ ...T.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[nameKey]}</div>
            <div style={{ height: 10, background: 'var(--muted, #F8FAFC)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
            </div>
            <div style={{ ...T.bodyMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r[valueKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

function SalaryRangeChart({ minCTC, p25, median, p75, maxCTC }) {
  // Parse "X LPA" → number
  const num = (s) => { const m = String(s || '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; };
  const lo = num(minCTC), q1 = num(p25), m = num(median), q3 = num(p75), hi = num(maxCTC);
  if (lo == null || hi == null || hi <= lo) {
    return <div style={T.meta}>Insufficient data to render salary range.</div>;
  }
  const span = hi - lo;
  const pct = (v) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  const W = '100%', H = 60;
  return (
    <svg viewBox="0 0 600 60" preserveAspectRatio="none" style={{ width: W, height: H, margin: '8px 0' }}>
      {/* Background bar */}
      <rect x="0" y="22" width="600" height="16" rx="8" fill="#F1F5F9" />
      {/* Range box from p25 → p75 */}
      {q1 != null && q3 != null && (
        <rect x={pct(q1) * 6} y="20" width={(pct(q3) - pct(q1)) * 6} height="20" rx="3" fill="rgba(249,115,22,0.25)" stroke="rgba(249,115,22,0.6)" />
      )}
      {/* Median tick */}
      {m != null && (
        <line x1={pct(m) * 6} x2={pct(m) * 6} y1="14" y2="46" stroke="#F97316" strokeWidth="3" />
      )}
      {/* Min/Max ticks */}
      <line x1="0" x2="0" y1="18" y2="42" stroke="#1E293B" strokeWidth="2" />
      <line x1="600" x2="600" y1="18" y2="42" stroke="#1E293B" strokeWidth="2" />
      {/* Labels */}
      <text x="0" y="58" fontSize="11" fill="#64748B">Min: {minCTC}</text>
      {q1 != null && <text x={pct(q1) * 6} y="13" fontSize="11" fill="#64748B" textAnchor="middle">P25: {p25}</text>}
      {m != null && <text x={pct(m) * 6} y="58" fontSize="11" fill="#1E293B" textAnchor="middle" fontWeight="700">Median: {median}</text>}
      {q3 != null && <text x={pct(q3) * 6} y="13" fontSize="11" fill="#64748B" textAnchor="middle">P75: {p75}</text>}
      <text x="600" y="58" fontSize="11" fill="#64748B" textAnchor="end">Max: {maxCTC}</text>
    </svg>
  );
}

function FunnelChart({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '8px 0' }}>
      {steps.map((s, i) => {
        const w = 100 - (i * 18);
        return (
          <div key={i} style={{
            width: `${w}%`, padding: '10px 14px', marginBottom: 4,
            background: `linear-gradient(135deg, var(--orange, #F97316) 0%, #EA580C 100%)`,
            color: '#fff', borderRadius: 6, textAlign: 'center',
            opacity: 1 - (i * 0.15),
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function EditableList({ items, editMode, onChange, ordered }) {
  if (!editMode) {
    const Tag = ordered ? 'ol' : 'ul';
    return (
      <Tag style={{ paddingLeft: ordered ? 22 : 20, margin: 0, ...T.body }}>
        {items.map((t, i) => <li key={i} style={{ marginBottom: ordered ? 6 : 2 }}>{t}</li>)}
      </Tag>
    );
  }
  // Edit mode — text inputs per row + remove + add.
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ ...T.meta, minWidth: 18 }}>{ordered ? `${i + 1}.` : '•'}</span>
          <input
            value={t}
            onChange={(e) => {
              const next = [...items]; next[i] = e.target.value; onChange(next);
            }}
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6,
              ...T.body, fontFamily: 'inherit' }}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer',
              fontSize: 16, padding: '0 6px' }}
            aria-label="Remove"
          >×</button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="ag-btn ag-btn--ghost ag-btn--sm"
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
      >+ Add</button>
    </div>
  );
}

function StarRating({ rating }) {
  const r = parseFloat(rating) || 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#F59E0B', fontSize: 13 }}>★</span>
      <strong style={T.bodyStrong}>{r.toFixed(1)}</strong>
      <span style={T.meta}>/5</span>
    </span>
  );
}

// ── Progress stepper (shown while pipeline runs) ─────────────────────────
function ProgressStepper({ status, failureReason, onRetry }) {
  const idx = STAGES.findIndex(s => s.key === status);
  const isFailed = status === 'failed';

  return (
    <div className="mi-progress" style={{
      background: 'var(--surface-1, #fff)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24, marginBottom: 16,
    }}>
      <h3 style={{ ...T.section, marginTop: 0, marginBottom: 16 }}>
        {isFailed ? 'Report generation failed' : 'Generating market intelligence report'}
      </h3>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {STAGES.slice(0, 4).map((s, i) => {
          const done = idx > i;
          const active = idx === i && !isFailed;
          return (
            <div key={s.key} style={{
              flex: 1, padding: '10px 12px',
              background: done ? 'rgba(16,185,129,0.08)'
                : active ? 'rgba(249,115,22,0.10)'
                : 'var(--muted)',
              border: `1px solid ${done ? 'rgba(16,185,129,0.30)' : active ? 'rgba(249,115,22,0.30)' : 'var(--border)'}`,
              borderRadius: 8,
            }}>
              <div style={{
                ...T.eyebrow,
                color: done ? '#059669' : active ? 'var(--orange)' : 'var(--text-3)',
                marginBottom: 4,
              }}>
                {done ? '✓' : active ? '●' : '○'} Step {i + 1}
              </div>
              <div style={T.body}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div style={{
          marginTop: 16, padding: 12,
          background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)',
          borderRadius: 8, ...T.body, color: '#dc2626',
        }}>
          <strong>Reason:</strong> {failureReason || 'Unknown error.'}
          {onRetry && (
            <button className="ag-btn ag-btn--primary ag-btn--sm" style={{ marginLeft: 12 }} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}

      {!isFailed && (
        <div style={{ marginTop: 14, ...T.meta, fontStyle: 'italic' }}>
          Live web research takes 30 – 90 seconds. You can leave this page and come back; the report keeps generating in the background.
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────
export default function MIReportView({ authFetch, reportId, userRole, onBack }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);    // a deep clone of report.report_data when editing
  const [saving, setSaving] = useState(false);
  const pollRef = useRef(null);

  const canEdit = ['owner', 'team_lead', 'sr_recruiter', 'recruiter',
                   'admin', 'superuser', 'subuser'].includes(userRole);

  const load = useCallback(async () => {
    try {
      const r = await authFetch(`${BACKEND_URL}/mi/reports/${reportId}`);
      if (!r.ok) throw new Error('Report not found.');
      const d = await r.json();
      setReport(d.report);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [authFetch, reportId]);

  useEffect(() => { load(); }, [load]);

  // Poll while in-flight
  useEffect(() => {
    if (!report) return;
    const inFlight = ['pending', 'researching', 'structuring', 'generating'].includes(report.status);
    if (!inFlight) { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [report, load]);

  const handleRetry = async () => {
    try {
      const r = await authFetch(`${BACKEND_URL}/mi/reports/${reportId}/retry`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error || 'Retry failed.');
      load();
    } catch (e) { alert(e.message); }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/mi/reports/${reportId}/enrich-reputation`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error || 'Refresh failed.');
      load();
    } catch (e) { alert(e.message); }
    finally { setEnriching(false); }
  };

  const startEdit = () => {
    if (!report?.report_data) return;
    // Deep-clone via JSON round-trip — fields are all primitives/arrays/plain objects.
    setDraft(JSON.parse(JSON.stringify(report.report_data)));
    setEditMode(true);
  };
  const cancelEdit = () => { setDraft(null); setEditMode(false); };
  const saveEdit = async () => {
    setSaving(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/mi/reports/${reportId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_data: draft }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Save failed.');
      setEditMode(false); setDraft(null); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };
  const updateDraft = (path, value) => {
    setDraft(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  if (loading) return <div className="page-content"><div className="rpt-loading">Loading report…</div></div>;
  if (error)   return <div className="page-content"><div className="rpt-error">{error}</div></div>;
  if (!report) return null;

  // ── Header (always shown) ──────────────────────────────────────────────
  const jc = report.job_context || {};
  // When editMode is on, render against the draft so live edits are visible.
  const data = (editMode && draft) ? draft : (report.report_data || {});
  const sd   = data.structuredData || {};
  const isReady = report.status === 'completed';

  return (
    <div className="page-content">
      <div className="rpt-header">
        <div className="rpt-header-left">
          {onBack && <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={onBack}>← Back</button>}
          <div>
            <h1 className="rpt-title">{jc.title || 'Market Intelligence Report'}</h1>
            <p className="rpt-subtitle">
              {jc.industry || '—'} · {jc.location || '—'} · {jc.experienceLevel || '—'}
              {jc.clientName ? ` · for ${jc.clientName}` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }} data-print-hide>
          {isReady && !editMode && (
            <ExportPdfButton elementId="mi-report-content" jobTitle={jc.title} generatedAt={data.generatedAt} />
          )}
          {isReady && !editMode && canEdit && (
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={startEdit}>✎ Edit</button>
          )}
          {isReady && editMode && (
            <>
              <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
          {isReady && !editMode && (
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={handleEnrich} disabled={enriching}>
              {enriching ? 'Refreshing…' : '↻ Refresh Glassdoor'}
            </button>
          )}
        </div>
      </div>

      {/* Progress stepper while pipeline is running */}
      {!isReady && report.status !== 'failed' && (
        <ProgressStepper status={report.status} />
      )}
      {report.status === 'failed' && (
        <ProgressStepper status="failed" failureReason={report.failure_reason} onRetry={handleRetry} />
      )}

      {!isReady ? null : (
        <div id="mi-report-content">
          {/* ── Header card with skills + meta ── */}
          <div className="mi-card" style={{
            background: 'var(--surface-1, #fff)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '20px 22px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8, background: 'var(--navy, #1A2B4A)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>📊</div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, margin: 0, color: 'var(--text-1)' }}>{jc.title}</h1>
                <div style={{ ...T.meta, marginTop: 4 }}>
                  📍 {jc.location} · 💼 {jc.experienceLevel} · 📅 {fmtDate(data.generatedAt)}
                  {jc.noticePeriod ? ` · 🕐 ${jc.noticePeriod} preferred` : ''}
                </div>
              </div>
            </div>
            {Array.isArray(jc.mustHaveSkills) && jc.mustHaveSkills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {jc.mustHaveSkills.map(s => (
                  <span key={s} style={{
                    ...T.metaStrong, padding: '3px 9px', borderRadius: 4,
                    background: 'var(--orange-dim, rgba(249,115,22,0.10))',
                    color: 'var(--orange, #EA580C)', border: '1px solid var(--orange-border, rgba(249,115,22,0.25))',
                  }}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* ── Executive summary ── */}
          {(data.executiveSummary || editMode) && (
            <div className="mi-card" style={{
              background: 'var(--surface-1, #fff)', border: '1px solid var(--border)',
              borderLeft: '4px solid var(--orange, #F97316)', borderRadius: 12,
              padding: '20px 22px', marginBottom: 16,
            }}>
              <div style={{ ...T.eyebrow, color: 'var(--orange, #F97316)', letterSpacing: '0.12em', marginBottom: 8 }}>
                Executive Summary
              </div>
              {editMode ? (
                <textarea
                  value={data.executiveSummary || ''}
                  onChange={(e) => updateDraft('executiveSummary', e.target.value)}
                  rows={5}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 12,
                    border: '1px solid var(--border)', borderRadius: 6,
                    ...T.body, fontFamily: 'inherit', resize: 'vertical' }}
                />
              ) : (
                <p style={{ ...T.body, margin: 0 }}>
                  {data.executiveSummary}
                </p>
              )}
            </div>
          )}

          {/* ── 1. Demand Analysis ── */}
          {sd.demandAnalysis && (
            <SectionCard icon="📈" title="Demand Analysis" confidence={sd.demandAnalysis.confidence}>
              <MetricStrip items={[
                { label: 'YoY Growth',    value: sd.demandAnalysis.growthRate || '—', big: true },
                { label: 'Hot Locations', value: (sd.demandAnalysis.hotLocations || []).length, sub: (sd.demandAnalysis.hotLocations || []).slice(0,3).join(', ') },
              ]} />
              <p style={{ ...T.body, margin: '8px 0 0' }}>
                {sd.demandAnalysis.jobPostingTrends}
              </p>
              {sd.demandAnalysis.hotLocations?.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sd.demandAnalysis.hotLocations.map((l, i) => (
                    <span key={i} style={{ ...T.metaStrong, padding: '3px 8px', borderRadius: 4,
                      background: 'var(--muted)', border: '1px solid var(--border)' }}>
                      📍 {l}
                    </span>
                  ))}
                </div>
              )}
              <SourceLinks sources={sd.demandAnalysis.sources} />
            </SectionCard>
          )}

          {/* ── 2. Talent Availability ── */}
          {sd.talentAvailability && (
            <SectionCard icon="👥" title="Talent Availability" confidence={sd.talentAvailability.confidence}>
              <MetricStrip items={[
                { label: 'Total Pool',         value: sd.talentAvailability.totalPool || '—', big: true },
                { label: 'Active Job Seekers', value: sd.talentAvailability.activeJobSeekers || '—' },
                { label: 'Passive Candidates', value: sd.talentAvailability.passiveCandidates || '—' },
              ]} />
              {sd.talentAvailability.tierCityBreakdown && Object.keys(sd.talentAvailability.tierCityBreakdown).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ ...T.eyebrow, marginBottom: 6 }}>By City Tier</div>
                  <HorizontalBarChart
                    data={Object.entries(sd.talentAvailability.tierCityBreakdown).map(([k, v]) => ({ name: k, value: v }))}
                    color="#3b82f6"
                  />
                </div>
              )}
              <SourceLinks sources={sd.talentAvailability.sources} />
            </SectionCard>
          )}

          {/* ── 3. Salary Benchmarks ── */}
          {sd.salaryBenchmarks && (
            <SectionCard icon="💰" title="Salary Benchmarks (LPA)" confidence={sd.salaryBenchmarks.confidence}>
              <SalaryRangeChart
                minCTC={sd.salaryBenchmarks.minCTC}
                p25={sd.salaryBenchmarks.percentile25}
                median={sd.salaryBenchmarks.medianCTC}
                p75={sd.salaryBenchmarks.percentile75}
                maxCTC={sd.salaryBenchmarks.maxCTC}
              />
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[
                  ['Min',     sd.salaryBenchmarks.minCTC],
                  ['P25',     sd.salaryBenchmarks.percentile25],
                  ['Median',  sd.salaryBenchmarks.medianCTC],
                  ['P75',     sd.salaryBenchmarks.percentile75],
                  ['Max',     sd.salaryBenchmarks.maxCTC],
                ].map(([k, v], i) => (
                  <div key={i} style={{
                    padding: '8px 10px', background: 'var(--muted)', border: '1px solid var(--border)',
                    borderRadius: 6, textAlign: 'center',
                  }}>
                    <div style={{ ...T.eyebrow, marginBottom: 2 }}>{k}</div>
                    <div style={T.bodyStrong}>{v || '—'}</div>
                  </div>
                ))}
              </div>
              <SourceLinks sources={sd.salaryBenchmarks.sources} />
            </SectionCard>
          )}

          {/* ── 4. Skill Availability — the differentiated card ⭐ ── */}
          {sd.skillAvailability && Array.isArray(sd.skillAvailability.skills) && sd.skillAvailability.skills[0] && (() => {
            const row = sd.skillAvailability.skills[0];
            const sty = SKILL_TYPE_STYLE[row.skillType] || SKILL_TYPE_STYLE.Niche;
            return (
              <SectionCard icon="🎯" title="Combined-Skill Availability" confidence={sd.skillAvailability.confidence}
                highlight accent={sty.color}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: 14, background: sty.bg, border: `1px solid ${sty.border}`, borderRadius: 8, marginBottom: 14,
                }}>
                  <div style={{
                    ...T.eyebrow,
                    padding: '5px 14px', borderRadius: 999,
                    background: sty.color, color: '#fff',
                  }}>{sty.label}</div>
                  <div>
                    <div style={T.bodyMuted}>{sty.help}</div>
                    <div style={{ ...T.bodyStrong, color: sty.color, marginTop: 2 }}>{row.skill}</div>
                  </div>
                </div>
                <MetricStrip items={[
                  { label: 'Available Profiles', value: row.availableProfiles || '—' },
                  { label: 'Immediate',          value: row.immediate || '—' },
                  { label: '30 Days',            value: row.thirtyDays || '—' },
                  { label: '60 Days',            value: row.sixtyDays || '—' },
                ]} />
                {row.notes && (
                  <p style={{ ...T.bodyMuted, fontStyle: 'italic', marginTop: 10 }}>
                    {row.notes}
                  </p>
                )}
                <SourceLinks sources={sd.skillAvailability.sources} />
              </SectionCard>
            );
          })()}

          {/* ── 5. Competitor Companies ── */}
          {sd.competitorAnalysis?.topHiringCompanies && (
            <SectionCard icon="🏢" title="Top Hiring Companies" confidence={sd.competitorAnalysis.confidence}>
              <HorizontalBarChart
                data={sd.competitorAnalysis.topHiringCompanies.map(c => ({ name: c.name, value: c.openPositions }))}
              />
              <SourceLinks sources={sd.competitorAnalysis.sources} />
            </SectionCard>
          )}

          {/* ── 6. Joining Timelines ── */}
          {sd.joiningTimelines && (
            <SectionCard icon="⏱" title="Joining Timelines" confidence={sd.joiningTimelines.confidence}>
              <MetricStrip items={[
                { label: 'Avg Notice Period',        value: sd.joiningTimelines.averageNoticePeriod || '—', big: true },
                { label: 'Typical Time-to-Hire',    value: sd.joiningTimelines.typicalTimeToHire || '—',
                  sub: 'capped at 8 weeks' },
              ]} />
              {sd.joiningTimelines.preferredNoticePeriodFit && (
                <div style={{
                  marginTop: 10, padding: 10,
                  background: 'var(--muted)', borderLeft: '3px solid var(--text-3)', borderRadius: 4,
                  ...T.body,
                }}>
                  <strong style={{ color: 'var(--text-2)' }}>Notice Period Fit:</strong> {sd.joiningTimelines.preferredNoticePeriodFit}
                </div>
              )}
              {sd.joiningTimelines.buyoutTrends && (
                <p style={{ ...T.body, marginTop: 10 }}>
                  {sd.joiningTimelines.buyoutTrends}
                </p>
              )}
              <SourceLinks sources={sd.joiningTimelines.sources} />
            </SectionCard>
          )}

          {/* ── 7. Talent Reputation ── */}
          {sd.talentReputation?.companies && (
            <SectionCard icon="⭐" title="Talent Reputation (Glassdoor)" confidence={sd.talentReputation.confidence}>
              <div style={{ display: 'grid', gap: 8 }}>
                {sd.talentReputation.companies.map((c, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'center',
                    padding: '10px 12px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6,
                  }}>
                    <div style={T.bodyStrong}>{c.name}</div>
                    <StarRating rating={c.rating} />
                    <div style={T.metaStrong}>
                      {c.recommendationRate || '—'}
                    </div>
                  </div>
                ))}
              </div>
              {sd.talentReputation.ratingSource && (
                <div style={{ ...T.meta, marginTop: 8, fontStyle: 'italic' }}>
                  Source: {sd.talentReputation.ratingSource}
                </div>
              )}
              <SourceLinks sources={sd.talentReputation.sources} />
            </SectionCard>
          )}

          {/* ── 8. Key Trends ── */}
          {sd.keyTrends?.trends && (
            <SectionCard icon="📊" title="Key Market Trends" confidence={sd.keyTrends.confidence}>
              <EditableList
                items={sd.keyTrends.trends}
                editMode={editMode}
                onChange={(next) => updateDraft('structuredData.keyTrends.trends', next)}
                ordered={false}
              />
              <SourceLinks sources={sd.keyTrends.sources} />
            </SectionCard>
          )}

          {/* ── 9. Positioning Recommendations ── */}
          {sd.positioningRecommendations?.recommendations && (
            <SectionCard icon="🎯" title="Positioning Recommendations" confidence={sd.positioningRecommendations.confidence}>
              <EditableList
                items={sd.positioningRecommendations.recommendations}
                editMode={editMode}
                onChange={(next) => updateDraft('structuredData.positioningRecommendations.recommendations', next)}
                ordered={true}
              />
              <SourceLinks sources={sd.positioningRecommendations.sources} />
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
