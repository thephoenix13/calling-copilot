import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Step1_SelectJD({ session, authFetch, onComplete }) {
  const [jobs, setJobs]       = useState([]);
  const [selected, setSelected] = useState(session.job_id || '');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    authFetch(`${BACKEND_URL}/jobs?status=active`).then(r => r.json())
      .then(d => setJobs(d.jobs || []))
      .catch(console.error);
  }, [authFetch]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onComplete({ job_id: selected }, 2);
    } finally {
      setSaving(false);
    }
  };

  const job = jobs.find(j => j.id === parseInt(selected));

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 1 — Select Job Opening</h2>
        <p className="sw-step-desc">Choose the job opening this recruitment session is for. This feeds the job details into all subsequent steps.</p>
      </div>

      <div className="sw-content-card">
        <div className="ag-field">
          <label className="ag-field-label">Active Job Openings</label>
          {jobs.length === 0 ? (
            <p className="ag-empty" style={{ padding: '16px 0' }}>No active jobs found. Create a job in Job Management first.</p>
          ) : (
            <select
              className="ag-input"
              value={selected}
              onChange={e => setSelected(e.target.value)}
              style={{ maxWidth: 480 }}
            >
              <option value="">— Select a job —</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.title}{j.client_name ? ` — ${j.client_name}` : ''}{j.location ? ` (${j.location})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {job && (
          <div className="sw-job-preview">
            <div className="sw-job-preview-row">
              <span className="sw-job-preview-label">Title</span>
              <span className="sw-job-preview-value">{job.title}</span>
            </div>
            {job.client_name && (
              <div className="sw-job-preview-row">
                <span className="sw-job-preview-label">Client</span>
                <span className="sw-job-preview-value">{job.client_name}</span>
              </div>
            )}
            {job.location && (
              <div className="sw-job-preview-row">
                <span className="sw-job-preview-label">Location</span>
                <span className="sw-job-preview-value">{job.location}</span>
              </div>
            )}
            {(job.experience_min != null || job.experience_max != null) && (
              <div className="sw-job-preview-row">
                <span className="sw-job-preview-label">Experience</span>
                <span className="sw-job-preview-value">{job.experience_min ?? '?'}–{job.experience_max ?? '?'} yrs</span>
              </div>
            )}
            {job.required_skills?.length > 0 && (
              <div className="sw-job-preview-row sw-job-preview-row--skills">
                <span className="sw-job-preview-label">Required Skills</span>
                <div className="sw-skills-wrap">
                  {job.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            )}
            {job.preferred_skills?.length > 0 && (
              <div className="sw-job-preview-row sw-job-preview-row--skills">
                <span className="sw-job-preview-label">Preferred Skills</span>
                <div className="sw-skills-wrap">
                  {job.preferred_skills.map(s => <span key={s} className="skill-chip skill-chip--dim">{s}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sw-step-actions">
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleConfirm}
            disabled={!selected || saving}
          >
            {saving ? 'Saving…' : 'Confirm & Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
