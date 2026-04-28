import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const COLUMNS = [
  { key: 'L1',       label: 'L1 Interview' },
  { key: 'L2',       label: 'L2 Interview' },
  { key: 'L3',       label: 'L3 Interview' },
  { key: 'selected', label: '🎉 Selected'  },
];

const NEXT_LEVEL = { L1: 'L2', L2: 'L3', L3: 'selected' };

export default function Step7_PipelineTracker({ session, authFetch, onRefresh }) {
  const [feedback, setFeedback]   = useState({});
  const [saving, setSaving]       = useState({});

  const proceeded = (session.candidates || []).filter(c => c.decision === 'proceed');

  const save = async (sc, patch) => {
    setSaving(s => ({ ...s, [sc.id]: true }));
    try {
      await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${sc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(s => ({ ...s, [sc.id]: false }));
    }
  };

  const handleNext = (sc) => {
    const col = sc.pipeline_status === 'pending' ? sc.interview_level : sc.interview_level;
    const next = NEXT_LEVEL[sc.interview_level];
    if (!next) return;
    if (next === 'selected') {
      save(sc, { pipeline_status: 'selected' });
    } else {
      save(sc, { interview_level: next, pipeline_status: 'pending' });
    }
  };

  const handleHold   = (sc) => save(sc, { pipeline_status: 'hold'   });
  const handleReject = (sc) => save(sc, { pipeline_status: 'reject'  });
  const handleFeedbackSave = (sc) => {
    const text = feedback[sc.id] ?? sc.pipeline_feedback ?? '';
    save(sc, { pipeline_feedback: text });
  };

  const cardsByColumn = COLUMNS.reduce((acc, col) => {
    acc[col.key] = proceeded.filter(sc => {
      if (col.key === 'selected') return sc.pipeline_status === 'selected';
      return sc.interview_level === col.key && sc.pipeline_status !== 'selected' && sc.pipeline_status !== 'reject';
    });
    return acc;
  }, {});

  const rejected = proceeded.filter(sc => sc.pipeline_status === 'reject');

  return (
    <div className="sw-step-page sw-tracker-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 7 — Pipeline Tracker</h2>
        <p className="sw-step-desc">Move candidates through interview rounds. Hold, reject, or advance to the next level.</p>
      </div>

      <div className="sw-kanban">
        {COLUMNS.map(col => (
          <div key={col.key} className={`sw-kanban-col${col.key === 'selected' ? ' sw-kanban-col--selected' : ''}`}>
            <div className="sw-kanban-col-header">
              {col.label}
              <span className="sw-kanban-count">{cardsByColumn[col.key]?.length || 0}</span>
            </div>

            <div className="sw-kanban-cards">
              {cardsByColumn[col.key]?.length === 0 ? (
                <div className="sw-kanban-empty">—</div>
              ) : (
                cardsByColumn[col.key].map(sc => (
                  <div key={sc.id} className={`sw-kanban-card${sc.pipeline_status === 'hold' ? ' sw-kanban-card--hold' : ''}`}>
                    <div className="sw-card-name">{sc.candidate_name}</div>
                    {sc.candidate_title && <div className="sw-card-title">{sc.candidate_title}</div>}
                    <div className="sw-card-badges">
                      {sc.match_percentage != null && <span className="sw-card-badge">{Math.round(sc.match_percentage)}% match</span>}
                      {sc.ai_interview_score != null && <span className="sw-card-badge">AI: {sc.ai_interview_score}/100</span>}
                    </div>

                    {sc.pipeline_status === 'hold' && <div className="sw-card-hold-tag">⏸ On Hold</div>}

                    {/* Feedback */}
                    <textarea
                      className="sw-card-feedback"
                      placeholder="Interview feedback…"
                      value={feedback[sc.id] ?? sc.pipeline_feedback ?? ''}
                      onChange={e => setFeedback(f => ({ ...f, [sc.id]: e.target.value }))}
                      rows={2}
                    />

                    {/* Actions */}
                    {col.key !== 'selected' && (
                      <div className="sw-card-actions">
                        <button
                          className="sw-card-btn sw-card-btn--next"
                          onClick={() => handleNext(sc)}
                          disabled={saving[sc.id]}
                        >
                          {NEXT_LEVEL[sc.interview_level] === 'selected' ? '🎉 Select' : `→ ${NEXT_LEVEL[sc.interview_level]}`}
                        </button>
                        {sc.pipeline_status !== 'hold'
                          ? <button className="sw-card-btn sw-card-btn--hold" onClick={() => handleHold(sc)} disabled={saving[sc.id]}>Hold</button>
                          : <button className="sw-card-btn sw-card-btn--hold" onClick={() => save(sc, { pipeline_status: 'pending' })} disabled={saving[sc.id]}>Unhold</button>
                        }
                        <button className="sw-card-btn sw-card-btn--reject" onClick={() => handleReject(sc)} disabled={saving[sc.id]}>Reject</button>
                        {(feedback[sc.id] != null && feedback[sc.id] !== sc.pipeline_feedback) && (
                          <button className="sw-card-btn sw-card-btn--save" onClick={() => handleFeedbackSave(sc)} disabled={saving[sc.id]}>Save Notes</button>
                        )}
                      </div>
                    )}
                    {col.key === 'selected' && (
                      <div className="sw-card-actions">
                        {(feedback[sc.id] != null && feedback[sc.id] !== sc.pipeline_feedback) && (
                          <button className="sw-card-btn sw-card-btn--save" onClick={() => handleFeedbackSave(sc)} disabled={saving[sc.id]}>Save Notes</button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rejected */}
      {rejected.length > 0 && (
        <div className="sw-rejected-section">
          <div className="sw-section-title" style={{ color: 'var(--text-3)', marginBottom: 8 }}>Rejected ({rejected.length})</div>
          <div className="sw-rejected-list">
            {rejected.map(sc => (
              <div key={sc.id} className="sw-rejected-row">
                <span>{sc.candidate_name}</span>
                <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => save(sc, { pipeline_status: 'pending' })}>Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
