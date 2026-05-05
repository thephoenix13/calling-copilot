import { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`asmnt-status asmnt-status--${status}`}>
      {status === 'active' ? '● ' : status === 'closed' ? '✕ ' : '○ '}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Difficulty badge ──────────────────────────────────────────────────────────
function DiffBadge({ diff }) {
  if (!diff) return null;
  return <span className={`asmnt-diff-badge asmnt-diff-badge--${diff}`}>{diff}</span>;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return <span className="spinner" style={{ display: 'inline-block', marginRight: 6 }} />;
}

// ── Create / Edit Assessment Modal ────────────────────────────────────────────
function AssessmentFormModal({ initial, jobs, onSave, onClose, loading, onNavigate }) {
  const blank = { title: '', description: '', instructions: '', job_id: '', time_limit_min: 30, pass_score: 60, status: 'draft' };
  const [form, setForm] = useState(initial ? { ...blank, ...initial, pass_score: initial.pass_score || initial.pass_score_pct || 60 } : blank);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    setErr('');
    onSave(form);
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">{initial ? 'Edit Assessment' : 'New Assessment'}</h3>
        {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Title *</label>
            <input className="ag-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. React Developer MCQ Round" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="ag-textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of this assessment" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Instructions (shown to candidates)</label>
            <textarea className="ag-textarea" rows={3} value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="e.g. Read each question carefully. You have one attempt." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Linked Job</label>
            <select className="ag-input" value={form.job_id} onChange={e => set('job_id', e.target.value)}>
              <option value="">— None —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            {onNavigate && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>
                Don't see your job?{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}
                  onClick={() => { onClose(); onNavigate('jobs'); }}
                >
                  Go to Job Management →
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Time Limit (minutes)</label>
              <input className="ag-input" type="number" min={5} max={180} value={form.time_limit_min} onChange={e => set('time_limit_min', Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Pass Score %</label>
              <input className="ag-input" type="number" min={0} max={100} value={form.pass_score} onChange={e => set('pass_score', Number(e.target.value))} />
            </div>
          </div>
          {initial && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Status</label>
              <select className="ag-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}
        </div>

        <div className="ag-modal-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={loading}>
            {loading ? <><Spinner />Saving…</> : (initial ? 'Save Changes' : 'Create Assessment')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Question Form Modal ───────────────────────────────────────────────────────
function QuestionModal({ initial, onSave, onClose, loading }) {
  const blank = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', explanation: '', topic: '', difficulty: 'medium' };
  const [form, setForm] = useState(initial || blank);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.question_text.trim()) { setErr('Question text is required.'); return; }
    if (!form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) {
      setErr('All four options are required.'); return;
    }
    setErr('');
    onSave(form);
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">{initial ? 'Edit Question' : 'Add Question'}</h3>
        {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Question *</label>
            <textarea className="ag-textarea" rows={3} value={form.question_text} onChange={e => set('question_text', e.target.value)} placeholder="Enter your question here…" />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Options *</label>
            <div className="asmnt-options-grid">
              {['a', 'b', 'c', 'd'].map(opt => (
                <div key={opt} className="asmnt-option-row">
                  <span className="asmnt-option-label">{opt.toUpperCase()}</span>
                  <input className="ag-input" style={{ flex: 1 }} value={form[`option_${opt}`]} onChange={e => set(`option_${opt}`, e.target.value)} placeholder={`Option ${opt.toUpperCase()}`} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Correct Option</label>
              <select className="ag-input" value={form.correct_option} onChange={e => set('correct_option', e.target.value)}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Difficulty</label>
              <select className="ag-input" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Topic</label>
              <input className="ag-input" value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. React Hooks" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Explanation (optional)</label>
            <textarea className="ag-textarea" rows={2} value={form.explanation} onChange={e => set('explanation', e.target.value)} placeholder="Explain why this is the correct answer…" />
          </div>
        </div>

        <div className="ag-modal-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={loading}>
            {loading ? <><Spinner />Saving…</> : (initial ? 'Update Question' : 'Add Question')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Generate Modal ─────────────────────────────────────────────────────────
function AIGenerateModal({ assessmentId, authFetch, onGenerated, onClose }) {
  const [count, setCount]         = useState(10);
  const [topic, setTopic]         = useState('');
  const [difficulty, setDifficulty] = useState('mixed');
  const [generating, setGenerating] = useState(false);
  const [err, setErr]             = useState('');
  const [ctx, setCtx]             = useState(null);   // ai-context result
  const [ctxLoading, setCtxLoading] = useState(true);

  // Fetch context info when modal opens
  useEffect(() => {
    authFetch(`${BACKEND_URL}/assessments/${assessmentId}/ai-context`)
      .then(r => r.json())
      .then(d => setCtx(d))
      .catch(() => setCtx(null))
      .finally(() => setCtxLoading(false));
  }, [assessmentId, authFetch]);

  const handleGenerate = async () => {
    setGenerating(true);
    setErr('');
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments/${assessmentId}/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, topic: topic.trim() || undefined, difficulty }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      await res.json();
      onGenerated();
    } catch (e) {
      setErr(e.message);
      setGenerating(false);
    }
  };

  // Context info panel
  const ContextPanel = () => {
    if (ctxLoading) {
      return (
        <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spinner /><span style={{ color: 'var(--text-3)' }}>Checking available context…</span>
        </div>
      );
    }
    if (!ctx) return null;

    const rows = [];
    if (ctx.job) {
      rows.push({ label: 'Linked Job', value: ctx.job.title + (ctx.job.client_name ? ` @ ${ctx.job.client_name}` : ''), ok: true });
    } else {
      rows.push({ label: 'Linked Job', value: 'None — questions will be generic', ok: false });
    }
    if (ctx.has_session_assets) {
      rows.push({ label: 'JD Enhancer Assets', value: 'Full assets available (session)', ok: true });
    } else if (ctx.has_enhancer_assets) {
      rows.push({ label: 'JD Enhancer Assets', value: 'Assets found (JD Enhancer)', ok: true });
    } else {
      rows.push({ label: 'JD Enhancer Assets', value: 'Not prepared — only job details will be used', ok: false });
    }

    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Context for Generation</div>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: r.ok ? '#34d399' : '#f59e0b', fontSize: 14, lineHeight: 1.2 }}>{r.ok ? '✓' : '!'}</span>
            <span>
              <span style={{ color: 'var(--text-3)' }}>{r.label}: </span>
              <span style={{ color: r.ok ? 'var(--text-1)' : '#f59e0b', fontWeight: 600 }}>{r.value}</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="ag-modal-overlay" onClick={generating ? undefined : onClose}>
      <div className="ag-modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">✨ AI Generate Questions</h3>

        {generating ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <Spinner />
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 14, fontWeight: 600 }}>Generating {count} questions…</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>This may take 10–20 seconds. Please wait.</div>
          </div>
        ) : (
          <>
            {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</div>}

            <ContextPanel />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Number of Questions</label>
                <select className="ag-input" value={count} onChange={e => setCount(Number(e.target.value))}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Topic <span style={{ color: 'var(--text-3)' }}>(optional — overrides auto-selection)</span></label>
                <input className="ag-input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. React Hooks, SQL Joins, API Testing" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Difficulty</label>
                <select className="ag-input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed (30% easy / 50% medium / 20% hard)</option>
                </select>
              </div>
            </div>
            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--ghost" onClick={onClose}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleGenerate} disabled={ctxLoading}>Generate</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ assessmentId, authFetch, candidates, onInvited, onClose }) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  const filteredCandidates = candidates.filter(c => {
    const q = search.toLowerCase();
    const n = (c.name || c.candidate_name || '').toLowerCase();
    const e = (c.email || c.candidate_email || '').toLowerCase();
    return n.includes(q) || e.includes(q);
  });

  const addFromDB = (c) => {
    const em = (c.email || c.candidate_email || '').toLowerCase();
    if (!em) return;
    if (selected.find(s => s.email === em)) return;
    setSelected(s => [...s, { name: c.name || c.candidate_name, email: em, candidate_id: c.id }]);
    setSearch('');
  };

  const addManual = () => {
    if (!name.trim() || !email.trim()) { setErr('Name and email are required.'); return; }
    const em = email.trim().toLowerCase();
    if (selected.find(s => s.email === em)) { setErr('This email is already in the list.'); return; }
    setSelected(s => [...s, { name: name.trim(), email: em }]);
    setName(''); setEmail(''); setErr('');
  };

  const remove = (em) => setSelected(s => s.filter(x => x.email !== em));

  const handleSend = async () => {
    const toSend = selected.length > 0 ? selected : null;
    if (!toSend) { setErr('Add at least one candidate.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments/${assessmentId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: toSend }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      onInvited();
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 660, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">Invite Candidates</h3>
        {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</div>}

        {/* DB candidate search */}
        {candidates.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Search candidate database</label>
            <input
              className="ag-input"
              placeholder="Type name or email to filter…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)' }}>
                {filteredCandidates.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-3)' }}>No candidates match "{search}"</div>
                ) : filteredCandidates.map(c => {
                  const em = (c.email || c.candidate_email || '').toLowerCase();
                  const alreadyAdded = selected.find(s => s.email === em);
                  return (
                    <button
                      key={c.id}
                      onClick={() => addFromDB(c)}
                      disabled={!!alreadyAdded}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
                        background: 'none', border: 'none', cursor: alreadyAdded ? 'default' : 'pointer',
                        textAlign: 'left', borderBottom: '1px solid var(--border-subtle)',
                        opacity: alreadyAdded ? 0.5 : 1,
                      }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>
                        {(c.name || c.candidate_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{c.name || c.candidate_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{em}</div>
                      </div>
                      {alreadyAdded && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#34d399' }}>✓ Added</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Manual add */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Add manually</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="ag-input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addManual()} />
            <input className="ag-input" placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addManual()} />
            <button className="ag-btn ag-btn--ghost" onClick={addManual} style={{ whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>

        {/* Selected list */}
        {selected.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
              Will send invite to ({selected.length}):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selected.map(s => (
                <div key={s.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: 'var(--text-3)' }}>{s.email}</span>
                  <button onClick={() => remove(s.email)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ag-modal-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="ag-btn ag-btn--primary" onClick={handleSend} disabled={loading || selected.length === 0}>
            {loading ? <><Spinner />Sending…</> : `Send ${selected.length > 0 ? `${selected.length} ` : ''}Invite${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Eval Report Modal ─────────────────────────────────────────────────────────
function EvalReportModal({ submission, assessment, onClose }) {
  const ev = submission.ai_evaluation || {};
  const passFail = (submission.score ?? 0) >= (assessment.pass_score || 60) ? 'pass' : 'fail';

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 640, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">Evaluation Report — {submission.candidate_name}</h3>

        {/* Score hero */}
        <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
          <div className="ca-result-score">{submission.score ?? 0}%</div>
          <span className={`asmnt-status asmnt-status--${passFail === 'pass' ? 'active' : 'closed'}`} style={{ fontSize: 13 }}>
            {passFail === 'pass' ? '✓ Pass' : '✕ Fail'}
          </span>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>
            {submission.correct_count} / {submission.total_questions} correct · Time: {fmtTime(submission.time_taken_sec)}
          </div>
        </div>

        {/* Summary */}
        {ev.summary && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {ev.summary}
          </div>
        )}

        {/* Recommendation */}
        {ev.recommendation && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Recommendation</div>
            <span className={`asmnt-rec--${(ev.recommendation || '').toLowerCase().replace(/\s/g,'_')}`} style={{ fontWeight: 700, fontSize: 14 }}>
              {ev.recommendation}
            </span>
            {ev.recommendation_note && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>{ev.recommendation_note}</div>}
          </div>
        )}

        {/* Topic scores + difficulty */}
        <div className="asmnt-eval-grid">
          {ev.topic_scores && Object.keys(ev.topic_scores).length > 0 && (
            <div className="asmnt-eval-section">
              <div className="asmnt-eval-label">Topic Scores</div>
              {Object.entries(ev.topic_scores).map(([topic, score]) => (
                <div key={topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{topic}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{score}%</span>
                </div>
              ))}
            </div>
          )}
          {ev.difficulty_breakdown && Object.keys(ev.difficulty_breakdown).length > 0 && (
            <div className="asmnt-eval-section">
              <div className="asmnt-eval-label">By Difficulty</div>
              {Object.entries(ev.difficulty_breakdown).map(([diff, val]) => (
                <div key={diff} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <DiffBadge diff={diff} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{val}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strengths & gaps */}
        {(ev.strengths?.length > 0 || ev.gaps?.length > 0) && (
          <div className="asmnt-eval-grid">
            {ev.strengths?.length > 0 && (
              <div className="asmnt-eval-section">
                <div className="asmnt-eval-label">Strengths</div>
                <div className="asmnt-chip-list">
                  {ev.strengths.map((s, i) => <span key={i} className="asmnt-chip" style={{ color: '#34d399' }}>{s}</span>)}
                </div>
              </div>
            )}
            {ev.gaps?.length > 0 && (
              <div className="asmnt-eval-section">
                <div className="asmnt-eval-label">Gaps</div>
                <div className="asmnt-chip-list">
                  {ev.gaps.map((g, i) => <span key={i} className="asmnt-chip" style={{ color: '#f87171' }}>{g}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Question-by-question */}
        {submission.answers?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Question Breakdown</div>
            {submission.answers.map((ans, i) => (
              <div key={i} className="asmnt-q-result">
                <span className="asmnt-q-result-icon">{ans.is_correct ? '✅' : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 3 }}>{i + 1}. {ans.question_text}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Your answer: <strong>{ans.selected_option}</strong>
                    {!ans.is_correct && <> · Correct: <strong style={{ color: '#34d399' }}>{ans.correct_option}</strong></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="ag-modal-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Questions Tab ─────────────────────────────────────────────────────────────
function QuestionsTab({ assessment, authFetch, onRefresh }) {
  const [showAddQ, setShowAddQ] = useState(false);
  const [editQ, setEditQ] = useState(null);
  const [showAIGen, setShowAIGen] = useState(false);
  const [savingQ, setSavingQ] = useState(false);

  const questions = assessment.questions || [];

  const handleAddQuestion = async (form) => {
    setSavingQ(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments/${assessment.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to add question.');
      setShowAddQ(false);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingQ(false);
    }
  };

  const handleEditQuestion = async (form) => {
    setSavingQ(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments/${assessment.id}/questions/${editQ.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to update question.');
      setEditQ(null);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingQ(false);
    }
  };

  const handleDeleteQuestion = async (qid) => {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    try {
      await authFetch(`${BACKEND_URL}/assessments/${assessment.id}/questions/${qid}`, { method: 'DELETE' });
      onRefresh();
    } catch {
      alert('Failed to delete question.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-3)' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
        <button className="ag-btn ag-btn--ghost" onClick={() => setShowAIGen(true)}>✨ AI Generate</button>
        <button className="ag-btn ag-btn--primary" onClick={() => setShowAddQ(true)}>+ Add Question</button>
      </div>

      {questions.length === 0 ? (
        <div className="ag-empty">No questions yet. Add manually or use AI Generate to create questions automatically.</div>
      ) : (
        <div className="asmnt-q-list">
          {questions.map((q, i) => (
            <div key={q.id} className="asmnt-q-row">
              <div className="asmnt-q-num">Q{i + 1}</div>
              <div className="asmnt-q-body">
                <div className="asmnt-q-text">{q.question_text}</div>
                <div className="asmnt-q-tags">
                  {q.topic && <span className="asmnt-topic-badge">{q.topic}</span>}
                  {q.difficulty && <DiffBadge diff={q.difficulty} />}
                  <span className="asmnt-correct-badge">✓ {q.correct_option}</span>
                </div>
              </div>
              <div className="asmnt-q-actions">
                <button
                  className="ag-btn ag-btn--ghost"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => setEditQ(q)}
                  title="Edit question"
                >✏</button>
                <button
                  className="ag-btn ag-btn--ghost"
                  style={{ padding: '4px 8px', fontSize: 12, color: '#f87171' }}
                  onClick={() => handleDeleteQuestion(q.id)}
                  title="Delete question"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddQ && (
        <QuestionModal onSave={handleAddQuestion} onClose={() => setShowAddQ(false)} loading={savingQ} />
      )}
      {editQ && (
        <QuestionModal initial={editQ} onSave={handleEditQuestion} onClose={() => setEditQ(null)} loading={savingQ} />
      )}
      {showAIGen && (
        <AIGenerateModal
          assessmentId={assessment.id}
          authFetch={authFetch}
          onGenerated={() => { setShowAIGen(false); onRefresh(); }}
          onClose={() => setShowAIGen(false)}
        />
      )}
    </div>
  );
}

// ── Invites Tab ───────────────────────────────────────────────────────────────
function InvitesTab({ assessment, authFetch, candidates, onRefresh }) {
  const [showInvite, setShowInvite]   = useState(false);
  const [copiedId, setCopiedId]       = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [resentId, setResentId]       = useState(null);

  const invites = assessment.invites || [];

  const copyLink = (token, id) => {
    const url = `${window.location.origin}/assessment?token=${token}`;
    navigator.clipboard.writeText(url).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    });
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const resendEmail = async (inv) => {
    setResendingId(inv.id);
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments/${assessment.id}/invites/${inv.id}/resend`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      setResentId(inv.id); setTimeout(() => setResentId(null), 3000);
    } catch (e) { alert(e.message); } finally { setResendingId(null); }
  };

  const inviteStatusColor = { pending: '#60a5fa', started: '#fbbf24', completed: '#34d399' };
  const inviteStatusBg    = { pending: 'rgba(96,165,250,.12)', started: 'rgba(251,191,36,.12)', completed: 'rgba(52,211,153,.12)' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-3)' }}>{invites.length} invite{invites.length !== 1 ? 's' : ''} sent</span>
        <button className="ag-btn ag-btn--primary" onClick={() => setShowInvite(true)}>+ Invite Candidates</button>
      </div>

      {invites.length === 0 ? (
        <div className="ag-empty">No invites sent yet. Click "Invite Candidates" to send an assessment link.</div>
      ) : (
        <table className="asmnt-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Email</th>
              <th>Status</th>
              <th>Invited</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.map(inv => (
              <tr key={inv.id} style={{ cursor: 'default' }}>
                <td style={{ fontWeight: 600 }}>{inv.candidate_name}</td>
                <td style={{ color: 'var(--text-3)' }}>{inv.candidate_email}</td>
                <td>
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700,
                    borderRadius: 5, padding: '2px 8px',
                    color: inviteStatusColor[inv.status] || 'var(--text-2)',
                    background: inviteStatusBg[inv.status] || 'var(--bg-elevated)',
                  }}>
                    {(inv.status || 'pending').charAt(0).toUpperCase() + (inv.status || 'pending').slice(1)}
                  </span>
                </td>
                <td style={{ color: 'var(--text-3)' }}>{fmtDate(inv.invited_at || inv.created_at)}</td>
                <td style={{ color: 'var(--text-3)' }}>{fmtDate(inv.completed_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="ag-btn ag-btn--ghost"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => copyLink(inv.token, inv.id)}
                    >
                      {copiedId === inv.id ? '✓ Copied' : '📋 Copy Link'}
                    </button>
                    {inv.status !== 'completed' && (
                      <button
                        className="ag-btn ag-btn--ghost"
                        style={{ padding: '4px 10px', fontSize: 12, color: resentId === inv.id ? '#34d399' : undefined }}
                        onClick={() => resendEmail(inv)}
                        disabled={resendingId === inv.id}
                      >
                        {resendingId === inv.id ? <><Spinner />Sending…</> : resentId === inv.id ? '✓ Sent' : '✉ Resend'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showInvite && (
        <InviteModal
          assessmentId={assessment.id}
          authFetch={authFetch}
          candidates={candidates}
          onInvited={() => { setShowInvite(false); onRefresh(); }}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}

// ── Results Tab ───────────────────────────────────────────────────────────────
function ResultsTab({ assessment, authFetch }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewReport, setViewReport] = useState(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    authFetch(`${BACKEND_URL}/assessments/${assessment.id}/results`)
      .then(r => r.json())
      .then(d => setResults(d.submissions || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [assessment.id, authFetch]);

  const recLabel = {
    strong_pass: 'Strong Pass',
    pass: 'Pass',
    borderline: 'Borderline',
    fail: 'Fail',
  };

  if (loading) return <div className="sw-loading"><Spinner /> Loading results…</div>;

  return (
    <div>
      {results.length === 0 ? (
        <div className="ag-empty">No completed submissions yet. Results will appear here once candidates finish the assessment.</div>
      ) : (
        <table className="asmnt-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Score</th>
              <th>Correct</th>
              <th>Time Taken</th>
              <th>Result</th>
              <th>Recommendation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const passed = (r.score ?? 0) >= (assessment.pass_score || 60);
              const rec = r.ai_evaluation?.recommendation || '';
              return (
                <tr key={r.id} style={{ cursor: 'default' }}>
                  <td style={{ fontWeight: 600 }}>{r.candidate_name}</td>
                  <td style={{ fontWeight: 700 }}>{r.score ?? '—'}%</td>
                  <td style={{ color: 'var(--text-3)' }}>{r.correct_count}/{r.total_questions}</td>
                  <td style={{ color: 'var(--text-3)' }}>{fmtTime(r.time_taken_sec)}</td>
                  <td>
                    <span className={`asmnt-status asmnt-status--${passed ? 'active' : 'closed'}`}>
                      {passed ? '✓ Pass' : '✕ Fail'}
                    </span>
                  </td>
                  <td>
                    {rec ? (
                      <span className={`asmnt-rec--${rec.toLowerCase().replace(/\s/g, '_')}`} style={{ fontWeight: 600, fontSize: 13 }}>
                        {recLabel[rec.toLowerCase().replace(/\s/g, '_')] || rec}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <button
                      className="ag-btn ag-btn--ghost"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => setViewReport(r)}
                    >
                      View Report
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {viewReport && (
        <EvalReportModal submission={viewReport} assessment={assessment} onClose={() => setViewReport(null)} />
      )}
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────────────────────
function DetailView({ assessmentId, authFetch, jobs, candidates, onBack }) {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('questions');
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments/${assessmentId}`);
      if (!res.ok) throw new Error('Failed to load assessment.');
      const d = await res.json();
      setAssessment({ ...(d.assessment || d), questions: d.questions || [], invites: d.invites || [] });
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, authFetch]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleEdit = async (form) => {
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to update assessment.');
      setShowEdit(false);
      await fetchDetail();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusChanging(true);
    try {
      await authFetch(`${BACKEND_URL}/assessments/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...assessment, status: newStatus }),
      });
      await fetchDetail();
    } catch {
      alert('Failed to change status.');
    } finally {
      setStatusChanging(false);
    }
  };

  const jobName = (id) => {
    const j = jobs.find(j => String(j.id) === String(id));
    return j ? j.title : '—';
  };

  if (loading) {
    return (
      <div className="page-content page-content--wide">
        <div className="ag-module-body">
          <div className="sw-loading"><Spinner /> Loading assessment…</div>
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  const tabs = [
    { id: 'questions', label: 'Questions' },
    { id: 'invites',   label: 'Invites' },
    { id: 'results',   label: 'Results' },
  ];

  return (
    <div className="page-content page-content--wide">
      <div className="ag-module-body">
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, fontWeight: 600 }}
          >
            ← Assessments
          </button>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{assessment.title}</span>
        </div>

        {/* Assessment header card */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{assessment.title}</h2>
                <StatusBadge status={assessment.status || 'draft'} />
              </div>
              {assessment.description && (
                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{assessment.description}</p>
              )}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
                {assessment.job_id && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    <strong style={{ color: 'var(--text-2)' }}>Job:</strong> {jobName(assessment.job_id)}
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  <strong style={{ color: 'var(--text-2)' }}>Time Limit:</strong> {assessment.time_limit_min || 30} min
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  <strong style={{ color: 'var(--text-2)' }}>Pass Score:</strong> {assessment.pass_score || assessment.pass_score_pct || 60}%
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  <strong style={{ color: 'var(--text-2)' }}>Questions:</strong> {(assessment.questions || []).length}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <select
                className="ag-input"
                style={{ width: 'auto', fontSize: 12 }}
                value={assessment.status || 'draft'}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={statusChanging}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
              <button className="ag-btn ag-btn--ghost" onClick={() => setShowEdit(true)}>✏ Edit</button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--accent)' : 'var(--text-2)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'questions' && (
          <QuestionsTab assessment={assessment} authFetch={authFetch} onRefresh={fetchDetail} />
        )}
        {tab === 'invites' && (
          <InvitesTab assessment={assessment} authFetch={authFetch} candidates={candidates} onRefresh={fetchDetail} />
        )}
        {tab === 'results' && (
          <ResultsTab assessment={assessment} authFetch={authFetch} />
        )}
      </div>

      {showEdit && (
        <AssessmentFormModal
          initial={assessment}
          jobs={jobs}
          onSave={handleEdit}
          onClose={() => setShowEdit(false)}
          loading={saving}
        />
      )}
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({ authFetch, onOpenDetail, jobs = [], onNavigate }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const aRes = await authFetch(`${BACKEND_URL}/assessments`).then(r => r.json());
      setAssessments(aRes.assessments || aRes || []);
    } catch {
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (form) => {
    setCreating(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create assessment.');
      setShowCreate(false);
      await fetchData();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const total     = assessments.length;
  const active    = assessments.filter(a => a.status === 'active').length;
  const draft     = assessments.filter(a => a.status === 'draft').length;
  const completed = assessments.reduce((sum, a) => sum + (a.completed_count || 0), 0);

  const jobName = (id) => {
    const j = jobs.find(j => String(j.id) === String(id));
    return j ? j.title : '—';
  };

  return (
    <div className="page-content page-content--wide">
      <div className="ag-module-body">
        <div className="ag-page-header">
          <div>
            <h1 className="ag-page-title">MCQ Assessments</h1>
            <p className="ag-page-subtitle">Create and manage multiple-choice assessments with AI-generated questions and automated evaluation.</p>
          </div>
          <button className="ag-btn ag-btn--primary" onClick={() => setShowCreate(true)}>+ New Assessment</button>
        </div>

        {/* Stats strip */}
        <div className="ag-stats-strip" style={{ marginBottom: 28 }}>
          <div className="ag-stat-card">
            <span className="ag-stat-value">{total}</span>
            <span className="ag-stat-label">Total</span>
          </div>
          <div className="ag-stat-card">
            <span className="ag-stat-value" style={{ color: '#34d399' }}>{active}</span>
            <span className="ag-stat-label">Active</span>
          </div>
          <div className="ag-stat-card">
            <span className="ag-stat-value" style={{ color: 'var(--text-3)' }}>{draft}</span>
            <span className="ag-stat-label">Draft</span>
          </div>
          <div className="ag-stat-card">
            <span className="ag-stat-value" style={{ color: '#60a5fa' }}>{completed}</span>
            <span className="ag-stat-label">Completed (invites)</span>
          </div>
        </div>

        {loading ? (
          <div className="sw-loading"><Spinner /> Loading assessments…</div>
        ) : assessments.length === 0 ? (
          <div className="ag-empty">No assessments yet. Click "+ New Assessment" to create your first MCQ assessment.</div>
        ) : (
          <table className="asmnt-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Job</th>
                <th>Status</th>
                <th>Questions</th>
                <th>Invited</th>
                <th>Completed</th>
                <th>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map(a => (
                <tr key={a.id} onClick={() => onOpenDetail(a.id)}>
                  <td style={{ fontWeight: 600 }}>{a.title}</td>
                  <td style={{ color: 'var(--text-3)' }}>{a.job_id ? jobName(a.job_id) : '—'}</td>
                  <td><StatusBadge status={a.status || 'draft'} /></td>
                  <td>{a.question_count ?? (a.questions?.length ?? 0)}</td>
                  <td>{a.invited_count ?? 0}</td>
                  <td>{a.completed_count ?? 0}</td>
                  <td>{a.avg_score != null ? `${Math.round(a.avg_score)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <AssessmentFormModal
          jobs={jobs}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          loading={creating}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// ── Root Module ───────────────────────────────────────────────────────────────
export default function AssessmentsModule({ authFetch, onNavigate }) {
  const [view, setView] = useState('list');
  const [detailId, setDetailId] = useState(null);
  const [globalJobs, setGlobalJobs] = useState([]);
  const [globalCandidates, setGlobalCandidates] = useState([]);

  useEffect(() => {
    Promise.all([
      authFetch(`${BACKEND_URL}/jobs`).then(r => r.json()).catch(() => ({ jobs: [] })),
      authFetch(`${BACKEND_URL}/candidates`).then(r => r.json()).catch(() => ({ candidates: [] })),
    ]).then(([jd, cd]) => {
      setGlobalJobs(jd.jobs || []);
      setGlobalCandidates(cd.candidates || []);
    });
  }, [authFetch]);

  const openDetail = (id) => {
    setDetailId(id);
    setView('detail');
  };

  const goBack = () => {
    setDetailId(null);
    setView('list');
  };

  if (view === 'detail' && detailId) {
    return (
      <DetailView
        assessmentId={detailId}
        authFetch={authFetch}
        jobs={globalJobs}
        candidates={globalCandidates}
        onBack={goBack}
      />
    );
  }

  return <ListView authFetch={authFetch} onOpenDetail={openDetail} jobs={globalJobs} onNavigate={onNavigate} />;
}
