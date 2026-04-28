import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const EMPLOYMENT_TYPES = ['Full-time', 'Contract', 'Part-time', 'Freelance', 'Internship'];
const STATUS_TABS = [
  { value: 'all',    label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft',  label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];
const STATUS_COLORS = {
  active: { bg: 'rgba(5,150,105,0.15)',  color: '#34d399', border: 'rgba(52,211,153,0.3)' },
  draft:  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  closed: { bg: 'rgba(107,114,128,0.15)',color: '#9ca3af', border: 'rgba(156,163,175,0.3)' },
};

// ── Reusable tag-chip skills input ───────────────────────────────────────────
function SkillsInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('');

  const add = () => {
    const skill = input.trim();
    if (!skill || value.includes(skill)) { setInput(''); return; }
    onChange([...value, skill]);
    setInput('');
  };

  const remove = (s) => onChange(value.filter(x => x !== s));

  return (
    <div className="skills-input-wrapper">
      <div className="skills-chips">
        {value.map(s => (
          <span key={s} className="skill-chip skill-chip--removable">
            {s}
            <button type="button" className="skill-chip-remove" onClick={() => remove(s)}>×</button>
          </span>
        ))}
        <input
          className="skills-inline-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={value.length === 0 ? placeholder : 'Add more…'}
        />
      </div>
    </div>
  );
}

// ── Job form (create / edit) ─────────────────────────────────────────────────
function JobForm({ job, onSave, onCancel, authFetch }) {
  const isEdit = !!job?.id;
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [form, setForm] = useState({
    title:           job?.title           || '',
    department:      job?.department      || '',
    client_name:     job?.client_name     || '',
    location:        job?.location        || '',
    employment_type: job?.employment_type || 'Full-time',
    description:     job?.description     || '',
    experience_min:  job?.experience_min  ?? '',
    experience_max:  job?.experience_max  ?? '',
    salary_min:      job?.salary_min      ?? '',
    salary_max:      job?.salary_max      ?? '',
    openings_count:  job?.openings_count  ?? 1,
    required_skills: job?.required_skills  || [],
    preferred_skills:job?.preferred_skills || [],
    status:          job?.status          || 'active',
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required.'); return; }

    setSaving(true);
    try {
      const url    = isEdit ? `${BACKEND_URL}/jobs/${job.id}` : `${BACKEND_URL}/jobs`;
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          experience_min:  form.experience_min  !== '' ? Number(form.experience_min)  : null,
          experience_max:  form.experience_max  !== '' ? Number(form.experience_max)  : null,
          salary_min:      form.salary_min      !== '' ? Number(form.salary_min)      : null,
          salary_max:      form.salary_max      !== '' ? Number(form.salary_max)      : null,
          openings_count:  Number(form.openings_count) || 1,
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

  return (
    <div className="ag-form-page">
      <div className="ag-form-header">
        <button className="ag-back-btn" type="button" onClick={onCancel}>← Back</button>
        <h2 className="ag-form-title">{isEdit ? 'Edit Job' : 'New Job Opening'}</h2>
      </div>

      <form className="ag-form" onSubmit={handleSubmit}>
        <div className="ag-form-grid">
          {/* Row 1 */}
          <div className="ag-field ag-field--wide">
            <label className="ag-label">Job Title *</label>
            <input className="ag-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Senior React Developer" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Department</label>
            <input className="ag-input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Engineering" />
          </div>

          {/* Row 2 */}
          <div className="ag-field">
            <label className="ag-label">Client / Company</label>
            <input className="ag-input" value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="e.g. Infosys" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Location</label>
            <input className="ag-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Pune / Remote" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Employment Type</label>
            <select className="ag-input" value={form.employment_type} onChange={e => set('employment_type', e.target.value)}>
              {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Row 3 — numeric */}
          <div className="ag-field">
            <label className="ag-label">Min Experience (yrs)</label>
            <input className="ag-input" type="number" min="0" value={form.experience_min} onChange={e => set('experience_min', e.target.value)} placeholder="e.g. 2" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Max Experience (yrs)</label>
            <input className="ag-input" type="number" min="0" value={form.experience_max} onChange={e => set('experience_max', e.target.value)} placeholder="e.g. 6" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Min Salary (LPA)</label>
            <input className="ag-input" type="number" min="0" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} placeholder="e.g. 8" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Max Salary (LPA)</label>
            <input className="ag-input" type="number" min="0" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} placeholder="e.g. 14" />
          </div>
          <div className="ag-field">
            <label className="ag-label">Openings</label>
            <input className="ag-input" type="number" min="1" value={form.openings_count} onChange={e => set('openings_count', e.target.value)} />
          </div>

          {/* Description */}
          <div className="ag-field ag-field--full">
            <label className="ag-label">Job Description</label>
            <textarea className="ag-input ag-textarea" rows={6} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Paste or type the full job description…" />
          </div>

          {/* Skills */}
          <div className="ag-field ag-field--full">
            <label className="ag-label">Required Skills</label>
            <SkillsInput value={form.required_skills} onChange={v => set('required_skills', v)} placeholder="Type a skill and press Enter…" />
          </div>
          <div className="ag-field ag-field--full">
            <label className="ag-label">Preferred Skills</label>
            <SkillsInput value={form.preferred_skills} onChange={v => set('preferred_skills', v)} placeholder="Type a skill and press Enter…" />
          </div>

          {/* Status */}
          <div className="ag-field">
            <label className="ag-label">Status</label>
            <div className="ag-radio-group">
              {['draft', 'active', 'closed'].map(s => (
                <label key={s} className="ag-radio-label">
                  <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => set('status', s)} />
                  <span className="ag-radio-text">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="ag-form-error">{error}</div>}

        <div className="ag-form-actions">
          <button type="button" className="ag-btn ag-btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="ag-btn ag-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main jobs module ─────────────────────────────────────────────────────────
export default function JobsModule({ authFetch, isLight, onToggleTheme, onLogout, onBack }) {
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter,setStatusFilter]= useState('all');
  const [search,      setSearch]      = useState('');
  const [view,        setView]        = useState('list'); // 'list' | 'form'
  const [editJob,     setEditJob]     = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const res  = await authFetch(`${BACKEND_URL}/jobs?${params}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, search]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleSave = (savedJob) => {
    setJobs(prev => {
      const idx = prev.findIndex(j => j.id === savedJob.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = savedJob; return next; }
      return [savedJob, ...prev];
    });
    setView('list');
    setEditJob(null);
  };

  const handleDelete = async (id) => {
    setDeleteLoading(true);
    try {
      await authFetch(`${BACKEND_URL}/jobs/${id}`, { method: 'DELETE' });
      setJobs(prev => prev.filter(j => j.id !== id));
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  const openCreate = () => { setEditJob(null); setView('form'); };
  const openEdit   = (job) => { setEditJob(job); setView('form'); };

  // ── Form view ──
  if (view === 'form') {
    return (
      <div className={`app${isLight ? ' light' : ''}`}>
        <header className="app-header">
          <div className="header-left">
            <span className="logo">💼</span>
            <h1>Job Management</h1>
          </div>
          <div className="header-right">
            <button className="theme-toggle-btn" onClick={onToggleTheme}>{isLight ? '🌙 Dark' : '☀️ Light'}</button>
            <button className="report-btn" onClick={onLogout}>Sign out</button>
          </div>
        </header>
        <div className="ag-module-body">
          <JobForm
            job={editJob}
            authFetch={authFetch}
            onSave={handleSave}
            onCancel={() => { setView('list'); setEditJob(null); }}
          />
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className={`app${isLight ? ' light' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <button className="report-btn" onClick={onBack}>← Agentic Home</button>
          <span className="logo">💼</span>
          <h1>Job Management</h1>
        </div>
        <div className="header-right">
          <button className="theme-toggle-btn" onClick={onToggleTheme}>{isLight ? '🌙 Dark' : '☀️ Light'}</button>
          <button className="report-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <div className="ag-module-body">
        {/* Toolbar */}
        <div className="ag-toolbar">
          <div className="ag-status-tabs">
            {STATUS_TABS.map(t => (
              <button
                key={t.value}
                className={`ag-status-tab${statusFilter === t.value ? ' active' : ''}`}
                onClick={() => setStatusFilter(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="ag-search"
            placeholder="Search jobs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="ag-btn ag-btn--primary" onClick={openCreate}>+ New Job</button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="ag-empty"><span className="spinner" /> Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="ag-empty">
            <p>No jobs found.</p>
            <button className="ag-btn ag-btn--primary" onClick={openCreate}>Create your first job</button>
          </div>
        ) : (
          <div className="ag-table-wrap">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Client</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Exp</th>
                  <th>Openings</th>
                  <th>Skills</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const sc = STATUS_COLORS[job.status] || STATUS_COLORS.closed;
                  return (
                    <tr key={job.id}>
                      <td className="ag-td-title">
                        <span className="ag-job-title">{job.title}</span>
                        {job.department && <span className="ag-job-dept">{job.department}</span>}
                      </td>
                      <td className="ag-td-muted">{job.client_name || '—'}</td>
                      <td className="ag-td-muted">{job.location    || '—'}</td>
                      <td className="ag-td-muted">{job.employment_type}</td>
                      <td className="ag-td-muted">
                        {job.experience_min != null || job.experience_max != null
                          ? `${job.experience_min ?? '?'}–${job.experience_max ?? '?'} yr`
                          : '—'}
                      </td>
                      <td className="ag-td-center">{job.openings_count}</td>
                      <td>
                        <div className="ag-skill-preview">
                          {job.required_skills.slice(0, 3).map(s => (
                            <span key={s} className="skill-chip">{s}</span>
                          ))}
                          {job.required_skills.length > 3 && (
                            <span className="ag-skill-more">+{job.required_skills.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="ag-status-badge" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {job.status}
                        </span>
                      </td>
                      <td>
                        <div className="ag-row-actions">
                          <button className="ag-action-btn" onClick={() => openEdit(job)}>Edit</button>
                          <button className="ag-action-btn ag-action-btn--danger" onClick={() => setDeleteId(job.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteId && (
        <div className="ag-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="ag-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">Delete Job</h3>
            <p className="ag-modal-body">This will permanently delete the job opening. Are you sure?</p>
            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setDeleteId(null)} disabled={deleteLoading}>Cancel</button>
              <button className="ag-btn ag-btn--danger" onClick={() => handleDelete(deleteId)} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
