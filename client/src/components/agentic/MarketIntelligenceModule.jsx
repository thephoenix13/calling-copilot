/**
 * MarketIntelligenceModule — top-level Insights module.
 *
 * Two views:
 *   - 'list'   list of past MI reports for the current user/team
 *   - 'detail' a single report (delegated to MIReportView)
 *   - 'new'    the new-report form (delegated to MIReportForm)
 */

import { useState, useEffect, useCallback } from 'react';
import MIReportForm from './MIReportForm';
import MIReportView from './MIReportView';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STATUS_PILL = {
  pending:      { bg: 'rgba(100,116,139,0.10)', color: '#64748b', border: 'rgba(100,116,139,0.30)', label: 'Queued' },
  researching:  { bg: 'rgba(124,58,237,0.10)',  color: '#7c3aed', border: 'rgba(124,58,237,0.30)',  label: 'Researching' },
  structuring:  { bg: 'rgba(124,58,237,0.10)',  color: '#7c3aed', border: 'rgba(124,58,237,0.30)',  label: 'Structuring' },
  generating:   { bg: 'rgba(124,58,237,0.10)',  color: '#7c3aed', border: 'rgba(124,58,237,0.30)',  label: 'Finalizing' },
  completed:    { bg: 'rgba(16,185,129,0.10)',  color: '#059669', border: 'rgba(16,185,129,0.30)',  label: 'Complete' },
  failed:       { bg: 'rgba(220,38,38,0.10)',   color: '#dc2626', border: 'rgba(220,38,38,0.30)',   label: 'Failed' },
};

const fmtDate = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt.replace ? dt.replace(' ', 'T') + 'Z' : dt)
      .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

export default function MarketIntelligenceModule({ authFetch, userRole }) {
  const [view,     setView]     = useState('list');   // 'list' | 'new' | 'detail'
  const [reportId, setReportId] = useState(null);
  const [reports,  setReports]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const canWrite = ['owner', 'team_lead', 'sr_recruiter', 'recruiter',
                    'admin', 'superuser', 'subuser'].includes(userRole);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await authFetch(`${BACKEND_URL}/mi/reports`);
      if (!r.ok) throw new Error('Could not load market intelligence reports');
      const d = await r.json();
      setReports(d.reports || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => {
    if (view === 'list') loadList();
  }, [view, loadList]);

  // ── Detail view ────────────────────────────────────────────────────────
  if (view === 'detail' && reportId) {
    return (
      <MIReportView
        authFetch={authFetch}
        reportId={reportId}
        userRole={userRole}
        onBack={() => { setView('list'); setReportId(null); }}
      />
    );
  }

  // ── New report form ────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <MIReportForm
        authFetch={authFetch}
        userRole={userRole}
        onBack={() => setView('list')}
        onCreated={(id) => { setReportId(id); setView('detail'); }}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
  return (
    <div className="page-content">
      <div className="rpt-header">
        <div className="rpt-header-left">
          <div>
            <h1 className="rpt-title">Market Intelligence</h1>
            <p className="rpt-subtitle">India hiring market reports — salary, demand, talent pool, competitor activity</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={loadList}>↺ Refresh</button>
          {canWrite && <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={() => setView('new')}>+ New Report</button>}
        </div>
      </div>

      {loading ? (
        <div className="rpt-loading">Loading reports…</div>
      ) : error ? (
        <div className="rpt-error">{error} <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={loadList}>Retry</button></div>
      ) : reports.length === 0 ? (
        <div className="rpt-empty" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 16 }}>
            No market intelligence reports yet.
          </p>
          {canWrite && (
            <button className="ag-btn ag-btn--primary" onClick={() => setView('new')}>
              Generate your first report
            </button>
          )}
        </div>
      ) : (
        <div className="rpt-card rpt-card--full">
          <div className="rpt-jobs-table-wrap">
            <table className="rpt-jobs-table">
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Location</th>
                  <th>Industry</th>
                  <th>Linked Job</th>
                  <th>Author</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const pill = STATUS_PILL[r.status] || STATUS_PILL.pending;
                  return (
                    <tr key={r.id} className="rpt-detail-row" style={{ cursor: 'pointer' }}
                      onClick={() => { setReportId(r.id); setView('detail'); }}
                    >
                      <td><strong>{r.job_context?.title || '—'}</strong></td>
                      <td className="rpt-td-muted">{r.job_context?.location || '—'}</td>
                      <td className="rpt-td-muted">{r.job_context?.industry || '—'}</td>
                      <td className="rpt-td-muted">{r.job_title || '—'}</td>
                      <td className="rpt-td-muted">{r.author_name || '—'}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 600,
                          padding: '3px 9px', borderRadius: 999,
                          background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`,
                        }}>{pill.label}</span>
                      </td>
                      <td className="rpt-td-muted">{fmtDate(r.created_at)}</td>
                      <td>
                        <button
                          className="ag-btn ag-btn--ghost ag-btn--sm"
                          onClick={(e) => { e.stopPropagation(); setReportId(r.id); setView('detail'); }}
                        >View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
