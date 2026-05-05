import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Step5_MCQScheduler({ session, authFetch, onComplete, onRefresh }) {
  const [assessments,  setAssessments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState(null);
  const [selected,     setSelected]     = useState(new Set());
  const [sending,      setSending]      = useState(false);
  const [sendResults,  setSendResults]  = useState({});
  const [completing,   setCompleting]   = useState(false);

  const passing = (session.candidates || []).filter(c => c.screening_status === 'pass');

  useEffect(() => {
    authFetch(`${BACKEND_URL}/assessments`)
      .then(r => r.json())
      .then(d => setAssessments(d.assessments || []))
      .catch(() => setAssessments([]))
      .finally(() => setLoading(false));

    // Pre-select uninvited candidates
    const uninvited = passing.filter(c => !c.mcq_invite_sent).map(c => c.id);
    setSelected(new Set(uninvited.length > 0 ? uninvited : passing.map(c => c.id)));
  }, []);

  const toggleCandidate = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = passing.map(c => c.id);
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids));
  };

  const handleSendInvites = async () => {
    if (!selectedId || selected.size === 0) return;
    setSending(true);
    try {
      const candidatesToInvite = passing
        .filter(c => selected.has(c.id))
        .map(c => ({ name: c.candidate_name, email: c.candidate_email, candidate_id: c.id }));

      const res  = await authFetch(`${BACKEND_URL}/assessments/${selectedId}/invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ candidates: candidatesToInvite }),
      });
      const data = await res.json();
      const results = {};
      (data.invites || []).forEach(inv => { results[inv.candidate_id || inv.candidate_email] = 'invited'; });
      setSendResults(results);
      setSelected(new Set());
      await onRefresh();
    } catch (err) {
      alert('Failed to send invites: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleContinue = async () => {
    setCompleting(true);
    try {
      await onComplete({}, 6);
    } finally {
      setCompleting(false);
    }
  };

  const selectedAssessment = assessments.find(a => a.id === Number(selectedId));

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 5 — MCQ Assessment</h2>
        <p className="sw-step-desc">
          Select an MCQ assessment and invite shortlisted candidates. This step is optional — click Continue to skip.
        </p>
      </div>

      <div className="sw-sched-grid">
        {/* Left: Assessment selector */}
        <div className="sw-content-card">
          <div className="sw-sched-section-title">MCQ Assessment</div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Loading assessments…</div>
          ) : assessments.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
              No MCQ assessments found. Go to <strong>MCQ Assessments</strong> under Evaluation to create one first.
            </div>
          ) : (
            <select
              className="sw-sched-select"
              value={selectedId || ''}
              onChange={e => setSelectedId(Number(e.target.value) || null)}
            >
              <option value="">— Select an assessment —</option>
              {assessments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.title} · {a.question_count ?? 0} questions · {a.time_limit_min || 30} min
                </option>
              ))}
            </select>
          )}

          {selectedAssessment && (
            <div className="sw-sched-iv-meta" style={{ marginTop: 10 }}>
              <span className="sw-sched-meta-chip">{selectedAssessment.question_count ?? 0} questions</span>
              <span className="sw-sched-meta-chip">{selectedAssessment.time_limit_min || 30} min</span>
              <span className="sw-sched-meta-chip">{selectedAssessment.status || 'draft'}</span>
              {selectedAssessment.pass_score != null && (
                <span className="sw-sched-meta-chip">Pass: {selectedAssessment.pass_score}%</span>
              )}
            </div>
          )}
        </div>

        {/* Right: Candidates */}
        <div className="sw-content-card">
          <div className="sw-sched-card-header">
            <div className="sw-sched-section-title">Shortlisted Candidates ({passing.length})</div>
            {passing.length > 0 && (
              <button className="sw-sched-toggle-all" onClick={toggleAll}>
                {selected.size === passing.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          <div className="sw-sched-candidates">
            {passing.map(c => {
              const wasInvited = sendResults[c.id] === 'invited';
              return (
                <div key={c.id} className={`sw-sched-cand-row${wasInvited ? ' sw-sched-cand-row--done' : ''}`}>
                  <label className="sw-sched-check-label">
                    <input
                      type="checkbox"
                      className="sw-sched-check"
                      checked={selected.has(c.id)}
                      onChange={() => toggleCandidate(c.id)}
                      disabled={wasInvited}
                    />
                    <div className="sw-sched-cand-info">
                      <span className="sw-sched-cand-name">{c.candidate_name}</span>
                      <span className="sw-sched-cand-email">{c.candidate_email}</span>
                    </div>
                  </label>
                  {wasInvited && (
                    <span className="sw-sched-badge sw-sched-badge--sent">✓ Invited</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sw-step-footer">
        <button
          className="sw-sched-send-btn"
          onClick={handleSendInvites}
          disabled={!selectedId || selected.size === 0 || sending}
        >
          {sending ? 'Sending invites…' : `Send ${selected.size > 0 ? `${selected.size} ` : ''}Invite${selected.size !== 1 ? 's' : ''}`}
        </button>
        <button className="ag-btn ag-btn--primary" onClick={handleContinue} disabled={completing}>
          {completing ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
