import { useState, useEffect, useRef, useCallback } from 'react';

const BACKEND_URL = 'http://localhost:3000';

export default function InterviewPanel({ transcript, callStatus }) {
  // ── JD / Resume inputs ───────────────────────────────────────────────────
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [jdFile, setJdFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);

  // ── Generated questions ──────────────────────────────────────────────────
  const [sections, setSections] = useState([]);
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
      setCheckedQuestions(new Set());
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Live suggestions: debounce on transcript updates ────────────────────
  const fetchSuggestions = useCallback(async () => {
    if (callStatus !== 'in-call' && callStatus !== 'ended') return;
    const finalTranscript = transcript.filter(e => e.isFinal !== false);
    if (finalTranscript.length === 0) return;
    setSuggestLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: finalTranscript, currentQuestion }),
      });
      if (!res.ok) return;
      const { suggestions: s } = await res.json();
      setSuggestions(s || []);
    } catch (_) {
      // silently ignore
    } finally {
      setSuggestLoading(false);
    }
  }, [transcript, currentQuestion, callStatus]);

  useEffect(() => {
    const finalCount = transcript.filter(e => e.isFinal !== false).length;
    // Only trigger when new final Candidate lines appear
    const newCandidateLines = transcript.filter(
      e => e.isFinal !== false && e.speaker === 'Candidate'
    ).length;

    if (newCandidateLines === lastTranscriptLen.current) return;
    lastTranscriptLen.current = newCandidateLines;

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    // 2 second debounce so we don't hammer the API mid-sentence
    suggestTimerRef.current = setTimeout(fetchSuggestions, 2000);
    return () => clearTimeout(suggestTimerRef.current);
  }, [transcript, fetchSuggestions]);

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
      </div>

      {/* ── JD + Resume inputs ── */}
      <div className="ip-inputs">
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

      {/* ── Live AI Suggestions ── */}
      <div className="ip-suggestions">
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
              : 'Start a call to see live suggestions.'}
          </div>
        )}
        {suggestions.map((s, i) => (
          <div key={i} className="ip-suggestion-item">
            <span className="ip-suggestion-num">{i + 1}</span>
            <span className="ip-suggestion-text">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
