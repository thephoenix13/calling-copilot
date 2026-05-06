import { useState, useRef, useEffect } from 'react';
import VideoRecorder from './VideoRecorder';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Step: Verify identity ────────────────────────────────────────────────────
function VerifyStep({ code, onVerified }) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setError('Please enter your name and email.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/vi/public/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Verification failed.'); return; }
      onVerified(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vi-cf-card">
      <div className="vi-cf-logo">Zeople</div>
      <h1 className="vi-cf-title">Video Interview</h1>
      <p className="vi-cf-subtitle">Enter your name and email to access your interview.</p>
      {error && <div className="vi-cf-error">{error}</div>}
      <form className="vi-cf-form" onSubmit={handleSubmit}>
        <div className="vi-cf-field">
          <label>Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Priya Kapoor"
            autoFocus
          />
        </div>
        <div className="vi-cf-field">
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. priya@example.com"
          />
        </div>
        <button type="submit" className="vi-cf-btn vi-cf-btn--primary" disabled={loading}>
          {loading ? 'Verifying…' : 'Access Interview →'}
        </button>
      </form>
    </div>
  );
}

// ── Step: Instructions & system check ────────────────────────────────────────
function InstructionsStep({ interviewTitle, questions, onStart }) {
  const [cameraOk,  setCameraOk]  = useState(null); // null | true | false
  const [checking,  setChecking]  = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const checkCamera = async () => {
    setChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOk(true);
    } catch {
      setCameraOk(false);
    } finally {
      setChecking(false);
    }
  };

  const handleStart = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onStart();
  };

  const totalMin = questions.reduce((s, q) => s + (q.estimated_time_minutes || 3), 0);

  return (
    <div className="vi-cf-card vi-cf-card--wide">
      <div className="vi-cf-logo">Zeople</div>
      <h1 className="vi-cf-title">{interviewTitle}</h1>

      <div className="vi-cf-info-grid">
        <div className="vi-cf-info-item">
          <span className="vi-cf-info-num">{questions.length}</span>
          <span className="vi-cf-info-lbl">Questions</span>
        </div>
        <div className="vi-cf-info-item">
          <span className="vi-cf-info-num">{totalMin}</span>
          <span className="vi-cf-info-lbl">Minutes</span>
        </div>
      </div>

      <div className="vi-cf-instructions">
        <h3>Before you begin:</h3>
        <ul>
          <li>Ensure you are in a quiet, well-lit room.</li>
          <li>Your camera and microphone must be accessible.</li>
          <li>You can re-record each answer before moving on.</li>
          <li>Once submitted, you cannot re-do the interview.</li>
          <li>Your responses will be transcribed and evaluated by AI.</li>
        </ul>
      </div>

      <div className="vi-cf-syscheck">
        <h3>System Check</h3>
        {cameraOk === null && (
          <button className="vi-cf-btn vi-cf-btn--outline" onClick={checkCamera} disabled={checking}>
            {checking ? 'Checking…' : '▶ Test Camera & Microphone'}
          </button>
        )}
        {cameraOk === false && (
          <div className="vi-cf-error">
            Camera/microphone access denied. Please allow permissions in your browser and refresh the page.
          </div>
        )}
        {cameraOk === true && (
          <div className="vi-cf-syscheck-ok">
            <video ref={videoRef} autoPlay muted playsInline className="vi-cf-preview-video" />
            <div className="vi-cf-ok-badge">✓ Camera & Microphone OK</div>
          </div>
        )}
      </div>

      <button
        className="vi-cf-btn vi-cf-btn--primary"
        onClick={handleStart}
        disabled={cameraOk !== true}
        style={{ marginTop: 24 }}
      >
        Begin Interview →
      </button>
    </div>
  );
}

// ── Step: Interview (per-question recording) ──────────────────────────────────
function InterviewStep({ candidateId, interviewId, questions, onComplete }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [blobs,      setBlobs]      = useState({}); // questionId -> Blob
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState('');
  const [recKey,     setRecKey]     = useState(0); // force VideoRecorder remount

  const currentQuestion = questions[currentIdx];
  const progress = Math.round(((currentIdx) / questions.length) * 100);
  const hasBlob = !!blobs[currentQuestion?.id];

  const handleRecordingComplete = (blob) => {
    if (!currentQuestion) return;
    if (blob) {
      setBlobs(b => ({ ...b, [currentQuestion.id]: blob }));
    } else {
      setBlobs(b => { const n = { ...b }; delete n[currentQuestion.id]; return n; });
    }
  };

  const uploadResponse = async (questionId, blob) => {
    const formData = new FormData();
    formData.append('candidateId', candidateId);
    formData.append('interviewId', interviewId);
    formData.append('questionId', questionId);
    formData.append('video', blob, `response_${questionId}.webm`);

    const res = await fetch(`${BACKEND_URL}/vi/public/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Upload failed (${res.status})`);
    }
  };

  const handleNext = async () => {
    if (!hasBlob) return;
    setUploading(true);
    setUploadErr('');
    try {
      await uploadResponse(currentQuestion.id, blobs[currentQuestion.id]);

      if (currentIdx < questions.length - 1) {
        setCurrentIdx(i => i + 1);
        setRecKey(k => k + 1); // remount recorder for next question
      } else {
        // All questions done
        await fetch(`${BACKEND_URL}/vi/public/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId }),
        });
        onComplete();
      }
    } catch (err) {
      setUploadErr(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const typeLabel = { technical: 'Technical', behavioral: 'Behavioral', situational: 'Situational' };

  return (
    <div className="vi-cf-interview">
      <div className="vi-cf-progress-bar">
        <div className="vi-cf-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="vi-cf-progress-text">
        Question {currentIdx + 1} of {questions.length}
        <span>{progress}% complete</span>
      </div>

      <VideoRecorder
        key={`recorder-${currentIdx}-${recKey}`}
        onRecordingComplete={handleRecordingComplete}
        maxDuration={(currentQuestion?.estimated_time_minutes || 5) * 60}
        headerContent={
          <div className="vi-cf-question-card">
            <div className="vi-cf-question-meta">
              <span className="vi-cf-qtype">{typeLabel[currentQuestion?.question_type] || 'Question'}</span>
              <span className="vi-cf-qtime">~{currentQuestion?.estimated_time_minutes} min</span>
            </div>
            <h2 className="vi-cf-question-text">{currentQuestion?.question_text}</h2>
          </div>
        }
      />

      {uploadErr && <div className="vi-cf-error" style={{ marginTop: 12 }}>{uploadErr}</div>}

      <button
        className="vi-cf-btn vi-cf-btn--primary"
        style={{ marginTop: 16, width: '100%' }}
        onClick={handleNext}
        disabled={!hasBlob || uploading}
      >
        {uploading
          ? <><span className="vi-cf-spinner" /> Uploading…</>
          : currentIdx < questions.length - 1
            ? `Save & Next Question →`
            : `Submit Interview ✓`
        }
      </button>
    </div>
  );
}

// ── Step: Done ────────────────────────────────────────────────────────────────
function DoneStep({ candidateName }) {
  return (
    <div className="vi-cf-card vi-cf-card--done">
      <div className="vi-cf-done-icon">✓</div>
      <h1 className="vi-cf-title">Interview Complete!</h1>
      <p className="vi-cf-subtitle">
        Thank you{candidateName ? `, ${candidateName.split(' ')[0]}` : ''}! Your responses have been submitted successfully.
      </p>
      <p className="vi-cf-done-note">
        Your answers are being transcribed and evaluated. The recruiter will be in touch shortly.
      </p>
    </div>
  );
}

// ── Main CandidateFlow ────────────────────────────────────────────────────────
export default function CandidateFlow() {
  const code   = new URLSearchParams(window.location.search).get('code') || '';
  const [step, setStep]         = useState('verify');  // verify | instructions | interview | done
  const [session, setSession]   = useState(null);      // { candidateId, interviewId, interviewTitle, candidateName, questions }

  const handleVerified = async (data) => {
    setSession(data);
    // Mark as started
    try {
      await fetch(`${BACKEND_URL}/vi/public/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: data.candidateId }),
      });
    } catch (_) {}
    setStep('instructions');
  };

  if (!code) {
    return (
      <div className="vi-cf-shell">
        <div className="vi-cf-card">
          <div className="vi-cf-logo">Zeople</div>
          <h1 className="vi-cf-title">Invalid Link</h1>
          <p className="vi-cf-subtitle">This interview link is missing an access code. Please use the link sent to your email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vi-cf-shell">
      {step === 'verify' && (
        <VerifyStep code={code} onVerified={handleVerified} />
      )}
      {step === 'instructions' && session && (
        <InstructionsStep
          interviewTitle={session.interviewTitle}
          questions={session.questions}
          onStart={() => setStep('interview')}
        />
      )}
      {step === 'interview' && session && (
        <InterviewStep
          candidateId={session.candidateId}
          interviewId={session.interviewId}
          questions={session.questions}
          onComplete={() => setStep('done')}
        />
      )}
      {step === 'done' && (
        <DoneStep candidateName={session?.candidateName} />
      )}
    </div>
  );
}
