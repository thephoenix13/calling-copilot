import { useState, useRef, useEffect } from 'react';

export default function VideoRecorder({ onRecordingComplete, maxDuration = 300, headerContent }) {
  const [isRecording,  setIsRecording]  = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedUrl,  setRecordedUrl]  = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [time,         setTime]         = useState(0);
  const [cameraError,  setCameraError]  = useState('');
  const [hasStream,    setHasStream]    = useState(false);

  const videoRef     = useRef(null);
  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const streamRef    = useRef(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      streamRef.current = stream;
      setHasStream(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError('Unable to access camera/microphone. Please check permissions.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    const mr = new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond: 500000 });

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url  = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      setIsPreviewing(true);
      onRecordingComplete(blob);
    };

    mediaRecRef.current = mr;
    mr.start();
    setIsRecording(true);
    setTime(0);

    timerRef.current = setInterval(() => {
      setTime(prev => {
        const next = prev + 1;
        if (next >= maxDuration) stopRecording();
        return next;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecRef.current && isRecording) {
      mediaRecRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleRetry = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedBlob(null);
    setIsPreviewing(false);
    setTime(0);
    onRecordingComplete(null);
    startCamera();
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (cameraError) {
    return (
      <div className="vi-recorder-error">
        <span>⚠️</span>
        <p>{cameraError}</p>
      </div>
    );
  }

  return (
    <div className="vi-recorder vi-recorder--split">
      {/* LEFT: Controls */}
      <div className="vi-rec-controls-panel">
        {isPreviewing ? (
          <>
            <div className="vi-rec-status-indicator vi-rec-status-indicator--ok">
              <span className="vi-rec-status-dot" />
              Answer recorded
            </div>
            <p className="vi-rec-tip">Your response has been saved. You can re-record if needed.</p>
            <button className="vi-rec-btn vi-rec-btn--retry" onClick={handleRetry}>
              ↺ Re-record
            </button>
          </>
        ) : (
          <>
            {isRecording && (
              <div className="vi-rec-status-indicator vi-rec-status-indicator--recording">
                <span className="vi-rec-dot" />
                Recording — {fmt(time)}
              </div>
            )}
            {!isRecording ? (
              <button className="vi-rec-btn vi-rec-btn--start" onClick={startRecording} disabled={!hasStream}>
                ● Start Recording
              </button>
            ) : (
              <button className="vi-rec-btn vi-rec-btn--stop" onClick={stopRecording}>
                ■ Stop Recording
              </button>
            )}
            <p className="vi-rec-tip">Max duration: {fmt(maxDuration)}</p>
          </>
        )}
      </div>

      {/* RIGHT: Header content (question) + video */}
      <div className="vi-rec-video-panel">
        {headerContent && <div className="vi-rec-header-slot">{headerContent}</div>}
        {isPreviewing && recordedUrl ? (
          <video className="vi-recorder-video vi-recorder-video--playback" src={recordedUrl} controls playsInline />
        ) : (
          <div className="vi-recorder-preview">
            <video ref={videoRef} autoPlay muted playsInline className="vi-recorder-video" />
            {isRecording && (
              <div className="vi-rec-timer">
                <span className="vi-rec-dot" />
                {fmt(time)} / {fmt(maxDuration)}
              </div>
            )}
            {!hasStream && !cameraError && <div className="vi-rec-loading">Initializing camera…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
