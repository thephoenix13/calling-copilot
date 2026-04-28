import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', cls: 'sw-screen-pending' },
  { value: 'pass',    label: 'Pass',    cls: 'sw-screen-pass'    },
  { value: 'fail',    label: 'Fail',    cls: 'sw-screen-fail'    },
];

export default function Step4_RecruiterScreening({ session, authFetch, onComplete, onRefresh, onScreenViaCall }) {
  const [saving, setSaving]   = useState({});
  const candidates = session.candidates || [];
  const passCount  = candidates.filter(c => c.screening_status === 'pass').length;

  const updateStatus = async (scId, status) => {
    setSaving(s => ({ ...s, [scId]: true }));
    try {
      await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${scId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screening_status: status }),
      });
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(s => ({ ...s, [scId]: false }));
    }
  };

  const handleContinue = async () => {
    await onComplete({}, 5);
  };

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 4 — Recruiter Screening</h2>
        <p className="sw-step-desc">Review each candidate and mark Pass or Fail before the AI interview stage. At least 1 pass is required to continue.</p>
      </div>

      <div className="sw-content-card">
        <div className="sw-section-header">
          <div className="sw-section-title">Candidates ({candidates.length})</div>
          {passCount > 0 && <span className="sw-pass-count">✓ {passCount} passed</span>}
        </div>

        {candidates.length === 0 ? (
          <div className="ag-empty">No candidates in this session. Go back to Step 3 to add candidates.</div>
        ) : (
          <div className="sw-screening-list">
            {candidates.map(sc => {
              const statusOpt = STATUS_OPTIONS.find(o => o.value === sc.screening_status) || STATUS_OPTIONS[0];
              return (
                <div key={sc.id} className="sw-screening-row">
                  <div className="sw-screening-info">
                    <div className="sw-screening-name">{sc.candidate_name}</div>
                    <div className="sw-screening-meta">
                      {sc.candidate_title && <span>{sc.candidate_title}</span>}
                      {sc.match_percentage != null && <span className="sw-match-inline">{Math.round(sc.match_percentage)}% match</span>}
                    </div>
                  </div>
                  <div className="sw-screening-controls">
                    <div className="sw-screen-radios">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          className={`sw-screen-btn ${opt.cls}${sc.screening_status === opt.value ? ' sw-screen-btn--active' : ''}`}
                          onClick={() => updateStatus(sc.id, opt.value)}
                          disabled={saving[sc.id]}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {onScreenViaCall && (
                      <button
                        className="sw-screen-call-btn"
                        onClick={() => onScreenViaCall(sc)}
                        title="Open Calling CoPilot pre-filled with this candidate's details"
                      >
                        📞 Screen via Call
                      </button>
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
            disabled={passCount === 0}
            title={passCount === 0 ? 'Mark at least 1 candidate as Pass to continue' : ''}
          >
            Continue to AI Reports →
          </button>
          {passCount === 0 && <span className="sw-gate-hint">Mark at least 1 candidate as Pass to unlock the next step.</span>}
        </div>
      </div>
    </div>
  );
}
