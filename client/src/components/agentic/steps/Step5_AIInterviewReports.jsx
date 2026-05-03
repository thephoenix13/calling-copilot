import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Step5_AIInterviewReports({ session, authFetch, onComplete, onRefresh }) {
  const [scores,   setScores]   = useState({});
  const [actions,  setActions]  = useState({});
  const [viScores, setViScores] = useState({});

  const passing        = (session.candidates || []).filter(c => c.screening_status === 'pass');
  const activePass     = passing.filter(c => !c.vi_review);
  const reviewedOut    = passing.filter(c =>  c.vi_review);

  const allScored = activePass.length > 0 && activePass.every(c =>
    c.ai_interview_score != null ||
    (scores[c.id] != null && scores[c.id] !== '')
  );

  useEffect(() => {
    if (session.vi_interview_id) loadViScores();
  }, []);

  const loadViScores = async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/vi/sessions/${session.id}/vi-scores`);
      const data = await res.json();
      const map  = data.scores || {};
      setViScores(map);
      // Pre-fill inputs for candidates without a saved score
      const pre = {};
      passing.forEach(c => {
        if (c.ai_interview_score == null && map[c.id]?.overall_score != null) {
          pre[c.id] = map[c.id].overall_score;
        }
      });
      if (Object.keys(pre).length > 0) setScores(s => ({ ...pre, ...s }));
    } catch (err) {
      console.error('[AIReports] Could not load VI scores', err);
    }
  };

  const handleScoreChange = (scId, val) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0 && n <= 100) setScores(s => ({ ...s, [scId]: n }));
    else if (val === '') setScores(s => ({ ...s, [scId]: '' }));
  };

  const patch = async (scId, body, key) => {
    setActions(a => ({ ...a, [scId]: key }));
    try {
      await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${scId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      await onRefresh();
    } finally {
      setActions(a => ({ ...a, [scId]: null }));
    }
  };

  const handleUpdate  = async (scId) => {
    const score = scores[scId];
    if (score === '' || score == null) return;
    await patch(scId, { ai_interview_score: score }, 'saving');
    setScores(s => { const n = { ...s }; delete n[scId]; return n; });
  };
  const handleHold    = (scId) => patch(scId, { vi_review: 'hold' },   'holding');
  const handleReject  = (scId) => patch(scId, { vi_review: 'reject' }, 'rejecting');
  const handleRestore = (scId) => patch(scId, { vi_review: null },     'restoring');

  const handleContinue = async () => {
    await onComplete({}, 7);
  };

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 6 — AI Interview Reports</h2>
        <p className="sw-step-desc">
          Review video interview scores. Update, Hold, or Reject each candidate before proceeding to Decision.
          {session.vi_interview_id
            ? ' Scores from the video interview have been auto-filled where available.'
            : ''}
        </p>
      </div>

      <div className="sw-content-card">
        <div className="sw-section-title">
          Active Candidates ({activePass.length})
        </div>

        {passing.length === 0 && (
          <div className="ag-empty">No shortlisted candidates.</div>
        )}

        <div className="sw-interview-list">
          {activePass.map(c => {
            const val   = scores[c.id] ?? c.ai_interview_score ?? '';
            const vi    = viScores[c.id];
            const saved = c.ai_interview_score != null;
            const busy  = actions[c.id];
            return (
              <div key={c.id} className="sw-interview-row sw-report-row">
                <div className="sw-interview-info">
                  <div className="sw-interview-name">{c.candidate_name}</div>
                  {c.candidate_title && (
                    <div className="sw-interview-title">{c.candidate_title}</div>
                  )}
                  {vi?.overall_score != null && (
                    <div className="sw-report-vi-hint">
                      Video score: <strong>{vi.overall_score}/100</strong>
                      {vi.hiring_recommendation && (
                        <span className={`sw-report-rec sw-report-rec--${vi.hiring_recommendation.toLowerCase().replace(/\s+/g,'-')}`}>
                          {vi.hiring_recommendation}
                        </span>
                      )}
                    </div>
                  )}
                  {vi && vi.overall_score == null && vi.vc_status && (
                    <div className="sw-report-vi-hint sw-report-vi-hint--muted">
                      Video: {vi.vc_status}
                    </div>
                  )}
                </div>
                <div className="sw-report-controls">
                  <div className="sw-score-wrap">
                    <input
                      type="number"
                      min="0" max="100"
                      className="sw-score-input"
                      value={val}
                      onChange={e => handleScoreChange(c.id, e.target.value)}
                      placeholder="0–100"
                    />
                    <span className="sw-score-unit">/100</span>
                    <button
                      className="ag-btn ag-btn--primary ag-btn--sm"
                      onClick={() => handleUpdate(c.id)}
                      disabled={!!busy || val === ''}
                    >
                      {busy === 'saving' ? '…' : saved ? 'Update' : 'Save'}
                    </button>
                  </div>
                  <div className="sw-report-action-row">
                    <button
                      className="sw-report-act-btn sw-report-act-btn--hold"
                      onClick={() => handleHold(c.id)}
                      disabled={!!busy}
                    >
                      {busy === 'holding' ? '…' : 'Hold'}
                    </button>
                    <button
                      className="sw-report-act-btn sw-report-act-btn--reject"
                      onClick={() => handleReject(c.id)}
                      disabled={!!busy}
                    >
                      {busy === 'rejecting' ? '…' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {reviewedOut.length > 0 && (
          <>
            <div className="sw-section-title sw-section-title--spaced">Reviewed Out ({reviewedOut.length})</div>
            <div className="sw-interview-list">
              {reviewedOut.map(c => (
                <div key={c.id} className="sw-interview-row sw-report-row sw-report-row--out">
                  <div className="sw-interview-info">
                    <div className="sw-interview-name">{c.candidate_name}</div>
                    {c.candidate_title && (
                      <div className="sw-interview-title">{c.candidate_title}</div>
                    )}
                  </div>
                  <div className="sw-report-controls">
                    <span className={`sw-report-status sw-report-status--${c.vi_review}`}>
                      {c.vi_review === 'hold' ? 'On Hold' : 'Rejected'}
                    </span>
                    <button
                      className="sw-report-act-btn sw-report-act-btn--restore"
                      onClick={() => handleRestore(c.id)}
                      disabled={!!actions[c.id]}
                    >
                      {actions[c.id] === 'restoring' ? '…' : 'Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="sw-step-actions">
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleContinue}
            disabled={!allScored}
            title={!allScored ? 'All active candidates need a score to continue' : ''}
          >
            Continue to Decision →
          </button>
          {!allScored && activePass.length > 0 && (
            <span className="sw-gate-hint">
              {activePass.filter(c => c.ai_interview_score == null && (scores[c.id] == null || scores[c.id] === '')).length} candidate(s) still need a score.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
