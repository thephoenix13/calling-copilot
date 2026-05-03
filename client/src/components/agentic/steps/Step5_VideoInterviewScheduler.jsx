import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Step5_VideoInterviewScheduler({ session, authFetch, onComplete, onRefresh }) {
  const [interviews,        setInterviews]        = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [selectedId,        setSelectedId]        = useState(session.vi_interview_id || null);
  const [showCreate,        setShowCreate]        = useState(false);
  const [newTitle,          setNewTitle]          = useState('');
  const [newDesc,           setNewDesc]           = useState('');
  const [creating,          setCreating]          = useState(false);
  const [selected,          setSelected]          = useState(new Set());
  const [sending,           setSending]           = useState(false);
  const [sendResults,       setSendResults]       = useState(null);
  const [completing,        setCompleting]        = useState(false);

  const passing = (session.candidates || []).filter(c => c.screening_status === 'pass');

  useEffect(() => {
    loadInterviews();
    const uninvited = passing.filter(c => !c.vi_invite_sent).map(c => c.id);
    setSelected(new Set(uninvited));
  }, []);

  const loadInterviews = async () => {
    setLoadingInterviews(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/vi/interviews`);
      const data = await res.json();
      setInterviews(data.interviews || []);
    } finally {
      setLoadingInterviews(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/vi/interviews`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: newTitle.trim(), job_description: newDesc.trim() }),
      });
      const data = await res.json();
      await loadInterviews();
      if (data.interview?.id) setSelectedId(data.interview.id);
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
    } finally {
      setCreating(false);
    }
  };

  const toggleCandidate = (scId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(scId)) next.delete(scId); else next.add(scId);
      return next;
    });
  };

  const uninvitedPassing = passing.filter(c => !c.vi_invite_sent);

  const toggleAll = () => {
    const ids = uninvitedPassing.map(c => c.id);
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids));
  };

  const handleSendInvites = async () => {
    if (!selectedId || selected.size === 0) return;
    setSending(true);
    setSendResults(null);
    try {
      const res  = await authFetch(`${BACKEND_URL}/vi/sessions/${session.id}/bulk-invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ interview_id: selectedId, sc_ids: [...selected] }),
      });
      const data = await res.json();
      const map  = {};
      (data.results || []).forEach(r => { map[r.sc_id] = r; });
      setSendResults(map);
      await onRefresh();
      setSelected(new Set());
    } finally {
      setSending(false);
    }
  };

  const handleContinue = async () => {
    setCompleting(true);
    try {
      const updates = selectedId ? { vi_interview_id: selectedId } : {};
      await onComplete(updates, 6);
    } finally {
      setCompleting(false);
    }
  };

  const selectedInterview = interviews.find(iv => iv.id === Number(selectedId));
  const anyInvited = passing.some(c => c.vi_invite_sent);

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 5 — Schedule Video Interviews</h2>
        <p className="sw-step-desc">
          Invite shortlisted candidates to a video interview. This step is optional — click Continue to skip.
        </p>
      </div>

      <div className="sw-sched-grid">
        {/* Left: Interview selector */}
        <div className="sw-content-card">
          <div className="sw-sched-section-title">Video Interview</div>

          <div className="sw-sched-iv-row">
            <select
              className="sw-sched-select"
              value={selectedId || ''}
              onChange={e => setSelectedId(Number(e.target.value) || null)}
            >
              <option value="">
                {loadingInterviews ? 'Loading…' : '— Select an interview —'}
              </option>
              {interviews.map(iv => (
                <option key={iv.id} value={iv.id}>
                  {iv.title} · {iv.question_count_actual ?? iv.question_count} questions
                </option>
              ))}
            </select>

            <button
              className={`sw-sched-create-btn${showCreate ? ' sw-sched-create-btn--cancel' : ''}`}
              onClick={() => setShowCreate(v => !v)}
            >
              {showCreate ? '✕ Cancel' : '+ New'}
            </button>
          </div>

          {selectedInterview && (
            <div className="sw-sched-iv-meta">
              <span className="sw-sched-meta-chip">
                {selectedInterview.question_count_actual ?? selectedInterview.question_count} questions
              </span>
              {selectedInterview.status && (
                <span className="sw-sched-meta-chip">{selectedInterview.status}</span>
              )}
              {selectedInterview.expiry_date && (
                <span className="sw-sched-meta-chip sw-sched-meta-chip--warn">
                  Expires {new Date(selectedInterview.expiry_date).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {showCreate && (
            <div className="sw-sched-create-form">
              <input
                className="sw-sched-input"
                placeholder="Interview title *"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <textarea
                className="sw-sched-textarea"
                placeholder="Job description / context (optional)"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={3}
              />
              <button
                className="ag-btn ag-btn--primary ag-btn--sm"
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
              >
                {creating ? 'Creating…' : 'Create Interview'}
              </button>
            </div>
          )}
        </div>

        {/* Right: Candidates */}
        <div className="sw-content-card">
          <div className="sw-sched-card-header">
            <div className="sw-sched-section-title">
              Shortlisted Candidates ({passing.length})
            </div>
            {uninvitedPassing.length > 0 && (
              <button className="sw-sched-toggle-all" onClick={toggleAll}>
                {selected.size === uninvitedPassing.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          <div className="sw-sched-candidates">
            {passing.map(c => {
              const result    = sendResults?.[c.id];
              const isInvited = c.vi_invite_sent || result?.status === 'invited' || result?.status === 'already_invited';
              const isError   = result?.status === 'error';
              return (
                <div
                  key={c.id}
                  className={`sw-sched-cand-row${isInvited ? ' sw-sched-cand-row--done' : ''}`}
                >
                  <label className="sw-sched-check-label">
                    <input
                      type="checkbox"
                      className="sw-sched-check"
                      checked={selected.has(c.id)}
                      onChange={() => toggleCandidate(c.id)}
                      disabled={isInvited}
                    />
                    <div className="sw-sched-cand-info">
                      <span className="sw-sched-cand-name">{c.candidate_name}</span>
                      <span className="sw-sched-cand-email">{c.candidate_email}</span>
                    </div>
                  </label>
                  <div className="sw-sched-cand-badge-col">
                    {isInvited && (
                      <span className="sw-sched-badge sw-sched-badge--sent">✓ Invited</span>
                    )}
                    {isError && (
                      <span className="sw-sched-badge sw-sched-badge--error">✗ Failed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="sw-step-footer">
        <button
          className="sw-sched-send-btn"
          onClick={handleSendInvites}
          disabled={!selectedId || selected.size === 0 || sending}
        >
          {sending
            ? 'Sending invites…'
            : `Send ${selected.size > 0 ? `${selected.size} ` : ''}Invite${selected.size !== 1 ? 's' : ''}`}
        </button>
        <button
          className="ag-btn ag-btn--primary"
          onClick={handleContinue}
          disabled={completing}
        >
          {completing ? 'Saving…' : 'Continue →'}
        </button>
      </div>

      {anyInvited && (
        <div className="sw-sched-invite-note">
          Invited candidates will receive an email with a private link and access code to complete the video interview.
        </div>
      )}
    </div>
  );
}
