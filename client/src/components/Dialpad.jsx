export default function Dialpad({
  phoneNumber,
  onPhoneNumberChange,
  onKey,
  onBackspace,
  onStartCall,
  onEndCall,
  onReset,
  onToggleMute,
  callStatus,
  isMuted,
}) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const isIdle = callStatus === 'idle';
  const isConnecting = callStatus === 'connecting';
  const isInCall = callStatus === 'in-call';
  const isEnded = callStatus === 'ended';
  // Need at least + and a few digits to be dialable
  const canCall = isIdle && phoneNumber.trim().length > 4;

  return (
    <div className="dialpad-card">
      {/* Phone number display */}
      <div className="number-display">
        <input
          type="tel"
          className="number-input"
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange(e.target.value)}
          placeholder="+91 98604 30568"
          disabled={isConnecting || isInCall}
          maxLength={20}
        />
        {phoneNumber.length > 1 && isIdle && (
          <button className="backspace-btn" onClick={onBackspace} title="Backspace">
            ⌫
          </button>
        )}
      </div>

      {/* Keypad */}
      <div className="keypad">
        {keys.map((row, ri) => (
          <div key={ri} className="keypad-row">
            {row.map((key) => (
              <button
                key={key}
                className="key-btn"
                onClick={() => onKey(key)}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="action-buttons">
        {(isIdle || isConnecting) && !isEnded && (
          <button
            className="call-btn call-start"
            onClick={onStartCall}
            disabled={!canCall || isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="spinner" /> Connecting…
              </>
            ) : (
              <>📞 Call</>
            )}
          </button>
        )}

        {isInCall && (
          <div className="in-call-buttons">
            <button
              className={`call-btn mute-btn ${isMuted ? 'muted' : ''}`}
              onClick={onToggleMute}
            >
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
            <button className="call-btn call-end" onClick={onEndCall}>
              📵 Hang Up
            </button>
          </div>
        )}

        {isEnded && (
          <button className="call-btn call-reset" onClick={onReset}>
            🔄 New Call
          </button>
        )}
      </div>
    </div>
  );
}
