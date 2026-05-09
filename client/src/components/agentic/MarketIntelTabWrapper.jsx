/**
 * MarketIntelTabWrapper — embedded MI report inside the JD Enhancer tab.
 *
 * Replaces the legacy shallow MarketIntelligenceTab. Wraps the same
 * generation form + report view used by the standalone Market Intelligence
 * module under Insights, but pre-fills from the JD Enhancer's JD text.
 *
 * Critical: the JDE's own parsedJob shape doesn't carry the strict enums
 * the MI pipeline requires (industry / experienceLevel / noticePeriod), so
 * we run /mi/parse-jd on the raw JD text — the dedicated MI parser uses
 * an enum-allowlisted tool and returns a fully-shaped JobContext.
 *
 * Flow:
 *   no-existing-report  → "Generate report" → POST /mi/parse-jd(jdText)
 *                         → MIReportForm with prefillJobContext → polls → MIReportView
 *   existing-report     → list of past reports for this title, click to open
 */

import { useState, useEffect, useCallback } from 'react';
import MIReportForm from './MIReportForm';
import MIReportView from './MIReportView';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STATUS_PILL = {
  pending:      { color: '#64748b', label: 'Queued' },
  researching:  { color: '#7c3aed', label: 'Researching' },
  structuring:  { color: '#7c3aed', label: 'Structuring' },
  generating:   { color: '#7c3aed', label: 'Finalizing' },
  completed:    { color: '#059669', label: 'Complete' },
  failed:       { color: '#dc2626', label: 'Failed' },
};

const fmtDate = (dt) => {
  if (!dt) return '—';
  try { return new Date(dt.replace ? dt.replace(' ', 'T') + 'Z' : dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};

export default function MarketIntelTabWrapper({ authFetch, userRole, parsedJob, jdText, jobId }) {
  const [view, setView] = useState('list');     // 'list' | 'form' | 'detail'
  const [reportId, setReportId] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedContext, setParsedContext] = useState(null);  // strict JobContext from /mi/parse-jd

  const canWrite = ['owner', 'team_lead', 'sr_recruiter', 'recruiter',
                    'admin', 'superuser', 'subuser'].includes(userRole);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = jobId
        ? `${BACKEND_URL}/mi/reports?job_id=${jobId}`
        : `${BACKEND_URL}/mi/reports`;
      const r = await authFetch(url);
      if (!r.ok) { setReports([]); return; }
      const d = await r.json();
      // If no jobId, narrow client-side by matching the parsed title (best effort).
      const filtered = jobId
        ? (d.reports || [])
        : (d.reports || []).filter(rep =>
            parsedJob?.title && (rep.job_context?.title || '').toLowerCase().includes(parsedJob.title.toLowerCase().slice(0, 20))
          );
      setReports(filtered);
    } finally { setLoading(false); }
  }, [authFetch, jobId, parsedJob]);

  useEffect(() => { if (view === 'list') loadReports(); }, [view, loadReports]);

  // Run the dedicated MI Stage-0 parser, then open the form pre-filled.
  const startGenerate = async () => {
    setParseError('');
    const text = (jdText && jdText.trim().length >= 20) ? jdText : '';
    if (!text) {
      // No JD text — open the form with whatever we have from JDE as a soft seed.
      setParsedContext(parsedJob ? {
        title:                  parsedJob.title || '',
        clientName:             parsedJob.client_name || '',
        mustHaveSkills:         Array.isArray(parsedJob.required_skills) ? parsedJob.required_skills : [],
        detailedJobDescription: '',
      } : null);
      setView('form');
      return;
    }

    setParsing(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/mi/parse-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Parse failed.');
      // Merge JDE-known fields the MI parser may not infer (clientName).
      const merged = {
        ...d.fields,
        clientName: d.fields.clientName || parsedJob?.client_name || '',
      };
      setParsedContext(merged);
      setView('form');
    } catch (e) {
      setParseError(e.message);
    } finally {
      setParsing(false);
    }
  };

  // ── Detail view ────────────────────────────────────────────────────────
  if (view === 'detail' && reportId) {
    return (
      <div style={{ marginTop: -16 /* Compensate for tab padding */ }}>
        <MIReportView
          authFetch={authFetch}
          reportId={reportId}
          userRole={userRole}
          onBack={() => { setView('list'); setReportId(null); loadReports(); }}
        />
      </div>
    );
  }

  // ── Form view (prefilled from MI parser) ───────────────────────────────
  if (view === 'form') {
    return (
      <div style={{ marginTop: -16 }}>
        <MIReportForm
          authFetch={authFetch}
          userRole={userRole}
          prefillJobContext={parsedContext}
          prefillJobId={jobId || null}
          onBack={() => setView('list')}
          onCreated={(id) => { setReportId(id); setView('detail'); }}
        />
      </div>
    );
  }

  // ── List view (this job's MI history) ──────────────────────────────────
  const hasJdText = jdText && jdText.trim().length >= 20;
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            Market Intelligence Reports
            {parsedJob?.title && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · for "{parsedJob.title}"</span>}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 0' }}>
            Live India market data: salary, demand, talent pool, competitor activity, Glassdoor reputation.
          </p>
        </div>
        {canWrite && (
          <button
            className="ag-btn ag-btn--primary"
            onClick={startGenerate}
            disabled={parsing || (!hasJdText && !parsedJob)}
          >
            {parsing ? 'Reading JD…' : '+ Generate Report'}
          </button>
        )}
      </div>

      {parseError && (
        <div className="sett-error" style={{ marginBottom: 12 }}>{parseError}</div>
      )}

      {!hasJdText && !parsedJob && (
        <div style={{
          padding: '12px 14px', background: 'var(--orange-dim, rgba(249,115,22,0.10))',
          border: '1px solid var(--orange-border, rgba(249,115,22,0.25))', borderRadius: 8,
          fontSize: 12, color: 'var(--text-2)',
        }}>
          Run the JD enhancement first — Market Intelligence prefills from the parsed job fields.
        </div>
      )}

      {loading ? (
        <div className="jde-tab-empty" style={{ padding: '2rem' }}>Loading…</div>
      ) : reports.length === 0 ? (
        <div className="jde-tab-empty" style={{ flexDirection: 'column', gap: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>📊</div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: 0 }}>
            No market intelligence report for this role yet.
          </p>
          {(hasJdText || parsedJob) && canWrite && (
            <button className="ag-btn ag-btn--primary" onClick={startGenerate} disabled={parsing}>
              {parsing ? 'Reading JD…' : 'Generate first report'}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {reports.map(r => {
            const pill = STATUS_PILL[r.status] || STATUS_PILL.pending;
            return (
              <div key={r.id}
                onClick={() => { setReportId(r.id); setView('detail'); }}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12,
                  padding: '10px 14px', background: 'var(--surface-1, #fff)',
                  border: '1px solid var(--border-1, #E2E8F0)', borderRadius: 8, cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    {r.job_context?.title || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {r.job_context?.location || '—'} · {r.author_name || '—'} · {fmtDate(r.created_at)}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '3px 9px', borderRadius: 999, color: pill.color,
                  background: pill.color + '18', border: `1px solid ${pill.color}40`,
                }}>{pill.label}</span>
                <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={(e) => { e.stopPropagation(); setReportId(r.id); setView('detail'); }}>
                  Open
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
