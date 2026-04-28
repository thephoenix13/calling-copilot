import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Step5_AIInterviewReports({ session, authFetch, onComplete, onRefresh }) {
  const [scores, setScores]   = useState({});
  const [saving, setSaving]   = useState({});

  const passing = (session.candidates || []).filter(c => c.screening_status === 'pass');
  const allScored = passing.length > 0 && passing.every(c =>
    c.ai_interview_score != null || scores[c.id] != null
  );

  const handleScoreChange = (scId, val) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0 && n <= 100) setScores(s => ({ ...s, [scId]: n }));
    else if (val === '') setScores(s => ({ ...s, [scId]: '' }));
  };

  const handleSaveScore = async (scId) => {
    const score = scores[scId];
    if (score === '' || score == null) return;
    setSaving(s => ({ ...s, [scId]: true }));
    try {
      await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${scId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_interview_score: score }),
      });
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(s => ({ ...s, [scId]: false }));
    }
  };

  const handleContinue = async () => {
    await onComplete({}, 6);
  };

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 5 — AI Interview Reports</h2>
        <p className="sw-step-desc">Enter AI interview scores (0–100) for each candidate who passed screening. All candidates must be scored to continue.</p>
      </div>

      <div className="sw-content-card">
        <div className="sw-section-title">Passed Candidates ({passing.length})</div>

        {passing.length === 0 ? (
          <div className="ag-empty">No candidates passed screening yet.</div>
        ) : (
          <div className="sw-interview-list">
            {passing.map(sc => {
              const current = scores[sc.id] ?? sc.ai_interview_score ?? '';
              const saved   = sc.ai_interview_score != null;
              return (
                <div key={sc.id} className="sw-interview-row">
                  <div className="sw-interview-info">
                    <div className="sw-interview-name">{sc.candidate_name}</div>
                    {sc.candidate_title && <div className="sw-interview-title">{sc.candidate_title}</div>}
                  </div>
                  <div className="sw-interview-controls">
                    <div className="sw-score-wrap">
                      <input
                        type="number"
                        min="0" max="100"
                        className="sw-score-input"
                        value={current}
                        onChange={e => handleScoreChange(sc.id, e.target.value)}
                        placeholder="0–100"
                      />
                      <span className="sw-score-unit">/100</span>
                      <button
                        className="ag-btn ag-btn--primary ag-btn--sm"
                        onClick={() => handleSaveScore(sc.id)}
                        disabled={saving[sc.id] || current === ''}
                      >
                        {saving[sc.id] ? '…' : saved ? 'Update' : 'Save'}
                      </button>
                    </div>
                    {saved && scores[sc.id] == null && (
                      <span className="sw-score-saved">Saved: {sc.ai_interview_score}/100</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="sw-step-actions">
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleContinue}
            disabled={!allScored}
            title={!allScored ? 'All passing candidates must have an AI interview score' : ''}
          >
            Continue to Decision →
          </button>
          {!allScored && passing.length > 0 && (
            <span className="sw-gate-hint">All {passing.length} passing candidates need a score to continue.</span>
          )}
        </div>
      </div>
    </div>
  );
}
