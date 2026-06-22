import { useState, useEffect, useRef, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function InterviewPanel({ transcript, callStatus, initialJd, initialResume, consentGiven }) {
  // ── JD / Resume inputs ───────────────────────────────────────────────────
  const [jdText, setJdText] = useState(initialJd || '');
  const [resumeText, setResumeText] = useState(initialResume || '');
  const [jdFile, setJdFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);

  // ── Generated questions ──────────────────────────────────────────────────
  const [sections, setSections] = useState([]);
  const [claims, setClaims] = useState([]);   // Candidate Intelligence Map (IDF Feature 1)
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [checkedQuestions, setCheckedQuestions] = useState(new Set());
  const [currentQuestion, setCurrentQuestion] = useState('');

  // ── Live suggestions ─────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimerRef = useRef(null);
  const lastTranscriptLen = useRef(0);

  // ── Collapsed sections ───────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(new Set());

  // ── Auto-collapse inputs when suggestions arrive ─────────────────────────
  const [inputsCollapsed, setInputsCollapsed] = useState(false);
  const autoCollapsedRef = useRef(false);

  useEffect(() => {
    if (suggestions.length > 0 && !autoCollapsedRef.current) {
      autoCollapsedRef.current = true;
      setInputsCollapsed(true);
    }
  }, [suggestions]);

  // ── Generate questions ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setGenError('');
    setSections([]);
    try {
      const fd = new FormData();
      if (jdFile) fd.append('jdFile', jdFile);
      else fd.append('jdText', jdText);
      if (resumeFile) fd.append('resumeFile', resumeFile);
      else fd.append('resumeText', resumeText);

      const res = await fetch(`${BACKEND_URL}/ai/generate-questions`, { method: 'POST', body: fd });
      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        const msg = ct.includes('json')
          ? (await res.json()).error
          : await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSections(data.sections || []);
      setClaims(Array.isArray(data.claims) ? data.claims : []);
      setCheckedQuestions(new Set());
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Live suggestions: debounce on transcript updates ────────────────────
  const fetchSuggestions = useCallback(async () => {
    if (callStatus !== 'in-call' && callStatus !== 'sim-call' && callStatus !== 'sim-ended' && callStatus !== 'ended') return;
    const finalTranscript = transcript.filter(e => e.isFinal !== false);
    if (finalTranscript.length === 0) return;
    setSuggestLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: finalTranscript, currentQuestion, jd: jdText, resume: resumeText, claims }),
      });
      if (!res.ok) return;
      const { suggestions: s } = await res.json();
      setSuggestions(s || []);
    } catch (_) {
      // silently ignore
    } finally {
      setSuggestLoading(false);
    }
  }, [transcript, currentQuestion, callStatus, jdText, resumeText, claims]);

  useEffect(() => {
    // Only trigger when new final Candidate lines appear
    const newCandidateLines = transcript.filter(
      e => e.isFinal !== false && e.speaker === 'Candidate'
    ).length;

    if (newCandidateLines === lastTranscriptLen.current) return;
    lastTranscriptLen.current = newCandidateLines;

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    // ~1s debounce — long enough to coalesce in-flight chunks,
    // short enough to fire before the recruiter starts the next question.
    suggestTimerRef.current = setTimeout(fetchSuggestions, 1000);
    // No cleanup here on purpose: cleanup runs on EVERY transcript change
    // (including recruiter typing the next question) which would cancel the
    // pending fetch. The timer is cleared only when a newer candidate line
    // arrives or the component unmounts (handled by the unmount-only effect).
  }, [transcript, fetchSuggestions]);

  // Clear any pending timer only when the panel unmounts.
  useEffect(() => () => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
  }, []);

  // ── Toggle section collapse ──────────────────────────────────────────────
  const toggleSection = (i) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // ── Toggle question checked ──────────────────────────────────────────────
  const toggleCheck = (key) => {
    setCheckedQuestions(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Mark question as "currently being discussed" ─────────────────────────
  const setActive = (q) => {
    setCurrentQuestion(prev => prev === q ? '' : q);
  };

  const hasInputs = jdText.trim() || resumeText.trim() || jdFile || resumeFile;

  return (
    <div className="interview-panel">
      {/* ── Header ── */}
      <div className="ip-header">
        <span className="ip-title">🧭 Interview Guide</span>
        {inputsCollapsed ? (
          <button className="ip-inputs-toggle" onClick={() => setInputsCollapsed(false)}>
            ＋ JD / Resume
          </button>
        ) : (
          <button className="ip-inputs-toggle ip-inputs-toggle--collapse" onClick={() => setInputsCollapsed(true)}>
            − Hide
          </button>
        )}
      </div>

      {/* ── JD + Resume inputs ── */}
      <div className={`ip-inputs${inputsCollapsed ? ' ip-inputs--hidden' : ''}`}>
        <div className="ip-input-group">
          <label className="ip-label">Job Description</label>
          <textarea
            className="ip-textarea"
            placeholder="Paste JD here…"
            value={jdText}
            onChange={e => { setJdText(e.target.value); setJdFile(null); }}
            rows={4}
          />
          <div className="ip-or-row">
            <span className="ip-or-text">or upload file (PDF / TXT)</span>
            <label className="ip-file-label">
              {jdFile ? `📄 ${jdFile.name}` : '+ Upload'}
              <input
                type="file"
                accept=".pdf,.txt"
                style={{ display: 'none' }}
                onChange={e => { setJdFile(e.target.files[0] || null); setJdText(''); }}
              />
            </label>
          </div>
        </div>

        <div className="ip-input-group">
          <label className="ip-label">Candidate Resume</label>
          <textarea
            className="ip-textarea"
            placeholder="Paste resume here…"
            value={resumeText}
            onChange={e => { setResumeText(e.target.value); setResumeFile(null); }}
            rows={4}
          />
          <div className="ip-or-row">
            <span className="ip-or-text">or upload file (PDF / TXT)</span>
            <label className="ip-file-label">
              {resumeFile ? `📄 ${resumeFile.name}` : '+ Upload'}
              <input
                type="file"
                accept=".pdf,.txt"
                style={{ display: 'none' }}
                onChange={e => { setResumeFile(e.target.files[0] || null); setResumeText(''); }}
              />
            </label>
          </div>
        </div>

        {genError && <div className="ip-error">{genError}</div>}

        <button
          className="ip-generate-btn"
          onClick={handleGenerate}
          disabled={generating || !hasInputs}
        >
          {generating ? <><span className="spinner" />  Generating…</> : '✨ Generate Interview Questions'}
        </button>
      </div>

      {/* ── Generated questions ── */}
      {sections.length > 0 && (
        <div className="ip-questions">
          <div className="ip-section-header-row">
            <span className="ip-section-count">{sections.length} sections</span>
            <span className="ip-checked-count">
              {checkedQuestions.size} / {sections.reduce((a, s) => a + s.questions.length, 0)} asked
            </span>
          </div>
          {sections.map((sec, si) => (
            <div key={si} className="ip-section">
              <button className="ip-section-title" onClick={() => toggleSection(si)}>
                <span>{collapsed.has(si) ? '▶' : '▼'} {sec.title}</span>
                <span className="ip-section-badge">{sec.questions.length}</span>
              </button>
              {!collapsed.has(si) && (
                <ul className="ip-question-list">
                  {sec.questions.map((q, qi) => {
                    const key = `${si}-${qi}`;
                    const isChecked = checkedQuestions.has(key);
                    const isActive = currentQuestion === q;
                    return (
                      <li key={key} className={`ip-question-item ${isChecked ? 'checked' : ''} ${isActive ? 'active' : ''}`}>
                        <button className="ip-check-btn" onClick={() => toggleCheck(key)} title="Mark as asked">
                          {isChecked ? '✓' : '○'}
                        </button>
                        <span className="ip-question-text">{q}</span>
                        <button
                          className={`ip-active-btn ${isActive ? 'is-active' : ''}`}
                          onClick={() => setActive(q)}
                          title={isActive ? 'Unset as current' : 'Set as current question'}
                        >
                          {isActive ? '🎯' : '→'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Live AI Suggestions — only shown when consent is given ── */}
      <div className="ip-suggestions" style={consentGiven === false ? { opacity: 0.4, pointerEvents: 'none' } : {}}>
        <div className="ip-suggestions-header">
          <span className="ip-suggestions-title">💡 Live AI Suggestions</span>
          {suggestLoading && <span className="ip-suggest-loading">thinking…</span>}
        </div>
        {currentQuestion && (
          <div className="ip-current-q">
            <span className="ip-current-q-label">Current:</span> {currentQuestion}
          </div>
        )}
        {suggestions.length === 0 && !suggestLoading && (
          <div className="ip-suggestions-empty">
            {callStatus === 'in-call'
              ? 'Suggestions will appear as the candidate speaks…'
              : callStatus === 'sim-call'
              ? 'Suggestions will appear as the candidate responds…'
              : 'Start a call to see live suggestions.'}
          </div>
        )}
        {suggestions.map((s, i) => {
          const text   = typeof s === 'string' ? s : (s?.question || '');
          const type   = typeof s === 'object' && s ? s.type : null;
          const reason = typeof s === 'object' && s ? s.reason : '';
          const claim  = typeof s === 'object' && s ? s.claim_tested : null;
          const typeLabel = { cross_check: 'Cross-check', drill_down: 'Drill down', scenario: 'Scenario' }[type] || null;
          return (
            <div key={i} className="ip-suggestion-item">
              <span className="ip-suggestion-num">{i + 1}</span>
              <div className="ip-suggestion-body">
                <span className="ip-suggestion-text">{text}</span>
                {(typeLabel || claim || reason) && (
                  <div className="ip-suggestion-meta">
                    {typeLabel && <span className={`ip-probe-tag ip-probe-${type}`}>{typeLabel}</span>}
                    {claim && <span className="ip-probe-claim">tests: {claim}</span>}
                    {reason && <span className="ip-probe-reason">{reason}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
