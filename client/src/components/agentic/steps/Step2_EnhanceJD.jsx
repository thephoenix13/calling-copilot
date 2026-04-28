import { useState } from 'react';
import {
  FormattedJDTab, RecruiterBriefTab, ClarificationsTab,
  ReachoutTab, KeywordsTab, stripMarkers,
} from '../JDEnhancerTabs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const TABS = [
  { key: 'jd',        label: 'Formatted JD',   field: 'formattedJD'            },
  { key: 'brief',     label: 'Recruiter Brief', field: 'recruiterBrief'         },
  { key: 'questions', label: 'Clarifications',  field: 'clarificationQuestions' },
  { key: 'reachout',  label: 'Reachout',        field: 'reachoutMaterial'       },
  { key: 'keywords',  label: 'Keywords',        field: 'sourcingKeywords'       },
];

const LOADING_STEPS = [
  'Parsing job details…',
  'Writing formatted JD…',
  'Preparing recruiter brief…',
  'Generating clarification questions…',
  'Creating reachout material…',
  'Building sourcing keywords…',
];

export default function Step2_EnhanceJD({ session, authFetch, onComplete }) {
  const existingData = session.enhancement_data;

  const [results, setResults]     = useState(existingData || null);
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState('jd');
  const [clientNotes, setClientNotes] = useState('');
  const [saving, setSaving]       = useState(false);

  const job = session.job;
  if (!job) return <div className="sw-step-page"><p className="ag-empty">No job selected. Please go back to Step 1.</p></div>;

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setLoadingStep(0);

    const timer = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 7000);

    try {
      const res  = await authFetch(`${BACKEND_URL}/enhance-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          clientNotes: clientNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Generation failed.');
      const data = await res.json();
      setResults(data);
      setActiveTab('jd');
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!results) return;
    setSaving(true);
    try {
      await onComplete({ enhancement_data: results, enhancement_saved: 1 }, 3);
    } finally {
      setSaving(false);
    }
  };

  const copyTab = (tabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    const content = results?.[tab.field];
    const text = typeof content === 'string' ? stripMarkers(content) : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (generating) {
    return (
      <div className="sw-step-page">
        <div className="jde-loading-page" style={{ minHeight: 'auto', padding: '48px 24px' }}>
          <div className="jde-loading-card">
            <div className="jde-spinner" />
            <div className="jde-loading-step">{LOADING_STEPS[loadingStep]}</div>
            <div className="jde-progress-dots">
              {TABS.map((_, i) => (
                <div key={i} className={`jde-dot${loadingStep > i ? ' jde-dot--done' : loadingStep === i + 1 ? ' jde-dot--active' : ''}`} />
              ))}
            </div>
            <p className="jde-loading-hint">Generating 5 recruitment assets — ~40–60 seconds.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── No results yet ─────────────────────────────────────────────────────
  if (!results) {
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

          <div className="ag-field" style={{ marginTop: 16 }}>
            <label className="ag-field-label">Client Notes <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional — will be highlighted in output)</span></label>
            <textarea
              className="ag-textarea"
              value={clientNotes}
              onChange={e => setClientNotes(e.target.value)}
              placeholder="Any extra notes from the client…"
              rows={3}
            />
          </div>

          {error && <div className="jde-error-banner">⚠ {error}</div>}

          <div className="sw-step-actions">
            <button className="ag-btn ag-btn--primary" onClick={handleGenerate}>✨ Generate Assets</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────
  return (
    <div className="sw-step-page sw-step-page--results">
      <div className="sw-enhance-header">
        <div className="sw-step-header" style={{ margin: 0 }}>
          <h2 className="sw-step-title">Step 2 — Enhance JD</h2>
          <div className="sw-job-chip">{job.title}{job.client_name ? ` — ${job.client_name}` : ''}</div>
        </div>
        <div className="sw-enhance-actions">
          <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={handleGenerate}>⟳ Regenerate All</button>
          <button
            className="ag-btn ag-btn--primary"
            onClick={handleSaveAndContinue}
            disabled={saving}
          >
            {saving ? 'Saving…' : session.enhancement_saved ? '✓ Saved — Continue →' : '💾 Save & Continue →'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="jde-tab-bar" style={{ padding: '8px 0 0', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`jde-tab-btn${activeTab === tab.key ? ' jde-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {results[tab.field] == null && <span className="jde-tab-missing">⚠</span>}
          </button>
        ))}
      </div>

      {/* Tab toolbar */}
      <div className="jde-tab-toolbar">
        <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => copyTab(activeTab)}>📋 Copy</button>
      </div>

      {/* Tab content */}
      <div className="jde-tab-content">
        {activeTab === 'jd'        && <FormattedJDTab content={results.formattedJD} />}
        {activeTab === 'brief'     && <RecruiterBriefTab content={results.recruiterBrief} />}
        {activeTab === 'questions' && <ClarificationsTab content={results.clarificationQuestions} />}
        {activeTab === 'reachout'  && <ReachoutTab content={results.reachoutMaterial} />}
        {activeTab === 'keywords'  && <KeywordsTab content={results.sourcingKeywords} />}
      </div>
    </div>
  );
}
