import { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { io } from 'socket.io-client';
import Dialpad from './components/Dialpad';
import CallStatus from './components/CallStatus';
import Transcript from './components/Transcript';
import PerCallQAReport from './components/PerCallQAReport';
import CandidateEvaluationReport from './components/CandidateEvaluationReport';
import InterviewPanel from './components/InterviewPanel';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function App() {
  const [device, setDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle | connecting | in-call | ended
  const [transcript, setTranscript] = useState([]);
  const [phoneNumber, setPhoneNumber] = useState('+');
  const [callingNumber, setCallingNumber] = useState(''); // candidate number being called
  const [deviceError, setDeviceError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showCER, setShowCER] = useState(false);
  const socketRef = useRef(null);

  // ── Socket.io connection ────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.io connected:', socket.id);
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket.io disconnected');
      setSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket.io connection error:', err.message);
      setSocketConnected(false);
    });

    socket.on('transcript', ({ text, isFinal, speaker }) => {
      setTranscript((prev) => {
        const finals = prev.filter((e) => e.isFinal);
        if (isFinal) {
          // Promote to final — drop this speaker's interim if present
          return [...finals, { text, isFinal: true, speaker }];
        }
        // Keep interims from OTHER speakers, replace only this speaker's interim
        const otherInterims = prev.filter((e) => !e.isFinal && e.speaker !== speaker);
        return [...finals, ...otherInterims, { text, isFinal: false, speaker }];
      });
    });

    socket.on('call-ended', () => {
      setCallStatus('ended');
    });

    return () => socket.disconnect();
  }, []);

  // ── Twilio Device init ──────────────────────────────────────────────────
  const initDevice = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/token`, { method: 'POST' });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || `HTTP ${res.status}`);
      }
      const { token } = await res.json();

      const dev = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'],
      });

      dev.on('error', (err) => {
        console.error('Twilio Device error:', err);
        setDeviceError(err.message || 'Device error');
      });

      setDevice(dev);
      setDeviceError('');
      console.log('Twilio Device ready');
    } catch (err) {
      console.error('Device init failed:', err.message);
      setDeviceError(err.message);
    }
  }, []);

  useEffect(() => {
    initDevice();
  }, [initDevice]);

  // ── Dialpad key press ───────────────────────────────────────────────────
  const handleKey = (key) => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      setPhoneNumber((n) => n + key);
    } else if (activeCall) {
      activeCall.sendDigits(key);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber((n) => (n.length > 1 ? n.slice(0, -1) : n));
  };

  // ── Start call ──────────────────────────────────────────────────────────
  const startCall = async () => {
    if (!device) {
      setDeviceError('Device not ready. Trying to reconnect...');
      await initDevice();
      return;
    }
    const to = phoneNumber.trim();
    if (!to || to === '+') return;

    try {
      setCallStatus('connecting');
      setCallingNumber(to);
      setTranscript([]);

      const call = await device.connect({
        params: { To: to },
      });

      setActiveCall(call);

      call.on('accept', () => {
        console.log('Call accepted');
        setCallStatus('in-call');
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        setCallStatus('ended');
        setActiveCall(null);
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        setCallStatus('idle');
        setActiveCall(null);
        setDeviceError(err.message || 'Call error');
      });

      call.on('cancel', () => {
        setCallStatus('idle');
        setActiveCall(null);
      });
    } catch (err) {
      console.error('Failed to connect:', err);
      setCallStatus('idle');
      setDeviceError(err.message || 'Failed to connect');
    }
  };

  // ── Mute toggle ─────────────────────────────────────────────────────────
  const toggleMute = () => {
    if (!activeCall) return;
    const next = !isMuted;
    activeCall.mute(next);
    setIsMuted(next);
  };

  // ── End call ────────────────────────────────────────────────────────────
  const endCall = () => {
    if (activeCall) activeCall.disconnect();
  };

  // ── Reset for new call ──────────────────────────────────────────────────
  const resetCall = () => {
    setCallStatus('idle');
    setTranscript([]);
    setPhoneNumber('+');
    setCallingNumber('');
    setDeviceError('');
    setIsMuted(false);
  };

  return (
    <div className="app">
      {showReport && (
        <div className="report-overlay">
          <div className="report-overlay-bar">
            <span className="report-overlay-title">Per-Call QA Report</span>
            <button className="report-close-btn" onClick={() => setShowReport(false)}>✕ Close</button>
          </div>
          <div className="report-overlay-body">
            <PerCallQAReport />
          </div>
        </div>
      )}

      {showCER && (
        <div className="report-overlay">
          <div className="report-overlay-bar">
            <span className="report-overlay-title">Candidate Evaluation Report</span>
            <button className="report-close-btn" onClick={() => setShowCER(false)}>✕ Close</button>
          </div>
          <div className="report-overlay-body">
            <CandidateEvaluationReport />
          </div>
        </div>
      )}
      <header className="app-header">
        <div className="header-left">
          <span className="logo">📞</span>
          <h1>Recruiter Call App</h1>
        </div>
        <div className="header-right">
          <button className="report-btn" onClick={() => setShowCER(true)}>
            👤 Candidate Report
          </button>
          <button className="report-btn" onClick={() => setShowReport(true)}>
            📋 QA Report
          </button>
          <span className={`device-status ${socketConnected ? 'ready' : 'not-ready'}`}>
            {socketConnected ? '● Connected' : '● Disconnected'}
          </span>
        </div>
      </header>

      {deviceError && (
        <div className="error-banner">
          ⚠️ {deviceError}
        </div>
      )}

      <main className="main-content">
        {/* LEFT: Dialpad + Status */}
        <div className="left-panel">
          <CallStatus status={callStatus} callingNumber={callingNumber} />

          <Dialpad
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
            onKey={handleKey}
            onBackspace={handleBackspace}
            onStartCall={startCall}
            onEndCall={endCall}
            onReset={resetCall}
            onToggleMute={toggleMute}
            callStatus={callStatus}
            isMuted={isMuted}
          />
        </div>

        {/* CENTER: Live Transcript */}
        <div className="center-panel">
          <Transcript entries={transcript} callStatus={callStatus} callingNumber={callingNumber} />
        </div>

        {/* RIGHT: Interview Guide + Live AI Suggestions */}
        <div className="right-panel">
          <InterviewPanel transcript={transcript} callStatus={callStatus} />
        </div>
      </main>
    </div>
  );
}
