import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FormattedJDTab, RecruiterBriefTab, ClarificationsReadOnly,
  ReachoutTab, KeywordsTab, stripMarkers,
} from './JDEnhancerTabs';

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

// ── Qualification Modal ──────────────────────────────────────────────────────
function QualificationModal({ job, authFetch, onQualified, onClose }) {
  const [qa,      setQa]      = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [regen,   setRegen]   = useState({});
  const [error,   setError]   = useState('');

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    setLoading(true); setError('');
    try {
      const res  = await authFetch(`${BACKEND_URL}/jobs/${job.id}/qualification-questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions');
      setQa(data.questions || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleRegenerate = async (idx) => {
    setRegen(r => ({ ...r, [idx]: true }));
    try {
      const res  = await authFetch(`${BACKEND_URL}/jobs/${job.id}/qualification-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateIndex: idx, existingQuestions: qa.map(q => q.question) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate');
      if (data.question) setQa(prev => prev.map((item, i) => i === idx ? { ...item, question: data.question } : item));
    } catch (e) { setError(e.message); }
    finally { setRegen(r => ({ ...r, [idx]: false })); }
  };

  const handleAnswer = (idx, val) =>
    setQa(prev => prev.map((item, i) => i === idx ? { ...item, answer: val } : item));

  const handleMarkQualified = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(`${BACKEND_URL}/jobs/${job.id}/qualify`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qa }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      onQualified(job.id);
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal qual-modal" onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">📋 Job Qualification — {job.title}</h3>
        <p className="qual-modal-hint">
          Use these questions in your HM intake call. Fill in answers, then mark as Qualified — all JD assets will auto-refresh.
        </p>

        {loading ? (
          <div className="qual-loading"><span className="spinner" /> Generating clarification questions…</div>
        ) : error && qa.length === 0 ? (
          <div className="qual-error">
            {error}{' '}
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={loadQuestions}>Retry</button>
          </div>
        ) : (
          <div className="qual-qa-list">
            {qa.map((item, idx) => (
              <div key={idx} className="qual-qa-row">
                <div className="qual-qa-header">
                  <span className="qual-qa-num">{idx + 1}</span>
                  <span className="qual-qa-question">{item.question}</span>
                  <button
                    className="qual-regen-btn"
                    onClick={() => handleRegenerate(idx)}
                    disabled={regen[idx]}
                    title="Regenerate this question"
                  >
                    {regen[idx] ? '…' : '↺ Regen'}
                  </button>
                </div>
                <textarea
                  className="ag-input qual-qa-answer"
                  placeholder="HM's answer…"
                  rows={2}
                  value={item.answer || ''}
                  onChange={e => handleAnswer(idx, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {error && qa.length > 0 && <div className="qual-error" style={{ marginTop: 8 }}>{error}</div>}

        <div className="ag-modal-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleMarkQualified}
            disabled={saving || loading || qa.length === 0}
          >
            {saving ? 'Qualifying…' : '✓ Mark as Qualified'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Job Detail view ──────────────────────────────────────────────────────────
const JD_ASSET_TABS = [
  { key: 'jd',        label: 'Formatted JD',   field: 'formattedJD'            },
  { key: 'brief',     label: 'Recruiter Brief', field: 'recruiterBrief'         },
  { key: 'questions', label: 'Clarifications',  field: 'clarificationQuestions' },
  { key: 'reachout',  label: 'Reachout',        field: 'reachoutMaterial'       },
  { key: 'keywords',  label: 'Keywords',        field: 'sourcingKeywords'       },
];

function JobDetail({ job, authFetch, userRole, onBack, onEdit, onDelete }) {
  const [candidates,    setCandidates]    = useState([]);
  const [matchLoading,  setMatchLoading]  = useState(true);
  const [totalPool,     setTotalPool]     = useState(0);
  const [enhancement,   setEnhancement]   = useState(undefined); // undefined = loading, null = none
  const [activeAssetTab, setActiveAssetTab] = useState('jd');
  const [assignees,     setAssignees]     = useState([]);
  const [showAddAssignee, setShowAddAssignee] = useState(false);
  const [teamPool,      setTeamPool]      = useState([]);
  const [assignBusy,    setAssignBusy]    = useState(false);
  const [hms,           setHms]           = useState([]);
  const [showAddHm,     setShowAddHm]     = useState(false);
  const [hmFeedback,    setHmFeedback]    = useState([]);

  // Owners and Team Leads can manage assignees. Legacy role names accepted
  // so old JWTs still work until the next sign-in.
  const canAssign = ['owner', 'team_lead', 'admin', 'superuser'].includes(userRole);
  // Recruiters / Sr Recruiters can also edit job content (just not assignees).
  const canEdit   = ['owner', 'team_lead', 'sr_recruiter', 'recruiter',
                     'admin', 'superuser', 'subuser'].includes(userRole);

  const loadAssignees = useCallback(() => {
    authFetch(`${BACKEND_URL}/jobs/${job.id}/assignees`)
      .then(r => r.json())
      .then(d => setAssignees(d.assignees || []))
      .catch(() => setAssignees([]));
  }, [job.id, authFetch]);

  const loadHms = useCallback(() => {
    authFetch(`${BACKEND_URL}/jobs/${job.id}/hiring-managers`)
      .then(r => r.json())
      .then(d => setHms(d.hiring_managers || []))
      .catch(() => setHms([]));
  }, [job.id, authFetch]);

  const loadHmFeedback = useCallback(() => {
    authFetch(`${BACKEND_URL}/jobs/${job.id}/hm-feedback`)
      .then(r => r.json())
      .then(d => setHmFeedback(d.feedback || []))
      .catch(() => setHmFeedback([]));
  }, [job.id, authFetch]);

  useEffect(() => {
    (async () => {
      setMatchLoading(true);
      try {
        const res  = await authFetch(`${BACKEND_URL}/jobs/${job.id}/matched-candidates`);
        const data = await res.json();
        setCandidates(data.candidates || []);
        setTotalPool(data.total_pool  || 0);
      } catch { setCandidates([]); }
      finally  { setMatchLoading(false); }
    })();

    authFetch(`${BACKEND_URL}/jobs/${job.id}/enhancement`)
      .then(r => r.json())
      .then(d => setEnhancement(d.enhancement || null))
      .catch(() => setEnhancement(null));

    loadAssignees();
    loadHms();
    loadHmFeedback();
  }, [job.id, authFetch, loadAssignees, loadHms, loadHmFeedback]);

  const openAddHm = async () => {
    setShowAddHm(true);
    if (teamPool.length) return;
    try {
      const r = await authFetch(`${BACKEND_URL}/admin/team-pool`);
      const d = await r.json();
      setTeamPool(d.members || []);
    } catch { setTeamPool([]); }
  };

  const addHm = async (userId) => {
    setAssignBusy(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/jobs/${job.id}/hiring-managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const d = await r.json();
      if (r.ok) {
        setHms(d.hiring_managers || []);
        setShowAddHm(false);
      } else {
        alert(d.error || 'Failed to attach hiring manager.');
      }
    } finally { setAssignBusy(false); }
  };

  const removeHm = async (userId) => {
    if (!confirm('Remove this hiring manager from the job?')) return;
    setAssignBusy(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/jobs/${job.id}/hiring-managers/${userId}`, { method: 'DELETE' });
      const d = await r.json();
      if (r.ok) setHms(d.hiring_managers || []);
      else      alert(d.error || 'Failed to remove hiring manager.');
    } finally { setAssignBusy(false); }
  };

  const openAddAssignee = async () => {
    setShowAddAssignee(true);
    if (teamPool.length) return;
    try {
      const r = await authFetch(`${BACKEND_URL}/admin/team-pool`);
      const d = await r.json();
      setTeamPool(d.members || []);
    } catch { setTeamPool([]); }
  };

  const addAssignee = async (userId, roleOnJob) => {
    setAssignBusy(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/jobs/${job.id}/assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role_on_job: roleOnJob }),
      });
      const d = await r.json();
      if (r.ok) {
        setAssignees(d.assignees || []);
        setShowAddAssignee(false);
      } else {
        alert(d.error || 'Failed to add assignee.');
      }
    } finally { setAssignBusy(false); }
  };

  const removeAssignee = async (userId) => {
    if (!confirm('Remove this teammate from the job?')) return;
    setAssignBusy(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/jobs/${job.id}/assignees/${userId}`, { method: 'DELETE' });
      const d = await r.json();
      if (r.ok) setAssignees(d.assignees || []);
      else      alert(d.error || 'Failed to remove assignee.');
    } finally { setAssignBusy(false); }
  };

  const ROLE_LABEL = { lead: 'Lead', collaborator: 'Collaborator', sourcer: 'Sourcer' };
  const ROLE_COLOR = {
    lead:         { bg: 'rgba(249,115,22,0.12)', color: '#ea580c', border: 'rgba(249,115,22,0.3)' },
    collaborator: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', border: 'rgba(59,130,246,0.3)' },
    sourcer:      { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: 'rgba(124,58,237,0.3)' },
  };
  const assignedUserIds = new Set(assignees.map(a => a.user_id));
  const eligible = teamPool.filter(m => !assignedUserIds.has(m.id));

  const copyAssetTab = (tabKey) => {
    const tab = JD_ASSET_TABS.find(t => t.key === tabKey);
    const content = enhancement?.[tab.field];
    const text = typeof content === 'string' ? stripMarkers(content) : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const sc = STATUS_COLORS[job.status] || STATUS_COLORS.closed;

  const scoreColor = (s) => {
    if (s >= 80) return { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a', border: 'rgba(34,197,94,0.3)' };
    if (s >= 60) return { bg: 'rgba(249,115,22,0.12)', color: '#ea580c', border: 'rgba(249,115,22,0.3)' };
    if (s >= 40) return { bg: 'rgba(245,158,11,0.12)', color: '#d97706', border: 'rgba(245,158,11,0.3)' };
    return           { bg: 'rgba(100,116,139,0.10)',   color: '#64748b', border: 'rgba(100,116,139,0.25)' };
  };

  return (
    <div className="jd-detail">
      {/* ── Header ── */}
      <div className="jd-detail-header">
        <button className="ag-btn ag-btn--ghost" onClick={onBack}>← Back to Jobs</button>
        <div className="jd-detail-actions">
          {canEdit   && <button className="ag-btn ag-btn--ghost"  onClick={() => onEdit(job)}>Edit Job</button>}
          {canAssign && <button className="ag-btn ag-btn--danger" onClick={() => onDelete(job.id)}>Delete</button>}
        </div>
      </div>

      {/* ── Job card ── */}
      <div className="jd-detail-card">
        <div className="jd-detail-title-row">
          <div>
            <h1 className="jd-detail-title">{job.title}</h1>
            {job.department && <p className="jd-detail-dept">{job.department}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {job.is_qualified && <span className="ag-qualified-badge">✓ Qualified</span>}
            <span className="ag-status-badge" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
              {job.status}
            </span>
          </div>
        </div>

        {/* Meta grid */}
        <div className="jd-detail-meta">
          {job.client_name && (
            <div className="jd-meta-item">
              <span className="jd-meta-label">Client</span>
              <span className="jd-meta-value">{job.client_name}</span>
            </div>
          )}
          {job.location && (
            <div className="jd-meta-item">
              <span className="jd-meta-label">Location</span>
              <span className="jd-meta-value">{job.location}</span>
            </div>
          )}
          <div className="jd-meta-item">
            <span className="jd-meta-label">Type</span>
            <span className="jd-meta-value">{job.employment_type}</span>
          </div>
          {(job.experience_min != null || job.experience_max != null) && (
            <div className="jd-meta-item">
              <span className="jd-meta-label">Experience</span>
              <span className="jd-meta-value">{job.experience_min ?? '?'}–{job.experience_max ?? '?'} years</span>
            </div>
          )}
          {(job.salary_min != null || job.salary_max != null) && (
            <div className="jd-meta-item">
              <span className="jd-meta-label">Salary (LPA)</span>
              <span className="jd-meta-value">₹{job.salary_min ?? '?'}–{job.salary_max ?? '?'}</span>
            </div>
          )}
          <div className="jd-meta-item">
            <span className="jd-meta-label">Openings</span>
            <span className="jd-meta-value">{job.openings_count}</span>
          </div>
        </div>

        {/* Skills */}
        {job.required_skills?.length > 0 && (
          <div className="jd-detail-section">
            <p className="jd-section-label">Required Skills</p>
            <div className="ag-skill-preview">
              {job.required_skills.map(s => <span key={s} className="skill-chip skill-chip--required">{s}</span>)}
            </div>
          </div>
        )}
        {job.preferred_skills?.length > 0 && (
          <div className="jd-detail-section">
            <p className="jd-section-label">Preferred Skills</p>
            <div className="ag-skill-preview">
              {job.preferred_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
            </div>
          </div>
        )}

        {/* Team / Assignees */}
        <div className="jd-detail-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p className="jd-section-label" style={{ margin: 0 }}>Team</p>
            {canAssign && (
              <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={openAddAssignee} disabled={assignBusy}>
                + Add Assignee
              </button>
            )}
          </div>
          <div className="ag-skill-preview" style={{ gap: 8 }}>
            {assignees.length === 0 && <span style={{ color: 'var(--text-3)', fontSize: 13 }}>No assignees yet.</span>}
            {assignees.map(a => {
              const c = ROLE_COLOR[a.role_on_job] || ROLE_COLOR.collaborator;
              return (
                <span key={a.id} className="skill-chip"
                  style={{
                    background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                  }}
                >
                  <strong style={{ fontWeight: 600 }}>{a.display_name || a.email}</strong>
                  <span style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.85 }}>
                    {ROLE_LABEL[a.role_on_job]}
                  </span>
                  {canAssign && assignees.length > 1 && (
                    <button
                      onClick={() => removeAssignee(a.user_id)}
                      disabled={assignBusy}
                      title="Remove"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: c.color, fontSize: 14, padding: 0, marginLeft: 2, lineHeight: 1,
                      }}
                    >×</button>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Hiring Managers */}
        <div className="jd-detail-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p className="jd-section-label" style={{ margin: 0 }}>Hiring Managers</p>
            {canAssign && (
              <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={openAddHm} disabled={assignBusy}>
                + Add Hiring Manager
              </button>
            )}
          </div>
          <div className="ag-skill-preview" style={{ gap: 8 }}>
            {hms.length === 0 && <span style={{ color: 'var(--text-3)', fontSize: 13 }}>No hiring managers attached.</span>}
            {hms.map(h => (
              <span key={h.id} className="skill-chip"
                style={{
                  background: 'rgba(16,185,129,0.10)', color: '#059669',
                  border: '1px solid rgba(16,185,129,0.3)',
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                }}
              >
                <strong style={{ fontWeight: 600 }}>{h.display_name || h.email}</strong>
                <span style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.85 }}>HM</span>
                {canAssign && (
                  <button
                    onClick={() => removeHm(h.user_id)}
                    disabled={assignBusy}
                    title="Remove"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#059669', fontSize: 14, padding: 0, marginLeft: 2, lineHeight: 1,
                    }}
                  >×</button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* HM Feedback received */}
        {hmFeedback.length > 0 && (() => {
          const REC_LABEL = { strong_yes: 'Strong Yes', yes: 'Yes', maybe: 'Maybe', no: 'No', strong_no: 'Strong No' };
          const REC_COLOR = {
            strong_yes: '#10b981', yes: '#34d399', maybe: '#f59e0b', no: '#f87171', strong_no: '#dc2626',
          };
          // Group feedback by candidate.
          const byCand = new Map();
          for (const fb of hmFeedback) {
            if (!byCand.has(fb.candidate_id)) byCand.set(fb.candidate_id, { name: fb.candidate_name, title: fb.candidate_title, items: [] });
            byCand.get(fb.candidate_id).items.push(fb);
          }
          return (
            <div className="jd-detail-section">
              <p className="jd-section-label">Hiring Manager Feedback ({hmFeedback.length})</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {[...byCand.values()].map(group => (
                  <div key={group.name} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>{group.name}</div>
                    {group.title && <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{group.title}</div>}
                    {group.items.map(fb => {
                      const c = REC_COLOR[fb.recommendation] || '#94a3b8';
                      return (
                        <div key={fb.id} style={{
                          marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-subtle)',
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 12, color: 'var(--text-1)' }}>{fb.hm_display_name || fb.hm_email}</strong>
                            {fb.recommendation && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                                padding: '2px 8px', borderRadius: 999,
                                background: `${c}18`, color: c, border: `1px solid ${c}40`,
                              }}>{REC_LABEL[fb.recommendation] || fb.recommendation}</span>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>
                              {fb.updated_at ? new Date(fb.updated_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </span>
                          </div>
                          {fb.notes && (
                            <div style={{
                              fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55,
                              fontStyle: 'italic',
                              borderLeft: '3px solid var(--border)',
                              paddingLeft: 10,
                            }}>
                              "{fb.notes}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {showAddHm && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}
            onClick={() => setShowAddHm(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20, width: 460, maxWidth: '92vw', maxHeight: '80vh', overflow: 'auto',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Attach Hiring Manager</h3>
              {(() => {
                const attachedIds = new Set(hms.map(h => h.user_id));
                const pool = teamPool.filter(m => m.role === 'hiring_manager' && !attachedIds.has(m.id));
                if (pool.length === 0) {
                  return (
                    <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      No eligible hiring managers found. Add one from <em>Settings → Team</em>{' '}
                      with role <strong>Hiring Manager</strong>, then come back here.
                    </p>
                  );
                }
                return pool.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.display_name || m.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.email}</div>
                    </div>
                    <button
                      className="ag-btn ag-btn--primary ag-btn--sm"
                      disabled={assignBusy}
                      onClick={() => addHm(m.id)}
                    >Attach</button>
                  </div>
                ));
              })()}
              <div style={{ marginTop: 14, textAlign: 'right' }}>
                <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setShowAddHm(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showAddAssignee && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}
            onClick={() => setShowAddAssignee(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20, width: 460, maxWidth: '92vw', maxHeight: '80vh', overflow: 'auto',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Add Assignee</h3>
              {eligible.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Everyone in your company is already on this job.
                  Add new teammates from <em>Settings → Team</em>.
                </p>
              ) : eligible.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.display_name || m.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.email} · {m.role}</div>
                  </div>
                  <select
                    defaultValue="collaborator"
                    onChange={e => e.currentTarget.dataset.role = e.target.value}
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    id={`role-${m.id}`}
                  >
                    <option value="lead">Lead</option>
                    <option value="collaborator">Collaborator</option>
                    <option value="sourcer">Sourcer</option>
                  </select>
                  <button
                    className="ag-btn ag-btn--primary ag-btn--sm"
                    disabled={assignBusy}
                    onClick={() => {
                      const sel = document.getElementById(`role-${m.id}`);
                      addAssignee(m.id, sel ? sel.value : 'collaborator');
                    }}
                  >Add</button>
                </div>
              ))}
              <div style={{ marginTop: 14, textAlign: 'right' }}>
                <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setShowAddAssignee(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        {job.description && (
          <div className="jd-detail-section">
            <p className="jd-section-label">Description</p>
            <p className="jd-description">{job.description}</p>
          </div>
        )}
      </div>

      {/* ── JD Enhancer Assets ── */}
      <div className="jd-assets-section">
        <div className="jd-assets-section-header">
          <h2 className="jd-assets-title">JD Enhancer Assets</h2>
          {enhancement === undefined && (
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</span>
          )}
        </div>

        {enhancement === null && enhancement !== undefined && (
          <div className="jd-assets-empty">
            No assets yet. Run the <strong>JD Enhancer</strong> for this role inside a Pipeline Session to generate the formatted JD, recruiter brief, reachout copy, and more.
          </div>
        )}

        {enhancement && (
          <>
            <div className="jde-tab-bar" style={{ marginBottom: 0 }}>
              {JD_ASSET_TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`jde-tab-btn${activeAssetTab === tab.key ? ' jde-tab-btn--active' : ''}`}
                  onClick={() => setActiveAssetTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
              <button
                className="ag-btn ag-btn--ghost ag-btn--sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => copyAssetTab(activeAssetTab)}
              >
                📋 Copy
              </button>
            </div>
            <div className="jd-assets-tab-content jde-tab-content">
              {activeAssetTab === 'jd'        && (enhancement.formattedJD
                ? <FormattedJDTab content={enhancement.formattedJD} />
                : <div className="rpt-empty">Not generated yet.</div>)}
              {activeAssetTab === 'brief'     && (enhancement.recruiterBrief
                ? <RecruiterBriefTab content={enhancement.recruiterBrief} />
                : <div className="rpt-empty">Not generated yet.</div>)}
              {activeAssetTab === 'questions' && <ClarificationsReadOnly content={enhancement.clarificationQuestions} />}
              {activeAssetTab === 'reachout'  && (enhancement.reachoutMaterial
                ? <ReachoutTab content={enhancement.reachoutMaterial} />
                : <div className="rpt-empty">Not generated yet.</div>)}
              {activeAssetTab === 'keywords'  && (enhancement.sourcingKeywords
                ? <KeywordsTab content={enhancement.sourcingKeywords} />
                : <div className="rpt-empty">Not generated yet.</div>)}
            </div>
          </>
        )}
      </div>

      {/* ── Matched candidates ── */}
      <div className="jd-matched-header">
        <div>
          <h2 className="jd-matched-title">Matched Candidates</h2>
          <p className="jd-matched-sub">
            {matchLoading ? 'Scoring candidates…' : `${candidates.length} matches from ${totalPool} in your database`}
          </p>
        </div>
      </div>

      {matchLoading ? (
        <div className="ag-empty"><span className="spinner" /> Scoring candidates…</div>
      ) : candidates.length === 0 ? (
        <div className="ag-empty"><p>No candidates scored above the match threshold.</p></div>
      ) : (
        <div className="ag-table-wrap">
          <table className="ag-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Current Role</th>
                <th>Company</th>
                <th>Exp</th>
                <th>Match</th>
                <th>Matched Skills</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map(c => {
                const sc2 = scoreColor(c.match_score);
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="ag-candidate-name">{c.name}</span>
                      {c.location && <span className="ag-candidate-email">{c.location}</span>}
                    </td>
                    <td className="ag-td-muted">{c.current_title || '—'}</td>
                    <td className="ag-td-muted">{c.current_company || '—'}</td>
                    <td className="ag-td-muted">{c.experience_years != null ? `${c.experience_years} yr` : '—'}</td>
                    <td>
                      <span className="jd-score-badge" style={{ background: sc2.bg, color: sc2.color, border: `1px solid ${sc2.border}` }}>
                        {c.match_score}%
                      </span>
                    </td>
                    <td>
                      <div className="ag-skill-preview">
                        {c.matched_required.slice(0, 4).map(s => (
                          <span key={s} className="skill-chip skill-chip--matched">{s}</span>
                        ))}
                        {c.matched_required.length > 4 && (
                          <span className="ag-skill-more">+{c.matched_required.length - 4}</span>
                        )}
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
  );
}

// ── Main jobs module ─────────────────────────────────────────────────────────
export default function JobsModule({ authFetch, userRole, isLight, onToggleTheme, onLogout, onBack }) {
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter,setStatusFilter]= useState('all');
  const [assignFilter,setAssignFilter]= useState('all'); // 'all' | 'me'
  const [search,      setSearch]      = useState('');
  const [view,        setView]        = useState('list'); // 'list' | 'form' | 'detail'
  const [editJob,     setEditJob]     = useState(null);
  const [detailJob,   setDetailJob]   = useState(null);
  const [deleteId,      setDeleteId]      = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [qualifyJobId,  setQualifyJobId]  = useState(null);

  // Roles that can create / edit / delete jobs. Read-only roles (sourcer,
  // hiring_manager) see the list but no mutation buttons.
  const canMutate = ['owner', 'team_lead', 'sr_recruiter', 'recruiter',
                     'admin', 'superuser', 'subuser'].includes(userRole);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all')          params.set('status', statusFilter);
      if (assignFilter === 'me')           params.set('assigned_to', 'me');
      if (search.trim())                   params.set('search', search.trim());
      const res  = await authFetch(`${BACKEND_URL}/jobs?${params}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, assignFilter, search]);

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
  const openEdit   = (job) => { setEditJob(job); setDetailJob(null); setView('form'); };
  const openDetail = (job) => { setDetailJob(job); setView('detail'); };

  const handleQualified = (jobId) =>
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, is_qualified: true } : j));

  // ── Detail view ──
  if (view === 'detail' && detailJob) {
    return (
      <div className="page-content page-content--wide">
        <div className="ag-module-body">
          <JobDetail
            job={detailJob}
            authFetch={authFetch}
            userRole={userRole}
            onBack={() => setView('list')}
            onEdit={openEdit}
            onDelete={(id) => { setDeleteId(id); setView('list'); }}
          />
        </div>
      </div>
    );
  }

  // ── Form view ──
  if (view === 'form') {
    return (
      <div className="page-content page-content--wide">
        <div className="ag-module-body">
          <div className="ag-page-header">
            <div>
              <h1 className="ag-page-title">Job Management</h1>
              <p className="ag-page-subtitle">{editJob ? 'Edit job' : 'Create new job'}</p>
            </div>
          </div>
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
    <div className="page-content page-content--wide">
      <div className="ag-module-body">
        {/* Page header */}
        <div className="ag-page-header">
          <div>
            <h1 className="ag-page-title">Job Management</h1>
            <p className="ag-page-subtitle">Manage open positions and client requirements</p>
          </div>
        </div>
        {/* Toolbar */}
        <div className="ag-toolbar">
          <div className="ag-status-tabs">
            <button
              className={`ag-status-tab${assignFilter === 'all' ? ' active' : ''}`}
              onClick={() => setAssignFilter('all')}
            >
              All Jobs
            </button>
            <button
              className={`ag-status-tab${assignFilter === 'me' ? ' active' : ''}`}
              onClick={() => setAssignFilter('me')}
            >
              My Jobs
            </button>
          </div>
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
          {canMutate && (
            <>
              <button className="ag-btn ag-btn--ghost" onClick={() => setShowBulkUpload(true)}>📤 Bulk Upload</button>
              <button className="ag-btn ag-btn--primary" onClick={openCreate}>+ New Job</button>
            </>
          )}
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
                  <th>Lead</th>
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
                        <button className="ag-job-title ag-job-title--link" onClick={() => openDetail(job)}>{job.title}</button>
                        {job.department && <span className="ag-job-dept">{job.department}</span>}
                        {job.is_qualified && <span className="ag-qualified-badge">✓ Qualified</span>}
                      </td>
                      <td className="ag-td-muted">{job.client_name || '—'}</td>
                      <td className="ag-td-muted">{job.lead_name   || '—'}</td>
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
                          {canMutate && !job.is_qualified && (
                            <button className="ag-action-btn ag-action-btn--qualify" onClick={() => setQualifyJobId(job.id)}>Qualify</button>
                          )}
                          {canMutate && (
                            <>
                              <button className="ag-action-btn" onClick={() => openEdit(job)}>Edit</button>
                              <button className="ag-action-btn ag-action-btn--danger" onClick={() => setDeleteId(job.id)}>Delete</button>
                            </>
                          )}
                          {!canMutate && <span className="ag-td-muted" style={{ fontSize: 11 }}>Read-only</span>}
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

      {/* Qualification modal */}
      {qualifyJobId && (
        <QualificationModal
          job={jobs.find(j => j.id === qualifyJobId)}
          authFetch={authFetch}
          onQualified={handleQualified}
          onClose={() => setQualifyJobId(null)}
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
