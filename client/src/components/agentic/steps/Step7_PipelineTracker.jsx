import { useState, useRef, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Voice Note Modal ─────────────────────────────────────────────────────────
function VoiceNoteModal({ candidateName, existingNote, onSave, onClose }) {
  const [transcript, setTranscript] = useState(existingNote || '');
  const [recording,  setRecording]  = useState(false);
  const [supported,  setSupported]  = useState(true);
  const [saving,     setSaving]     = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-IN';

    let finalSoFar = existingNote || '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) { finalSoFar += (finalSoFar ? ' ' : '') + chunk; }
        else interim += chunk;
      }
      setTranscript(finalSoFar + (interim ? ' ' + interim : ''));
    };
    rec.onerror = () => setRecording(false);
    rec.onend   = () => { if (recording) rec.start(); };

    recognitionRef.current = rec;
    return () => { rec.stop(); };
  }, []);

  const toggleRecording = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (recording) { rec.stop(); setRecording(false); }
    else           { rec.start(); setRecording(true); }
  };

  const handleSave = async () => {
    if (!transcript.trim()) return;
    setSaving(true);
    await onSave(transcript.trim());
    setSaving(false);
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal voice-note-modal" onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">🎙 Voice Note — {candidateName}</h3>
        {!supported ? (
          <p className="voice-note-unsupported">Speech recognition is not supported in this browser. Please use Chrome or Edge and type your note below.</p>
        ) : (
          <div className="voice-note-controls">
            <button
              className={`voice-record-btn${recording ? ' voice-record-btn--active' : ''}`}
              onClick={toggleRecording}
            >
              {recording ? '⏹ Stop Recording' : '🎙 Start Recording'}
            </button>
            {recording && <span className="voice-recording-badge">● Recording…</span>}
          </div>
        )}
        <textarea
          className="ag-textarea voice-note-textarea"
          placeholder="Transcript will appear here as you speak, or type manually…"
          rows={6}
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
        />
        <div className="ag-modal-actions">
          <button className="ag-btn ag-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleSave}
            disabled={saving || !transcript.trim()}
          >
            {saving ? 'Saving…' : '💾 Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

const POFU_BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const COLUMNS = [
  { key: 'L1',       label: 'L1 Interview' },
  { key: 'L2',       label: 'L2 Interview' },
  { key: 'L3',       label: 'L3 Interview' },
  { key: 'selected', label: '🎉 Selected'  },
];

const NEXT_LEVEL = { L1: 'L2', L2: 'L3', L3: 'selected' };

export default function Step7_PipelineTracker({ session, authFetch, onRefresh }) {
  const [feedback, setFeedback]     = useState({});
  const [saving, setSaving]         = useState({});
  const [voiceNoteFor, setVoiceNoteFor] = useState(null);

  // POFU enrollment modal
  const [pofuModal, setPofuModal] = useState(null); // sc object
  const [pofuDoj, setPofuDoj]     = useState('');
  const [pofuEnrolling, setPofuEnrolling] = useState(false);
  const [pofuMsg, setPofuMsg]     = useState('');

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

  const handleEnrollPOFU = async () => {
    if (!pofuModal) return;
    setPofuEnrolling(true);
    setPofuMsg('');
    try {
      const job = session.job || {};
      await authFetch(`${POFU_BACKEND}/pofu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name:  pofuModal.candidate_name,
          candidate_email: pofuModal.candidate_email || '',
          role_title:      job.title || session.job_title || '',
          company_name:    job.company_name || '',
          doj:             pofuDoj || null,
          session_id:      session.id,
          candidate_id:    pofuModal.candidate_id,
          job_id:          session.job_id,
        }),
      });
      setPofuMsg('Enrolled in POFU!');
      setTimeout(() => { setPofuModal(null); setPofuMsg(''); setPofuDoj(''); }, 1500);
    } catch (err) {
      setPofuMsg('Failed to enrol. Please try again.');
    } finally {
      setPofuEnrolling(false);
    }
  };
  const handleFeedbackSave = (sc) => {
    const text = feedback[sc.id] ?? sc.pipeline_feedback ?? '';
    save(sc, { pipeline_feedback: text });
  };

  const handleVoiceNoteSave = async (text) => {
    const sc = voiceNoteFor;
    if (!sc) return;
    setFeedback(f => ({ ...f, [sc.id]: text }));
    await save(sc, { pipeline_feedback: text });
    setVoiceNoteFor(null);
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
                    <div className="sw-card-feedback-header">
                      <span className="sw-card-feedback-label">Notes</span>
                      <button
                        className={`sw-voice-note-btn${(feedback[sc.id] ?? sc.pipeline_feedback) ? ' sw-voice-note-btn--has-note' : ''}`}
                        onClick={() => setVoiceNoteFor(sc)}
                        title="Record voice note"
                      >
                        🎙 {(feedback[sc.id] ?? sc.pipeline_feedback) ? 'Edit Note' : 'Voice Note'}
                      </button>
                    </div>
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
                        <button
                          className="sw-card-btn"
                          style={{ background: 'var(--orange-dim)', color: 'var(--orange)', borderColor: 'var(--orange-border)' }}
                          onClick={() => { setPofuModal(sc); setPofuDoj(''); setPofuMsg(''); }}
                          disabled={saving[sc.id]}
                        >
                          🎯 Move to POFU
                        </button>
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

      {/* Voice note modal */}
      {voiceNoteFor && (
        <VoiceNoteModal
          candidateName={voiceNoteFor.candidate_name}
          existingNote={feedback[voiceNoteFor.id] ?? voiceNoteFor.pipeline_feedback ?? ''}
          onSave={handleVoiceNoteSave}
          onClose={() => setVoiceNoteFor(null)}
        />
      )}

      {/* POFU enrolment modal */}
      {pofuModal && (
        <div className="ag-modal-overlay" onClick={() => setPofuModal(null)}>
          <div className="ag-modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">Move to POFU</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              Enrol <strong>{pofuModal.candidate_name}</strong> in Post Offer Follow-Up. The AI will automatically send engagement emails until they join.
            </p>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Date of Joining (optional)</label>
            <input
              type="date"
              className="ag-input"
              value={pofuDoj}
              onChange={e => setPofuDoj(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            {pofuMsg && (
              <div style={{ fontSize: 13, color: pofuMsg.startsWith('Failed') ? '#f87171' : '#10b981', marginBottom: 12 }}>{pofuMsg}</div>
            )}
            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setPofuModal(null)}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleEnrollPOFU} disabled={pofuEnrolling}>
                {pofuEnrolling ? 'Enrolling…' : '🎯 Enrol in POFU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
