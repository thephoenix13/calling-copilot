/**
 * HMApp — top-level Hiring Manager portal.
 * Routed from App.jsx when userRole === 'hiring_manager'. Bypasses the
 * normal recruiter-facing AppShell entirely and renders only the slimmed-
 * down stakeholder view.
 */

import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const REC_LABELS = {
  strong_yes: 'Strong Yes', yes: 'Yes', maybe: 'Maybe', no: 'No', strong_no: 'Strong No',
};
const REC_COLORS = {
  strong_yes: '#10b981', yes: '#34d399', maybe: '#f59e0b', no: '#f87171', strong_no: '#dc2626',
};

const PIPE_LABELS = {
  selected: 'Selected', pending: 'In Process', hold: 'On Hold', reject: 'Rejected',
};
const PIPE_COLORS = {
  selected: '#10b981', pending: '#3b82f6', hold: '#f59e0b', reject: '#94a3b8',
};

const fmtDate = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt.replace ? dt.replace(' ', 'T') : dt)
      .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

// ─── Header ────────────────────────────────────────────────────────────────
function Header({ displayName, onLogout }) {
  return (
    <header style={{
      background: '#1A2B4A', color: '#fff',
      padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16,
      borderBottom: '4px solid #F97316',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/zeople-logo.png" alt="" style={{ width: 32, height: 32 }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#F97316' }}>ZEOPLE</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Hiring Manager Portal</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{displayName}</span>
      <button onClick={onLogout} style={{
        background: 'rgba(255,255,255,0.08)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
        padding: '6px 12px', fontSize: 12, cursor: 'pointer',
      }}>Sign out</button>
    </header>
  );
}

// ─── Job List ──────────────────────────────────────────────────────────────
function JobsList({ authFetch, onOpenJob }) {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${BACKEND_URL}/hm/jobs`);
        if (!r.ok) throw new Error('Could not load your jobs');
        const d = await r.json();
        setJobs(d.jobs || []);
      } catch (e) { setError(e.message); }
      finally   { setLoading(false); }
    })();
  }, [authFetch]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading…</div>;
  if (error)   return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Your jobs</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        {jobs.length === 0
          ? 'No jobs have been shared with you yet.'
          : `${jobs.length} job${jobs.length === 1 ? '' : 's'} you're hiring for.`}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {jobs.map(j => (
          <div key={j.id}
            onClick={() => onOpenJob(j.id)}
            style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
              padding: 18, cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)'; }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>{j.title}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{j.client_name || '—'} · {j.location || ''}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(j.required_skills || []).slice(0, 4).map(s => (
                <span key={s} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA',
                }}>{s}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
              Shared {fmtDate(j.added_at)} · {j.openings_count} opening{j.openings_count === 1 ? '' : 's'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feedback form per candidate ───────────────────────────────────────────
function FeedbackForm({ authFetch, jobId, candidate, onSaved }) {
  const [rec,   setRec]   = useState(candidate.hm_recommendation || '');
  const [notes, setNotes] = useState(candidate.hm_notes || '');
  const [busy,  setBusy]  = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setBusy(true); setSaved(false);
    try {
      const r = await authFetch(`${BACKEND_URL}/hm/jobs/${jobId}/candidates/${candidate.id}/feedback`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recommendation: rec || null, notes: notes || null }),
      });
      if (r.ok) {
        setSaved(true);
        if (onSaved) onSaved();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, padding: 12, background: '#F8FAFC', borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: 8 }}>YOUR RECOMMENDATION</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.entries(REC_LABELS).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setRec(rec === k ? '' : k)}
            style={{
              fontSize: 12, fontWeight: 600,
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
              background: rec === k ? REC_COLORS[k] : '#fff',
              color:      rec === k ? '#fff' : REC_COLORS[k],
              border:     `1px solid ${REC_COLORS[k]}`,
            }}
          >{label}</button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes for the recruiter (optional)…"
        rows={3}
        style={{
          width: '100%', fontSize: 13, padding: '8px 10px',
          border: '1px solid #E2E8F0', borderRadius: 6, fontFamily: 'inherit',
          resize: 'vertical', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            background: '#F97316', color: '#fff',
            border: 'none', borderRadius: 6, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >{busy ? 'Saving…' : 'Save feedback'}</button>
        {saved && <span style={{ fontSize: 12, color: '#059669' }}>✓ Saved</span>}
        {candidate.hm_updated_at && !saved && (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Last saved {fmtDate(candidate.hm_updated_at)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Job Detail ────────────────────────────────────────────────────────────
function JobDetail({ authFetch, jobId, onBack }) {
  const [job,        setJob]        = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [jr, cr] = await Promise.all([
        authFetch(`${BACKEND_URL}/hm/jobs/${jobId}`),
        authFetch(`${BACKEND_URL}/hm/jobs/${jobId}/candidates`),
      ]);
      if (!jr.ok || !cr.ok) throw new Error('Could not load job');
      const jd = await jr.json();
      const cd = await cr.json();
      setJob(jd.job);
      setCandidates(cd.candidates || []);
    } catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  }, [authFetch, jobId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading…</div>;
  if (error)   return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (!job)    return null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 40px' }}>
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', color: '#64748b',
        fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0,
      }}>← Back to your jobs</button>

      {/* Job header card */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: 0, marginBottom: 4 }}>{job.title}</h1>
        <div style={{ fontSize: 13, color: '#64748b' }}>{job.client_name || '—'} · {job.location || ''} · {job.openings_count} opening{job.openings_count === 1 ? '' : 's'}</div>
        {job.required_skills?.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {job.required_skills.map(s => (
              <span key={s} style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 4,
                background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA',
              }}>{s}</span>
            ))}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 12 }}>
        Candidates on the shortlist <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 13 }}>({candidates.length})</span>
      </h2>

      {candidates.length === 0 ? (
        <div style={{ background: '#F8FAFC', border: '1px dashed #E2E8F0', padding: 30, borderRadius: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No candidates have been shortlisted yet — your recruiter will share them here as they pass the screening stage.
        </div>
      ) : (
        candidates.map(c => {
          const pipeColor = PIPE_COLORS[c.pipeline_status] || '#94a3b8';
          const pipeLabel = PIPE_LABELS[c.pipeline_status] || c.pipeline_status;
          return (
            <div key={c.id} style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
              padding: 18, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {c.current_title || '—'}{c.current_company ? ` · ${c.current_company}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {c.experience_years != null ? `${c.experience_years} yrs · ` : ''}{c.location || ''}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>MATCH</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{c.match_percentage ?? '—'}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>VI SCORE</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{c.ai_interview_score ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>STATUS</div>
                    <span style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 4,
                      background: pipeColor + '18', color: pipeColor, border: `1px solid ${pipeColor}40`,
                    }}>{pipeLabel}</span>
                  </div>
                </div>
              </div>

              {c.vi_review && (
                <div style={{
                  marginTop: 12, padding: 10, background: '#F8FAFC',
                  borderLeft: '3px solid #cbd5e1', fontSize: 12, color: '#475569',
                  fontStyle: 'italic', lineHeight: 1.55,
                }}>
                  Recruiter note: {c.vi_review}
                </div>
              )}

              <FeedbackForm
                authFetch={authFetch}
                jobId={jobId}
                candidate={c}
                onSaved={load}
              />
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Top-level shell ───────────────────────────────────────────────────────
export default function HMApp({ authFetch, displayName, onLogout }) {
  const [view,    setView]    = useState('list'); // 'list' | 'detail'
  const [jobId,   setJobId]   = useState(null);

  const openJob = (id) => { setJobId(id); setView('detail'); };
  const back    = ()  => { setJobId(null); setView('list'); };

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Header displayName={displayName} onLogout={onLogout} />
      {view === 'list'   && <JobsList  authFetch={authFetch} onOpenJob={openJob} />}
      {view === 'detail' && <JobDetail authFetch={authFetch} jobId={jobId} onBack={back} />}
    </div>
  );
}
