import { useState, useRef } from 'react';

export default function SimChatInput({ onSend, isSending, disabled, candidateName }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const handleSend = () => {
    const msg = text.trim();
    if (!msg || isSending || disabled) return;
    onSend(msg);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Enter sends; Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="sim-chat-card">
      <div className="sim-chat-header">
        <span className="sim-chat-label">🎬 Simulation Mode</span>
        {candidateName && (
          <span className="sim-chat-candidate">Candidate: <strong>{candidateName}</strong></span>
        )}
      </div>

      <div className="sim-chat-hint">
        Type what you'd say as the recruiter. The AI candidate will respond.
      </div>

      <textarea
        ref={textareaRef}
        className="sim-chat-textarea"
        placeholder={disabled ? 'Simulation ended.' : 'e.g. Tell me about your experience with React…'}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSending}
        rows={3}
      />

      <div className="sim-chat-actions">
        {isSending && (
          <span className="sim-chat-thinking">
            <span className="spinner" /> {candidateName || 'Candidate'} is responding…
          </span>
        )}
        <button
          className="sim-send-btn"
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
        >
          Send
        </button>
      </div>
    </div>
  );
}
