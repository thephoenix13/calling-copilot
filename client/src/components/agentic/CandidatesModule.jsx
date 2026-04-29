import { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Skills input (shared) ────────────────────────────────────────────────────
function SkillsInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const s = input.trim();
    if (!s || value.includes(s)) { setInput(''); return; }
    onChange([...value, s]);
    setInput('');
  };
  return (
    <div className="skills-input-wrapper">
      <div className="skills-chips">
        {value.map(s => (
          <span key={s} className="skill-chip skill-chip--removable">
            {s}
            <button type="button" className="skill-chip-remove" onClick={() => onChange(value.filter(x => x !== s))}>×</button>
          </span>
        ))}
        <input
          className="skills-inline-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={value.length === 0 ? placeholder : 'Add more…'}
        />
      </div>
    </div>
  );
}

// ── Candidate form (create / edit) ───────────────────────────────────────────
function CandidateForm({ candidate, onSave, onCancel, authFetch }) {
  const isEdit = !!candidate?.id;
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [mode,        setMode]        = useState(isEdit ? 'manual' : 'choose'); // 'choose' | 'upload' | 'manual'
  const [parsing,     setParsing]     = useState(false);
  const [parseErr,    setParseErr]    = useState('');
  const [aiCheck,     setAiCheck]     = useState(null);  // { verdict, confidence, indicators, summary }
  const [aiChecking,  setAiChecking]  = useState(false);
  const fileInputRef = useRef(null);

  const runAiCheck = async (text) => {
    if (!text || text.trim().length < 100) return;
    setAiChecking(true);
    setAiCheck(null);
    try {
      const res  = await authFetch(`${BACKEND_URL}/ai/check-ai-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) setAiCheck(data);
    } catch { /* silent */ }
    finally { setAiChecking(false); }
  };

  const [form, setForm] = useState({
    name:             candidate?.name             || '',
    email:            candidate?.email            || '',
    phone:            candidate?.phone            || '',
    location:         candidate?.location         || '',
    current_title:    candidate?.current_title    || '',
    current_company:  candidate?.current_company  || '',
    experience_years: candidate?.experience_years ?? '',
    skills:           candidate?.skills           || [],
    education:        candidate?.education        || '',
    linkedin_url:     candidate?.linkedin_url     || '',
    portfolio_url:    candidate?.portfolio_url    || '',
    resume_filename:  candidate?.resume_filename  || '',
    resume_text:      candidate?.resume_text      || '',
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  // ── Resume upload + parse ──
  const handleResumeUpload = async (file) => {
    if (!file) return;
    setParseErr('');
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const res  = await authFetch(`${BACKEND_URL}/candidates/parse-resume`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setParseErr(data.error || 'Parse failed.'); return; }

      const f = data.fields || {};
      setForm(prev => ({
        ...prev,
        name:             f.name             || prev.name,
        email:            f.email            || prev.email,
        phone:            f.phone            || prev.phone,
        location:         f.location         || prev.location,
        current_title:    f.current_title    || prev.current_title,
        current_company:  f.current_company  || prev.current_company,
        experience_years: f.experience_years ?? prev.experience_years,
        skills:           f.skills?.length   ? f.skills : prev.skills,
        education:        f.education        || prev.education,
        linkedin_url:     f.linkedin_url     || prev.linkedin_url,
        portfolio_url:    f.portfolio_url    || prev.portfolio_url,
        resume_filename:  data.resumeFilename || prev.resume_filename,
        resume_text:      data.resumeText    || prev.resume_text,
      }));
      setMode('manual');
      if (data.resumeText) runAiCheck(data.resumeText);
    } catch {
      setParseErr('Network error during parsing.');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }

    setSaving(true);
    try {
      const url    = isEdit ? `${BACKEND_URL}/candidates/${candidate.id}` : `${BACKEND_URL}/candidates`;
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          experience_years: form.experience_years !== '' ? Number(form.experience_years) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Save failed.'); return; }
      onSave(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Choose mode screen ──
  if (mode === 'choose') {
    return (
      <div className="ag-form-page">
        <div className="ag-form-header">
          <button className="ag-back-btn" type="button" onClick={onCancel}>← Back</button>
          <h2 className="ag-form-title">Add Candidate</h2>
        </div>
        <div className="ag-choose-cards">
          <div className="ag-choose-card" onClick={() => setMode('upload')}>
            <div className="ag-choose-icon">📄</div>
            <div className="ag-choose-title">Upload Resume</div>
            <p className="ag-choose-desc">Upload a PDF or DOCX — Claude will auto-fill the profile fields.</p>
          </div>
          <div className="ag-choose-card" onClick={() => setMode('manual')}>
            <div className="ag-choose-icon">✍️</div>
            <div className="ag-choose-title">Manual Entry</div>
            <p className="ag-choose-desc">Fill in the candidate's details directly without a file.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload screen ──
  if (mode === 'upload') {
    return (
      <div className="ag-form-page">
        <div className="ag-form-header">
          <button className="ag-back-btn" type="button" onClick={() => setMode('choose')}>← Back</button>
          <h2 className="ag-form-title">Upload Resume</h2>
        </div>
        <div className="ag-upload-zone"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleResumeUpload(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
        >
          {parsing ? (
            <div className="ag-upload-parsing">
              <span className="spinner" />
              <span>Parsing resume with Claude…</span>
            </div>
          ) : (
            <>
              <div className="ag-upload-icon">📤</div>
              <p className="ag-upload-label">Drag & drop or click to upload</p>
              <p className="ag-upload-hint">PDF, DOCX, or TXT · Max 10 MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            style={{ display: 'none' }}
            onChange={e => handleResumeUpload(e.target.files[0])}
          />
        </div>
        {parseErr && <div className="ag-form-error" style={{ marginTop: 12 }}>{parseErr}</div>}
      </div>
    );
  }

  // ── Manual / edit form ──
  return (
    <div className="ag-form-page">
      <div className="ag-form-header">
        <button className="ag-back-btn" type="button" onClick={onCancel}>← Back</button>
        <h2 className="ag-form-title">
          {isEdit ? 'Edit Candidate' : 'New Candidate'}
          {form.resume_filename && <span className="ag-form-subtitle"> · Resume parsed ✓</span>}
        </h2>
      </div>

      <form className="ag-form" onSubmit={handleSubmit}>
        <div className="ag-form-grid">
          <div className="ag-field">
            <label className="ag-label">Full Name *</label>
            <input className="ag-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Priya Kapoor" autoFocus />
          </div>
          <div className="ag-field">
            <label className="ag-label">Email</label>
            <input className="ag-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="priya@example.com" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Phone</label>
            <input className="ag-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Location</label>
            <input className="ag-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Pune" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Current Title</label>
            <input className="ag-input" value={form.current_title} onChange={e => set('current_title', e.target.value)} placeholder="e.g. Senior QA Engineer" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Current Company</label>
            <input className="ag-input" value={form.current_company} onChange={e => set('current_company', e.target.value)} placeholder="e.g. Wipro" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Years of Experience</label>
            <input className="ag-input" type="number" min="0" step="0.5" value={form.experience_years} onChange={e => set('experience_years', e.target.value)} placeholder="e.g. 3.5" />
          </div>
          <div className="ag-field ag-field--full">
            <label className="ag-label">Skills</label>
            <SkillsInput value={form.skills} onChange={v => set('skills', v)} placeholder="Type a skill and press Enter…" />
          </div>
          <div className="ag-field ag-field--full">
            <label className="ag-label">Education</label>
            <input className="ag-input" value={form.education} onChange={e => set('education', e.target.value)} placeholder="e.g. B.E. Computer Engineering, Pune University" />
          </div>
          <div className="ag-field">
            <label className="ag-label">LinkedIn URL</label>
            <input className="ag-input" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/…" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Portfolio / GitHub</label>
            <input className="ag-input" value={form.portfolio_url} onChange={e => set('portfolio_url', e.target.value)} placeholder="https://github.com/…" />
          </div>

          {/* Re-upload option */}
          {!isEdit && mode === 'manual' && (
            <div className="ag-field ag-field--full">
              <label className="ag-label">Resume File</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {form.resume_filename
                  ? <span style={{ fontSize: 13, color: 'var(--text-2)' }}>✓ {form.resume_filename}</span>
                  : <span style={{ fontSize: 13, color: 'var(--text-3)' }}>No file attached</span>
                }
                <button type="button" className="ag-btn ag-btn--ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setMode('upload')}>
                  {form.resume_filename ? 'Replace' : 'Upload Resume'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Content Check */}
        {(form.resume_text || aiCheck || aiChecking) && (
          <div className="ag-field ag-field--full">
            <div className="aic-panel">
              <div className="aic-panel-header">
                <span className="aic-panel-title">AI Content Check</span>
                {!aiChecking && form.resume_text?.trim().length >= 100 && (
                  <button type="button" className="ag-btn ag-btn--ghost ag-btn--sm"
                    onClick={() => runAiCheck(form.resume_text)}>
                    {aiCheck ? 'Re-check' : 'Run Check'}
                  </button>
                )}
              </div>
              {aiChecking && (
                <div className="aic-loading"><span className="spinner" /> Analysing resume text…</div>
              )}
              {aiCheck && !aiChecking && (() => {
                const v = aiCheck.verdict;
                const cls = v === 'human' || v === 'likely_human' ? 'aic-badge--human'
                          : v === 'mixed'                          ? 'aic-badge--mixed'
                          :                                          'aic-badge--ai';
                const label = {
                  human:        'Human-written',
                  likely_human: 'Likely human',
                  mixed:        'Mixed (AI-assisted)',
                  likely_ai:    'Likely AI-generated',
                  ai_generated: 'AI-generated',
                }[v] || v;
                return (
                  <div className="aic-result">
                    <div className="aic-verdict-row">
                      <span className={`aic-badge ${cls}`}>{label}</span>
                      <span className="aic-confidence">{aiCheck.confidence}% confidence</span>
                    </div>
                    {aiCheck.summary && <p className="aic-summary">{aiCheck.summary}</p>}
                    {aiCheck.indicators?.length > 0 && (
                      <ul className="aic-indicators">
                        {aiCheck.indicators.map((ind, i) => <li key={i}>{ind}</li>)}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {error && <div className="ag-form-error">{error}</div>}

        <div className="ag-form-actions">
          <button type="button" className="ag-btn ag-btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="ag-btn ag-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Candidate'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Candidate profile (read-only) ────────────────────────────────────────────
function CandidateProfile({ candidate, onEdit, onBack }) {
  const c = candidate;
  return (
    <div className="ag-form-page">
      <div className="ag-form-header">
        <button className="ag-back-btn" onClick={onBack}>← Back</button>
        <h2 className="ag-form-title">{c.name}</h2>
        <button className="ag-btn ag-btn--ghost" style={{ marginLeft: 'auto' }} onClick={onEdit}>Edit</button>
      </div>
      <div className="ag-profile-body">
        <div className="ag-profile-grid">
          {[
            ['Email',       c.email],
            ['Phone',       c.phone],
            ['Location',    c.location],
            ['Current Title', c.current_title],
            ['Company',     c.current_company],
            ['Experience',  c.experience_years != null ? `${c.experience_years} yrs` : null],
            ['Education',   c.education],
          ].map(([label, val]) => val ? (
            <div key={label} className="ag-profile-field">
              <span className="ag-profile-label">{label}</span>
              <span className="ag-profile-value">{val}</span>
            </div>
          ) : null)}
        </div>
        {c.skills?.length > 0 && (
          <div className="ag-profile-section">
            <span className="ag-profile-label">Skills</span>
            <div className="skills-chips" style={{ marginTop: 8 }}>
              {c.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
            </div>
          </div>
        )}
        {(c.linkedin_url || c.portfolio_url) && (
          <div className="ag-profile-section">
            <span className="ag-profile-label">Links</span>
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              {c.linkedin_url  && <a className="ag-profile-link" href={c.linkedin_url}  target="_blank" rel="noreferrer">LinkedIn ↗</a>}
              {c.portfolio_url && <a className="ag-profile-link" href={c.portfolio_url} target="_blank" rel="noreferrer">Portfolio ↗</a>}
            </div>
          </div>
        )}
        {c.resume_filename && (
          <div className="ag-profile-section">
            <span className="ag-profile-label">Resume on file</span>
            <span className="ag-profile-value" style={{ marginTop: 4, display: 'block', fontSize: 13, color: 'var(--text-2)' }}>
              {c.resume_filename}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main candidates module ───────────────────────────────────────────────────
export default function CandidatesModule({ authFetch, isLight, onToggleTheme, onLogout, onBack }) {
  const [candidates, setCandidates] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [view,       setView]       = useState('list'); // 'list' | 'form' | 'profile'
  const [selected,   setSelected]   = useState(null);
  const [deleteId,   setDeleteId]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'active' });
      if (search.trim()) params.set('search', search.trim());
      const res  = await authFetch(`${BACKEND_URL}/candidates?${params}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, search]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const handleSave = (saved) => {
    setCandidates(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setView('list');
    setSelected(null);
  };

  const handleDelete = async (id) => {
    setDeleteLoading(true);
    try {
      await authFetch(`${BACKEND_URL}/candidates/${id}`, { method: 'DELETE' });
      setCandidates(prev => prev.filter(c => c.id !== id));
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  const pageHeader = null;

  // ── Profile view ──
  if (view === 'profile' && selected) {
    return (
      <div className="page-content">
        {pageHeader}
        <div className="ag-module-body">
          <CandidateProfile
            candidate={selected}
            onBack={() => { setView('list'); setSelected(null); }}
            onEdit={() => setView('form')}
          />
        </div>
      </div>
    );
  }

  // ── Form view ──
  if (view === 'form') {
    return (
      <div className="page-content">
        {pageHeader}
        <div className="ag-module-body">
          <CandidateForm
            candidate={selected}
            authFetch={authFetch}
            onSave={handleSave}
            onCancel={() => { setView(selected ? 'profile' : 'list'); }}
          />
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="page-content">
      {pageHeader}
      <div className="ag-module-body">
        <div className="ag-toolbar">
          <input
            className="ag-search ag-search--wide"
            placeholder="Search by name, title, company, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="ag-btn ag-btn--primary" onClick={() => { setSelected(null); setView('form'); }}>
            + Add Candidate
          </button>
        </div>

        {loading ? (
          <div className="ag-empty"><span className="spinner" /> Loading…</div>
        ) : candidates.length === 0 ? (
          <div className="ag-empty">
            <p>No candidates in the pool yet.</p>
            <button className="ag-btn ag-btn--primary" onClick={() => { setSelected(null); setView('form'); }}>
              Add your first candidate
            </button>
          </div>
        ) : (
          <div className="ag-table-wrap">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Current Role</th>
                  <th>Company</th>
                  <th>Exp</th>
                  <th>Skills</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.id} className="ag-tr-clickable" onClick={() => { setSelected(c); setView('profile'); }}>
                    <td>
                      <div className="ag-candidate-name">{c.name}</div>
                      {c.email && <div className="ag-candidate-email">{c.email}</div>}
                    </td>
                    <td className="ag-td-muted">{c.current_title    || '—'}</td>
                    <td className="ag-td-muted">{c.current_company  || '—'}</td>
                    <td className="ag-td-muted">
                      {c.experience_years != null ? `${c.experience_years} yr` : '—'}
                    </td>
                    <td>
                      <div className="ag-skill-preview">
                        {c.skills.slice(0, 3).map(s => <span key={s} className="skill-chip">{s}</span>)}
                        {c.skills.length > 3 && <span className="ag-skill-more">+{c.skills.length - 3}</span>}
                      </div>
                    </td>
                    <td className="ag-td-muted">{c.location || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="ag-row-actions">
                        <button className="ag-action-btn" onClick={() => { setSelected(c); setView('form'); }}>Edit</button>
                        <button className="ag-action-btn ag-action-btn--danger" onClick={() => setDeleteId(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteId && (
        <div className="ag-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="ag-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">Remove Candidate</h3>
            <p className="ag-modal-body">This will permanently remove the candidate from the pool. Are you sure?</p>
            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setDeleteId(null)} disabled={deleteLoading}>Cancel</button>
              <button className="ag-btn ag-btn--danger" onClick={() => handleDelete(deleteId)} disabled={deleteLoading}>
                {deleteLoading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
