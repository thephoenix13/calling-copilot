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

const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending',   cls: 'sw-screen-pending'   },
  { value: 'pass',     label: 'Shortlist', cls: 'sw-screen-shortlist' },
  { value: 'fail',     label: 'Reject',    cls: 'sw-screen-reject'    },
  { value: 'on_hold',  label: 'On Hold',   cls: 'sw-screen-on-hold'   },
];

const ASSESSMENT_OPTIONS = [
  { value: 'interview',  label: 'Interview'          },
  { value: 'mcq',        label: 'MCQ Test'            },
  { value: 'coding',     label: 'Coding Challenge'    },
  { value: 'sme_panel',  label: 'SME Panel Interview' },
];

function buildAssessmentEmail(sc, atype, session) {
  const role = session.job?.title || 'the role';
  const name = sc.candidate_name;
  const subjects = {
    interview:  `Interview Invitation — ${role}`,
    mcq:        `Assessment Link — ${role}`,
    coding:     `Coding Challenge — ${role}`,
    sme_panel:  `SME Panel Invitation — ${role}`,
  };
  const bodies = {
    interview:  `Hi ${name},\n\nThank you for our conversation. We'd like to move you forward with a formal interview for the ${role} position.\n\nWe'll share the interview schedule shortly.\n\nBest regards,\nRecruitment Team`,
    mcq:        `Hi ${name},\n\nAs the next step for the ${role} position, please complete our online multiple-choice assessment.\n\n[Assessment Link — to be shared]\n\nPlease complete it at your earliest convenience.\n\nBest regards,\nRecruitment Team`,
    coding:     `Hi ${name},\n\nAs the next step for the ${role} role, please attempt our coding challenge.\n\n[Coding Challenge Link — to be shared]\n\nKindly complete it within 48 hours.\n\nBest regards,\nRecruitment Team`,
    sme_panel:  `Hi ${name},\n\nWe'd like to schedule an SME panel interview for the ${role} position. Our team will reach out shortly to coordinate a time.\n\nBest regards,\nRecruitment Team`,
  };
  return { subject: subjects[atype] || `Next Steps — ${role}`, body: bodies[atype] || '' };
}

export default function Step4_RecruiterScreening({ session, authFetch, onComplete, onRefresh, onScreenViaCall }) {
  const [saving,         setSaving]        = useState({});
  const [voiceNoteFor,   setVoiceNoteFor]  = useState(null);
  const [assessmentType, setAssessmentType] = useState({});
  const candidates = session.candidates || [];
  const passCount  = candidates.filter(c => c.screening_status === 'pass').length;

  const saveVoiceNote = async (text) => {
    const sc = voiceNoteFor;
    if (!sc) return;
    await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${sc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_feedback: text }),
    });
    setVoiceNoteFor(null);
    await onRefresh();
  };

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

  const handleAssessmentChange = async (scId, atype) => {
    setAssessmentType(prev => ({ ...prev, [scId]: atype }));
    authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${scId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment_type: atype || null }),
    }).catch(console.error);
  };

  const handleSendAssessment = (sc) => {
    const atype = assessmentType[sc.id] || sc.assessment_type;
    if (!atype) return;
    const { subject, body } = buildAssessmentEmail(sc, atype, session);
    window.open(
      `mailto:${sc.candidate_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    );
  };

  const handleContinue = async () => {
    await onComplete({}, 5);
  };

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 4 — Recruiter Screening</h2>
        <p className="sw-step-desc">Review each candidate and mark Shortlist, Reject, or On Hold before the AI interview stage. At least 1 shortlisted candidate is required to continue.</p>
      </div>

      <div className="sw-content-card">
        <div className="sw-section-header">
          <div className="sw-section-title">Candidates ({candidates.length})</div>
          {passCount > 0 && <span className="sw-pass-count">✓ {passCount} shortlisted</span>}
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
                    {sc.pipeline_feedback && (
                      <div className="sw-voice-note-preview">
                        🎙 {sc.pipeline_feedback.length > 120 ? sc.pipeline_feedback.slice(0, 120) + '…' : sc.pipeline_feedback}
                      </div>
                    )}
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
                    <div className="sw-screen-extra-actions">
                      <button
                        className={`sw-voice-note-btn${sc.pipeline_feedback ? ' sw-voice-note-btn--has-note' : ''}`}
                        onClick={() => setVoiceNoteFor(sc)}
                        title={sc.pipeline_feedback ? 'Edit voice note' : 'Add voice note'}
                      >
                        🎙 {sc.pipeline_feedback ? 'Edit Note' : 'Voice Note'}
                      </button>
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
                    {sc.screening_status === 'pass' && (
                      <div className="sw-assessment-row">
                        <select
                          className="sw-assessment-select"
                          value={assessmentType[sc.id] ?? (sc.assessment_type || '')}
                          onChange={e => handleAssessmentChange(sc.id, e.target.value)}
                        >
                          <option value="">Send Assessment…</option>
                          {ASSESSMENT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {(assessmentType[sc.id] || sc.assessment_type) && (
                          <button
                            className="sw-assessment-send-btn"
                            onClick={() => handleSendAssessment(sc)}
                          >
                            ✉ Send Email
                          </button>
                        )}
                      </div>
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
            title={passCount === 0 ? 'Mark at least 1 candidate as Shortlist to continue' : ''}
          >
            Continue to AI Reports →
          </button>
          {passCount === 0 && <span className="sw-gate-hint">Mark at least 1 candidate as Shortlist to unlock the next step.</span>}
        </div>
      </div>

      {voiceNoteFor && (
        <VoiceNoteModal
          candidateName={voiceNoteFor.candidate_name}
          existingNote={voiceNoteFor.pipeline_feedback || ''}
          onSave={saveVoiceNote}
          onClose={() => setVoiceNoteFor(null)}
        />
      )}
    </div>
  );
}
