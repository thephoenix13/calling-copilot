import { useState, useEffect, useRef, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Timer hook ────────────────────────────────────────────────────────────────
function useTimer(initialSeconds, onExpire) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const intervalRef = useRef(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const start = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  const warningClass = remaining <= 60 ? 'ca-timer--danger' : remaining <= 300 ? 'ca-timer--warning' : '';

  return { remaining, mmss, warningClass, start, stop };
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="ca-logo">
      <div className="ca-logo-mark">Z</div>
      <span className="ca-logo-name">Zeople RecruiterOS</span>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="ca-page">
      <div className="ca-card">
        <Logo />
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 14 }}>
          <span className="spinner" style={{ display: 'inline-block', marginBottom: 12 }} />
          <div>Loading your assessment…</div>
        </div>
      </div>
    </div>
  );
}

// ── Error screen ──────────────────────────────────────────────────────────────
function ErrorScreen({ message }) {
  return (
    <div className="ca-page">
      <div className="ca-card">
        <Logo />
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Unable to load assessment</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>{message || 'This link may be invalid or expired. Please contact your recruiter.'}</p>
        </div>
      </div>
    </div>
  );
}

// ── Intro screen ──────────────────────────────────────────────────────────────
function IntroScreen({ assessment, onStart }) {
  const { title, description, instructions, time_limit_min, questions } = assessment;

  return (
    <div className="ca-page">
      <div className="ca-card">
        <Logo />
        <h1 className="ca-title">{title}</h1>
        {description && <p className="ca-subtitle">{description}</p>}

        <div className="ca-meta-strip">
          <div className="ca-meta-item">
            <span className="ca-meta-label">Questions</span>
            <span className="ca-meta-value">{questions.length}</span>
          </div>
          <div className="ca-meta-item">
            <span className="ca-meta-label">Time Limit</span>
            <span className="ca-meta-value">{time_limit_min || 30} min</span>
          </div>
          <div className="ca-meta-item">
            <span className="ca-meta-label">Type</span>
            <span className="ca-meta-value">MCQ</span>
          </div>
        </div>

        {instructions && (
          <div className="ca-instructions">
            <strong style={{ display: 'block', marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Instructions</strong>
            {instructions}
          </div>
        )}

        <div style={{ marginTop: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
          <strong>Before you start:</strong> Make sure you are in a quiet environment with a stable internet connection. The timer will begin the moment you click Start. Once started, the assessment cannot be paused.
        </div>

        <button className="ag-btn ag-btn--primary" style={{ width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: 15 }} onClick={onStart}>
          Start Assessment →
        </button>
      </div>
    </div>
  );
}

// ── In-progress screen ────────────────────────────────────────────────────────
function InProgressScreen({ assessment, token, onSubmitted }) {
  const { questions, time_limit_min } = assessment;
  const totalSeconds = (time_limit_min || 30) * 60;

  const [answers, setAnswers] = useState({}); // { [qIndex]: 'A'|'B'|'C'|'D' }
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const startTimeRef = useRef(Date.now());

  const handleAutoSubmit = useCallback(() => {
    doSubmit(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { remaining, mmss, warningClass, start, stop } = useTimer(totalSeconds, handleAutoSubmit);

  useEffect(() => { start(); return stop; }, [start, stop]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const setAnswer = (idx, opt) => {
    setAnswers(prev => ({ ...prev, [idx]: opt }));
  };

  const doSubmit = async (auto = false) => {
    if (!auto && !allAnswered) {
      const confirm = window.confirm(`You have answered ${answeredCount} of ${questions.length} questions. Submit anyway?`);
      if (!confirm) return;
    }
    stop();
    setSubmitting(true);
    setSubmitErr('');
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    const payload = {
      answers: questions.map((q, i) => ({
        question_id: q.id,
        selected_option: answers[i] || null,
      })),
      time_taken_sec: timeTaken,
    };
    try {
      const res = await fetch(`${BACKEND_URL}/assessments/take/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      onSubmitted(data);
    } catch (e) {
      setSubmitErr(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="ca-page">
      <div className="ca-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Logo />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>TIME REMAINING</div>
            <div className={`ca-timer ${warningClass}`}>{mmss}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>
          <span>{assessment.title}</span>
          <span>{answeredCount}/{questions.length} answered</span>
        </div>

        <div className="ca-progress-bar">
          <div className="ca-progress-fill" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>

        <div style={{ marginTop: 20 }}>
          {questions.map((q, idx) => (
            <div key={q.id} className="ca-question-card">
              <div className="ca-question-num">Question {idx + 1} of {questions.length}</div>
              <div className="ca-question-text">{q.question_text}</div>
              {['A', 'B', 'C', 'D'].map(opt => {
                const optKey = `option_${opt.toLowerCase()}`;
                const optText = q[optKey];
                if (!optText) return null;
                const selected = answers[idx] === opt;
                return (
                  <div
                    key={opt}
                    className={`ca-option${selected ? ' ca-option--selected' : ''}`}
                    onClick={() => setAnswer(idx, opt)}
                  >
                    <div className="ca-option-key">{opt}</div>
                    <span className="ca-option-text">{optText}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {submitErr && (
          <div style={{ color: '#f87171', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
            Error: {submitErr}
          </div>
        )}

        <div className="ca-submit-section">
          <button
            className="ag-btn ag-btn--primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: 15 }}
            onClick={() => doSubmit(false)}
            disabled={submitting}
          >
            {submitting ? (
              <><span className="spinner" style={{ marginRight: 8 }} />Submitting…</>
            ) : (
              allAnswered ? 'Submit Assessment' : `Submit Assessment (${answeredCount}/${questions.length} answered)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Submitted screen ──────────────────────────────────────────────────────────
function SubmittedScreen({ result, assessment }) {
  const { score_pct, correct_count, total_count } = result;
  const passPct = assessment.pass_score_pct || 60;
  const passed = score_pct >= passPct;

  return (
    <div className="ca-page">
      <div className="ca-card">
        <Logo />
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{passed ? '🎉' : '📋'}</div>
          <h1 className="ca-title" style={{ textAlign: 'center' }}>Assessment Submitted</h1>
          <p className="ca-subtitle" style={{ textAlign: 'center' }}>
            Thank you for completing the assessment. Here is your result:
          </p>

          <div className={`ca-result-score ${passed ? 'ca-result-pass' : 'ca-result-fail'}`}>{score_pct ?? 0}%</div>

          <div style={{ display: 'inline-block', marginBottom: 16 }}>
            <span className={`asmnt-status ${passed ? 'asmnt-status--active' : 'asmnt-status--closed'}`} style={{ fontSize: 14 }}>
              {passed ? '✓ Pass' : '✕ Did not pass'}
            </span>
          </div>

          <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 32 }}>
            {correct_count} of {total_count} questions correct · Pass mark: {passPct}%
          </div>

          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '20px 24px', textAlign: 'left', marginBottom: 24 }}>
            {passed ? (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                Congratulations! You have passed the assessment. The recruiter will review your results and get back to you shortly.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                The recruiter will review your performance and be in touch. Thank you for taking the time to complete this assessment.
              </p>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>You may close this window.</p>
        </div>
      </div>
    </div>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────
export default function CandidateAssessment() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [appState, setAppState] = useState('loading'); // loading | error | intro | in-progress | submitted
  const [assessment, setAssessment] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    if (!token) {
      setErrorMsg('No assessment token found in URL. Please use the link provided by your recruiter.');
      setAppState('error');
      return;
    }

    fetch(`${BACKEND_URL}/assessments/take/${token}`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || `Error ${res.status}`); });
        return res.json();
      })
      .then(data => {
        setAssessment(data.assessment || data);
        setAppState('intro');
      })
      .catch(err => {
        setErrorMsg(err.message || 'Failed to load assessment. The link may be invalid or expired.');
        setAppState('error');
      });
  }, [token]);

  const handleStart = () => setAppState('in-progress');

  const handleSubmitted = (result) => {
    setSubmitResult(result);
    setAppState('submitted');
  };

  if (appState === 'loading') return <LoadingScreen />;
  if (appState === 'error')   return <ErrorScreen message={errorMsg} />;
  if (appState === 'intro')   return <IntroScreen assessment={assessment} onStart={handleStart} />;
  if (appState === 'in-progress') {
    return (
      <InProgressScreen
        assessment={assessment}
        token={token}
        onSubmitted={handleSubmitted}
      />
    );
  }
  if (appState === 'submitted') {
    return <SubmittedScreen result={submitResult} assessment={assessment} />;
  }

  return null;
}
