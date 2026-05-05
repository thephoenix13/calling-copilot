import { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const LANGUAGES = ['javascript','typescript','python','java','cpp','csharp','go','ruby','sql','bash'];
const TYPE_LABELS = { write: 'Write', fix: 'Fix Bug', complete: 'Complete' };
const TYPE_COLORS = { write: '#60a5fa', fix: '#f87171', complete: '#34d399' };

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(sec) {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}m ${s}s`;
}

function Spinner() { return <span className="spinner" style={{ display: 'inline-block', marginRight: 6 }} />; }
function StatusBadge({ status }) {
  return <span className={`asmnt-status asmnt-status--${status}`}>{status === 'active' ? '● ' : status === 'closed' ? '✕ ' : '○ '}{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}
function DiffBadge({ diff }) {
  if (!diff) return null;
  return <span className={`asmnt-diff-badge asmnt-diff-badge--${diff}`}>{diff}</span>;
}
function TypeBadge({ type }) {
  if (!type) return null;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${TYPE_COLORS[type]}22`, color: TYPE_COLORS[type], border: `1px solid ${TYPE_COLORS[type]}44` }}>{TYPE_LABELS[type] || type}</span>;
}

// ── Code Editor (styled textarea with line numbers) ────────────────────────────
function CodeEditor({ value, onChange, language = 'javascript', readOnly = false, minHeight = 220 }) {
  const taRef    = useRef(null);
  const lnRef    = useRef(null);
  const lines    = (value || '').split('\n');
  const lineCount = Math.max(lines.length, 5);

  const syncScroll = () => {
    if (lnRef.current && taRef.current) lnRef.current.scrollTop = taRef.current.scrollTop;
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta  = taRef.current;
      const s   = ta.selectionStart;
      const end = ta.selectionEnd;
      const nv  = value.substring(0, s) + '  ' + value.substring(end);
      onChange(nv);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
  };

  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace", fontSize: 13, background: 'var(--bg-elevated)' }}>
      {/* Line numbers */}
      <div
        ref={lnRef}
        style={{ width: 40, minHeight, background: 'rgba(0,0,0,0.15)', color: 'var(--text-3)', textAlign: 'right', padding: '12px 8px 12px 0', lineHeight: '20px', userSelect: 'none', overflowY: 'hidden', flexShrink: 0 }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ height: 20 }}>{i + 1}</div>
        ))}
      </div>
      {/* Textarea */}
      <textarea
        ref={taRef}
        value={value || ''}
        onChange={e => onChange && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        readOnly={readOnly}
        spellCheck={false}
        style={{
          flex: 1, minHeight, padding: '12px', border: 'none', outline: 'none', resize: 'vertical',
          fontFamily: 'inherit', fontSize: 'inherit', lineHeight: '20px',
          background: 'transparent', color: 'var(--text-1)',
          caretColor: 'var(--accent)', overflowX: 'auto',
        }}
      />
    </div>
  );
}

// ── Assessment Form Modal ─────────────────────────────────────────────────────
function AssessmentFormModal({ initial, jobs, onSave, onClose, loading, onNavigate }) {
  const blank = { title: '', description: '', instructions: '', job_id: '', time_limit_min: 60, pass_score: 60, status: 'draft' };
  const [form, setForm] = useState(initial ? { ...blank, ...initial, pass_score: initial.pass_score || 60 } : blank);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">{initial ? 'Edit Assessment' : 'New Coding Assessment'}</h3>
        {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Title *</label>
            <input className="ag-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Backend Engineer Coding Round" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="ag-textarea" rows={2} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Brief description shown to recruiters" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Instructions (shown to candidates)</label>
            <textarea className="ag-textarea" rows={3} value={form.instructions || ''} onChange={e => set('instructions', e.target.value)} placeholder="e.g. Read each problem carefully. You may use any approach." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Linked Job</label>
            <select className="ag-input" value={form.job_id || ''} onChange={e => set('job_id', e.target.value)}>
              <option value="">— None —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            {onNavigate && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>
                Don't see your job?{' '}
                <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }} onClick={() => { onClose(); onNavigate('jobs'); }}>
                  Go to Job Management →
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Time Limit (minutes)</label>
              <input className="ag-input" type="number" min={10} max={240} value={form.time_limit_min} onChange={e => set('time_limit_min', Number(e.target.value))} />
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
          <button className="ag-btn ag-btn--primary" onClick={() => { if (!form.title.trim()) { setErr('Title is required.'); return; } setErr(''); onSave(form); }} disabled={loading}>
            {loading ? <><Spinner />Saving…</> : (initial ? 'Save Changes' : 'Create Assessment')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Question Form Modal ───────────────────────────────────────────────────────
function QuestionModal({ initial, onSave, onClose, loading }) {
  const blank = { title: '', problem_statement: '', starter_code: '', language: 'javascript', question_type: 'write', difficulty: 'medium', topic: '' };
  const [form, setForm] = useState(initial || blank);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 640, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">{initial ? 'Edit Question' : 'Add Question'}</h3>
        {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Title *</label>
            <input className="ag-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Reverse a Linked List" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Language</label>
              <select className="ag-input" value={form.language} onChange={e => set('language', e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Type</label>
              <select className="ag-input" value={form.question_type} onChange={e => set('question_type', e.target.value)}>
                <option value="write">Write (from scratch)</option>
                <option value="fix">Fix Bug</option>
                <option value="complete">Complete Code</option>
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
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Topic</label>
            <input className="ag-input" value={form.topic || ''} onChange={e => set('topic', e.target.value)} placeholder="e.g. Arrays, Recursion, SQL Joins" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Problem Statement *</label>
            <textarea className="ag-textarea" rows={5} value={form.problem_statement} onChange={e => set('problem_statement', e.target.value)} placeholder="Describe the problem clearly, including expected inputs and outputs." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
              Starter Code <span style={{ color: 'var(--text-3)' }}>(function signature, buggy code, or partial implementation)</span>
            </label>
            <CodeEditor value={form.starter_code || ''} onChange={v => set('starter_code', v)} language={form.language} minHeight={140} />
          </div>
        </div>
        <div className="ag-modal-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="ag-btn ag-btn--primary" onClick={() => {
            if (!form.title.trim()) { setErr('Title required.'); return; }
            if (!form.problem_statement.trim()) { setErr('Problem statement required.'); return; }
            setErr(''); onSave(form);
          }} disabled={loading}>
            {loading ? <><Spinner />Saving…</> : (initial ? 'Save Changes' : 'Add Question')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Generate Modal ─────────────────────────────────────────────────────────
function AIGenerateModal({ assessmentId, authFetch, onGenerated, onClose }) {
  const [count, setCount]           = useState(5);
  const [language, setLanguage]     = useState('javascript');
  const [difficulty, setDifficulty] = useState('mixed');
  const [topic, setTopic]           = useState('');
  const [generating, setGenerating] = useState(false);
  const [err, setErr]               = useState('');
  const [ctx, setCtx]               = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  useEffect(() => {
    authFetch(`${BACKEND_URL}/coding-assessments/${assessmentId}/ai-context`)
      .then(r => r.json()).then(d => setCtx(d)).catch(() => setCtx(null))
      .finally(() => setCtxLoading(false));
  }, [assessmentId, authFetch]);

  const handleGenerate = async () => {
    setGenerating(true); setErr('');
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments/${assessmentId}/ai-generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, language, difficulty, topic: topic.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Error ${res.status}`); }
      await res.json();
      onGenerated();
    } catch (e) { setErr(e.message); setGenerating(false); }
  };

  const ContextPanel = () => {
    if (ctxLoading) return (
      <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spinner /><span style={{ color: 'var(--text-3)' }}>Checking context…</span>
      </div>
    );
    if (!ctx) return null;
    const rows = [
      ctx.job
        ? { label: 'Linked Job', value: ctx.job.title + (ctx.job.client_name ? ` @ ${ctx.job.client_name}` : ''), ok: true }
        : { label: 'Linked Job', value: 'None — questions will be generic', ok: false },
      ctx.has_session_assets
        ? { label: 'JD Assets', value: 'Full assets available', ok: true }
        : ctx.has_enhancer_assets
          ? { label: 'JD Assets', value: 'JD Enhancer assets found', ok: true }
          : { label: 'JD Assets', value: 'Not prepared — job details only', ok: false },
    ];
    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Context for Generation</div>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: r.ok ? '#34d399' : '#f59e0b', fontSize: 14, lineHeight: 1.2 }}>{r.ok ? '✓' : '!'}</span>
            <span><span style={{ color: 'var(--text-3)' }}>{r.label}: </span><span style={{ color: r.ok ? 'var(--text-1)' : '#f59e0b', fontWeight: 600 }}>{r.value}</span></span>
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
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 14, fontWeight: 600 }}>Generating {count} coding questions…</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>This may take 15–30 seconds. Please wait.</div>
          </div>
        ) : (
          <>
            {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</div>}
            <ContextPanel />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Number of Questions</label>
                  <select className="ag-input" value={count} onChange={e => setCount(Number(e.target.value))}>
                    {[3,5,8,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Language</label>
                  <select className="ag-input" value={language} onChange={e => setLanguage(e.target.value)}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
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
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Topic <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
                <input className="ag-input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Arrays, SQL Joins, REST APIs" />
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
    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  const addFromDB = (c) => {
    const em = (c.email || '').toLowerCase();
    if (!em) return;
    if (selected.find(s => s.email === em)) return;
    setSelected(s => [...s, { name: c.name, email: em, candidate_id: c.id }]);
    setSearch('');
  };

  const addManual = () => {
    if (!name.trim() || !email.trim()) { setErr('Name and email required.'); return; }
    const em = email.trim().toLowerCase();
    if (selected.find(s => s.email === em)) { setErr('This email is already in the list.'); return; }
    setSelected(s => [...s, { name: name.trim(), email: em }]);
    setName(''); setEmail(''); setErr('');
  };

  const remove = (em) => setSelected(s => s.filter(x => x.email !== em));

  const handleSend = async () => {
    if (selected.length === 0) { setErr('Add at least one candidate.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments/${assessmentId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: selected }),
      });
      if (!res.ok) throw new Error('Failed to send invites.');
      const data = await res.json();
      onInvited(data.invites);
    } catch (e) { setErr(e.message); setLoading(false); }
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
                  const em = (c.email || '').toLowerCase();
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
                        {(c.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{c.name}</div>
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
function EvalReportModal({ submission, assessment, questions, onClose }) {
  const ev      = submission.ai_evaluation || {};
  const passed  = (submission.score ?? 0) >= (assessment.pass_score || 60);

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 700, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">Code Evaluation — {submission.candidate_name}</h3>

        {/* Score hero */}
        <div style={{ textAlign: 'center', padding: '20px 0 14px' }}>
          <div className="ca-result-score">{submission.score ?? '—'}%</div>
          <span className={`asmnt-status asmnt-status--${passed ? 'active' : 'closed'}`} style={{ fontSize: 13 }}>
            {passed ? '✓ Pass' : '✕ Fail'}
          </span>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>
            Time taken: {fmtTime(submission.time_taken_sec)} · Submitted: {fmtDate(submission.submitted_at)}
          </div>
        </div>

        {ev.summary && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {ev.summary}
          </div>
        )}

        {ev.recommendation && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Recommendation</div>
            <span className={`asmnt-rec--${(ev.recommendation || '').toLowerCase().replace(/\s/g,'_')}`} style={{ fontWeight: 700, fontSize: 14 }}>
              {ev.recommendation.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
        )}

        {(ev.strengths?.length > 0 || ev.gaps?.length > 0) && (
          <div className="asmnt-eval-grid" style={{ marginBottom: 16 }}>
            {ev.strengths?.length > 0 && (
              <div className="asmnt-eval-section">
                <div className="asmnt-eval-label">Strengths</div>
                {ev.strengths.map((s, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>✓ {s}</div>)}
              </div>
            )}
            {ev.gaps?.length > 0 && (
              <div className="asmnt-eval-section">
                <div className="asmnt-eval-label">Gaps</div>
                {ev.gaps.map((g, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>✗ {g}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Per question breakdown */}
        {ev.per_question?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Per Question</div>
            {ev.per_question.map((pq, i) => {
              const q = questions.find(q => String(q.id) === String(pq.question_id)) || questions[i];
              const answers = JSON.parse(submission.answers || '{}');
              const code = q ? answers[q.id] : null;
              return (
                <div key={i} style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>Q{i + 1}: {q?.title || `Question ${i + 1}`}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pq.score >= 70 ? '#34d399' : pq.score >= 40 ? '#f59e0b' : '#f87171' }}>{pq.score}/100</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4 }}>{pq.correctness}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4 }}>{pq.quality}</span>
                  </div>
                  {pq.feedback && (
                    <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{pq.feedback}</div>
                  )}
                  {code && (
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Submitted code:</div>
                      <CodeEditor value={code} language={q?.language || 'javascript'} readOnly minHeight={80} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!ev.summary && !ev.per_question && (
          <div className="ag-empty" style={{ margin: '16px 0' }}>AI evaluation is still processing. Check back in a moment.</div>
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
  const [showAddQ, setShowAddQ]   = useState(false);
  const [showAIGen, setShowAIGen] = useState(false);
  const [editQ, setEditQ]         = useState(null);
  const [savingQ, setSavingQ]     = useState(false);

  const questions = assessment.questions || [];

  const handleAdd = async (form) => {
    setSavingQ(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments/${assessment.id}/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to add question.');
      setShowAddQ(false); onRefresh();
    } catch (e) { alert(e.message); } finally { setSavingQ(false); }
  };

  const handleEdit = async (form) => {
    setSavingQ(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments/${assessment.id}/questions/${editQ.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to update question.');
      setEditQ(null); onRefresh();
    } catch (e) { alert(e.message); } finally { setSavingQ(false); }
  };

  const handleDelete = async (qid) => {
    if (!window.confirm('Delete this question?')) return;
    await authFetch(`${BACKEND_URL}/coding-assessments/${assessment.id}/questions/${qid}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-3)' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
        <button className="ag-btn ag-btn--ghost" onClick={() => setShowAIGen(true)}>✨ AI Generate</button>
        <button className="ag-btn ag-btn--primary" onClick={() => setShowAddQ(true)}>+ Add Question</button>
      </div>

      {questions.length === 0 ? (
        <div className="ag-empty">No questions yet. Use AI Generate or add manually.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Question header */}
              <div style={{ padding: '12px 16px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', minWidth: 28 }}>Q{i + 1}</span>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, color: 'var(--text-1)' }}>{q.title}</span>
                <TypeBadge type={q.question_type} />
                <DiffBadge diff={q.difficulty} />
                <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{q.language}</span>
                {q.topic && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.topic}</span>}
                <button className="ag-btn ag-btn--ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setEditQ(q)}>✏</button>
                <button className="ag-btn ag-btn--ghost" style={{ padding: '4px 8px', fontSize: 12, color: '#f87171' }} onClick={() => handleDelete(q.id)}>✕</button>
              </div>
              {/* Problem statement */}
              <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, borderBottom: q.starter_code ? '1px solid var(--border)' : 'none' }}>
                {q.problem_statement}
              </div>
              {/* Starter code */}
              {q.starter_code && (
                <div style={{ padding: '10px 16px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Starter code:</div>
                  <CodeEditor value={q.starter_code} language={q.language} readOnly minHeight={80} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddQ  && <QuestionModal onSave={handleAdd}  onClose={() => setShowAddQ(false)}  loading={savingQ} />}
      {editQ     && <QuestionModal initial={editQ} onSave={handleEdit} onClose={() => setEditQ(null)} loading={savingQ} />}
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

  const copy = (link, id) => {
    navigator.clipboard.writeText(link).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); });
  };

  const resendEmail = async (inv) => {
    setResendingId(inv.id);
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments/${assessment.id}/invites/${inv.id}/resend`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      setResentId(inv.id); setTimeout(() => setResentId(null), 3000);
    } catch (e) { alert(e.message); } finally { setResendingId(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-3)' }}>{invites.length} invite{invites.length !== 1 ? 's' : ''}</span>
        <button className="ag-btn ag-btn--primary" onClick={() => setShowInvite(true)}>+ Invite Candidates</button>
      </div>

      {invites.length === 0 ? (
        <div className="ag-empty">No candidates invited yet. Click "Invite Candidates" to send assessment links.</div>
      ) : (
        <table className="asmnt-table">
          <thead><tr><th>Candidate</th><th>Email</th><th>Status</th><th>Invited</th><th>Completed</th><th>Score</th><th>Actions</th></tr></thead>
          <tbody>
            {invites.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 600 }}>{inv.candidate_name}</td>
                <td style={{ color: 'var(--text-3)' }}>{inv.candidate_email}</td>
                <td><span className={`asmnt-status asmnt-status--${inv.status === 'completed' ? 'active' : inv.status === 'started' ? 'draft' : 'closed'}`}>{inv.status}</span></td>
                <td style={{ color: 'var(--text-3)' }}>{fmtDate(inv.invited_at)}</td>
                <td style={{ color: 'var(--text-3)' }}>{fmtDate(inv.completed_at)}</td>
                <td style={{ fontWeight: 600 }}>{inv.submission?.score != null ? `${inv.submission.score}%` : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="ag-btn ag-btn--ghost"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => copy(`${window.location.origin}/coding-assessment?token=${inv.token}`, inv.id)}
                    >
                      {copiedId === inv.id ? '✓ Copied' : '📋 Copy Link'}
                    </button>
                    {inv.status !== 'completed' && (
                      <button
                        className="ag-btn ag-btn--ghost"
                        style={{ fontSize: 11, padding: '3px 8px', color: resentId === inv.id ? '#34d399' : undefined }}
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
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [viewReport, setViewReport] = useState(null);
  const [questions, setQuestions] = useState([]);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    authFetch(`${BACKEND_URL}/coding-assessments/${assessment.id}/results`)
      .then(r => r.json())
      .then(d => { setResults(d.submissions || []); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [assessment.id, authFetch]);

  useEffect(() => { setQuestions(assessment.questions || []); }, [assessment]);

  if (loading) return <div className="sw-loading"><Spinner /> Loading results…</div>;

  return (
    <div>
      {results.length === 0 ? (
        <div className="ag-empty">No submissions yet. Results appear here once candidates complete the assessment.</div>
      ) : (
        <table className="asmnt-table">
          <thead>
            <tr><th>Candidate</th><th>Score</th><th>Time</th><th>Result</th><th>Recommendation</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {results.map(r => {
              const passed = (r.score ?? 0) >= (assessment.pass_score || 60);
              const rec    = r.ai_evaluation?.recommendation || '';
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.candidate_name}</td>
                  <td style={{ fontWeight: 700 }}>{r.score ?? '—'}%</td>
                  <td style={{ color: 'var(--text-3)' }}>{fmtTime(r.time_taken_sec)}</td>
                  <td><span className={`asmnt-status asmnt-status--${passed ? 'active' : 'closed'}`}>{passed ? '✓ Pass' : '✕ Fail'}</span></td>
                  <td style={{ fontWeight: 600, fontSize: 13, color: rec ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {rec ? rec.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-3)' }}>{fmtDate(r.submitted_at)}</td>
                  <td>
                    <button className="ag-btn ag-btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setViewReport(r)}>
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
        <EvalReportModal
          submission={viewReport}
          assessment={assessment}
          questions={questions}
          onClose={() => setViewReport(null)}
        />
      )}
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────────────────────
function DetailView({ assessmentId, authFetch, jobs, candidates, onBack }) {
  const [assessment, setAssessment]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('questions');
  const [showEdit, setShowEdit]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments/${assessmentId}`);
      if (!res.ok) throw new Error('Failed to load.');
      const d = await res.json();
      setAssessment({ ...(d.assessment || d), questions: d.questions || [], invites: d.invites || [] });
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  }, [assessmentId, authFetch]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleEdit = async (form) => {
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments/${assessmentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to update.');
      setShowEdit(false); await fetchDetail();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusChanging(true);
    try {
      await authFetch(`${BACKEND_URL}/coding-assessments/${assessmentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...assessment, status: newStatus }),
      });
      await fetchDetail();
    } catch { alert('Failed to change status.'); } finally { setStatusChanging(false); }
  };

  const jobName = (id) => { const j = jobs.find(j => String(j.id) === String(id)); return j ? j.title : '—'; };

  if (loading) return <div className="page-content page-content--wide"><div className="ag-module-body"><div className="sw-loading"><Spinner /> Loading…</div></div></div>;
  if (!assessment) return null;

  const tabs = [{ id: 'questions', label: 'Questions' }, { id: 'invites', label: 'Invites' }, { id: 'results', label: 'Results' }];

  return (
    <div className="page-content page-content--wide">
      <div className="ag-module-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, fontWeight: 600 }}>← Coding Assessments</button>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{assessment.title}</span>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{assessment.title}</h2>
                <StatusBadge status={assessment.status || 'draft'} />
              </div>
              {assessment.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{assessment.description}</p>}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
                {assessment.job_id && <span style={{ fontSize: 12, color: 'var(--text-3)' }}><strong style={{ color: 'var(--text-2)' }}>Job:</strong> {jobName(assessment.job_id)}</span>}
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}><strong style={{ color: 'var(--text-2)' }}>Time:</strong> {assessment.time_limit_min || 60} min</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}><strong style={{ color: 'var(--text-2)' }}>Pass:</strong> {assessment.pass_score || 60}%</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}><strong style={{ color: 'var(--text-2)' }}>Questions:</strong> {(assessment.questions || []).length}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <select className="ag-input" style={{ width: 'auto', fontSize: 12 }} value={assessment.status || 'draft'} onChange={e => handleStatusChange(e.target.value)} disabled={statusChanging}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
              <button className="ag-btn ag-btn--ghost" onClick={() => setShowEdit(true)}>✏ Edit</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? 'var(--accent)' : 'var(--text-2)', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'questions' && <QuestionsTab assessment={assessment} authFetch={authFetch} onRefresh={fetchDetail} />}
        {tab === 'invites'   && <InvitesTab   assessment={assessment} authFetch={authFetch} candidates={candidates} onRefresh={fetchDetail} />}
        {tab === 'results'   && <ResultsTab   assessment={assessment} authFetch={authFetch} />}

        {showEdit && (
          <AssessmentFormModal initial={assessment} jobs={jobs} onSave={handleEdit} onClose={() => setShowEdit(false)} loading={saving} />
        )}
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({ authFetch, onOpenDetail, jobs = [], onNavigate }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [creating, setCreating]       = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments`);
      const d   = await res.json();
      setAssessments(d.assessments || []);
    } catch { setAssessments([]); } finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (form) => {
    setCreating(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/coding-assessments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to create.'); }
      setShowCreate(false); await fetchData();
    } catch (e) { alert(e.message); } finally { setCreating(false); }
  };

  const total     = assessments.length;
  const active    = assessments.filter(a => a.status === 'active').length;
  const draft     = assessments.filter(a => a.status === 'draft').length;
  const completed = assessments.reduce((s, a) => s + (a.completed_count || 0), 0);
  const jobName   = (id) => { const j = jobs.find(j => String(j.id) === String(id)); return j ? j.title : '—'; };

  return (
    <div className="page-content page-content--wide">
      <div className="ag-module-body">
        <div className="ag-page-header">
          <div>
            <h1 className="ag-page-title">Coding Assessments</h1>
            <p className="ag-page-subtitle">Create and manage coding challenges with AI-generated questions and automated code evaluation.</p>
          </div>
          <button className="ag-btn ag-btn--primary" onClick={() => setShowCreate(true)}>+ New Assessment</button>
        </div>

        <div className="ag-stats-strip" style={{ marginBottom: 28 }}>
          <div className="ag-stat-card"><span className="ag-stat-value">{total}</span><span className="ag-stat-label">Total</span></div>
          <div className="ag-stat-card"><span className="ag-stat-value" style={{ color: '#34d399' }}>{active}</span><span className="ag-stat-label">Active</span></div>
          <div className="ag-stat-card"><span className="ag-stat-value" style={{ color: 'var(--text-3)' }}>{draft}</span><span className="ag-stat-label">Draft</span></div>
          <div className="ag-stat-card"><span className="ag-stat-value" style={{ color: '#60a5fa' }}>{completed}</span><span className="ag-stat-label">Completed</span></div>
        </div>

        {loading ? <div className="sw-loading"><Spinner /> Loading…</div>
          : assessments.length === 0 ? <div className="ag-empty">No coding assessments yet. Click "+ New Assessment" to create your first one.</div>
          : (
            <table className="asmnt-table">
              <thead>
                <tr><th>Title</th><th>Job</th><th>Status</th><th>Questions</th><th>Invited</th><th>Completed</th></tr>
              </thead>
              <tbody>
                {assessments.map(a => (
                  <tr key={a.id} onClick={() => onOpenDetail(a.id)}>
                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                    <td style={{ color: 'var(--text-3)' }}>{a.job_id ? jobName(a.job_id) : '—'}</td>
                    <td><StatusBadge status={a.status || 'draft'} /></td>
                    <td>{a.question_count ?? 0}</td>
                    <td>{a.invite_count ?? 0}</td>
                    <td>{a.completed_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {showCreate && (
        <AssessmentFormModal jobs={jobs} onSave={handleCreate} onClose={() => setShowCreate(false)} loading={creating} onNavigate={onNavigate} />
      )}
    </div>
  );
}

// ── Root Module ───────────────────────────────────────────────────────────────
export default function CodingAssessmentsModule({ authFetch, onNavigate }) {
  const [view, setView]                     = useState('list');
  const [detailId, setDetailId]             = useState(null);
  const [globalJobs, setGlobalJobs]         = useState([]);
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

  if (view === 'detail' && detailId) {
    return (
      <DetailView
        assessmentId={detailId}
        authFetch={authFetch}
        jobs={globalJobs}
        candidates={globalCandidates}
        onBack={() => { setDetailId(null); setView('list'); }}
      />
    );
  }

  return (
    <ListView
      authFetch={authFetch}
      onOpenDetail={(id) => { setDetailId(id); setView('detail'); }}
      jobs={globalJobs}
      onNavigate={onNavigate}
    />
  );
}
