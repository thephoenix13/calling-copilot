import { useState, useEffect, useCallback, useRef } from 'react';
import Step1_SelectJD from './steps/Step1_SelectJD';
import Step2_EnhanceJD from './steps/Step2_EnhanceJD';
import Step3_SourceCandidates from './steps/Step3_SourceCandidates';
import Step4_RecruiterScreening from './steps/Step4_RecruiterScreening';
import Step5_VideoInterviewScheduler from './steps/Step5_VideoInterviewScheduler';
import Step6_AIInterviewReports from './steps/Step5_AIInterviewReports';
import Step7_Decision from './steps/Step6_Decision';
import Step8_PipelineTracker from './steps/Step7_PipelineTracker';
import {
  FormattedJDTab, RecruiterBriefTab, ClarificationsReadOnly,
  ReachoutTab, KeywordsTab, stripMarkers,
} from './JDEnhancerTabs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STEPS = [
  { n: 1, label: 'Select JD',   short: 'JD'       },
  { n: 2, label: 'Enhance JD',  short: 'Enhance'  },
  { n: 3, label: 'Source',      short: 'Source'   },
  { n: 4, label: 'Screening',   short: 'Screen'   },
  { n: 5, label: 'VI Schedule', short: 'Schedule' },
  { n: 6, label: 'AI Reports',  short: 'Reports'  },
  { n: 7, label: 'Decision',    short: 'Decision' },
  { n: 8, label: 'Tracker',     short: 'Tracker'  },
];

// ── Step gating ──────────────────────────────────────────────────────────────
function isStepUnlocked(stepNum, session) {
  if (!session) return stepNum === 1;
  const { job_id, enhancement_saved, candidates = [] } = session;
  const passing        = candidates.filter(c => c.screening_status === 'pass');
  const activeForScore = passing.filter(c => !c.vi_review);
  const scored         = activeForScore.filter(c => c.ai_interview_score != null);
  const proceeded      = candidates.filter(c => c.decision === 'proceed');

  switch (stepNum) {
    case 1: return true;
    case 2: return !!job_id;
    case 3: return enhancement_saved === 1;
    case 4: return candidates.length > 0;
    case 5: return passing.length > 0;
    case 6: return passing.length > 0;
    case 7: return passing.length > 0 && activeForScore.length > 0 && scored.length === activeForScore.length;
    case 8: return proceeded.length > 0;
    default: return false;
  }
}

const JD_TABS = [
  { key: 'jd',        label: 'Formatted JD',   field: 'formattedJD'            },
  { key: 'brief',     label: 'Recruiter Brief', field: 'recruiterBrief'         },
  { key: 'questions', label: 'Clarifications',  field: 'clarificationQuestions' },
  { key: 'reachout',  label: 'Reachout',        field: 'reachoutMaterial'       },
  { key: 'keywords',  label: 'Keywords',        field: 'sourcingKeywords'       },
];

export default function SessionWizard({ sessionId, authFetch, isLight, onToggleTheme, onLogout, onBack, onScreenViaCall }) {
  const [session,     setSession]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activeStep,  setActiveStep]  = useState(null);
  const [showJDModal, setShowJDModal] = useState(false);
  const [jdModalTab,  setJdModalTab]  = useState('jd');

  const activeStepRef = useRef(null);

  const fetchSession = useCallback(async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/sessions/${sessionId}`);
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        if (activeStepRef.current === null) {
          setActiveStep(data.session.current_step);
          activeStepRef.current = data.session.current_step;
        }
      }
    } catch (err) {
      console.error('fetch session error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, authFetch]);

  useEffect(() => {
    activeStepRef.current = null;
    setActiveStep(null);
    setLoading(true);
    setSession(null);
    fetchSession();
  }, [sessionId]);

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

  // ── JD Assets modal ────────────────────────────────────────────────────
  const enhancement = session.enhancement_data;

  const copyJDTab = (tabKey) => {
    const tab = JD_TABS.find(t => t.key === tabKey);
    const content = enhancement?.[tab.field];
    const text = typeof content === 'string' ? stripMarkers(content) : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="page-content page-content--wide">
      {/* Session breadcrumb */}
      <div className="sw-session-breadcrumb">
        <button className="sw-back-link" onClick={onBack}>← Sessions</button>
        <span className="sw-session-crumb-name">{session.name || `Session #${session.id}`}</span>
        {session.job?.title && <span className="sw-job-tag">{session.job.title}</span>}
        <button
          className="sw-jd-assets-btn"
          style={!enhancement ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          onClick={() => { if (enhancement) { setShowJDModal(true); setJdModalTab('jd'); } }}
          title={!enhancement ? 'Complete Step 2 — Enhance JD — to view assets' : 'View JD Assets'}
        >
          View JD Assets
        </button>
      </div>

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
        {currentActive === 5 && <Step5_VideoInterviewScheduler {...stepProps} />}
        {currentActive === 6 && <Step6_AIInterviewReports {...stepProps} />}
        {currentActive === 7 && <Step7_Decision {...stepProps} />}
        {currentActive === 8 && <Step8_PipelineTracker {...stepProps} />}
      </div>

      {/* JD Assets modal */}
      {showJDModal && enhancement && (
        <div className="ag-modal-overlay" onClick={() => setShowJDModal(false)}>
          <div className="jde-assets-modal" onClick={e => e.stopPropagation()}>
            <div className="jde-assets-modal-header">
              <h3 className="jde-assets-modal-title">
                JD Assets{session.job?.title ? ` — ${session.job.title}` : ''}
              </h3>
              <button className="jde-assets-modal-close" onClick={() => setShowJDModal(false)}>✕</button>
            </div>
            <div className="jde-tab-bar">
              {JD_TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`jde-tab-btn${jdModalTab === tab.key ? ' jde-tab-btn--active' : ''}`}
                  onClick={() => setJdModalTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="jde-tab-toolbar">
              <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => copyJDTab(jdModalTab)}>
                📋 Copy
              </button>
            </div>
            <div className="jde-tab-content jde-assets-modal-content">
              {jdModalTab === 'jd'        && (enhancement.formattedJD
                ? <FormattedJDTab content={enhancement.formattedJD} />
                : <div className="rpt-empty">No formatted JD generated yet.</div>)}
              {jdModalTab === 'brief'     && (enhancement.recruiterBrief
                ? <RecruiterBriefTab content={enhancement.recruiterBrief} />
                : <div className="rpt-empty">No recruiter brief generated yet.</div>)}
              {jdModalTab === 'questions' && <ClarificationsReadOnly content={enhancement.clarificationQuestions} />}
              {jdModalTab === 'reachout'  && (enhancement.reachoutMaterial
                ? <ReachoutTab content={enhancement.reachoutMaterial} />
                : <div className="rpt-empty">No reachout material generated yet.</div>)}
              {jdModalTab === 'keywords'  && (enhancement.sourcingKeywords
                ? <KeywordsTab content={enhancement.sourcingKeywords} />
                : <div className="rpt-empty">No keywords generated yet.</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
