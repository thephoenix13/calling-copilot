import { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { io } from 'socket.io-client';
import Dialpad from './components/Dialpad';
import CallStatus from './components/CallStatus';
import Transcript from './components/Transcript';
import PerCallQAReport from './components/PerCallQAReport';
import CandidateEvaluationReport from './components/CandidateEvaluationReport';
import InterviewPanel from './components/InterviewPanel';
import LoginPage from './components/LoginPage';
import UsersPanel from './components/UsersPanel';
import Dashboard from './components/Dashboard';
import AgenticApp from './components/agentic/AgenticApp';
import JobsModule from './components/agentic/JobsModule';
import CandidatesModule from './components/agentic/CandidatesModule';
import JDEnhancer from './components/agentic/JDEnhancer';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Auto-demo scenario ───────────────────────────────────────────────────────
const AUTO_DEMO = {
  candidateName: 'Priya Kapoor',
  role: 'Software Test Engineer',
  recruiterName: 'Komal Sharma',
  fakePhone: '+91 93070 42201',
  jd: `Role: Software Test Engineer | Client: Infosys
Experience: 2–5 years | Location: Pune / Hyderabad (Hybrid) | Budget: 8–14 LPA
Key Skills: Manual & Automation Testing, Selenium WebDriver, TestNG/JUnit, API Testing (Postman/RestAssured), JIRA, SQL, Agile/Scrum.
Responsibilities: Design and execute test cases for web and API applications. Develop automation scripts using Selenium. Report and track defects in JIRA. Collaborate with developers in sprint cycles. Own regression, smoke, and sanity testing.`,
  resume: `Priya Kapoor | Software Test Engineer | Pune | 3.5 years
Current: Wipro — QA Analyst
Skills: Manual Testing, Selenium WebDriver (Java), TestNG, Postman, RestAssured, JIRA, SQL, Git, Agile
Projects: E-commerce platform QA for US retail client — owns regression suite of 300+ automated tests. API testing for banking app using RestAssured. JMeter for basic performance testing.
Education: B.E. Computer Engineering, Savitribai Phule Pune University
CTC: ₹7.5 LPA | Expected: ₹11–12 LPA | Notice: 30 days`,
  questions: [
    "Hi Priya, this is Komal calling from TechRecruit — hope I'm not disturbing you. Do you have about 10 minutes to discuss a Software Test Engineer opportunity with Infosys?",
    "Great, thank you! Could you give me a quick overview of your current role and your overall experience in QA so far?",
    "That's good experience. Can you tell me about your automation work — which frameworks have you used, and roughly how much of your current testing is automated versus manual?",
    "Interesting. Can you walk me through how you'd design a test strategy for a new feature — say, a payment gateway integration? What would your end-to-end approach look like?",
    "Good. What's your experience with API testing? Have you used Postman or RestAssured, and can you give me an example of an API-level bug you found that wouldn't have surfaced through the UI?",
    "How do you manage regression testing within an Agile sprint cycle? And how do you handle flaky tests in your automation suite?",
    "Have you had any exposure to CI/CD pipelines — Jenkins or GitLab CI — for triggering automated test runs?",
    "On the practical side — what's your current notice period, and are you open to a hybrid model out of Pune or Hyderabad?",
    "What are your current and expected CTC? The budget for this Infosys role is in the range of 8 to 14 LPA depending on the panel outcome.",
    "That sounds very promising. This is a long-term engagement on a digital banking client — good team, structured QA process. Any questions or concerns from your side before we move ahead?",
  ],
};

export default function App() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const [userRole, setUserRole] = useState(() => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) { localStorage.removeItem('authToken'); return null; }
      return payload.role;
    } catch { return null; }
  });
  const [authToken, setAuthToken] = useState(() => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) { localStorage.removeItem('authToken'); return null; }
      return token;
    } catch { return null; }
  });
  const isAdmin = userRole === 'admin';
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'calling-copilot' | 'agentic'
  const [displayName, setDisplayName] = useState('');
  // screeningContext: set when launching a call from Step 4 of a pipeline session
  // { sessionId, scId, candidateName, roleTitle, jd, resume }
  const [screeningContext, setScreeningContext] = useState(null);

  // Authenticated fetch helper
  const authFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), 'Authorization': `Bearer ${authToken}` },
    });
  }, [authToken]);
  const [device, setDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [transcript, setTranscript] = useState([]);
  const [phoneNumber, setPhoneNumber] = useState('+');
  const [callingNumber, setCallingNumber] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showCER, setShowCER] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState(null);
  const socketRef = useRef(null);

  // ── Theme ──────────────────────────────────────────────────────────────
  const [isLight, setIsLight] = useState(false);

  // ── Simulation state ────────────────────────────────────────────────────
  const isSimModeRef = useRef(false);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [reportData, setReportData] = useState(null);

  // ── Auto-demo state ─────────────────────────────────────────────────────
  const [isAutoDemoRunning, setIsAutoDemoRunning] = useState(false);
  const autoDemoCancelRef = useRef(false);

  // ── Socket.io ───────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    socket.on('transcript', ({ text, isFinal, speaker }) => {
      // Ignore server transcript events during simulation — they would overwrite sim entries
      if (isSimModeRef.current) return;

      setTranscript((prev) => {
        const finals = prev.filter((e) => e.isFinal);
        if (isFinal) return [...finals, { text, isFinal: true, speaker }];
        const otherInterims = prev.filter((e) => !e.isFinal && e.speaker !== speaker);
        return [...finals, ...otherInterims, { text, isFinal: false, speaker }];
      });
    });

    socket.on('call-ended', () => {
      if (isSimModeRef.current) return;
      setCallStatus('ended');
    });

    return () => socket.disconnect();
  }, []);

  // ── Twilio Device ───────────────────────────────────────────────────────
  const initDevice = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/token`, { method: 'POST' });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error || `HTTP ${res.status}`); }
      const { token } = await res.json();
      const dev = new Device(token, { logLevel: 1, codecPreferences: ['opus', 'pcmu'] });
      dev.on('error', (err) => setDeviceError(err.message || 'Device error'));
      setDevice(dev);
      setDeviceError('');
    } catch (err) {
      setDeviceError(err.message);
    }
  }, [authFetch]);

  useEffect(() => { if (view === 'calling-copilot') initDevice(); }, [view, initDevice]);

  // ── Dialpad handlers (real call) ────────────────────────────────────────
  const handleKey = (key) => {
    if (callStatus === 'idle' || callStatus === 'ended') setPhoneNumber((n) => n + key);
    else if (activeCall) activeCall.sendDigits(key);
  };
  const handleBackspace = () => setPhoneNumber((n) => (n.length > 1 ? n.slice(0, -1) : n));

  const startCall = async () => {
    if (!device) { setDeviceError('Device not ready. Trying to reconnect...'); await initDevice(); return; }
    const to = phoneNumber.trim();
    if (!to || to === '+') return;
    try {
      setCallStatus('connecting');
      setCallingNumber(to);
      setTranscript([]);
      const call = await device.connect({ params: { To: to } });
      setActiveCall(call);

      // Register call in DB
      const sid = call.parameters?.CallSid;
      if (sid) {
        setCurrentCallSid(sid);
        authFetch(`${BACKEND_URL}/calls/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callSid: sid, to }),
        }).catch(() => {});
      }

      call.on('accept', () => setCallStatus('in-call'));
      call.on('disconnect', () => { setCallStatus('ended'); setActiveCall(null); });
      call.on('error', (err) => { setCallStatus('idle'); setActiveCall(null); setDeviceError(err.message || 'Call error'); });
      call.on('cancel', () => { setCallStatus('idle'); setActiveCall(null); });
    } catch (err) {
      setCallStatus('idle');
      setDeviceError(err.message || 'Failed to connect');
    }
  };
  const toggleMute = () => { if (!activeCall) return; const next = !isMuted; activeCall.mute(next); setIsMuted(next); };
  const endCall = () => { if (activeCall) activeCall.disconnect(); };
  const resetCall = () => {
    setCallStatus('idle'); setTranscript([]); setPhoneNumber('+');
    setCallingNumber(''); setDeviceError(''); setIsMuted(false); setCurrentCallSid(null);
  };

  // ── Word-group typewriter (simulates ASR capturing speech) ──────────────
  // Pushes 3–6 words at a time with natural pauses — looks like real transcription
  const asrTypewriter = async (text, speaker, getCancelled) => {
    const words = text.split(' ').filter(Boolean);
    let built = '';
    let i = 0;

    while (i < words.length) {
      if (getCancelled()) break;

      // 3–6 words per chunk
      const chunkSize = 3 + Math.floor(Math.random() * 4);
      const chunk = words.slice(i, i + chunkSize).join(' ');
      built += (built ? ' ' : '') + chunk;
      i += chunkSize;

      const snap = built;
      setTranscript(prev => {
        const finals = prev.filter(e => e.isFinal);
        return [...finals, { text: snap, isFinal: false, speaker }];
      });

      // Natural speech cadence — longer at sentence ends
      const lastWord = words[Math.min(i - 1, words.length - 1)];
      const atStop = /[.?!]$/.test(lastWord);
      const delay = atStop
        ? 1100 + Math.random() * 600   // 1.1–1.7s after sentence ends
        : 600  + Math.random() * 400;  // 0.6–1.0s between word groups

      await sleep(delay);
    }
  };

  // ── Shared: generate reports from transcript ────────────────────────────
  const generateReports = async (finalTranscript, role, candidateName, recruiterName, jd, resume, callSid) => {
    setCallStatus('sim-ended');
    setGeneratingReports(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/ai/generate-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript.filter(e => e.isFinal !== false),
          role, candidateName, recruiterName, jd, resume,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReportData(data);

      // Persist reports to DB
      if (callSid) {
        authFetch(`${BACKEND_URL}/calls/${callSid}/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qaReport: data.qaReport, candidateReport: data.candidateReport, jd, resume }),
        }).catch(() => {});
      }
    } catch {
      setDeviceError('Report generation failed — sample data shown in reports.');
      setTimeout(() => setDeviceError(''), 6000);
    } finally {
      setGeneratingReports(false);
    }
  };

  // ── Auto demo ───────────────────────────────────────────────────────────
  const runAutoDemo = async () => {
    autoDemoCancelRef.current = false;
    const cfg = AUTO_DEMO;
    const simCallSid = `SIM-${Date.now()}`;

    // Register SIM call in DB
    authFetch(`${BACKEND_URL}/calls/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid: simCallSid, to: cfg.fakePhone, candidateName: cfg.candidateName, roleTitle: cfg.role }),
    }).catch(() => {});
    setCurrentCallSid(simCallSid);

    isSimModeRef.current = true;
    setIsAutoDemoRunning(true);
    setCallStatus('sim-call');
    setTranscript([]);
    setReportData(null);
    setPhoneNumber(cfg.fakePhone);
    setCallingNumber(cfg.candidateName);

    const localTranscript = [];

    for (let i = 0; i < cfg.questions.length; i++) {
      if (autoDemoCancelRef.current) break;

      const question = cfg.questions[i];

      // ── Recruiter: word-group typewriter ──
      await asrTypewriter(question, 'Recruiter', () => autoDemoCancelRef.current);
      if (autoDemoCancelRef.current) break;

      const recruiterEntry = { text: question, isFinal: true, speaker: 'Recruiter' };
      localTranscript.push(recruiterEntry);
      setTranscript(prev => [...prev.filter(e => e.isFinal), recruiterEntry]);

      // Pause — candidate processing before responding
      await sleep(1500 + Math.random() * 1000);
      if (autoDemoCancelRef.current) break;

      // Show "..." while waiting for candidate response
      setTranscript(prev => [
        ...prev.filter(e => e.isFinal),
        { text: '…', isFinal: false, speaker: 'Candidate' },
      ]);

      // Fetch candidate reply
      let candidateReply = '';
      try {
        const res = await authFetch(`${BACKEND_URL}/ai/sim-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recruiterMessage: question,
            transcript: localTranscript,
            role: cfg.role,
            candidateName: cfg.candidateName,
            jd: cfg.jd,
            resume: cfg.resume,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${res.status}`);
        }
        const data = await res.json();
        candidateReply = data.candidateReply || '';
      } catch (err) {
        console.error('[AutoDemo] sim-reply failed:', err.message);
        setDeviceError(`Candidate AI error: ${err.message} — is the backend server running?`);
        await sleep(4000);
        setDeviceError('');
      }

      // Remove "..." placeholder
      setTranscript(prev => prev.filter(e => e.isFinal));

      if (!candidateReply || autoDemoCancelRef.current) continue;

      // ── Candidate: word-group typewriter ──
      await asrTypewriter(candidateReply, 'Candidate', () => autoDemoCancelRef.current);
      if (autoDemoCancelRef.current) break;

      const candidateEntry = { text: candidateReply, isFinal: true, speaker: 'Candidate' };
      localTranscript.push(candidateEntry);
      setTranscript(prev => [...prev.filter(e => e.isFinal), candidateEntry]);

      // Pause before recruiter asks next question
      const isLast = i === cfg.questions.length - 1;
      await sleep(isLast ? 800 : 3000 + Math.random() * 1500);
    }

    setIsAutoDemoRunning(false);
    if (autoDemoCancelRef.current) { autoDemoCancelRef.current = false; return; }

    await generateReports(
      localTranscript, cfg.role, cfg.candidateName, cfg.recruiterName, cfg.jd, cfg.resume, simCallSid
    );
  };

  const stopAutoDemo = () => {
    autoDemoCancelRef.current = true;
    setIsAutoDemoRunning(false);
    setCallStatus('sim-ended');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setUserRole(null);
    setView('dashboard');
    setDisplayName('');
  };

  const resetDemo = () => {
    isSimModeRef.current = false;
    setCallStatus('idle');
    setTranscript([]);
    setReportData(null);
    setPhoneNumber('+');
    setCallingNumber('');
    setCurrentCallSid(null);
  };

  const isSimActive = callStatus === 'sim-call';
  const isSimEnded = callStatus === 'sim-ended';

  if (!userRole) {
    return (
      <LoginPage
        onLogin={(role, token, name) => {
          setUserRole(role);
          setAuthToken(token);
          setDisplayName(name || '');
          setView('dashboard');
        }}
      />
    );
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        displayName={displayName}
        onSelect={setView}
        onLogout={handleLogout}
        isLight={isLight}
        onToggleTheme={() => setIsLight((l) => !l)}
      />
    );
  }

  const sharedModuleProps = { authFetch, userRole, isLight, onToggleTheme: () => setIsLight(l => !l), onLogout: handleLogout };

  if (view === 'jobs')        return <JobsModule       {...sharedModuleProps} onBack={() => setView('dashboard')} />;
  if (view === 'candidates')  return <CandidatesModule {...sharedModuleProps} onBack={() => setView('dashboard')} />;
  if (view === 'jd-enhancer') return <JDEnhancer       {...sharedModuleProps} onBack={() => setView('dashboard')} />;

  if (view === 'agentic') {
    return (
      <AgenticApp
        authFetch={authFetch}
        userRole={userRole}
        isLight={isLight}
        onToggleTheme={() => setIsLight((l) => !l)}
        onLogout={handleLogout}
        onBackToDashboard={() => setView('dashboard')}
        onScreenViaCall={(ctx) => {
          setScreeningContext(ctx);
          setCallStatus('idle');
          setTranscript([]);
          setPhoneNumber('+');
          setReportData(null);
          isSimModeRef.current = false;
          setView('calling-copilot');
        }}
      />
    );
  }

  const handleScreeningOutcome = async (status) => {
    const ctx = screeningContext;
    setScreeningContext(null);
    if (status && ctx) {
      try {
        await authFetch(`${BACKEND_URL}/sessions/${ctx.sessionId}/candidates/${ctx.scId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screening_status: status }),
        });
      } catch (err) {
        console.error('Failed to save screening outcome:', err);
      }
    }
    resetCall();
    setView('agentic');
  };

  return (
    <div className={`app${isLight ? ' light' : ''}`}>
      {/* ── QA Report ── */}
      {showReport && (
        <div className="report-overlay">
          <div className="report-overlay-bar">
            <span className="report-overlay-title">Per-Call QA Report</span>
            <button className="report-close-btn" onClick={() => setShowReport(false)}>✕ Close</button>
          </div>
          <div className="report-overlay-body">
            {generatingReports ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '3rem', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <span className="spinner" /> Generating QA report from conversation…
              </div>
            ) : (
              <PerCallQAReport reportData={reportData?.qaReport ?? null} />
            )}
          </div>
        </div>
      )}

      {/* ── Candidate Report ── */}
      {showCER && (
        <div className="report-overlay">
          <div className="report-overlay-bar">
            <span className="report-overlay-title">Candidate Evaluation Report</span>
            <button className="report-close-btn" onClick={() => setShowCER(false)}>✕ Close</button>
          </div>
          <div className="report-overlay-body">
            {generatingReports ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '3rem', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <span className="spinner" /> Generating candidate evaluation…
              </div>
            ) : (
              <CandidateEvaluationReport reportData={reportData?.candidateReport ?? null} />
            )}
          </div>
        </div>
      )}

      {/* ── Users Panel ── */}
      {showUsers && (
        <UsersPanel authToken={authToken} onClose={() => setShowUsers(false)} />
      )}

      {/* ── Screening outcome panel ── */}
      {callStatus === 'ended' && screeningContext && (
        <div className="sw-outcome-overlay">
          <div className="sw-outcome-panel">
            <div className="sw-outcome-title">
              Call ended — record screening outcome for <strong>{screeningContext.candidateName}</strong>
            </div>
            <div className="sw-outcome-actions">
              <button className="ag-btn ag-btn--primary" onClick={() => handleScreeningOutcome('pass')}>✓ Pass</button>
              <button className="sw-outcome-fail-btn" onClick={() => handleScreeningOutcome('fail')}>✗ Fail</button>
              <button className="ag-btn ag-btn--ghost" onClick={() => handleScreeningOutcome(null)}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-left">
          {(callStatus === 'idle' || callStatus === 'ended') && !screeningContext && (
            <button className="report-btn" onClick={() => setView('dashboard')}>← Dashboard</button>
          )}
          {(callStatus === 'idle') && screeningContext && (
            <button className="report-btn" onClick={() => { setScreeningContext(null); setView('agentic'); }}>← Back to Session</button>
          )}
          <span className="logo">📞</span>
          <h1>Calling CoPilot</h1>
          {screeningContext && (
            <span className="sw-screening-banner">📋 {screeningContext.candidateName} · {screeningContext.roleTitle}</span>
          )}
        </div>
        <div className="header-right">
          {isAdmin && callStatus === 'idle' && (
            <button className="report-btn auto-demo-btn" onClick={runAutoDemo}>
              ▶ Auto Demo
            </button>
          )}
          {isAdmin && isAutoDemoRunning && (
            <button
              className="report-btn"
              style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}
              onClick={stopAutoDemo}
            >
              ■ Stop
            </button>
          )}
          {isSimEnded && (
            <button className="report-btn" onClick={resetDemo}>🔄 New Call</button>
          )}
          {isAdmin && <button className="report-btn" onClick={() => setShowCER(true)}>👤 Candidate Report</button>}
          {isAdmin && <button className="report-btn" onClick={() => setShowReport(true)}>📋 QA Report</button>}
          {isAdmin && <button className="report-btn" onClick={() => setShowUsers(true)}>👥 Users</button>}
          <button className="theme-toggle-btn" onClick={() => setIsLight(l => !l)}>
            {isLight ? '🌙 Dark' : '☀️ Light'}
          </button>
          <button className="report-btn" onClick={handleLogout}>Sign out</button>
          <span className={`device-status ${socketConnected ? 'ready' : 'not-ready'}`}>
            {socketConnected ? '● Connected' : '● Disconnected'}
          </span>
        </div>
      </header>

      {deviceError && <div className="error-banner">⚠️ {deviceError}</div>}

      {generatingReports && (
        <div className="error-banner" style={{ background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}>
          <span className="spinner" style={{ marginRight: 8 }} /> Generating AI reports from conversation…
        </div>
      )}

      <main className="main-content">
        {/* LEFT — always the Dialpad */}
        <div className="left-panel">
          <CallStatus status={callStatus} callingNumber={callingNumber} />
          <Dialpad
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
            onKey={handleKey}
            onBackspace={handleBackspace}
            onStartCall={startCall}
            onEndCall={isSimActive || isSimEnded ? (isAutoDemoRunning ? stopAutoDemo : resetDemo) : endCall}
            onReset={isSimEnded ? resetDemo : resetCall}
            onToggleMute={toggleMute}
            callStatus={callStatus}
            isMuted={isMuted}
          />
        </div>

        {/* CENTER — Live Transcript */}
        <div className="center-panel">
          <Transcript entries={transcript} callStatus={callStatus} callingNumber={callingNumber} />
        </div>

        {/* RIGHT — Interview Guide + AI Suggestions */}
        <div className="right-panel">
          <InterviewPanel
            transcript={transcript}
            callStatus={callStatus}
            initialJd={screeningContext?.jd}
            initialResume={screeningContext?.resume}
          />
        </div>
      </main>
    </div>
  );
}
