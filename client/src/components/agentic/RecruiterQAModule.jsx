import { useState, useEffect, useMemo } from 'react';
import PerCallQAReport from '../PerCallQAReport';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const fmtDate = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt.replace ? dt.replace(' ', 'T') : dt)
      .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const fmtDur = (s) => {
  if (s == null) return '—';
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

const scoreColor = (n) => (n >= 70 ? 'var(--emerald)' : n >= 45 ? '#f59e0b' : '#f87171');
const RISK_COLORS = { low: 'var(--emerald)', medium: '#f59e0b', high: '#f87171', LOW: 'var(--emerald)', MEDIUM: '#f59e0b', HIGH: '#f87171' };

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rpt-stat-card">
      <div className="rpt-stat-value" style={color ? { color } : {}}>{value}</div>
      <div className="rpt-stat-label">{label}</div>
      {sub && <div className="rpt-stat-sub">{sub}</div>}
    </div>
  );
}

function Pill({ text, color }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '2px 7px', borderRadius: 4,
      background: `${color}18`, color, border: `1px solid ${color}40`,
      whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}

export default function RecruiterQAModule({ authFetch, onBack }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');
  const [sort,    setSort]    = useState('recent'); // recent | score-asc | score-desc

  // Drill-down state
  const [openCallSid, setOpenCallSid] = useState(null);
  const [openReport,  setOpenReport]  = useState(null);
  const [openLoading, setOpenLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${BACKEND_URL}/reports/qa-list`);
      if (!res.ok) throw new Error('Failed to load Recruiter QA data');
      const j = await res.json();
      setData(j);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openReportFor = async (callSid) => {
    setOpenCallSid(callSid);
    setOpenReport(null);
    setOpenLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/calls/${callSid}/reports`);
      if (!res.ok) throw new Error('Failed to load report');
      const j = await res.json();
      setOpenReport(j?.qaReport ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setOpenLoading(false);
    }
  };

  const closeReport = () => {
    setOpenCallSid(null);
    setOpenReport(null);
  };

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    const q = search.trim().toLowerCase();
    let rows = q
      ? data.rows.filter(r =>
          (r.recruiterName || '').toLowerCase().includes(q) ||
          (r.candidateName || '').toLowerCase().includes(q) ||
          (r.roleTitle     || '').toLowerCase().includes(q))
      : data.rows.slice();
    if (sort === 'score-asc')  rows.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    if (sort === 'score-desc') rows.sort((a, b) => (b.score ?? -1)  - (a.score ?? -1));
    // 'recent' is the server default order (generated_at DESC)
    return rows;
  }, [data, search, sort]);

  if (loading) return <div className="page-content"><div className="rpt-loading">Loading Recruiter QA…</div></div>;
  if (error)   return <div className="page-content"><div className="rpt-error">{error} <button onClick={load} className="ag-btn ag-btn--ghost ag-btn--sm">Retry</button></div></div>;
  if (!data)   return null;

  const { stats } = data;

  return (
    <div className="page-content">
      <div className="rpt-header">
        <div className="rpt-header-left">
          {onBack && <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={onBack}>← Back</button>}
          <div>
            <h1 className="rpt-title">Recruiter QA</h1>
            <p className="rpt-subtitle">Per-call scorecards, coaching nudges & dimension trends</p>
          </div>
        </div>
        <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={load}>↺ Refresh</button>
      </div>

      {/* KPI strip */}
      <div className="rpt-kpi-strip">
        <StatCard
          label="Calls Reviewed"
          value={stats.totalReviewed}
          sub="QA scorecards generated"
          color="var(--orange)"
        />
        <StatCard
          label="Avg QA Score"
          value={stats.avgScore != null ? `${stats.avgScore}` : '—'}
          sub="out of 100"
          color={stats.avgScore != null ? scoreColor(stats.avgScore) : undefined}
        />
        <StatCard
          label="Needs Coaching"
          value={`${stats.needsCoachingPct}%`}
          sub={`${stats.needsCoachingCount} call${stats.needsCoachingCount === 1 ? '' : 's'} below 70`}
          color="#f87171"
        />
        <StatCard
          label="Weakest Dimension"
          value={stats.topWeakDimension || '—'}
          sub="most common low-scoring area"
          color="var(--purple)"
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '20px 0 12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search recruiter, candidate, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 240, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border-1)', background: 'var(--surface-1)', color: 'var(--text-1)',
            fontSize: 13,
          }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border-1)', background: 'var(--surface-1)', color: 'var(--text-1)',
            fontSize: 13,
          }}
        >
          <option value="recent">Most Recent</option>
          <option value="score-asc">Lowest Score First</option>
          <option value="score-desc">Highest Score First</option>
        </select>
      </div>

      {/* Table */}
      <div className="rpt-card rpt-card--full">
        {filteredRows.length === 0 ? (
          <div className="rpt-empty">
            {data.rows.length === 0
              ? 'No QA reports yet — they’re generated automatically when a call ends in Calling CoPilot.'
              : 'No matches for your search.'}
          </div>
        ) : (
          <div className="rpt-jobs-table-wrap">
            <table className="rpt-jobs-table">
              <thead>
                <tr>
                  <th>Recruiter</th>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th className="rpt-th-num">Duration</th>
                  <th className="rpt-th-num">QA Score</th>
                  <th>Verdict</th>
                  <th>Risk</th>
                  <th>Weakest Dimension</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const sc = scoreColor(r.score);
                  const riskKey = (r.riskLevel || '').toLowerCase();
                  const riskColor = RISK_COLORS[riskKey] || '#94a3b8';
                  return (
                    <tr
                      key={r.callSid}
                      className="rpt-detail-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openReportFor(r.callSid)}
                    >
                      <td><strong>{r.recruiterName || '—'}</strong></td>
                      <td>{r.candidateName || '—'}</td>
                      <td className="rpt-td-muted">{r.roleTitle || '—'}</td>
                      <td className="rpt-td-muted">{fmtDate(r.startedAt)}</td>
                      <td className="rpt-td-num">{fmtDur(r.durationSec)}</td>
                      <td className="rpt-td-num"><strong style={{ color: sc }}>{r.score}</strong><span style={{ color: 'var(--text-3)' }}>/100</span></td>
                      <td>{r.verdict ? <Pill text={r.verdict} color={sc} /> : '—'}</td>
                      <td>{r.riskLevel ? <Pill text={r.riskLevel} color={riskColor} /> : '—'}</td>
                      <td className="rpt-td-muted">{r.weakestDimension || '—'}</td>
                      <td>
                        <button
                          className="ag-btn ag-btn--ghost ag-btn--sm"
                          onClick={(e) => { e.stopPropagation(); openReportFor(r.callSid); }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down overlay */}
      {openCallSid && (
        <div className="report-overlay">
          <div className="report-overlay-bar">
            <span className="report-overlay-title">Per-Call QA Report</span>
            <button className="report-close-btn" onClick={closeReport}>✕ Close</button>
          </div>
          <div className="report-overlay-body">
            {openLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '3rem', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <span className="spinner" /> Loading QA report…
              </div>
            ) : openReport ? (
              <PerCallQAReport reportData={openReport} />
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Report not available for this call.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
