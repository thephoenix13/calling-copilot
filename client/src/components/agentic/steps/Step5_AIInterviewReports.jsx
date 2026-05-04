import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Step5_AIInterviewReports({ session, authFetch, onComplete, onRefresh }) {
  const [scores,   setScores]   = useState({});
  const [actions,  setActions]  = useState({});
  const [viScores, setViScores] = useState({});

  const passing       = (session.candidates || []).filter(c => c.screening_status === 'pass');
  const pendingReview = passing.filter(c => !c.vi_review);
  const advancing     = passing.filter(c => c.vi_review === 'move_ahead');
  const reviewedOut   = passing.filter(c => c.vi_review && c.vi_review !== 'move_ahead');

  const allActed = passing.length > 0 && passing.every(c => c.vi_review != null);

  useEffect(() => {
    if (session.vi_interview_id) loadViScores();
  }, []);

  const loadViScores = async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/vi/sessions/${session.id}/vi-scores`);
      const data = await res.json();
      const map  = data.scores || {};
      setViScores(map);
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

  const handleMoveAhead = async (scId) => {
    const score = scores[scId] ?? passing.find(c => c.id === scId)?.ai_interview_score;
    const body  = { vi_review: 'move_ahead' };
    if (score != null && score !== '') body.ai_interview_score = Number(score);
    await patch(scId, body, 'advancing');
  };
  const handleHold    = (scId) => patch(scId, { vi_review: 'hold' },   'holding');
  const handleReject  = (scId) => patch(scId, { vi_review: 'reject' }, 'rejecting');
  const handleRestore = (scId) => patch(scId, { vi_review: null },     'restoring');

  const handleContinue = async () => { await onComplete({}, 7); };

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 6 — AI Interview Reports</h2>
        <p className="sw-step-desc">
          Review each candidate's interview score and take an explicit action — Move Ahead, Hold, or Reject — before proceeding to Decision.
          {session.vi_interview_id ? ' Scores have been auto-filled from the video interview.' : ''}
        </p>
      </div>

      <div className="ai-disclaimer-banner">
        <span className="ai-disclaimer-icon">ℹ</span>
        AI interview scores are <strong>recommendations only</strong>. The final hiring decision always rests with the recruiter — use these scores as one input among many.
      </div>

      <div className="sw-content-card">

        {/* ── Pending review ── */}
        {pendingReview.length > 0 && (
          <>
            <div className="sw-section-title">Pending Review ({pendingReview.length})</div>
            <div className="sw-interview-list">
              {pendingReview.map(c => {
                const val  = scores[c.id] ?? c.ai_interview_score ?? '';
                const vi   = viScores[c.id];
                const busy = actions[c.id];
                return (
                  <div key={c.id} className="sw-interview-row sw-report-row">
                    <div className="sw-interview-info">
                      <div className="sw-interview-name">{c.candidate_name}</div>
                      {c.candidate_title && <div className="sw-interview-title">{c.candidate_title}</div>}
                      {vi?.overall_score != null && (
                        <div className="sw-report-vi-hint">
                          Video score: <strong>{vi.overall_score}/100</strong>
                          {vi.hiring_recommendation && (
                            <span className={`sw-report-rec sw-report-rec--${vi.hiring_recommendation.toLowerCase().replace(/\s+/g, '-')}`}>
                              {vi.hiring_recommendation}
                            </span>
                          )}
                        </div>
                      )}
                      {vi && vi.overall_score == null && vi.vc_status && (
                        <div className="sw-report-vi-hint sw-report-vi-hint--muted">Video: {vi.vc_status}</div>
                      )}
                    </div>
                    <div className="sw-report-controls">
                      <div className="sw-score-wrap">
                        <input
                          type="number" min="0" max="100"
                          className="sw-score-input"
                          value={val}
                          onChange={e => handleScoreChange(c.id, e.target.value)}
                          placeholder="0–100"
                        />
                        <span className="sw-score-unit">/100</span>
                      </div>
                      <div className="sw-report-action-row">
                        <button
                          className="sw-report-act-btn sw-report-act-btn--ahead"
                          onClick={() => handleMoveAhead(c.id)}
                          disabled={!!busy}
                        >
                          {busy === 'advancing' ? '…' : '✓ Move Ahead'}
                        </button>
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
          </>
        )}

        {/* ── Moving Ahead ── */}
        {advancing.length > 0 && (
          <>
            <div className="sw-section-title sw-section-title--spaced">Moving Ahead ({advancing.length})</div>
            <div className="sw-interview-list">
              {advancing.map(c => (
                <div key={c.id} className="sw-interview-row sw-report-row sw-report-row--ahead">
                  <div className="sw-interview-info">
                    <div className="sw-interview-name">{c.candidate_name}</div>
                    {c.candidate_title && <div className="sw-interview-title">{c.candidate_title}</div>}
                    {c.ai_interview_score != null && (
                      <div className="sw-report-vi-hint">Score: <strong>{c.ai_interview_score}/100</strong></div>
                    )}
                  </div>
                  <div className="sw-report-controls">
                    <span className="sw-report-status sw-report-status--ahead">✓ Moving Ahead</span>
                    <button
                      className="sw-report-act-btn sw-report-act-btn--restore"
                      onClick={() => handleRestore(c.id)}
                      disabled={!!actions[c.id]}
                    >
                      {actions[c.id] === 'restoring' ? '…' : 'Undo'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Reviewed Out ── */}
        {reviewedOut.length > 0 && (
          <>
            <div className="sw-section-title sw-section-title--spaced">Reviewed Out ({reviewedOut.length})</div>
            <div className="sw-interview-list">
              {reviewedOut.map(c => (
                <div key={c.id} className="sw-interview-row sw-report-row sw-report-row--out">
                  <div className="sw-interview-info">
                    <div className="sw-interview-name">{c.candidate_name}</div>
                    {c.candidate_title && <div className="sw-interview-title">{c.candidate_title}</div>}
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

        {passing.length === 0 && (
          <div className="ag-empty">No shortlisted candidates.</div>
        )}

        <div className="sw-step-actions">
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleContinue}
            disabled={!allActed}
            title={!allActed ? 'Take an action on all candidates before proceeding' : ''}
          >
            Continue to Decision →
          </button>
          {!allActed && pendingReview.length > 0 && (
            <span className="sw-gate-hint">
              {pendingReview.length} candidate(s) still need a review action.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
