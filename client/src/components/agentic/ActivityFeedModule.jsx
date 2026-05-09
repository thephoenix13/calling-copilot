import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Map raw action codes to human-readable labels + accent colors.
const ACTION_META = {
  'job.create':              { label: 'Created job',                  color: 'var(--orange)'  },
  'job.update':              { label: 'Updated job',                  color: '#3b82f6'        },
  'job.delete':              { label: 'Deleted job',                  color: '#dc2626'        },
  'job.assignee.add':        { label: 'Assigned a teammate',          color: 'var(--emerald)' },
  'job.assignee.remove':     { label: 'Unassigned a teammate',        color: '#94a3b8'        },
  'job.hm.attach':           { label: 'Attached a hiring manager',    color: '#7c3aed'        },
  'job.hm.detach':           { label: 'Detached a hiring manager',    color: '#94a3b8'        },
  'hm.feedback.submit':      { label: 'Hiring manager feedback',      color: '#10b981'        },
  'session.create':          { label: 'Created a hiring session',     color: 'var(--orange)'  },
  'session.candidate.update':{ label: 'Updated candidate state',      color: '#f59e0b'        },
};

const ENTITY_TYPES = [
  { value: '',                    label: 'All activity'        },
  { value: 'job',                 label: 'Jobs'                },
  { value: 'session',             label: 'Sessions'            },
  { value: 'session_candidate',   label: 'Pipeline updates'    },
  { value: 'candidate',           label: 'Candidate feedback'  },
];

const fmt = (dt) => {
  if (!dt) return '—';
  try {
    const d = new Date(dt.replace ? dt.replace(' ', 'T') + 'Z' : dt);
    const now = new Date();
    const diffMs = now - d;
    const min = Math.floor(diffMs / 60000);
    if (min < 1)    return 'just now';
    if (min < 60)   return `${min} min ago`;
    if (min < 1440) return `${Math.floor(min / 60)} hr ago`;
    if (min < 4320) return `${Math.floor(min / 1440)} d ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dt; }
};

function summarize(ev) {
  const m = ev.metadata || {};
  switch (ev.action) {
    case 'job.create':
    case 'job.update':
    case 'job.delete':
      return m.title ? `"${m.title}"${m.client ? ' · ' + m.client : ''}` : `#${ev.entity_id}`;
    case 'job.assignee.add':
      return `User #${m.user_id} as ${m.role_on_job}`;
    case 'job.assignee.remove':
      return `User #${m.user_id}`;
    case 'job.hm.attach':
    case 'job.hm.detach':
      return `User #${m.user_id} on job #${ev.entity_id}`;
    case 'hm.feedback.submit':
      return `${m.recommendation ? `recommendation: ${m.recommendation.replace('_', ' ')}` : 'comment only'} on candidate #${ev.entity_id}`;
    case 'session.create':
      return m.name ? `"${m.name}"${m.job_id ? ' (job #' + m.job_id + ')' : ''}` : `#${ev.entity_id}`;
    case 'session.candidate.update': {
      const changes = Object.entries(m).filter(([k]) => k !== 'session_id');
      return changes.map(([k, v]) => `${k}: ${v}`).join(' · ');
    }
    default:
      return ev.entity_type ? `${ev.entity_type} #${ev.entity_id}` : '';
  }
}

const initials = (name) => (name || '?').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

export default function ActivityFeedModule({ authFetch, onBack }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filter) params.set('entity_type', filter);
      const r = await authFetch(`${BACKEND_URL}/admin/activity?${params}`);
      if (!r.ok) throw new Error('Could not load activity');
      const d = await r.json();
      setEvents(d.events || []);
    } catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  }, [authFetch, filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-content">
      <div className="rpt-header">
        <div className="rpt-header-left">
          {onBack && <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={onBack}>← Back</button>}
          <div>
            <h1 className="rpt-title">Activity Feed</h1>
            <p className="rpt-subtitle">Who did what across your company — owners and team leads only</p>
          </div>
        </div>
        <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={load}>↺ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 18px', flexWrap: 'wrap' }}>
        {ENTITY_TYPES.map(t => (
          <button
            key={t.value || 'all'}
            onClick={() => setFilter(t.value)}
            style={{
              fontSize: 12, fontWeight: 600,
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              background: filter === t.value ? 'var(--orange)' : 'var(--surface-1)',
              color:      filter === t.value ? '#fff'           : 'var(--text-2)',
              border:    `1px solid ${filter === t.value ? 'var(--orange)' : 'var(--border-1)'}`,
            }}
          >{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="rpt-loading">Loading activity…</div>
      ) : error ? (
        <div className="rpt-error">{error}</div>
      ) : events.length === 0 ? (
        <div className="rpt-empty">No activity recorded yet.</div>
      ) : (
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border-1)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {events.map((ev, i) => {
            const meta = ACTION_META[ev.action] || { label: ev.action, color: '#94a3b8' };
            return (
              <div key={ev.id} style={{
                display: 'grid',
                gridTemplateColumns: '38px 1fr auto',
                gap: 14,
                padding: '14px 18px',
                borderBottom: i < events.length - 1 ? '1px solid var(--border-1)' : 'none',
                alignItems: 'center',
              }}>
                {/* Avatar circle */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: meta.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>{initials(ev.display_name)}</div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text-1)', lineHeight: 1.45 }}>
                    <strong style={{ fontWeight: 600 }}>{ev.display_name || ev.email}</strong>
                    <span style={{ color: 'var(--text-2)' }}> · {meta.label.toLowerCase()}</span>
                    <span style={{ color: 'var(--text-3)' }}> — {summarize(ev)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {ev.user_role} · {ev.entity_type}#{ev.entity_id ?? '—'}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                  {fmt(ev.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
