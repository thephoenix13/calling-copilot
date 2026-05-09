/**
 * MIReportForm — new Market Intelligence report
 *
 * Step 1 (input)  — three channels:
 *   A) Paste JD text       → POST /mi/parse-jd  → step 2
 *   B) Upload PDF / DOCX   → POST /mi/upload-jd → step 2
 *   C) Pick from Jobs      → GET  /jobs         → POST /mi/parse-jd(job.description) → step 2
 *
 * Step 2 (form)   — recruiter confirms / edits all fields, manual entries
 *                   always win, then POST /mi/reports kicks off the pipeline.
 *
 * Props:
 *   prefillJobContext  — full server-parsed JobContext → skip step 1
 *   prefillJobId       — link the report to an existing job row
 *   prefillJob         — legacy job-row shape (used by some callers)
 */

import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Mirrors server/utils/mi-prompts.js ALLOWED_VALUES.
const LOCATIONS = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai',
  'Kolkata', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Kochi', 'Indore',
  'Coimbatore', 'Remote (India)', 'Pan India'];
const INDUSTRIES = ['Information Technology', 'Financial Services', 'Healthcare & Pharma',
  'E-commerce & Retail', 'Manufacturing', 'Consulting', 'Telecommunications',
  'BFSI', 'Education & EdTech', 'Media & Entertainment', 'Automotive',
  'Real Estate', 'Energy & Utilities', 'Other'];
const EMPLOYMENT_TYPES = ['Full-time', 'Contract', 'Part-time', 'Freelance', 'Internship'];
const EXP_LEVELS = ['Fresher (0-1 years)', 'Junior (1-3 years)', 'Mid-level (3-5 years)',
  'Senior (5-8 years)', 'Lead (8-12 years)', 'Principal/Architect (12+ years)',
  'Director/VP Level'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '45 days', '60 days', '90 days'];

const EMPTY = {
  title: '', location: '', industry: '', employmentType: 'Full-time',
  experienceLevel: '', mustHaveSkills: [], noticePeriod: '',
  clientName: '', detailedJobDescription: '',
};

export default function MIReportForm({
  authFetch, userRole, onBack, onCreated,
  prefillJob, prefillJobContext, prefillJobId,
}) {
  const initialStep = (prefillJobContext || prefillJob) ? 'form' : 'input';
  const [step, setStep]       = useState(initialStep);
  const [inputMode, setInputMode] = useState('paste'); // 'paste' | 'upload' | 'pick'
  const [jdText, setJdText]   = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm]       = useState(EMPTY);
  const [linkedJobId, setLinkedJobId] = useState(prefillJobId || prefillJob?.id || null);

  // ── Channel C state — Pick from Job Management ─────────────────────────
  const [jobsList, setJobsList] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsSearch, setJobsSearch] = useState('');

  // ── Channel B state — Upload PDF/DOCX ──────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  // Pre-fill from a strict server-parsed JobContext (preferred path).
  useEffect(() => {
    if (prefillJobContext) {
      setForm({ ...EMPTY, ...prefillJobContext });
      setStep('form');
    }
  }, [prefillJobContext]);

  // Pre-fill from a legacy Job row (when no MI parse yet).
  useEffect(() => {
    if (!prefillJobContext && prefillJob) {
      const skills = Array.isArray(prefillJob.required_skills) ? prefillJob.required_skills : [];
      setForm(f => ({
        ...EMPTY,
        title: prefillJob.title || '',
        clientName: prefillJob.client_name || '',
        location: LOCATIONS.includes(prefillJob.location) ? prefillJob.location : '',
        mustHaveSkills: skills,
        detailedJobDescription: prefillJob.description || '',
      }));
      setStep('form');
    }
  }, [prefillJob, prefillJobContext]);

  // Lazy-load /jobs when user switches to the picker tab.
  useEffect(() => {
    if (inputMode !== 'pick' || jobsList.length || jobsLoading) return;
    setJobsLoading(true);
    authFetch(`${BACKEND_URL}/jobs`)
      .then(r => r.json())
      .then(d => setJobsList(Array.isArray(d.jobs) ? d.jobs : []))
      .catch(() => setJobsList([]))
      .finally(() => setJobsLoading(false));
  }, [inputMode, jobsList.length, jobsLoading, authFetch]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  // ── Channel A — paste JD ────────────────────────────────────────────────
  const handleParse = async () => {
    if (jdText.trim().length < 20) { setError('Paste at least a paragraph of JD text.'); return; }
    setParsing(true); setError('');
    try {
      const r = await authFetch(`${BACKEND_URL}/mi/parse-jd`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jdText }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Parse failed');
      setForm({ ...EMPTY, ...d.fields });
      setStep('form');
    } catch (e) { setError(e.message); }
    finally { setParsing(false); }
  };

  const skipParse = () => { setStep('form'); setForm({ ...EMPTY, detailedJobDescription: jdText }); };

  // ── Channel B — upload PDF/DOCX/TXT ────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) { setError('Choose a file first.'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const r = await authFetch(`${BACKEND_URL}/mi/upload-jd`, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      setForm({ ...EMPTY, ...d.fields });
      setStep('form');
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  // ── Channel C — pick from Job Management ───────────────────────────────
  const handlePickJob = async (job) => {
    setError(''); setParsing(true); setLinkedJobId(job.id);
    try {
      // Try the strict parser on the job's description for clean enums.
      const description = job.description || '';
      let fields = null;
      if (description && description.trim().length >= 20) {
        const r = await authFetch(`${BACKEND_URL}/mi/parse-jd`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: description }),
        });
        if (r.ok) {
          const d = await r.json();
          fields = d.fields || null;
        }
      }
      // Merge known job-row fields over parser output.
      const skills = Array.isArray(job.required_skills) ? job.required_skills : [];
      const merged = {
        ...EMPTY,
        ...(fields || {}),
        title: job.title || fields?.title || '',
        clientName: job.client_name || fields?.clientName || '',
        location: LOCATIONS.includes(job.location) ? job.location : (fields?.location || ''),
        mustHaveSkills: (fields?.mustHaveSkills?.length ? fields.mustHaveSkills : skills),
        detailedJobDescription: description || fields?.detailedJobDescription || '',
      };
      setForm(merged);
      setStep('form');
    } catch (e) { setError(e.message); }
    finally { setParsing(false); }
  };

  const filteredJobs = jobsList.filter(j => {
    if (!jobsSearch.trim()) return true;
    const q = jobsSearch.toLowerCase();
    return (j.title || '').toLowerCase().includes(q)
        || (j.client_name || '').toLowerCase().includes(q)
        || (j.location || '').toLowerCase().includes(q);
  });

  // ── Skill chip helpers ─────────────────────────────────────────────────
  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    if (form.mustHaveSkills.includes(s)) { setSkillInput(''); return; }
    set({ mustHaveSkills: [...form.mustHaveSkills, s] });
    setSkillInput('');
  };
  const removeSkill = (s) => set({ mustHaveSkills: form.mustHaveSkills.filter(x => x !== s) });

  // ── Submit (kick off pipeline) ─────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    const missing = [];
    if (!form.title.trim())               missing.push('title');
    if (!form.location)                   missing.push('location');
    if (!form.industry)                   missing.push('industry');
    if (!form.experienceLevel)            missing.push('experience level');
    if (!form.mustHaveSkills.length)      missing.push('at least one skill');
    if (missing.length) { setError(`Please fill: ${missing.join(', ')}.`); return; }

    setSubmitting(true);
    try {
      const body = {
        jobContext: form,
        ...(linkedJobId ? { jobId: linkedJobId } : {}),
      };
      const r = await authFetch(`${BACKEND_URL}/mi/reports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not start report.');
      onCreated(d.id);
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  // ── Step 1: input (3 modes — paste / upload / pick) ────────────────────
  if (step === 'input') {
    return (
      <div className="page-content">
        <div className="rpt-header">
          <div className="rpt-header-left">
            {onBack && <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={onBack}>← Back</button>}
            <div>
              <h1 className="rpt-title">New Market Intelligence Report</h1>
              <p className="rpt-subtitle">Step 1 of 2 — provide a job description, AI extracts structured fields</p>
            </div>
          </div>
        </div>

        <div className="rpt-card rpt-card--full" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Mode tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border-1, #E2E8F0)',
            background: 'var(--surface-2, #F8FAFC)',
          }}>
            {[
              { k: 'paste',  label: 'Paste JD text' },
              { k: 'upload', label: 'Upload PDF / DOCX' },
              { k: 'pick',   label: 'Pick from Jobs' },
            ].map(t => (
              <button
                key={t.k}
                onClick={() => { setInputMode(t.k); setError(''); }}
                style={{
                  flex: 1, padding: '12px 14px', fontSize: 13, fontWeight: 600,
                  background: inputMode === t.k ? 'var(--surface-1, #fff)' : 'transparent',
                  color: inputMode === t.k ? 'var(--orange, #F97316)' : 'var(--text-2)',
                  border: 'none',
                  borderBottom: inputMode === t.k ? '2px solid var(--orange, #F97316)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >{t.label}</button>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            {error && <div className="sett-error" style={{ marginBottom: 12 }}>{error}</div>}

            {/* ── Paste mode ─────────────────────────────────────────── */}
            {inputMode === 'paste' && (
              <>
                <label className="sett-label" style={{ display: 'block', marginBottom: 6 }}>
                  Paste full job description
                </label>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste JD text here — title, responsibilities, required skills, experience level…"
                  rows={12}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: 12, border: '1px solid var(--border-1, #E2E8F0)', borderRadius: 8,
                    fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical',
                    background: 'var(--surface-1, #fff)', color: 'var(--text-1)',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="ag-btn ag-btn--ghost" onClick={skipParse} disabled={parsing}>
                    Skip — fill manually
                  </button>
                  <button className="ag-btn ag-btn--primary" onClick={handleParse} disabled={parsing}>
                    {parsing ? 'Parsing…' : 'Extract fields →'}
                  </button>
                </div>
              </>
            )}

            {/* ── Upload mode ────────────────────────────────────────── */}
            {inputMode === 'upload' && (
              <>
                <label className="sett-label" style={{ display: 'block', marginBottom: 6 }}>
                  Upload a JD file (PDF, DOCX, or TXT — max 8 MB)
                </label>
                <div style={{
                  border: '2px dashed var(--border-1, #CBD5E1)', borderRadius: 8,
                  padding: 32, textAlign: 'center', background: 'var(--surface-2, #F8FAFC)',
                }}>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    style={{ display: 'block', margin: '0 auto', fontSize: 13 }}
                  />
                  {uploadFile && (
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
                      <strong>{uploadFile.name}</strong> · {(uploadFile.size / 1024).toFixed(0)} KB
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button
                    className="ag-btn ag-btn--primary"
                    onClick={handleUpload}
                    disabled={!uploadFile || uploading}
                  >
                    {uploading ? 'Reading file…' : 'Extract fields →'}
                  </button>
                </div>
              </>
            )}

            {/* ── Pick mode ──────────────────────────────────────────── */}
            {inputMode === 'pick' && (
              <>
                <label className="sett-label" style={{ display: 'block', marginBottom: 6 }}>
                  Pick a job from your Job Management
                </label>
                <input
                  className="sett-input"
                  placeholder="Search by title, client, or location…"
                  value={jobsSearch}
                  onChange={(e) => setJobsSearch(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                {jobsLoading ? (
                  <div className="jde-tab-empty" style={{ padding: '2rem' }}>Loading jobs…</div>
                ) : filteredJobs.length === 0 ? (
                  <div className="jde-tab-empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-2)' }}>
                    {jobsList.length === 0 ? 'No jobs found in your workspace.' : 'No jobs match your search.'}
                  </div>
                ) : (
                  <div style={{
                    display: 'grid', gap: 6, maxHeight: 360, overflow: 'auto',
                    border: '1px solid var(--border-1, #E2E8F0)', borderRadius: 8, padding: 6,
                    background: 'var(--surface-1, #fff)',
                  }}>
                    {filteredJobs.map(j => (
                      <button
                        key={j.id}
                        onClick={() => handlePickJob(j)}
                        disabled={parsing}
                        style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 6,
                          background: 'transparent', border: '1px solid transparent', cursor: 'pointer',
                          display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #F8FAFC)'; e.currentTarget.style.borderColor = 'var(--border-1, #E2E8F0)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                            {j.title || 'Untitled'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {(j.client_name || '—')} · {(j.location || '—')}
                            {j.status ? ` · ${j.status}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--orange, #F97316)' }}>Use →</span>
                      </button>
                    ))}
                  </div>
                )}
                {parsing && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
                    Reading JD and extracting fields…
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: form (Channel B + edit Channel A extracted fields) ─────────
  return (
    <div className="page-content">
      <div className="rpt-header">
        <div className="rpt-header-left">
          {onBack && <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={onBack}>← Back</button>}
          <div>
            <h1 className="rpt-title">New Market Intelligence Report</h1>
            <p className="rpt-subtitle">{prefillJob || prefillJobContext ? 'Confirm the job details, then generate.' : 'Step 2 of 2 — confirm the fields, then generate. Manual entries override anything the AI extracted.'}</p>
          </div>
        </div>
      </div>

      <div className="rpt-card rpt-card--full" style={{ padding: 20 }}>
        {error && <div className="sett-error" style={{ marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Job Title *">
            <input className="sett-input" value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Client Name (optional)">
            <input className="sett-input" value={form.clientName || ''} onChange={(e) => set({ clientName: e.target.value })} />
          </Field>

          <Field label="Location *">
            <Select value={form.location} onChange={(v) => set({ location: v })} options={LOCATIONS} placeholder="Select…" />
          </Field>
          <Field label="Industry *">
            <Select value={form.industry} onChange={(v) => set({ industry: v })} options={INDUSTRIES} placeholder="Select…" />
          </Field>

          <Field label="Experience Level *">
            <Select value={form.experienceLevel} onChange={(v) => set({ experienceLevel: v })} options={EXP_LEVELS} placeholder="Select…" />
          </Field>
          <Field label="Employment Type">
            <Select value={form.employmentType} onChange={(v) => set({ employmentType: v })} options={EMPLOYMENT_TYPES} />
          </Field>

          <Field label="Preferred Notice Period">
            <Select value={form.noticePeriod} onChange={(v) => set({ noticePeriod: v })} options={NOTICE_PERIODS} placeholder="Any" />
          </Field>
          <div /> {/* spacer */}
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Required Skills * (must all be present in candidate profiles)">
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8,
              border: '1px solid var(--border-1, #E2E8F0)', borderRadius: 8, background: 'var(--surface-1, #fff)',
              minHeight: 44,
            }}>
              {form.mustHaveSkills.map(s => (
                <span key={s} style={{
                  background: 'var(--orange-dim, rgba(249,115,22,0.10))',
                  color: 'var(--orange, #F97316)', fontSize: 12, padding: '3px 10px',
                  borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: '1px solid var(--orange-border, rgba(249,115,22,0.25))',
                }}>
                  {s}
                  <button onClick={() => removeSkill(s)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                </span>
              ))}
              <input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(); } }}
                placeholder={form.mustHaveSkills.length ? 'Add another…' : 'Type a skill, press Enter'}
                style={{
                  flex: 1, minWidth: 140, border: 'none', outline: 'none',
                  fontSize: 13, padding: '4px 6px', background: 'transparent', color: 'var(--text-1)',
                }}
              />
            </div>
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Detailed JD (optional — passed as additional context to research)">
            <textarea
              className="sett-input"
              value={form.detailedJobDescription || ''}
              onChange={(e) => set({ detailedJobDescription: e.target.value })}
              rows={5}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>
        </div>

        <div style={{
          marginTop: 18, padding: 12, background: 'var(--orange-dim, rgba(249,115,22,0.08))',
          border: '1px solid var(--orange-border, rgba(249,115,22,0.25))', borderRadius: 8,
          fontSize: 12, color: 'var(--text-2)',
        }}>
          <strong style={{ color: 'var(--orange, #F97316)' }}>Heads up — </strong>
          generation runs in the background and takes 30 – 90 seconds. The research agent searches the web for live India market data; the structurer turns it into the report shape; the executive summary is written last. You can leave this page and come back to find the report ready.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          {!prefillJob && !prefillJobContext && (
            <button className="ag-btn ag-btn--ghost" onClick={() => setStep('input')} disabled={submitting}>
              ← Back to JD
            </button>
          )}
          <button className="ag-btn ag-btn--primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Starting…' : 'Generate report →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tiny inline form helpers (keep this file self-contained) ─────────────
function Field({ label, children }) {
  return (
    <label className="sett-label" style={{ display: 'block' }}>
      <span style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      {children}
    </label>
  );
}
function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="sett-input" value={value || ''} onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%' }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
