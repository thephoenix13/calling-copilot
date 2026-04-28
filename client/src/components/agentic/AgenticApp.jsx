import { useState } from 'react';
import AgenticHome from './AgenticHome';
import JobsModule from './JobsModule';
import CandidatesModule from './CandidatesModule';
import JDEnhancer from './JDEnhancer';
import PipelineSessions from './PipelineSessions';
import SessionWizard from './SessionWizard';

export default function AgenticApp({ authFetch, userRole, isLight, onToggleTheme, onLogout, onBackToDashboard, onScreenViaCall }) {
  const [view, setView]           = useState('home'); // 'home' | 'jobs' | 'candidates' | 'jd-enhancer' | 'sessions' | 'session'
  const [sessionId, setSessionId] = useState(null);

  const sharedProps = { authFetch, userRole, isLight, onToggleTheme, onLogout };

  if (view === 'jobs')       return <JobsModule      {...sharedProps} onBack={() => setView('home')} />;
  if (view === 'candidates') return <CandidatesModule {...sharedProps} onBack={() => setView('home')} />;
  if (view === 'jd-enhancer') return <JDEnhancer     {...sharedProps} onBack={() => setView('home')} />;

  if (view === 'sessions') {
    return (
      <PipelineSessions
        {...sharedProps}
        onBack={() => setView('home')}
        onOpenSession={id => { setSessionId(id); setView('session'); }}
      />
    );
  }

  if (view === 'session' && sessionId) {
    return (
      <SessionWizard
        {...sharedProps}
        sessionId={sessionId}
        onBack={() => setView('sessions')}
        onScreenViaCall={onScreenViaCall}
      />
    );
  }

  return (
    <AgenticHome
      {...sharedProps}
      onNav={setView}
      onBackToDashboard={onBackToDashboard}
    />
  );
}
