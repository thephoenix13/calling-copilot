import { useState } from 'react';
import AgenticHome from './AgenticHome';
import PipelineSessions from './PipelineSessions';
import SessionWizard from './SessionWizard';
import POFUModule from './POFUModule';
import JobsModule from './JobsModule';
import CandidatesModule from './CandidatesModule';
import ReportsModule from './ReportsModule';

export default function AgenticApp({ authFetch, userRole, isLight, onToggleTheme, onLogout, onBackToDashboard, onScreenViaCall }) {
  const [view, setView]           = useState('home'); // 'home' | 'sessions' | 'session' | 'pofu' | 'jobs' | 'candidates' | 'reports'
  const [sessionId, setSessionId] = useState(null);

  const sharedProps = { authFetch, userRole, isLight, onToggleTheme, onLogout };
  const goHome = () => setView('home');

  if (view === 'pofu')       return <POFUModule       {...sharedProps} onBack={goHome} />;
  if (view === 'jobs')       return <JobsModule       {...sharedProps} onBack={goHome} />;
  if (view === 'candidates') return <CandidatesModule {...sharedProps} onBack={goHome} />;
  if (view === 'reports')    return <ReportsModule    authFetch={authFetch} onBack={goHome} />;

  if (view === 'sessions') {
    return (
      <PipelineSessions
        {...sharedProps}
        onBack={goHome}
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
