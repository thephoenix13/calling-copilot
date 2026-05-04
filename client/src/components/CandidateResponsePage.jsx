import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function CandidateResponsePage() {
  const params  = new URLSearchParams(window.location.search);
  const token   = params.get('t');
  const preselect = params.get('r'); // option index from email button click

  const [state,    setState]    = useState('loading'); // loading | ready | submitting | done | error | already
  const [data,     setData]     = useState(null);
  const [selected, setSelected] = useState(preselect !== null ? Number(preselect) : null);
  const [custom,   setCustom]   = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('Invalid link.'); return; }
    fetch(`${BACKEND_URL}/pofu/respond/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.alreadyResponded) { setState('already'); setData(d); return; }
        if (d.error)            { setState('error');   setErrorMsg(d.error); return; }
        setData(d);
        setState('ready');
      })
      .catch(() => { setState('error'); setErrorMsg('Could not load this page. Please try again.'); });
  }, [token]);

  const handleSubmit = async () => {
    const response = selected !== null
      ? data.options[selected]
      : custom.trim();
    if (!response) return;

    setState('submitting');
    try {
      const res = await fetch(`${BACKEND_URL}/pofu/respond/${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ response }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setState('done');
    } catch (err) {
      setState('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="crp-page">
      <div className="crp-card">
        {/* Logo */}
        <div className="crp-logo">
          <div className="crp-logo-mark">R</div>
          <span className="crp-logo-text">RecruiterOS</span>
        </div>

        {state === 'loading' && (
          <div className="crp-center">
            <div className="crp-spinner" />
            <p className="crp-muted">Loading…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="crp-center">
            <div className="crp-icon crp-icon--error">✕</div>
            <p className="crp-body">{errorMsg}</p>
          </div>
        )}

        {state === 'already' && (
          <div className="crp-center">
            <div className="crp-icon crp-icon--done">✓</div>
            <h2 className="crp-heading">Already responded</h2>
            <p className="crp-body">
              Hi {data?.candidate_name?.split(' ')[0] || 'there'}, we've already received your response. Thank you!
            </p>
          </div>
        )}

        {state === 'done' && (
          <div className="crp-center">
            <div className="crp-icon crp-icon--done">✓</div>
            <h2 className="crp-heading">Thank you!</h2>
            <p className="crp-body">
              Your response has been received. The recruitment team will follow up if needed.
            </p>
          </div>
        )}

        {(state === 'ready' || state === 'submitting') && data && (
          <>
            <div className="crp-greeting">
              Hi {data.candidate_name?.split(' ')[0] || 'there'},
            </div>
            {data.role_title && (
              <div className="crp-role">
                {data.role_title}{data.company_name ? ` · ${data.company_name}` : ''}
              </div>
            )}
            {data.subject && (
              <div className="crp-subject">{data.subject}</div>
            )}

            <p className="crp-prompt">Please select your response:</p>

            {/* Option buttons */}
            <div className="crp-options">
              {data.options.map((opt, i) => (
                <button
                  key={i}
                  className={`crp-option${selected === i ? ' crp-option--selected' : ''}`}
                  onClick={() => { setSelected(i); setCustom(''); }}
                  disabled={state === 'submitting'}
                >
                  {selected === i && <span className="crp-option-check">✓</span>}
                  {opt}
                </button>
              ))}
            </div>

            {/* Custom message */}
            <div className="crp-or">or type your own message</div>
            <textarea
              className="crp-textarea"
              rows={3}
              placeholder="Type your message here…"
              value={custom}
              onChange={e => { setCustom(e.target.value); if (e.target.value) setSelected(null); }}
              disabled={state === 'submitting'}
            />

            <button
              className="crp-submit"
              onClick={handleSubmit}
              disabled={state === 'submitting' || (selected === null && !custom.trim())}
            >
              {state === 'submitting' ? 'Sending…' : 'Send Response →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
