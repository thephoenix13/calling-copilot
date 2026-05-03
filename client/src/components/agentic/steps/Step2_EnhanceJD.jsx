import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FormattedJDTab, RecruiterBriefTab, ClarificationsTab,
  ReachoutTab, KeywordsTab, MarketIntelligenceTab, DownloadDialog, stripMarkers,
  tryParse, CATEGORY_LABELS,
} from '../JDEnhancerTabs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const LS_SCRIPT_KEY = 'jde_company_script';

const TABS = [
  { key: 'jd',        label: 'Formatted JD',   field: 'formattedJD',            editable: true  },
  { key: 'brief',     label: 'Recruiter Brief', field: 'recruiterBrief',         editable: true  },
  { key: 'questions', label: 'Clarifications',  field: 'clarificationQuestions', editable: false },
  { key: 'reachout',  label: 'Reachout',        field: 'reachoutMaterial',       editable: true  },
  { key: 'keywords',  label: 'Keywords',        field: 'sourcingKeywords',       editable: false },
  { key: 'market',    label: 'Market Intel',    field: 'marketIntelligence',     editable: false },
];

const LOADING_STEPS = [
  'Parsing job details…',
  'Writing formatted job description…',
  'Preparing recruiter brief…',
  'Generating clarification questions…',
  'Creating reachout material…',
  'Building sourcing keywords…',
  'Finalising output…',
];

const MANUAL_PLACEHOLDERS = {
  jd:        'e.g., "Make the tone more startup-friendly" or "Emphasise remote-first culture"',
  brief:     'e.g., "Focus on non-technical recruiter audience" or "Add more context about the client industry"',
  questions: 'e.g., "Add more questions about leadership experience" or "Focus on cloud infrastructure questions"',
  reachout:  'e.g., "Make the WhatsApp message shorter and punchier" or "Emphasise the equity component"',
  keywords:  'e.g., "Add more React/Next.js variations" or "Include fintech-specific Boolean strings"',
};

export default function Step2_EnhanceJD({ session, authFetch, onComplete }) {
  const job = session.job;
  if (!job) return (
    <div className="sw-step-page">
      <p className="ag-empty">No job selected. Please go back to Step 1.</p>
    </div>
  );

  // ── View state ─────────────────────────────────────────────────────────────
  const hasExisting = !!session.enhancement_data;
  const [view,         setView]         = useState(hasExisting ? 'results' : 'prompt');
  const [loadingStep,  setLoadingStep]  = useState(0);
  const [loadingError, setLoadingError] = useState('');

  // ── Input state ────────────────────────────────────────────────────────────
  const [clientNotes,   setClientNotes]   = useState('');
  const [companyScript, setCompanyScript] = useState(() => localStorage.getItem(LS_SCRIPT_KEY) || '');
  const [showScript,    setShowScript]    = useState(false);

  useEffect(() => { localStorage.setItem(LS_SCRIPT_KEY, companyScript); }, [companyScript]);

  // ── Results state ──────────────────────────────────────────────────────────
  const [results,      setResults]      = useState(session.enhancement_data || {});
  const [activeTab,    setActiveTab]    = useState('jd');
  const [editingTab,   setEditingTab]   = useState(null);
  const [editDraft,    setEditDraft]    = useState('');
  const [regenerating, setRegenerating] = useState({});

  // parsedJob = the session's job object (already structured — no parse_fields needed)
  const parsedJob = job;

  // ── Manual instructions modal ──────────────────────────────────────────────
  const [manualInputTab,   setManualInputTab]   = useState(null);
  const [manualInputDraft, setManualInputDraft] = useState('');

  // ── Qualification flow ─────────────────────────────────────────────────────
  const [clarResponses,      setClarResponses]      = useState({});
  const [clarSavedResponses, setClarSavedResponses] = useState({});
  const [regenQuestions,     setRegenQuestions]     = useState({});
  const [qualifying,         setQualifying]         = useState(false);
  const [qualified,          setQualified]          = useState(false);

  useEffect(() => {
    const parsed = tryParse(results.clarificationQuestions);
    if (!parsed || typeof parsed !== 'object') return;
    setClarResponses(prev => {
      const next = {};
      Object.keys(CATEGORY_LABELS).forEach(key => {
        const qs = parsed[key] || [];
        next[key] = qs.map((q, i) => prev[key]?.[i] ?? q.response ?? '');
      });
      return next;
    });
  }, [results.clarificationQuestions]);

  // ── Save & Continue ────────────────────────────────────────────────────────
  const [continuing, setContinuing] = useState(false);

  const handleSaveAndContinue = async () => {
    if (!Object.keys(results).length) return;
    setContinuing(true);
    try {
      await onComplete({ enhancement_data: results, enhancement_saved: 1 }, 3);
    } finally {
      setContinuing(false);
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const [showDownload, setShowDownload] = useState(false);
  const saveTitle = `${job.title}${job.client_name ? ` — ${job.client_name}` : ''}`;

  // ── Generate all assets ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setView('loading');
    setLoadingStep(0);
    setLoadingError('');
    const timer = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 7000);
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          clientNotes: clientNotes || undefined,
          companyScript: companyScript || undefined,
        }),
      });
      if (!res.ok) throw new Error('Asset generation failed.');
      const data = await res.json();
      setResults(data);
      setActiveTab('jd');
      setEditingTab(null);
      setQualified(false);
      setView('results');
    } catch (err) {
      setLoadingError(err.message || 'Generation failed. Please try again.');
      setView('prompt');
    } finally {
      clearInterval(timer);
    }
  };

  // ── Regenerate single tab ──────────────────────────────────────────────────
  const handleRegenerate = useCallback(async (tabKey, manualInput) => {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab) return;
    setRegenerating(r => ({ ...r, [tabKey]: true }));
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: parsedJob,
          clientNotes: clientNotes || undefined,
          companyScript: companyScript || undefined,
          fields: [tab.field],
          manualInput: manualInput || undefined,
        }),
      });
      const data = await res.json();
      if (data[tab.field] !== undefined) {
        setResults(r => ({ ...r, [tab.field]: data[tab.field] }));
        if (editingTab === tabKey) setEditingTab(null);
      }
    } catch (err) {
      console.error('Regenerate error:', err);
    } finally {
      setRegenerating(r => ({ ...r, [tabKey]: false }));
    }
  }, [parsedJob, clientNotes, companyScript, editingTab, authFetch]);

  const handleManualRegenerate = () => {
    const tab   = manualInputTab;
    const input = manualInputDraft.trim();
    setManualInputTab(null);
    setManualInputDraft('');
    handleRegenerate(tab, input);
  };

  // ── Market intelligence ────────────────────────────────────────────────────
  const handleGenerateMarketIntel = useCallback(async () => {
    setRegenerating(r => ({ ...r, market: true }));
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: parsedJob, fields: ['marketIntelligence'] }),
      });
      const data = await res.json();
      if (data.marketIntelligence !== undefined) {
        setResults(r => ({ ...r, marketIntelligence: data.marketIntelligence }));
      }
    } catch (err) {
      console.error('Market intel error:', err);
    } finally {
      setRegenerating(r => ({ ...r, market: false }));
    }
  }, [parsedJob, authFetch]);

  // ── Inline edit ────────────────────────────────────────────────────────────
  const startEdit = (tabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    const content = results[tab.field];
    let draft = '';
    if (typeof content === 'string') {
      draft = stripMarkers(content);
    } else if (content && typeof content === 'object') {
      const { whatsapp, linkedin, pitch } = content;
      draft = [
        whatsapp ? `WhatsApp:\n${whatsapp}` : '',
        linkedin ? `LinkedIn:\n${linkedin}` : '',
        pitch    ? `Call Pitch:\n${pitch}`   : '',
      ].filter(Boolean).join('\n\n---\n\n');
    }
    setEditDraft(draft);
    setEditingTab(tabKey);
  };

  const saveEdit = (tabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    setResults(r => ({ ...r, [tab.field]: editDraft }));
    setEditingTab(null);
  };

  // ── Copy ───────────────────────────────────────────────────────────────────
  const copyTab = (tabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    const content = results[tab.field];
    const text = typeof content === 'string'
      ? stripMarkers(content)
      : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // ── Clarification save / regen ─────────────────────────────────────────────
  const handleSaveResponse = useCallback((category, idx, value) => {
    setClarSavedResponses(r => ({
      ...r,
      [category]: Object.assign([...(r[category] || [])], { [idx]: value }),
    }));
  }, []);

  const handleRegenQuestion = useCallback(async (category, idx, question, rationale) => {
    const loadKey = `${category}-${idx}`;
    setRegenQuestions(r => ({ ...r, [loadKey]: true }));
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd/regen-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: parsedJob, category, questionIndex: idx, question, rationale }),
      });
      const data = await res.json();
      if (data.question) {
        setResults(r => {
          const cq = tryParse(r.clarificationQuestions);
          if (!cq || !cq[category]) return r;
          const updated = { ...cq, [category]: [...cq[category]] };
          updated[category][idx] = {
            ...updated[category][idx],
            question: data.question,
            rationale: data.rationale || updated[category][idx].rationale,
          };
          return { ...r, clarificationQuestions: updated };
        });
      }
    } catch (err) {
      console.error('regen-question error:', err);
    } finally {
      setRegenQuestions(r => ({ ...r, [loadKey]: false }));
    }
  }, [parsedJob, authFetch]);

  // ── Qualify & Refresh ──────────────────────────────────────────────────────
  const handleQualifyAndRefresh = useCallback(async () => {
    setQualifying(true);
    const parsed = tryParse(results.clarificationQuestions);
    const qaLines = [];
    if (parsed) {
      Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
        (parsed[key] || []).forEach((q, i) => {
          const response = clarSavedResponses[key]?.[i];
          if (response?.trim()) {
            qaLines.push(`[${label}] Q: ${q.question}`);
            qaLines.push(`A: ${response}`);
            qaLines.push('');
          }
        });
      });
    }
    const qaNotes = qaLines.length > 0 ? `Qualification Call Q&A:\n${qaLines.join('\n')}` : '';
    const combinedNotes = [clientNotes, qaNotes].filter(Boolean).join('\n\n');
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: parsedJob,
          clientNotes: combinedNotes || undefined,
          companyScript: companyScript || undefined,
        }),
      });
      if (!res.ok) throw new Error('Refresh failed.');
      const data = await res.json();
      setResults(r => ({ ...r, ...data }));
      setQualified(true);
      if (session.job_id) {
        await authFetch(`${BACKEND_URL}/jobs/${session.job_id}/qualify`, { method: 'PATCH' }).catch(() => {});
      }
    } catch (err) {
      console.error('qualify error:', err);
    } finally {
      setQualifying(false);
    }
  }, [parsedJob, clientNotes, companyScript, results.clarificationQuestions, clarSavedResponses, session.job_id, authFetch]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeTabObj  = TABS.find(t => t.key === activeTab);
  const activeContent = results[activeTabObj?.field];

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'loading') {
    return (
      <div className="sw-step-page">
        <div className="jde-loading-page" style={{ minHeight: 'auto', padding: '48px 24px' }}>
          <div className="jde-loading-card">
            <div className="jde-spinner" />
            <div className="jde-loading-step">{LOADING_STEPS[loadingStep]}</div>
            <div className="jde-progress-dots">
              {TABS.slice(0, 5).map((_, i) => (
                <div key={i} className={`jde-dot${loadingStep > i ? ' jde-dot--done' : loadingStep === i + 1 ? ' jde-dot--active' : ''}`} />
              ))}
            </div>
            <p className="jde-loading-hint">Generating 5 recruitment assets — ~40–60 seconds.</p>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROMPT (no results yet)
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'prompt') {
    return (
      <div className="sw-step-page">
        <div className="sw-step-header">
          <h2 className="sw-step-title">Step 2 — Enhance JD</h2>
          <p className="sw-step-desc">Generate 5 AI recruitment assets from the selected job's details.</p>
        </div>
        <div className="sw-content-card">
          <div className="sw-job-chip">
            <strong>{job.title}</strong>
            {job.client_name && ` — ${job.client_name}`}
            {job.location && ` · ${job.location}`}
          </div>

          {loadingError && <div className="jde-error-banner">⚠ {loadingError}</div>}

          <div className="ag-field" style={{ marginTop: 16 }}>
            <label className="ag-field-label">
              Client Notes <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional — highlighted in output)</span>
            </label>
            <textarea
              className="ag-textarea"
              value={clientNotes}
              onChange={e => setClientNotes(e.target.value)}
              placeholder="Any extra notes from the client, e.g. 'Must have WordPress experience' or 'Remote-first, no relocation'…"
              rows={3}
            />
          </div>

          <div className="jde-script-section" style={{ marginTop: 8 }}>
            <button className="jde-script-toggle" onClick={() => setShowScript(s => !s)}>
              <span className="jde-script-arrow">{showScript ? '▼' : '▶'}</span>
              Company Intro Script
              {companyScript
                ? <span className="jde-script-badge jde-script-badge--set">set</span>
                : <span className="jde-script-badge">not set</span>}
            </button>
            {showScript && (
              <div className="jde-script-body">
                <p className="jde-script-hint">Used verbatim in WhatsApp/LinkedIn messages and the call pitch. Saved across sessions.</p>
                <textarea
                  className="ag-textarea"
                  value={companyScript}
                  onChange={e => setCompanyScript(e.target.value)}
                  placeholder="e.g., 'Hi, I'm reaching out from RecruiterOS, a recruitment firm specialising in tech roles across India…'"
                  rows={4}
                />
              </div>
            )}
          </div>

          <div className="sw-step-actions" style={{ marginTop: 20 }}>
            <button className="ag-btn ag-btn--primary" onClick={handleGenerate}>
              ✨ Generate Assets
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESULTS — full-featured view
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="sw-step-page sw-step-page--results">

      {/* Header */}
      <div className="sw-enhance-header">
        <div className="sw-step-header" style={{ margin: 0 }}>
          <h2 className="sw-step-title">Step 2 — Enhance JD</h2>
          <div className="sw-job-chip">
            {job.title}{job.client_name ? ` — ${job.client_name}` : ''}
          </div>
        </div>
        <div className="sw-enhance-actions">
          <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setShowDownload(true)}>
            ⬇ Download
          </button>
          <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={handleGenerate}>
            ⟳ Regenerate All
          </button>
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleSaveAndContinue}
            disabled={continuing}
          >
            {continuing ? 'Saving…' : session.enhancement_saved ? '✓ Saved — Continue →' : '💾 Save & Continue →'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="jde-tab-bar" style={{ padding: '8px 0 0', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`jde-tab-btn${activeTab === tab.key ? ' jde-tab-btn--active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setEditingTab(null); }}
          >
            {tab.label}
            {results[tab.field] == null && tab.key !== 'market' && (
              <span className="jde-tab-missing">⚠</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab toolbar */}
      <div className="jde-tab-toolbar">
        <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => copyTab(activeTab)}>
          📋 Copy
        </button>
        {activeTabObj?.editable && editingTab !== activeTab && (
          <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => startEdit(activeTab)}>
            ✏️ Edit
          </button>
        )}
        {editingTab === activeTab && (
          <>
            <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={() => saveEdit(activeTab)}>✓ Save Edit</button>
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setEditingTab(null)}>✗ Cancel</button>
          </>
        )}
        <button
          className="ag-btn ag-btn--ghost ag-btn--sm"
          onClick={() => { setManualInputTab(activeTab); setManualInputDraft(''); }}
          title="Regenerate with extra instructions"
        >
          + Instructions
        </button>
        <button
          className="ag-btn ag-btn--ghost ag-btn--sm jde-regen-btn"
          onClick={() => handleRegenerate(activeTab, '')}
          disabled={!!regenerating[activeTab]}
        >
          {regenerating[activeTab] ? '⟳ Regenerating…' : '⟳ Regenerate'}
        </button>
      </div>

      {/* Qualify bar — Clarifications tab only */}
      {activeTab === 'questions' && (() => {
        const hasSaved = Object.values(clarSavedResponses).some(
          arr => Array.isArray(arr) && arr.some(v => v?.trim())
        );
        return (
          <div className="jde-qualify-bar">
            <div className="jde-qualify-bar-text">
              {qualified
                ? '✓ Qualified — all assets refreshed with saved client responses.'
                : hasSaved
                  ? 'You have saved responses. Click to refresh all assets with this context.'
                  : 'Save at least one client response above to enable qualification.'}
            </div>
            <button
              className={`ag-btn ag-btn--sm jde-qualify-btn${qualified ? ' jde-qualify-btn--done' : ''}`}
              onClick={handleQualifyAndRefresh}
              disabled={qualifying || !hasSaved}
            >
              {qualifying ? '⟳ Refreshing All Assets…' : qualified ? '✓ Refresh Again' : '✓ Mark as Qualified & Refresh All'}
            </button>
          </div>
        );
      })()}

      {/* Tab content */}
      <div className="jde-tab-content">
        {activeTab === 'jd' && (
          <FormattedJDTab
            content={activeContent}
            editing={editingTab === 'jd'}
            editDraft={editDraft}
            onEditChange={setEditDraft}
          />
        )}
        {activeTab === 'brief' && (
          <RecruiterBriefTab
            content={activeContent}
            editing={editingTab === 'brief'}
            editDraft={editDraft}
            onEditChange={setEditDraft}
          />
        )}
        {activeTab === 'questions' && (
          <ClarificationsTab
            content={activeContent}
            responses={clarResponses}
            onResponseChange={(cat, idx, val) =>
              setClarResponses(r => ({ ...r, [cat]: Object.assign([...(r[cat] || [])], { [idx]: val }) }))
            }
            savedResponses={clarSavedResponses}
            onSaveResponse={handleSaveResponse}
            onRegenQuestion={handleRegenQuestion}
            regenQuestions={regenQuestions}
          />
        )}
        {activeTab === 'reachout' && (
          <ReachoutTab
            content={activeContent}
            editing={editingTab === 'reachout'}
            editDraft={editDraft}
            onEditChange={setEditDraft}
          />
        )}
        {activeTab === 'keywords' && <KeywordsTab content={activeContent} />}
        {activeTab === 'market' && (
          <MarketIntelligenceTab
            content={activeContent}
            onGenerate={handleGenerateMarketIntel}
            generating={!!regenerating.market}
          />
        )}
      </div>

      {/* Manual instructions modal */}
      {manualInputTab && (
        <div className="ag-modal-overlay" onClick={() => setManualInputTab(null)}>
          <div className="ag-modal jde-manual-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">
              Instructions — {TABS.find(t => t.key === manualInputTab)?.label}
            </h3>
            <p className="jde-manual-hint">Add specific instructions to guide this asset's regeneration.</p>
            <textarea
              className="ag-textarea jde-manual-textarea"
              value={manualInputDraft}
              onChange={e => setManualInputDraft(e.target.value)}
              placeholder={MANUAL_PLACEHOLDERS[manualInputTab] || 'Enter additional instructions…'}
              rows={4}
              autoFocus
            />
            <div className="jde-manual-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setManualInputTab(null)}>Cancel</button>
              <button
                className="ag-btn ag-btn--primary"
                onClick={handleManualRegenerate}
                disabled={!manualInputDraft.trim()}
              >
                ⟳ Regenerate with Instructions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download dialog */}
      {showDownload && (
        <DownloadDialog
          activeTab={activeTab}
          results={results}
          saveTitle={saveTitle}
          onClose={() => setShowDownload(false)}
        />
      )}
    </div>
  );
}
