import { useState, useEffect, useRef, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const TYPE_LABELS = { write: 'Write from Scratch', fix: 'Fix the Bug', complete: 'Complete the Code' };
const TYPE_COLORS = { write: '#60a5fa', fix: '#f87171', complete: '#34d399' };

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

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const mmss = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const warningClass = remaining <= 60 ? 'ca-timer--danger' : remaining <= 300 ? 'ca-timer--warning' : '';

  return { remaining, mmss, warningClass, start, stop };
}

// ── Code Editor ───────────────────────────────────────────────────────────────
function CodeEditor({ value, onChange, language = 'javascript', readOnly = false, minHeight = 300 }) {
  const taRef   = useRef(null);
  const lnRef   = useRef(null);
  const lines   = (value || '').split('\n');
  const lineCount = Math.max(lines.length, 8);

  const syncScroll = () => {
    if (lnRef.current && taRef.current) lnRef.current.scrollTop = taRef.current.scrollTop;
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta  = taRef.current;
      const s   = ta.selectionStart;
      const end = ta.selectionEnd;
      const nv  = value.substring(0, s) + '  ' + value.substring(end);
      onChange(nv);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
  };

  return (
    <div style={{
      display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace", fontSize: 13,
      background: 'var(--bg-elevated)',
    }}>
      <div
        ref={lnRef}
        style={{
          width: 44, minHeight, background: 'rgba(0,0,0,0.18)', color: 'var(--text-3)',
          textAlign: 'right', padding: '12px 8px 12px 0', lineHeight: '20px',
          userSelect: 'none', overflowY: 'hidden', flexShrink: 0,
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ height: 20 }}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value || ''}
        onChange={e => onChange && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        readOnly={readOnly}
        spellCheck={false}
        style={{
          flex: 1, minHeight, padding: '12px', border: 'none', outline: 'none', resize: 'vertical',
          fontFamily: 'inherit', fontSize: 'inherit', lineHeight: '20px',
          background: 'transparent', color: 'var(--text-1)', caretColor: 'var(--accent)', overflowX: 'auto',
        }}
      />
    </div>
  );
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

// ── Loading / Error screens ───────────────────────────────────────────────────
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

function ErrorScreen({ message }) {
  return (
    <div className="ca-page">
      <div className="ca-card">
        <Logo />
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Unable to load assessment</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
            {message || 'This link may be invalid or expired. Please contact your recruiter.'}
          </p>
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
            <span className="ca-meta-value">{time_limit_min || 60} min</span>
          </div>
          <div className="ca-meta-item">
            <span className="ca-meta-label">Type</span>
            <span className="ca-meta-value">Coding</span>
          </div>
        </div>

        {instructions && (
          <div className="ca-instructions">
            <strong style={{ display: 'block', marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Instructions</strong>
            {instructions}
          </div>
        )}

        <div style={{ marginTop: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
          <strong>Before you start:</strong> Each question has a problem statement and starter code. Write your solution in the editor.
          The timer begins when you click Start. You can switch between questions at any time — your code is saved automatically.
          Click <strong>Submit All</strong> when you are done, or all answers will be submitted automatically when time runs out.
        </div>

        <button
          className="ag-btn ag-btn--primary"
          style={{ width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: 15 }}
          onClick={onStart}
        >
          Start Assessment →
        </button>
      </div>
    </div>
  );
}

// ── In-progress screen ────────────────────────────────────────────────────────
function InProgressScreen({ assessment, token, onSubmitted }) {
  const { questions, time_limit_min } = assessment;
  const totalSeconds = (time_limit_min || 60) * 60;

  // answers keyed by question id
  const [answers, setAnswers]     = useState(() => {
    const init = {};
    questions.forEach(q => { init[q.id] = q.starter_code || ''; });
    return init;
  });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState('');
  const startTimeRef = useRef(Date.now());

  const handleAutoSubmit = useCallback(() => { doSubmit(true); }, []); // eslint-disable-line

  const { mmss, warningClass, start, stop } = useTimer(totalSeconds, handleAutoSubmit);

  useEffect(() => { start(); return stop; }, [start, stop]);

  const setCode = (qid, code) => setAnswers(prev => ({ ...prev, [qid]: code }));

  const answeredCount = Object.values(answers).filter(v => v && v.trim()).length;

  const doSubmit = async (auto = false) => {
    if (!auto) {
      const unanswered = questions.length - answeredCount;
      if (unanswered > 0) {
        const ok = window.confirm(`You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`);
        if (!ok) return;
      }
    }
    stop();
    setSubmitting(true);
    setSubmitErr('');
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      const res = await fetch(`${BACKEND_URL}/coding-assessments/take/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, time_taken_sec: timeTaken }),
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

  const q = questions[currentIdx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text-1)', overflow: 'hidden' }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', height: 56,
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <Logo />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{answeredCount}/{questions.length} answered</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 1 }}>TIME REMAINING</div>
          <div className={`ca-timer ${warningClass}`} style={{ fontSize: 18 }}>{mmss}</div>
        </div>
        {submitErr && (
          <div style={{ color: '#f87171', fontSize: 12 }}>Error: {submitErr}</div>
        )}
        <button
          className="ag-btn ag-btn--primary"
          style={{ padding: '8px 20px' }}
          onClick={() => doSubmit(false)}
          disabled={submitting}
        >
          {submitting ? <><span className="spinner" style={{ marginRight: 6 }} />Submitting…</> : 'Submit All'}
        </button>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 210, flexShrink: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
          padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 4 }}>
            Questions
          </div>
          {questions.map((q, idx) => {
            const isActive   = idx === currentIdx;
            const isAnswered = answers[q.id]?.trim() && answers[q.id]?.trim() !== (q.starter_code || '').trim();
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s',
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-1)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: isActive ? 'rgba(255,255,255,0.2)' : isAnswered ? '#34d399' : 'var(--bg-elevated)',
                  color: isActive ? '#fff' : isAnswered ? '#fff' : 'var(--text-2)',
                }}>
                  {isAnswered && !isActive ? '✓' : idx + 1}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 12 }}>
                  {q.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main question area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          {q && (
            <div>
              {/* Question header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Q{currentIdx + 1} of {questions.length}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: `${TYPE_COLORS[q.question_type] || '#60a5fa'}22`,
                  color: TYPE_COLORS[q.question_type] || '#60a5fa',
                  border: `1px solid ${TYPE_COLORS[q.question_type] || '#60a5fa'}44`,
                }}>{TYPE_LABELS[q.question_type] || q.question_type}</span>
                {q.difficulty && (
                  <span className={`asmnt-diff-badge asmnt-diff-badge--${q.difficulty}`}>{q.difficulty}</span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--text-2)', fontFamily: 'monospace' }}>
                  {q.language}
                </span>
                {q.topic && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.topic}</span>
                )}
              </div>

              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{q.title}</h2>

              {/* Problem statement */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {q.problem_statement}
              </div>

              {/* Code editor */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600 }}>Your Solution</div>
                <CodeEditor
                  value={answers[q.id] || ''}
                  onChange={code => setCode(q.id, code)}
                  language={q.language}
                  minHeight={320}
                />
              </div>

              {/* Navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button
                  className="ag-btn ag-btn--ghost"
                  onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                  style={{ opacity: currentIdx === 0 ? 0.4 : 1 }}
                >
                  ← Previous
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button className="ag-btn ag-btn--primary" onClick={() => setCurrentIdx(i => i + 1)}>
                    Next →
                  </button>
                ) : (
                  <button
                    className="ag-btn ag-btn--primary"
                    onClick={() => doSubmit(false)}
                    disabled={submitting}
                  >
                    {submitting ? <><span className="spinner" style={{ marginRight: 6 }} />Submitting…</> : 'Submit All →'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Submitted screen ──────────────────────────────────────────────────────────
function SubmittedScreen({ assessment }) {
  return (
    <div className="ca-page">
      <div className="ca-card">
        <Logo />
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
          <h1 className="ca-title" style={{ textAlign: 'center' }}>Submission Received</h1>
          <p className="ca-subtitle" style={{ textAlign: 'center' }}>
            Thank you for completing <strong>{assessment?.title}</strong>.
          </p>

          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '20px 24px', textAlign: 'left', marginBottom: 24, marginTop: 20 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
              Your code has been submitted and is being evaluated by our AI. The results will be reviewed by your recruiter, who will get back to you with feedback.
            </p>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>You may close this window.</p>
        </div>
      </div>
    </div>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────
export default function CandidateCodingAssessment() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [appState, setAppState]   = useState('loading');
  const [assessment, setAssessment] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('No assessment token found in URL. Please use the link provided by your recruiter.');
      setAppState('error');
      return;
    }

    fetch(`${BACKEND_URL}/coding-assessments/take/${token}`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || `Error ${res.status}`); });
        return res.json();
      })
      .then(data => {
        if (data.alreadyCompleted) {
          setAppState('submitted');
          return;
        }
        setAssessment({ ...(data.assessment || data), questions: data.questions || [] });
        setAppState('intro');
      })
      .catch(err => {
        setErrorMsg(err.message || 'Failed to load assessment. The link may be invalid or expired.');
        setAppState('error');
      });
  }, [token]);

  if (appState === 'loading')     return <LoadingScreen />;
  if (appState === 'error')       return <ErrorScreen message={errorMsg} />;
  if (appState === 'intro')       return <IntroScreen assessment={assessment} onStart={() => setAppState('in-progress')} />;
  if (appState === 'in-progress') {
    return (
      <InProgressScreen
        assessment={assessment}
        token={token}
        onSubmitted={() => setAppState('submitted')}
      />
    );
  }
  if (appState === 'submitted')   return <SubmittedScreen assessment={assessment} />;

  return null;
}
