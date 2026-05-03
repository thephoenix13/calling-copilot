import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusColors = {
  invited:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  in_progress:{ color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  completed:  { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  evaluated:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
};
const recLabels = {
  strong_fit:       { label: 'Strong Fit',     color: '#10b981' },
  good_fit:         { label: 'Good Fit',        color: '#34d399' },
  needs_review:     { label: 'Needs Review',    color: '#fbbf24' },
  not_recommended:  { label: 'Not Recommended', color: '#f87171' },
};

// ── Invite Candidate Modal ────────────────────────────────────────────────────
function InviteModal({ interviewId, authFetch, onInvited, onClose }) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState(null);
  const [err,     setErr]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setErr('Name and email are required.'); return; }
    setSending(true);
    setErr('');
    try {
      const res = await authFetch(`${BACKEND_URL}/vi/interviews/${interviewId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Failed to invite.'); return; }
      setResult(data);
      onInvited();
    } catch {
      setErr('Network error.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">Invite Candidate</h3>
        {!result ? (
          <form onSubmit={handleSubmit}>
            {err && <div className="vi-modal-err">{err}</div>}
            <div className="vi-modal-field">
              <label>Full Name *</label>
              <input className="ag-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Kapoor" required />
            </div>
            <div className="vi-modal-field">
              <label>Email Address *</label>
              <input className="ag-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="priya@example.com" required />
            </div>
            <div className="vi-modal-field">
              <label>Phone (optional)</label>
              <input className="ag-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="ag-modal-actions">
              <button type="button" className="ag-btn ag-btn--ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="ag-btn ag-btn--primary" disabled={sending}>
                {sending ? 'Sending…' : '📧 Send Invitation'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="vi-invite-success">
              <div className="vi-invite-success-icon">✓</div>
              <p>Invitation sent to <strong>{email}</strong></p>
              <div className="vi-invite-link-box">
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Interview link:</span>
                <code className="vi-invite-link">{result.link}</code>
              </div>
            </div>
            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create / Edit Interview Modal ─────────────────────────────────────────────
function InterviewFormModal({ existing, authFetch, onSaved, onClose }) {
  const [title,          setTitle]          = useState(existing?.title || '');
  const [jobDescription, setJobDescription] = useState(existing?.job_description || '');
  const [questionCount,  setQuestionCount]  = useState(existing?.question_count || 5);
  const [expiryDate,     setExpiryDate]     = useState(existing?.expiry_date ? existing.expiry_date.slice(0, 10) : '');
  const [saving,         setSaving]         = useState(false);
  const [extracting,     setExtracting]     = useState(false);
  const [err,            setErr]            = useState('');
  const fileInputRef = useRef(null);

  const handleJDUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setErr('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await authFetch(`${BACKEND_URL}/enhance-jd/extract-text`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Failed to extract text from file.'); return; }
      setJobDescription(data.text || '');
    } catch {
      setErr('Failed to read file.');
    } finally {
      setExtracting(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const url    = existing ? `${BACKEND_URL}/vi/interviews/${existing.id}` : `${BACKEND_URL}/vi/interviews`;
      const method = existing ? 'PUT' : 'POST';
      const res    = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, job_description: jobDescription,
          question_count: parseInt(questionCount) || 5,
          expiry_date: expiryDate || null,
          status: existing?.status || 'draft',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Save failed.'); return; }
      onSaved(data.interview);
    } catch {
      setErr('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">{existing ? 'Edit Interview' : 'Create Video Interview'}</h3>
        <form onSubmit={handleSave}>
          {err && <div className="vi-modal-err">{err}</div>}
          <div className="vi-modal-field">
            <label>Interview Title *</label>
            <input className="ag-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. React Developer — Round 1" autoFocus />
          </div>
          <div className="vi-modal-field">
            <div className="vi-jd-label-row">
              <label>Job Description <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(used to generate AI questions)</span></label>
              <button
                type="button"
                className="vi-jd-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                title="Upload PDF, DOC, DOCX, or TXT"
              >
                {extracting ? <><span className="spinner" style={{ width: 11, height: 11, marginRight: 4 }} />Extracting…</> : '📄 Upload JD'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={handleJDUpload}
              />
            </div>
            <textarea
              className="ag-textarea"
              rows={6}
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here, or upload a file above…"
            />
          </div>
          <div className="vi-modal-row">
            <div className="vi-modal-field vi-modal-field--half">
              <label>Number of Questions</label>
              <input className="ag-input" type="number" min={1} max={20} value={questionCount} onChange={e => setQuestionCount(e.target.value)} />
            </div>
            <div className="vi-modal-field vi-modal-field--half">
              <label>Expiry Date (optional)</label>
              <input className="ag-input" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div className="ag-modal-actions">
            <button type="button" className="ag-btn ag-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="ag-btn ag-btn--primary" disabled={saving || extracting}>
              {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Interview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Question Row ──────────────────────────────────────────────────────────────
function QuestionRow({ q, idx, interviewId, authFetch, onUpdated }) {
  const [editing,   setEditing]   = useState(false);
  const [text,      setText]      = useState(q.question_text);
  const [qtype,     setQtype]     = useState(q.question_type);
  const [estTime,   setEstTime]   = useState(q.estimated_time_minutes);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/vi/interviews/${interviewId}/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: text, question_type: qtype, estimated_time_minutes: estTime, order_number: q.order_number }),
      });
      setEditing(false);
      onUpdated();
    } catch (_) {}
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this question?')) return;
    setDeleting(true);
    await authFetch(`${BACKEND_URL}/vi/interviews/${interviewId}/questions/${q.id}`, { method: 'DELETE' });
    onUpdated();
  };

  const typeColors = { technical: '#60a5fa', behavioral: '#a78bfa', situational: '#34d399' };

  if (editing) {
    return (
      <div className="vi-q-row vi-q-row--editing">
        <textarea className="ag-textarea" rows={3} value={text} onChange={e => setText(e.target.value)} style={{ fontSize: 13 }} />
        <div className="vi-q-edit-row">
          <select className="ag-input" value={qtype} onChange={e => setQtype(e.target.value)} style={{ flex: 1 }}>
            <option value="technical">Technical</option>
            <option value="behavioral">Behavioral</option>
            <option value="situational">Situational</option>
          </select>
          <input type="number" className="ag-input" min={1} max={10} value={estTime} onChange={e => setEstTime(e.target.value)} style={{ width: 80 }} placeholder="min" />
          <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Save'}</button>
          <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vi-q-row">
      <div className="vi-q-num">{idx + 1}</div>
      <div className="vi-q-body">
        <p className="vi-q-text">{q.question_text}</p>
        <div className="vi-q-meta">
          <span className="vi-q-type" style={{ color: typeColors[q.question_type] }}>
            {q.question_type}
          </span>
          <span className="vi-q-time">~{q.estimated_time_minutes} min</span>
        </div>
      </div>
      <div className="vi-q-actions">
        <button className="vi-q-btn" onClick={() => setEditing(true)} title="Edit">✏</button>
        <button className="vi-q-btn vi-q-btn--del" onClick={handleDelete} disabled={deleting} title="Delete">✕</button>
      </div>
    </div>
  );
}

// ── Evaluation Report View ────────────────────────────────────────────────────
function ReportView({ candidateId, interviewTitle, authFetch, onBack }) {
  const [report,     setReport]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evalMsg,    setEvalMsg]    = useState('');

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/vi/candidates/${candidateId}/report`);
      if (res.ok) { const data = await res.json(); setReport(data); }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { loadReport(); }, [candidateId]);

  const triggerEvaluation = async () => {
    setEvaluating(true);
    setEvalMsg('');
    try {
      const res  = await authFetch(`${BACKEND_URL}/vi/candidates/${candidateId}/evaluate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setEvalMsg(data.error || 'Evaluation failed.'); }
      else { await loadReport(); setEvalMsg(''); }
    } catch {
      setEvalMsg('Network error during evaluation.');
    }
    setEvaluating(false);
  };

  const competencyLabels = {
    technical_skills: 'Technical', communication: 'Communication',
    problem_solving: 'Problem Solving', leadership: 'Leadership', cultural_fit: 'Cultural Fit',
  };

  if (loading) return (
    <div className="vi-detail">
      <button className="vi-back-btn" onClick={onBack}>← Back</button>
      <div className="vi-loading"><span className="spinner" /> Loading report…</div>
    </div>
  );

  const rec = report?.evaluation;

  return (
    <div className="vi-detail">
      <button className="vi-back-btn" onClick={onBack}>← Back to Interview</button>
      <div className="vi-detail-header">
        <div>
          <h2 className="vi-detail-title">{report?.candidate?.name || 'Candidate'}</h2>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{interviewTitle}</div>
        </div>
      </div>

      {!rec ? (
        <div className="vi-report-noeval">
          <p>No evaluation yet. Click below to generate an AI evaluation of this candidate's responses.</p>
          {evalMsg && <div className="vi-cf-error">{evalMsg}</div>}
          <button className="ag-btn ag-btn--primary" onClick={triggerEvaluation} disabled={evaluating}>
            {evaluating ? <><span className="spinner" style={{ marginRight: 6 }} />Evaluating…</> : '✨ Generate AI Evaluation'}
          </button>
        </div>
      ) : (
        <div className="vi-report">
          {/* Overall Score */}
          <div className="vi-report-overview">
            <div className="vi-report-score-ring">
              <svg viewBox="0 0 100 100" className="vi-score-svg">
                <circle cx="50" cy="50" r="40" className="vi-score-track" />
                <circle
                  cx="50" cy="50" r="40"
                  className="vi-score-fill"
                  strokeDasharray={`${2.513 * (rec.overall_score || 0)} 251.3`}
                />
              </svg>
              <div className="vi-score-text">
                <span className="vi-score-num">{rec.overall_score}</span>
                <span className="vi-score-sub">/ 100</span>
              </div>
            </div>
            <div className="vi-report-overview-info">
              {rec.hiring_recommendation && (
                <div
                  className="vi-rec-badge-lg"
                  style={{ color: recLabels[rec.hiring_recommendation]?.color || '#a78bfa' }}
                >
                  {recLabels[rec.hiring_recommendation]?.label || rec.hiring_recommendation}
                </div>
              )}
              <p className="vi-report-summary">{rec.evaluation_summary}</p>
            </div>
          </div>

          {/* Competency bars */}
          {rec.competency_scores && (
            <div className="vi-report-section">
              <h3 className="vi-report-section-title">Competencies</h3>
              <div className="vi-competencies">
                {Object.entries(rec.competency_scores).map(([key, val]) => (
                  <div key={key} className="vi-comp-row">
                    <span className="vi-comp-label">{competencyLabels[key] || key}</span>
                    <div className="vi-comp-bar-track">
                      <div className="vi-comp-bar-fill" style={{ width: `${val}%` }} />
                    </div>
                    <span className="vi-comp-score">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths / Weaknesses */}
          <div className="vi-report-sw">
            <div className="vi-report-section">
              <h3 className="vi-report-section-title" style={{ color: '#10b981' }}>Strengths</h3>
              <ul className="vi-sw-list">
                {(rec.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="vi-report-section">
              <h3 className="vi-report-section-title" style={{ color: '#f87171' }}>Weaknesses</h3>
              <ul className="vi-sw-list vi-sw-list--weak">
                {(rec.weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>

          {/* Behavioral insights */}
          {rec.behavioral_insights && (
            <div className="vi-report-section">
              <h3 className="vi-report-section-title">Behavioral Insights</h3>
              <p className="vi-report-insights">{rec.behavioral_insights}</p>
            </div>
          )}

          {/* Question evaluations */}
          {report?.questionEvals?.length > 0 && (
            <div className="vi-report-section">
              <h3 className="vi-report-section-title">Question-by-Question Analysis</h3>
              <div className="vi-qevals">
                {report.questionEvals.map((qe, i) => (
                  <div key={qe.id} className="vi-qeval-card">
                    <div className="vi-qeval-header">
                      <span className="vi-qeval-num">Q{i + 1}</span>
                      <span className="vi-qeval-qtext">{qe.question_text}</span>
                      <span className="vi-qeval-score">{qe.score}/100</span>
                    </div>
                    <div className="vi-qeval-subscores">
                      <span>Relevance: {qe.relevance_score}</span>
                      <span>Clarity: {qe.clarity_score}</span>
                      <span>Completeness: {qe.completeness_score}</span>
                    </div>
                    {qe.analysis && <p className="vi-qeval-analysis">{qe.analysis}</p>}
                    {qe.response_transcription && (
                      <details className="vi-qeval-transcript">
                        <summary>View transcription</summary>
                        <p>{qe.response_transcription}</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            {evalMsg && <div className="vi-cf-error">{evalMsg}</div>}
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={triggerEvaluation} disabled={evaluating}>
              {evaluating ? 'Re-evaluating…' : '↺ Re-run Evaluation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interview Detail View ─────────────────────────────────────────────────────
function InterviewDetail({ interviewId, authFetch, onBack }) {
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('questions'); // questions | candidates
  const [generating,    setGenerating]    = useState(false);
  const [genMsg,        setGenMsg]        = useState('');
  const [showInvite,    setShowInvite]    = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addingQ,       setAddingQ]       = useState(false);
  const [newQText,      setNewQText]      = useState('');
  const [newQType,      setNewQType]      = useState('behavioral');
  const [newQTime,      setNewQTime]      = useState(3);
  const [reportFor,     setReportFor]     = useState(null);
  const [activatingId,  setActivatingId]  = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/vi/interviews/${interviewId}`);
      const data = await res.json();
      setData(data.interview);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [interviewId]);

  const generateQuestions = async () => {
    if (!data?.job_description?.trim()) {
      setGenMsg('Add a job description first (edit the interview).'); return;
    }
    setGenerating(true);
    setGenMsg('');
    try {
      const res = await authFetch(`${BACKEND_URL}/vi/interviews/${interviewId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: data.question_count }),
      });
      const result = await res.json();
      if (!res.ok) { setGenMsg(result.error || 'Generation failed.'); }
      else { setData(result.interview); setGenMsg(''); }
    } catch {
      setGenMsg('Network error during generation.');
    }
    setGenerating(false);
  };

  const addQuestion = async () => {
    if (!newQText.trim()) return;
    try {
      await authFetch(`${BACKEND_URL}/vi/interviews/${interviewId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: newQText, question_type: newQType, estimated_time_minutes: newQTime }),
      });
      setNewQText(''); setAddingQ(false); load();
    } catch (_) {}
  };

  const toggleStatus = async () => {
    const newStatus = data.status === 'active' ? 'closed' : 'active';
    setActivatingId(true);
    try {
      await authFetch(`${BACKEND_URL}/vi/interviews/${interviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, status: newStatus }),
      });
      setData(d => ({ ...d, status: newStatus }));
    } catch (_) {}
    setActivatingId(false);
  };

  if (loading) return <div className="vi-loading"><span className="spinner" /> Loading…</div>;
  if (!data)   return <div className="vi-loading">Interview not found.</div>;

  if (reportFor) {
    return (
      <ReportView
        candidateId={reportFor.id}
        interviewTitle={data.title}
        authFetch={authFetch}
        onBack={() => setReportFor(null)}
      />
    );
  }

  const interviewLink = `${window.location.origin}/interview`;

  return (
    <div className="vi-detail">
      <button className="vi-back-btn" onClick={onBack}>← All Interviews</button>

      <div className="vi-detail-header">
        <div>
          <h2 className="vi-detail-title">{data.title}</h2>
          <div className="vi-detail-meta">
            <span className={`vi-status vi-status--${data.status}`}>{data.status}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
              {data.questions?.length || 0} questions · {data.candidates?.length || 0} candidates
            </span>
            {data.expiry_date && (
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                Expires {new Date(data.expiry_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="vi-detail-actions">
          <button
            className="ag-btn ag-btn--ghost ag-btn--sm"
            onClick={toggleStatus}
            disabled={activatingId}
          >
            {data.status === 'active' ? 'Close' : 'Activate'}
          </button>
          <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setShowEditModal(true)}>
            ✏ Edit
          </button>
          <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={() => setShowInvite(true)}>
            + Invite Candidate
          </button>
        </div>
      </div>

      {/* Interview link banner */}
      <div className="vi-link-banner">
        <span className="vi-link-label">Interview Portal:</span>
        <code className="vi-link-code">{interviewLink}</code>
        <button
          className="vi-link-copy"
          onClick={() => navigator.clipboard.writeText(interviewLink)}
          title="Copy link"
        >
          Copy
        </button>
      </div>

      {/* Tabs */}
      <div className="vi-tabs">
        <button className={`vi-tab${tab === 'questions' ? ' vi-tab--active' : ''}`} onClick={() => setTab('questions')}>
          Questions ({data.questions?.length || 0})
        </button>
        <button className={`vi-tab${tab === 'candidates' ? ' vi-tab--active' : ''}`} onClick={() => setTab('candidates')}>
          Candidates ({data.candidates?.length || 0})
        </button>
      </div>

      {/* Questions Tab */}
      {tab === 'questions' && (
        <div className="vi-tab-content">
          <div className="vi-tab-actions">
            <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={generateQuestions} disabled={generating}>
              {generating ? <><span className="spinner" style={{ marginRight: 6 }} />Generating…</> : '✨ Generate with AI'}
            </button>
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setAddingQ(a => !a)}>
              {addingQ ? 'Cancel' : '+ Add Manually'}
            </button>
          </div>
          {genMsg && <div className="vi-gen-msg">{genMsg}</div>}

          {addingQ && (
            <div className="vi-add-q-form">
              <textarea
                className="ag-textarea"
                rows={3}
                value={newQText}
                onChange={e => setNewQText(e.target.value)}
                placeholder="Enter your question here…"
                autoFocus
              />
              <div className="vi-q-edit-row">
                <select className="ag-input" value={newQType} onChange={e => setNewQType(e.target.value)}>
                  <option value="technical">Technical</option>
                  <option value="behavioral">Behavioral</option>
                  <option value="situational">Situational</option>
                </select>
                <input type="number" className="ag-input" min={1} max={10} value={newQTime} onChange={e => setNewQTime(e.target.value)} style={{ width: 80 }} placeholder="min" />
                <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={addQuestion} disabled={!newQText.trim()}>Add Question</button>
              </div>
            </div>
          )}

          {data.questions?.length === 0 ? (
            <div className="vi-empty">No questions yet. Generate with AI or add manually.</div>
          ) : (
            <div className="vi-q-list">
              {data.questions.map((q, i) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  idx={i}
                  interviewId={interviewId}
                  authFetch={authFetch}
                  onUpdated={load}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Candidates Tab */}
      {tab === 'candidates' && (
        <div className="vi-tab-content">
          {data.candidates?.length === 0 ? (
            <div className="vi-empty">No candidates yet. Click "Invite Candidate" to send an interview link.</div>
          ) : (
            <div className="vi-cand-table">
              {data.candidates.map(c => {
                const sc = statusColors[c.status] || statusColors.invited;
                return (
                  <div key={c.id} className="vi-cand-row">
                    <div className="vi-cand-avatar">{c.name[0].toUpperCase()}</div>
                    <div className="vi-cand-info">
                      <div className="vi-cand-name">{c.name}</div>
                      <div className="vi-cand-email">{c.email}</div>
                      {c.interview_completed_at && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          Completed {new Date(c.interview_completed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="vi-cand-status" style={{ color: sc.color, background: sc.bg }}>
                      {c.status.replace('_', ' ')}
                    </div>
                    <div className="vi-cand-actions">
                      {(c.status === 'completed' || c.status === 'evaluated') && (
                        <button
                          className="ag-btn ag-btn--primary ag-btn--sm"
                          onClick={() => setReportFor(c)}
                        >
                          {c.status === 'evaluated' ? '📊 View Report' : '✨ Evaluate'}
                        </button>
                      )}
                      {c.status === 'invited' && (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          Awaiting response
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showInvite && (
        <InviteModal
          interviewId={interviewId}
          authFetch={authFetch}
          onInvited={load}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showEditModal && (
        <InterviewFormModal
          existing={data}
          authFetch={authFetch}
          onSaved={(updated) => { setData(d => ({ ...d, ...updated })); setShowEditModal(false); load(); }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

// ── Interview Card (list item) ─────────────────────────────────────────────────
function InterviewCard({ iv, onSelect, onDelete }) {
  const completedCount = iv.completed_count + iv.evaluated_count;
  return (
    <div className="vi-card" onClick={() => onSelect(iv.id)}>
      <div className="vi-card-header">
        <span className={`vi-status vi-status--${iv.status}`}>{iv.status}</span>
        <button
          className="vi-card-del"
          onClick={e => { e.stopPropagation(); onDelete(iv.id); }}
          title="Delete"
        >✕</button>
      </div>
      <div className="vi-card-title">{iv.title}</div>
      {iv.job_title && <div className="vi-card-job">{iv.job_title}</div>}
      <div className="vi-card-stats">
        <span>{iv.question_count_actual || 0} questions</span>
        <span>{iv.candidate_count || 0} invited</span>
        {completedCount > 0 && <span style={{ color: '#10b981' }}>{completedCount} completed</span>}
      </div>
      <div className="vi-card-date">{new Date(iv.created_at).toLocaleDateString()}</div>
    </div>
  );
}

// ── Main Module ───────────────────────────────────────────────────────────────
export default function VideoInterviewModule({ authFetch }) {
  const [interviews,    setInterviews]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedId,    setSelectedId]    = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/vi/interviews`);
      const data = await res.json();
      setInterviews(data.interviews || []);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { loadInterviews(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interview and all its data?')) return;
    await authFetch(`${BACKEND_URL}/vi/interviews/${id}`, { method: 'DELETE' });
    loadInterviews();
  };

  const handleSaved = (iv) => {
    setShowCreate(false);
    setEditingInterview(null);
    setSelectedId(iv.id);
    loadInterviews();
  };

  if (selectedId) {
    return (
      <InterviewDetail
        interviewId={selectedId}
        authFetch={authFetch}
        onBack={() => { setSelectedId(null); loadInterviews(); }}
      />
    );
  }

  return (
    <div className="vi-module">
      <div className="vi-module-header">
        <div>
          <h2 className="vi-module-title">Video Interviews</h2>
          <p className="vi-module-sub">Create AI-powered video interviews and evaluate candidates asynchronously.</p>
        </div>
        <button className="ag-btn ag-btn--primary" onClick={() => setShowCreate(true)}>
          + New Interview
        </button>
      </div>

      {loading ? (
        <div className="vi-loading"><span className="spinner" /> Loading…</div>
      ) : interviews.length === 0 ? (
        <div className="vi-empty-state">
          <div className="vi-empty-icon">🎥</div>
          <h3>No video interviews yet</h3>
          <p>Create your first AI-powered video interview to evaluate candidates asynchronously.</p>
          <button className="ag-btn ag-btn--primary" onClick={() => setShowCreate(true)}>
            + Create Interview
          </button>
        </div>
      ) : (
        <div className="vi-grid">
          {interviews.map(iv => (
            <InterviewCard
              key={iv.id}
              iv={iv}
              onSelect={id => setSelectedId(id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {(showCreate || editingInterview) && (
        <InterviewFormModal
          existing={editingInterview}
          authFetch={authFetch}
          onSaved={handleSaved}
          onClose={() => { setShowCreate(false); setEditingInterview(null); }}
        />
      )}
    </div>
  );
}
