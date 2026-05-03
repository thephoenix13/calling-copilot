import { useEffect, useRef } from 'react';

export default function Transcript({ entries, callStatus, callingNumber, consentGiven }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const isActive = callStatus === 'in-call' || callStatus === 'sim-call';
  const isEmpty = entries.length === 0;

  return (
    <div className="transcript-card">
      <div className="transcript-header">
        <div className="transcript-title-row">
          <h2>Live Transcript</h2>
          {callingNumber && (
            <span className="transcript-number">{callingNumber}</span>
          )}
        </div>
        {(callStatus === 'in-call' || callStatus === 'sim-call') && (
          <span className="recording-badge">● LIVE</span>
        )}
        {callStatus === 'ended' && entries.length > 0 && (
          <span className="saved-badge">✓ Saved to /transcripts</span>
        )}
      </div>

      <div className="transcript-body" ref={bodyRef}>
        {/* Consent-gated states */}
        {isActive && consentGiven === null && (
          <p className="transcript-placeholder">Waiting for consent confirmation…</p>
        )}
        {isActive && consentGiven === false && (
          <p className="transcript-placeholder transcript-placeholder--disabled">
            Transcript disabled — candidate did not consent.
          </p>
        )}

        {/* Normal idle/connecting/ended placeholders */}
        {(consentGiven !== false) && isEmpty && callStatus === 'idle' && (
          <p className="transcript-placeholder">
            Transcript will appear here once a call starts.
          </p>
        )}
        {(consentGiven !== false) && isEmpty && callStatus === 'connecting' && (
          <p className="transcript-placeholder">Waiting for call to connect…</p>
        )}
        {consentGiven === true && isEmpty && callStatus === 'in-call' && (
          <p className="transcript-placeholder">Listening… speak to see transcript</p>
        )}
        {consentGiven === true && isEmpty && (callStatus === 'sim-call' || callStatus === 'sim-ended') && (
          <p className="transcript-placeholder">Listening… speak to see transcript</p>
        )}
        {(consentGiven !== false) && isEmpty && callStatus === 'ended' && (
          <p className="transcript-placeholder">No speech was detected in this call.</p>
        )}

        {consentGiven === true && entries.map((entry, i) => (
          <div
            key={i}
            className={`transcript-entry ${entry.isFinal ? 'final' : 'interim'} speaker-${(entry.speaker || 'Candidate').toLowerCase()}`}
          >
            <span className="entry-label">{entry.speaker || 'Candidate'}</span>
            <span className="entry-text">{entry.text}</span>
          </div>
        ))}
      </div>

      {consentGiven === true && !isEmpty && (
        <div className="transcript-footer">
          {entries.filter((e) => e.isFinal).length} utterance(s) captured
        </div>
      )}
    </div>
  );
}
