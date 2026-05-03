import { useState, useEffect, useCallback, useRef } from 'react';

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

// ── Bulk JD Upload modal ─────────────────────────────────────────────────────
const FILE_STATES = { queued: 'queued', extracting: 'extracting', parsing: 'parsing', creating: 'creating', done: 'done', error: 'error' };

function BulkUploadModal({ authFetch, onDone, onClose }) {
  const fileRef  = useRef(null);
  const [files,  setFiles]  = useState([]);   // [{ file, name, state, error }]
  const [running, setRunning] = useState(false);

  const MAX_FILES = 10;
  const addFiles = (picked) => {
    const next = Array.from(picked).map(f => ({ file: f, name: f.name, state: FILE_STATES.queued, error: '' }));
    setFiles(prev => {
      const combined = [...prev, ...next];
      return combined.slice(0, MAX_FILES);
    });
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const setFileState = (i, patch) =>
    setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const runUpload = async () => {
    if (!files.length || running) return;
    setRunning(true);
    let created = 0;

    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];

      // 1. Extract text
      setFileState(i, { state: FILE_STATES.extracting });
      let text = '';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const r = await authFetch(`${BACKEND_URL}/enhance-jd/extract-text`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error('Text extraction failed');
        const d = await r.json();
        text = d.text || '';
        if (!text.trim()) throw new Error('No text found in file');
      } catch (err) {
        setFileState(i, { state: FILE_STATES.error, error: err.message });
        continue;
      }

      // 2. Parse structured fields
      setFileState(i, { state: FILE_STATES.parsing });
      let fields = {};
      try {
        const r = await authFetch(`${BACKEND_URL}/enhance-jd`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'parse_fields', description: text }),
        });
        if (!r.ok) throw new Error('Field parsing failed');
        const d = await r.json();
        fields = d.fields || {};
        if (!fields.title) throw new Error('Could not extract job title');
      } catch (err) {
        setFileState(i, { state: FILE_STATES.error, error: err.message });
        continue;
      }

      // 3. Create job
      setFileState(i, { state: FILE_STATES.creating });
      try {
        const r = await authFetch(`${BACKEND_URL}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:           fields.title        || file.name.replace(/\.[^.]+$/, ''),
            department:      fields.department   || null,
            client_name:     fields.client_name  || null,
            location:        fields.location     || null,
            employment_type: fields.employment_type || 'Full-time',
            description:     fields.description  || text.slice(0, 8000),
            experience_min:  fields.experience_min  != null ? Number(fields.experience_min)  : null,
            experience_max:  fields.experience_max  != null ? Number(fields.experience_max)  : null,
            salary_min:      fields.salary_min      != null ? Number(fields.salary_min)      : null,
            salary_max:      fields.salary_max      != null ? Number(fields.salary_max)      : null,
            openings_count:  fields.openings_count  != null ? Number(fields.openings_count)  : 1,
            required_skills:  Array.isArray(fields.required_skills)  ? fields.required_skills  : [],
            preferred_skills: Array.isArray(fields.preferred_skills) ? fields.preferred_skills : [],
            status: 'active',
          }),
        });
        if (!r.ok) throw new Error('Job creation failed');
        setFileState(i, { state: FILE_STATES.done });
        created++;
      } catch (err) {
        setFileState(i, { state: FILE_STATES.error, error: err.message });
      }
    }

    setRunning(false);
    if (created > 0) onDone();
  };

  const allDone  = files.length > 0 && files.every(f => f.state === FILE_STATES.done || f.state === FILE_STATES.error);
  const canStart = files.some(f => f.state === FILE_STATES.queued) && !running;

  const stateLabel = { queued: 'Queued', extracting: 'Extracting…', parsing: 'Parsing fields…', creating: 'Creating job…', done: '✓ Done', error: '✗ Error' };
  const stateCls   = { queued: '', extracting: 'bulk-file--active', parsing: 'bulk-file--active', creating: 'bulk-file--active', done: 'bulk-file--done', error: 'bulk-file--error' };

  return (
    <div className="ag-modal-overlay" onClick={!running ? onClose : undefined}>
      <div className="ag-modal bulk-upload-modal" onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">Bulk Upload Job Descriptions</h3>
        <p className="bulk-upload-hint">Upload PDF, DOCX, or TXT files. Each file is parsed and a new job is created automatically.</p>

        {/* Drop zone */}
        <div
          className={`bulk-drop-zone${files.length >= MAX_FILES ? ' bulk-drop-zone--full' : ''}`}
          onClick={() => files.length < MAX_FILES && fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          <span className="bulk-drop-icon">📂</span>
          <span className="bulk-drop-text">
            {files.length >= MAX_FILES ? 'Limit reached — remove a file to add more' : 'Click to select files or drag & drop here'}
          </span>
          <span className="bulk-drop-sub">PDF · DOCX · TXT · {files.length}/{MAX_FILES} files</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            style={{ display: 'none' }}
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bulk-file-list">
            {files.map((f, i) => (
              <div key={i} className={`bulk-file-row ${stateCls[f.state]}`}>
                <span className="bulk-file-name">{f.name}</span>
                <span className="bulk-file-status">{stateLabel[f.state]}</span>
                {f.error && <span className="bulk-file-error" title={f.error}>{f.error}</span>}
                {f.state === FILE_STATES.queued && !running && (
                  <button className="bulk-file-remove" onClick={() => removeFile(i)}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bulk-upload-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose} disabled={running}>Cancel</button>
          {allDone ? (
            <button className="ag-btn ag-btn--primary" onClick={onClose}>Close</button>
          ) : (
            <button className="ag-btn ag-btn--primary" onClick={runUpload} disabled={!canStart}>
              {running ? '⟳ Processing…' : `Upload ${files.filter(f => f.state === FILE_STATES.queued).length || files.length} File${files.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
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
  const [showBulkUpload, setShowBulkUpload] = useState(false);

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
      <div className="page-content">
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
    <div className="page-content">
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
          <button className="ag-btn ag-btn--ghost" onClick={() => setShowBulkUpload(true)}>📤 Bulk Upload</button>
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
                        {job.is_qualified && <span className="ag-qualified-badge">✓ Qualified</span>}
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

      {/* Bulk upload modal */}
      {showBulkUpload && (
        <BulkUploadModal
          authFetch={authFetch}
          onDone={fetchJobs}
          onClose={() => setShowBulkUpload(false)}
        />
      )}

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
