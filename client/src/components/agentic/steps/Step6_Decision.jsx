import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const LEVELS = ['L1', 'L2', 'L3'];

export default function Step6_Decision({ session, authFetch, onComplete, onRefresh }) {
  const [saving, setSaving]   = useState({});
  const [local, setLocal]     = useState({});

  const scored = (session.candidates || []).filter(c => c.ai_interview_score != null);
  const proceedCount = scored.filter(c => c.decision === 'proceed').length;

  const getVal = (sc, field) => local[sc.id]?.[field] ?? sc[field] ?? '';

  const update = (scId, field, val) => {
    setLocal(l => ({ ...l, [scId]: { ...l[scId], [field]: val } }));
  };

  const handleSave = async (sc) => {
    const patch = local[sc.id] || {};
    if (!patch.decision && !sc.decision) return;
    setSaving(s => ({ ...s, [sc.id]: true }));
    try {
      await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${sc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision:        patch.decision        ?? sc.decision,
          interview_level: patch.interview_level ?? sc.interview_level,
        }),
      });
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(s => ({ ...s, [sc.id]: false }));
    }
  };

  const handleNotify = (sc) => {
    const subject = encodeURIComponent(`Interview Invitation — ${session.job?.title || 'Role'}`);
    const body    = encodeURIComponent(
      `Dear ${sc.candidate_name},\n\nWe are pleased to invite you for an ${getVal(sc, 'interview_level') || 'L1'} interview for the ${session.job?.title || 'role'} position.\n\nPlease let us know your availability.\n\nBest regards,\nRecruitment Team`
    );
    window.open(`mailto:${sc.candidate_email || ''}?subject=${subject}&body=${body}`);
    authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${sc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_sent: 1 }),
    }).then(() => onRefresh()).catch(console.error);
  };

  const handleContinue = async () => {
    await onComplete({}, 7);
  };

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 6 — Decision</h2>
        <p className="sw-step-desc">Decide which candidates to move forward. Set Proceed + Interview Level, then optionally notify by email.</p>
      </div>

      <div className="sw-content-card">
        <div className="sw-section-header">
          <div className="sw-section-title">Scored Candidates ({scored.length})</div>
          {proceedCount > 0 && <span className="sw-pass-count">✓ {proceedCount} proceeding</span>}
        </div>

        {scored.length === 0 ? (
          <div className="ag-empty">No scored candidates yet.</div>
        ) : (
          <div className="sw-decision-list">
            {scored.map(sc => {
              const decision = getVal(sc, 'decision');
              const level    = getVal(sc, 'interview_level');
              const isDirty  = local[sc.id] != null;
              return (
                <div key={sc.id} className="sw-decision-row">
                  <div className="sw-decision-info">
                    <div className="sw-decision-name">{sc.candidate_name}</div>
                    <div className="sw-decision-meta">
                      {sc.candidate_title && <span>{sc.candidate_title}</span>}
                      {sc.ai_interview_score != null && <span className="sw-score-pill">AI Score: {sc.ai_interview_score}/100</span>}
                      {sc.match_percentage  != null && <span className="sw-score-pill">{Math.round(sc.match_percentage)}% match</span>}
                    </div>
                  </div>

                  <div className="sw-decision-controls">
                    {/* Decision */}
                    <div className="sw-decision-radios">
                      {['proceed', 'pool'].map(opt => (
                        <button
                          key={opt}
                          className={`sw-dec-btn ${opt === 'proceed' ? 'sw-dec-proceed' : 'sw-dec-pool'}${decision === opt ? ' sw-dec-btn--active' : ''}`}
                          onClick={() => update(sc.id, 'decision', opt)}
                        >
                          {opt === 'proceed' ? '✓ Proceed' : '○ Pool'}
                        </button>
                      ))}
                    </div>

                    {/* Level (only when proceed) */}
                    {decision === 'proceed' && (
                      <div className="sw-level-radios">
                        {LEVELS.map(lv => (
                          <button
                            key={lv}
                            className={`sw-level-btn${level === lv ? ' sw-level-btn--active' : ''}`}
                            onClick={() => update(sc.id, 'interview_level', lv)}
                          >
                            {lv}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="sw-decision-actions">
                      {isDirty && (
                        <button
                          className="ag-btn ag-btn--primary ag-btn--sm"
                          onClick={() => handleSave(sc)}
                          disabled={saving[sc.id]}
                        >
                          {saving[sc.id] ? '…' : 'Save'}
                        </button>
                      )}
                      {decision === 'proceed' && (
                        <button
                          className={`ag-btn ag-btn--ghost ag-btn--sm${sc.email_sent ? ' sw-notified' : ''}`}
                          onClick={() => handleNotify(sc)}
                          title={sc.email_sent ? 'Already notified' : 'Send email invitation'}
                        >
                          {sc.email_sent ? '✓ Notified' : '✉ Notify'}
                        </button>
                      )}
                    </div>
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
            disabled={proceedCount === 0}
          >
            Continue to Pipeline Tracker →
          </button>
          {proceedCount === 0 && <span className="sw-gate-hint">Mark at least 1 candidate as Proceed to unlock the Tracker.</span>}
        </div>
      </div>
    </div>
  );
}
