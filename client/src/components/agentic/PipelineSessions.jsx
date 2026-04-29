import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STEP_LABELS = ['Select JD', 'Enhance JD', 'Source', 'Screening', 'AI Reports', 'Decision', 'Tracker'];

function StepBadge({ step }) {
  return (
    <div className="ps-step-badge" title={`Current step: ${STEP_LABELS[step - 1]}`}>
      Step {step} — {STEP_LABELS[step - 1]}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { active: ['ps-badge--active', 'Active'], completed: ['ps-badge--done', 'Completed'], archived: ['ps-badge--muted', 'Archived'] };
  const [cls, label] = map[status] || map.active;
  return <span className={`ps-badge ${cls}`}>{label}</span>;
}

export default function PipelineSessions({ authFetch, onBack, onOpenSession, isLight, onToggleTheme, onLogout }) {
  const [sessions, setSessions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [jobs, setJobs]             = useState([]);
  const [form, setForm]             = useState({ name: '', job_id: '' });
  const [creating, setCreating]     = useState(false);
  const [deleteId, setDeleteId]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, jRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/sessions`).then(r => r.json()),
        authFetch(`${BACKEND_URL}/jobs`).then(r => r.json()),
      ]);
      setSessions(sRes.sessions || []);
      setJobs((jRes.jobs || []).filter(j => j.status === 'active'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), job_id: form.job_id || undefined }),
      });
      const data = await res.json();
      if (data.id) {
        setShowCreate(false);
        setForm({ name: '', job_id: '' });
        onOpenSession(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await authFetch(`${BACKEND_URL}/sessions/${deleteId}`, { method: 'DELETE' });
      setSessions(s => s.filter(x => x.id !== deleteId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="page-content page-content--wide">

      <div className="ps-body">
        <div className="ps-toolbar">
          <h2 className="ps-page-title">Sessions</h2>
          <button className="ag-btn ag-btn--primary" onClick={() => setShowCreate(true)}>+ New Session</button>
        </div>

        {loading ? (
          <div className="ag-empty">Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="ps-empty-state">
            <div className="ps-empty-icon">🔄</div>
            <h3>No sessions yet</h3>
            <p>Create a session to run a guided 7-step recruitment pipeline for a job opening.</p>
            <button className="ag-btn ag-btn--primary" onClick={() => setShowCreate(true)}>+ New Session</button>
          </div>
        ) : (
          <div className="ps-sessions-grid">
            {sessions.map(s => (
              <div key={s.id} className="ps-session-card" onClick={() => onOpenSession(s.id)}>
                <div className="ps-session-header">
                  <div className="ps-session-name">{s.name || `Session #${s.id}`}</div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="ps-session-job">
                  {s.job_title ? `💼 ${s.job_title}${s.job_client ? ` — ${s.job_client}` : ''}` : '💼 No job selected'}
                </div>
                <div className="ps-session-meta">
                  <StepBadge step={s.current_step} />
                  <span className="ps-session-cands">👥 {s.candidate_count || 0} candidates</span>
                  <span className="ps-session-date">{new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="ps-session-progress">
                  {[1,2,3,4,5,6,7].map(n => (
                    <div key={n} className={`ps-prog-dot${n < s.current_step ? ' ps-prog-dot--done' : n === s.current_step ? ' ps-prog-dot--active' : ''}`} />
                  ))}
                </div>
                <button
                  className="ag-action-btn ag-action-btn--danger ps-delete-btn"
                  onClick={e => { e.stopPropagation(); setDeleteId(s.id); }}
                  title="Delete session"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="ag-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="ag-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">New Pipeline Session</h3>
            <div className="ag-form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="ag-field">
                <label className="ag-field-label">Session Name *</label>
                <input
                  className="ag-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Senior React Dev — Q2 2025"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="ag-field">
                <label className="ag-field-label">Job Opening (optional — can set in Step 1)</label>
                <select className="ag-input" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}>
                  <option value="">— Select a job —</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title}{j.client_name ? ` (${j.client_name})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleCreate} disabled={!form.name.trim() || creating}>
                {creating ? 'Creating…' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="ag-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="ag-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">Delete Session?</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '8px 0 0' }}>
              This will permanently delete the session and all its candidate data. This cannot be undone.
            </p>
            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="ag-btn ag-btn--danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
