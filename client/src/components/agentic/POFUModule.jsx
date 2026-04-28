import { useState, useEffect, useCallback } from 'react';
import POFUCandidate from './POFUCandidate';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STATE_LABELS = {
  offer_accepted: 'Offer Accepted',
  resigned:       'Resigned',
  bgv:            'BGV',
  confirmed:      'Confirmed',
  joined:         'Joined',
  dropped:        'Dropped',
};

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const RISK_BG     = { low: 'rgba(16,185,129,.1)', medium: 'rgba(245,158,11,.1)', high: 'rgba(239,68,68,.1)' };

function RiskBadge({ level, score }) {
  return (
    <span style={{
      background: RISK_BG[level] || RISK_BG.low,
      color: RISK_COLORS[level] || RISK_COLORS.low,
      border: `1px solid ${RISK_COLORS[level]}40`,
      borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600,
    }}>
      {level === 'high' ? '🔴' : level === 'medium' ? '🟡' : '🟢'} {level.charAt(0).toUpperCase() + level.slice(1)} ({score})
    </span>
  );
}

export default function POFUModule({ authFetch, isLight, onToggleTheme, onLogout, onBack }) {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null); // POFUCandidate detail view
  const [showAdd, setShowAdd]       = useState(false);
  const [addForm, setAddForm]       = useState({ candidate_name: '', candidate_email: '', role_title: '', company_name: '', doj: '' });
  const [adding, setAdding]         = useState(false);
  const [addError, setAddError]     = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/pofu`).then(r => r.json()),
        authFetch(`${BACKEND_URL}/pofu/stats`).then(r => r.json()),
      ]);
      setCandidates(cRes.candidates || []);
      setStats(sRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAdd = async () => {
    if (!addForm.candidate_name.trim() || !addForm.candidate_email.trim()) {
      setAddError('Name and email are required.'); return;
    }
    setAdding(true); setAddError('');
    try {
      await authFetch(`${BACKEND_URL}/pofu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      setShowAdd(false);
      setAddForm({ candidate_name: '', candidate_email: '', role_title: '', company_name: '', doj: '' });
      await fetchAll();
    } catch (err) {
      setAddError('Failed to add candidate.');
    } finally {
      setAdding(false);
    }
  };

  if (selected) {
    return (
      <POFUCandidate
        candidateId={selected}
        authFetch={authFetch}
        isLight={isLight}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onBack={() => { setSelected(null); fetchAll(); }}
      />
    );
  }

  return (
    <div className={`app${isLight ? ' light' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <button className="report-btn" onClick={onBack}>← Agentic Home</button>
          <span className="logo">🎯</span>
          <h1>POFU <span style={{ fontSize: 12, background: 'var(--orange-dim)', color: 'var(--orange)', border: '1px solid var(--orange-border)', borderRadius: 6, padding: '2px 8px', marginLeft: 8, verticalAlign: 'middle' }}>Beta</span></h1>
        </div>
        <div className="header-right">
          <button className="theme-toggle-btn" onClick={onToggleTheme}>{isLight ? '🌙 Dark' : '☀️ Light'}</button>
          <button className="report-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <div className="pofu-page">
        {/* Stats strip */}
        {stats && (
          <div className="ag-stats-strip" style={{ marginBottom: 24 }}>
            <div className="ag-stat-card">
              <span className="ag-stat-value">{stats.total}</span>
              <span className="ag-stat-label">In POFU</span>
            </div>
            <div className="ag-stat-card">
              <span className="ag-stat-value" style={{ color: '#ef4444' }}>{stats.atRisk}</span>
              <span className="ag-stat-label">At Risk</span>
            </div>
            <div className="ag-stat-card">
              <span className="ag-stat-value" style={{ color: '#f59e0b' }}>{stats.medium}</span>
              <span className="ag-stat-label">Medium Risk</span>
            </div>
            <div className="ag-stat-card">
              <span className="ag-stat-value" style={{ color: '#10b981' }}>{stats.joiningThisWeek}</span>
              <span className="ag-stat-label">Joining This Week</span>
            </div>
            <div className="ag-stat-card">
              <span className="ag-stat-value">{stats.joined}</span>
              <span className="ag-stat-label">Joined</span>
            </div>
            <div className="ag-stat-card">
              <span className="ag-stat-value" style={{ color: 'var(--text-3)' }}>{stats.dropped}</span>
              <span className="ag-stat-label">Dropped</span>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="pofu-section-title">Candidates ({candidates.length})</div>
          <button className="ag-btn ag-btn--primary" onClick={() => setShowAdd(true)}>+ Add Manually</button>
        </div>

        {loading ? (
          <div className="sw-loading">Loading…</div>
        ) : candidates.length === 0 ? (
          <div className="ag-empty">No candidates in POFU yet. Add manually or move selected candidates from Pipeline Tracker (Step 7).</div>
        ) : (
          <div className="pofu-list">
            {candidates.map(c => (
              <div key={c.id} className="pofu-row" onClick={() => setSelected(c.id)}>
                <div className="pofu-row-main">
                  <div className="pofu-row-name">{c.candidate_name}</div>
                  <div className="pofu-row-meta">
                    {c.role_title && <span>{c.role_title}</span>}
                    {c.company_name && <span>@ {c.company_name}</span>}
                    {c.doj && <span>DOJ: {new Date(c.doj).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                </div>
                <div className="pofu-row-right">
                  <span className="pofu-state-badge">{STATE_LABELS[c.state] || c.state}</span>
                  <RiskBadge level={c.risk_level} score={c.risk_score} />
                  {c.last_email_at && (
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Last email: {new Date(c.last_email_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add manually modal */}
      {showAdd && (
        <div className="ag-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="ag-modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">Add Candidate to POFU</h3>
            {addError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{addError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Candidate Name *', key: 'candidate_name', placeholder: 'Priya Kapoor' },
                { label: 'Email *',          key: 'candidate_email', placeholder: 'priya@email.com' },
                { label: 'Role Title',       key: 'role_title',      placeholder: 'Sr. React Developer' },
                { label: 'Company / Client', key: 'company_name',    placeholder: 'Razorpay' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    className="ag-input"
                    placeholder={f.placeholder}
                    value={addForm[f.key]}
                    onChange={e => setAddForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Date of Joining</label>
                <input
                  type="date"
                  className="ag-input"
                  value={addForm.doj}
                  onChange={e => setAddForm(fm => ({ ...fm, doj: e.target.value }))}
                />
              </div>
            </div>
            <div className="ag-modal-actions" style={{ marginTop: 20 }}>
              <button className="ag-btn ag-btn--ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleAdd} disabled={adding}>
                {adding ? 'Adding…' : 'Add to POFU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
