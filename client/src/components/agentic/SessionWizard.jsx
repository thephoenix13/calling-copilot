import { useState, useEffect, useCallback } from 'react';
import Step1_SelectJD from './steps/Step1_SelectJD';
import Step2_EnhanceJD from './steps/Step2_EnhanceJD';
import Step3_SourceCandidates from './steps/Step3_SourceCandidates';
import Step4_RecruiterScreening from './steps/Step4_RecruiterScreening';
import Step5_AIInterviewReports from './steps/Step5_AIInterviewReports';
import Step6_Decision from './steps/Step6_Decision';
import Step7_PipelineTracker from './steps/Step7_PipelineTracker';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STEPS = [
  { n: 1, label: 'Select JD',   short: 'JD'       },
  { n: 2, label: 'Enhance JD',  short: 'Enhance'  },
  { n: 3, label: 'Source',      short: 'Source'   },
  { n: 4, label: 'Screening',   short: 'Screen'   },
  { n: 5, label: 'AI Reports',  short: 'Reports'  },
  { n: 6, label: 'Decision',    short: 'Decision' },
  { n: 7, label: 'Tracker',     short: 'Tracker'  },
];

// ── Step gating ──────────────────────────────────────────────────────────────
function isStepUnlocked(stepNum, session) {
  if (!session) return stepNum === 1;
  const { job_id, enhancement_saved, candidates = [] } = session;
  const passing   = candidates.filter(c => c.screening_status === 'pass');
  const scored    = passing.filter(c => c.ai_interview_score != null);
  const proceeded = candidates.filter(c => c.decision === 'proceed');

  switch (stepNum) {
    case 1: return true;
    case 2: return !!job_id;
    case 3: return enhancement_saved === 1;
    case 4: return candidates.length > 0;
    case 5: return passing.length > 0;
    case 6: return passing.length > 0 && scored.length === passing.length;
    case 7: return proceeded.length > 0;
    default: return false;
  }
}

const stripMarkers = (t) => (t || '').replace(/\[\[NOTES_HIGHLIGHT\]\]/g, '').replace(/\[\[\/NOTES_HIGHLIGHT\]\]/g, '');

export default function SessionWizard({ sessionId, authFetch, isLight, onToggleTheme, onLogout, onBack, onScreenViaCall }) {
  const [session, setSession]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeStep, setActiveStep] = useState(null);

  const fetchSession = useCallback(async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/sessions/${sessionId}`);
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        if (activeStep === null) setActiveStep(data.session.current_step);
      }
    } catch (err) {
      console.error('fetch session error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, authFetch, activeStep]);

  useEffect(() => { fetchSession(); }, [sessionId]);

  // Called by a step when it completes — optionally advances current_step
  const handleStepComplete = async (updates = {}, advanceTo = null) => {
    const body = { ...updates };
    if (advanceTo && advanceTo > (session?.current_step || 1)) {
      body.current_step = advanceTo;
    }
    if (Object.keys(body).length > 0) {
      await authFetch(`${BACKEND_URL}/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    if (advanceTo) setActiveStep(advanceTo);
    await fetchSession();
  };

  // Called by steps that need a silent refresh without advancing
  const handleRefresh = async () => {
    await fetchSession();
  };

  if (loading) {
    return (
      <div className={`app${isLight ? ' light' : ''}`}>
        <div className="sw-loading">Loading session…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`app${isLight ? ' light' : ''}`}>
        <div className="sw-loading">Session not found. <button className="ag-btn ag-btn--ghost" onClick={onBack}>← Back</button></div>
      </div>
    );
  }

  const currentActive = activeStep || session.current_step;

  const handleScreenViaCall = onScreenViaCall
    ? (sc) => {
        const jd = session.enhancement_data?.formattedJD
          ? stripMarkers(session.enhancement_data.formattedJD)
          : (session.job?.description || '');
        onScreenViaCall({
          sessionId: session.id,
          scId: sc.id,
          candidateName: sc.candidate_name,
          roleTitle: session.job?.title || '',
          jd,
          resume: sc.candidate_resume_text || '',
        });
      }
    : undefined;

  const stepProps = {
    session,
    authFetch,
    onComplete: handleStepComplete,
    onRefresh:  handleRefresh,
    onScreenViaCall: handleScreenViaCall,
  };

  return (
    <div className={`app${isLight ? ' light' : ''}`}>
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button className="report-btn" onClick={onBack}>← Sessions</button>
          <span className="logo">🔄</span>
          <h1 className="sw-session-name">{session.name || `Session #${session.id}`}</h1>
          {session.job?.title && <span className="sw-job-tag">💼 {session.job.title}</span>}
        </div>
        <div className="header-right">
          <button className="theme-toggle-btn" onClick={onToggleTheme}>{isLight ? '🌙 Dark' : '☀️ Light'}</button>
          <button className="report-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      {/* Step indicator */}
      <div className="sw-step-bar">
        {STEPS.map((step, i) => {
          const unlocked = isStepUnlocked(step.n, session);
          const done     = step.n < session.current_step;
          const active   = step.n === currentActive;
          const locked   = !unlocked && !done;

          return (
            <button
              key={step.n}
              className={`sw-step-btn${active ? ' sw-step-btn--active' : done ? ' sw-step-btn--done' : locked ? ' sw-step-btn--locked' : ''}`}
              onClick={() => unlocked && setActiveStep(step.n)}
              disabled={locked}
              title={locked ? `Complete step ${step.n - 1} first` : step.label}
            >
              <span className="sw-step-num">{done ? '✓' : step.n}</span>
              <span className="sw-step-label">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="sw-step-content">
        {currentActive === 1 && <Step1_SelectJD {...stepProps} />}
        {currentActive === 2 && <Step2_EnhanceJD {...stepProps} />}
        {currentActive === 3 && <Step3_SourceCandidates {...stepProps} />}
        {currentActive === 4 && <Step4_RecruiterScreening {...stepProps} />}
        {currentActive === 5 && <Step5_AIInterviewReports {...stepProps} />}
        {currentActive === 6 && <Step6_Decision {...stepProps} />}
        {currentActive === 7 && <Step7_PipelineTracker {...stepProps} />}
      </div>
    </div>
  );
}
