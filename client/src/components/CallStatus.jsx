const STATUS_CONFIG = {
  idle: {
    label: 'Ready to call',
    color: '#6b7280',
    pulse: false,
  },
  connecting: {
    label: 'Connecting',
    color: '#f59e0b',
    pulse: true,
  },
  'in-call': {
    label: 'In call',
    color: '#10b981',
    pulse: true,
  },
  ended: {
    label: 'Call ended',
    color: '#ef4444',
    pulse: false,
  },
};

export default function CallStatus({ status, callingNumber }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;

  return (
    <div className="call-status">
      <div className="call-status-top">
        <span
          className={`status-dot ${config.pulse ? 'pulse' : ''}`}
          style={{ background: config.color }}
        />
        <span className="status-label" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>

      {callingNumber && (status === 'connecting' || status === 'in-call' || status === 'ended') && (
        <div className="call-parties">
          <div className="party">
            <span className="party-role">Recruiter</span>
            <span className="party-name">You</span>
          </div>
          <span className="call-arrow">→</span>
          <div className="party">
            <span className="party-role">Candidate</span>
            <span className="party-name">{callingNumber}</span>
          </div>
        </div>
      )}
    </div>
  );
}
