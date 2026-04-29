import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FormattedJDTab, RecruiterBriefTab, ClarificationsTab,
  ReachoutTab, KeywordsTab, DownloadDialog, stripMarkers,
} from './JDEnhancerTabs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const LS_SCRIPT_KEY = 'jde_company_script';

const TABS = [
  { key: 'jd',        label: 'Formatted JD',   field: 'formattedJD',            editable: true  },
  { key: 'brief',     label: 'Recruiter Brief', field: 'recruiterBrief',         editable: true  },
  { key: 'questions', label: 'Clarifications',  field: 'clarificationQuestions', editable: false },
  { key: 'reachout',  label: 'Reachout',        field: 'reachoutMaterial',       editable: true  },
  { key: 'keywords',  label: 'Keywords',        field: 'sourcingKeywords',       editable: false },
];

const LOADING_STEPS = [
  'Parsing job details…',
  'Writing formatted job description…',
  'Preparing recruiter brief…',
  'Generating clarification questions…',
  'Creating candidate reachout material…',
  'Building sourcing keyword sets…',
  'Finalising output…',
];

const MANUAL_PLACEHOLDERS = {
  jd:        'e.g., "Make the tone more startup-friendly" or "Emphasise remote-first culture"',
  brief:     'e.g., "Focus on non-technical recruiter audience" or "Add more context about the client industry"',
  questions: 'e.g., "Add more questions about leadership experience" or "Focus on cloud infrastructure questions"',
  reachout:  'e.g., "Make the WhatsApp message shorter and punchier" or "Emphasise the equity component"',
  keywords:  'e.g., "Add more React/Next.js variations" or "Include fintech-specific Boolean strings"',
};

// ── Saved list (reused in both views) ───────────────────────────────────────
function SavedListModal({ savedList, onLoad, onDelete, onClose }) {
  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal jde-saved-modal" onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">Saved Enhancements</h3>
        {savedList.length === 0 ? (
          <p className="ag-empty" style={{ margin: '24px 0' }}>No saved enhancements yet.</p>
        ) : (
          <div className="jde-saved-list">
            {savedList.map(item => (
              <div key={item.id} className="jde-saved-item" onClick={() => onLoad(item)}>
                <div className="jde-saved-info">
                  <div className="jde-saved-title">{item.title || 'Untitled'}</div>
                  <div className="jde-saved-date">{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <button
                  className="ag-action-btn ag-action-btn--danger"
                  title="Delete"
                  onClick={e => onDelete(item.id, e)}
                >✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button className="ag-btn ag-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function JDEnhancer({ authFetch, onBack, isLight, onToggleTheme, onLogout }) {
  // View
  const [view, setView]               = useState('input'); // 'input' | 'loading' | 'results'
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingError, setLoadingError] = useState('');

  // Input
  const [jdText, setJdText]           = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [companyScript, setCompanyScript] = useState(() => localStorage.getItem(LS_SCRIPT_KEY) || '');
  const [showScript, setShowScript]   = useState(false);
  const [extracting, setExtracting]   = useState(false);
  const fileRef = useRef(null);

  // Results
  const [results, setResults]         = useState({});
  const [parsedJob, setParsedJob]     = useState(null);
  const [activeTab, setActiveTab]     = useState('jd');
  const [editingTab, setEditingTab]   = useState(null);
  const [editDraft, setEditDraft]     = useState('');
  const [regenerating, setRegenerating] = useState({});

  // Manual input modal
  const [manualInputTab, setManualInputTab]     = useState(null);
  const [manualInputDraft, setManualInputDraft] = useState('');

  // Save / load
  const [savedId, setSavedId]         = useState(null);
  const [saveTitle, setSaveTitle]     = useState('');
  const [savedList, setSavedList]     = useState([]);
  const [showSavedList, setShowSavedList] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');

  // Download
  const [showDownload, setShowDownload] = useState(false);

  // Persist company script
  useEffect(() => {
    localStorage.setItem(LS_SCRIPT_KEY, companyScript);
  }, [companyScript]);

  // ── File upload ────────────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await authFetch(`${BACKEND_URL}/enhance-jd/extract-text`, { method: 'POST', body: fd });
      const data = await r.json();
      if (data.text) setJdText(data.text);
    } catch (err) {
      console.error('File extract error:', err);
    } finally {
      setExtracting(false);
      e.target.value = '';
    }
  };

  // ── Generate ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!jdText.trim()) return;
    setView('loading');
    setLoadingStep(0);
    setLoadingError('');

    const stepTimer = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 7000);

    try {
      // Parse structured fields from raw JD text
      const parseRes = await authFetch(`${BACKEND_URL}/enhance-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'parse_fields', description: jdText }),
      });
      if (!parseRes.ok) throw new Error('Failed to parse job description.');
      const parseData = await parseRes.json();
      const job = parseData.fields || {};
      setParsedJob(job);

      // Generate all 5 assets
      const genRes = await authFetch(`${BACKEND_URL}/enhance-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          clientNotes: clientNotes || undefined,
          companyScript: companyScript || undefined,
        }),
      });
      if (!genRes.ok) throw new Error('Asset generation failed.');
      const genData = await genRes.json();

      setResults(genData);
      setSaveTitle(job.title || 'Untitled Enhancement');
      setSavedId(null);
      setActiveTab('jd');
      setEditingTab(null);
      setView('results');
    } catch (err) {
      setLoadingError(err.message || 'Generation failed. Please try again.');
      setView('input');
    } finally {
      clearInterval(stepTimer);
    }
  };

  // ── Regenerate single tab ──────────────────────────────────────────────
  const handleRegenerate = useCallback(async (tabKey, manualInput) => {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab || !parsedJob) return;
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

  // ── Manual input → regenerate ──────────────────────────────────────────
  const handleManualRegenerate = () => {
    const tab = manualInputTab;
    const input = manualInputDraft.trim();
    setManualInputTab(null);
    setManualInputDraft('');
    handleRegenerate(tab, input);
  };

  // ── Inline edit ────────────────────────────────────────────────────────
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

  // ── Copy ───────────────────────────────────────────────────────────────
  const copyTab = (tabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    const content = results[tab.field];
    let text = '';
    if (typeof content === 'string') {
      text = stripMarkers(content);
    } else if (content && typeof content === 'object') {
      text = JSON.stringify(content, null, 2);
    }
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!Object.keys(results).length) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: savedId || undefined,
          title: saveTitle || 'Untitled Enhancement',
          jdInput: jdText,
          clientNotes: clientNotes || undefined,
          results,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setSavedId(data.id);
        setSaveMsg('Saved ✓');
        setTimeout(() => setSaveMsg(''), 2500);
      }
    } catch (err) {
      setSaveMsg('Save failed');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Saved list ─────────────────────────────────────────────────────────
  const loadSavedList = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd/saved`);
      const data = await res.json();
      setSavedList(data.saved || []);
      setShowSavedList(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadSaved = async (item) => {
    try {
      const res = await authFetch(`${BACKEND_URL}/enhance-jd/saved/${item.id}`);
      const data = await res.json();
      if (data.item) {
        setJdText(data.item.jd_input || '');
        setClientNotes(data.item.client_notes || '');
        setResults(data.item.results || {});
        setSavedId(item.id);
        setSaveTitle(item.title || '');
        setShowSavedList(false);
        setView('results');
        setActiveTab('jd');
        setEditingTab(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSaved = async (id, e) => {
    e.stopPropagation();
    try {
      await authFetch(`${BACKEND_URL}/enhance-jd/saved/${id}`, { method: 'DELETE' });
      setSavedList(l => l.filter(x => x.id !== id));
      if (savedId === id) setSavedId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ── New enhancement ────────────────────────────────────────────────────
  const handleNew = () => {
    setView('input');
    setJdText('');
    setClientNotes('');
    setResults({});
    setParsedJob(null);
    setSavedId(null);
    setSaveTitle('');
    setEditingTab(null);
    setActiveTab('jd');
    setLoadingError('');
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const activeTabObj    = TABS.find(t => t.key === activeTab);
  const activeContent   = results[activeTabObj?.field];

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="page-content page-content--wide">

      {/* ── Loading view ─────────────────────────────────────────────── */}
      {view === 'loading' && (
        <div className="jde-loading-page">
          <div className="jde-loading-card">
            <div className="jde-spinner" />
            <div className="jde-loading-step">{LOADING_STEPS[loadingStep]}</div>
            <div className="jde-progress-dots">
              {TABS.map((_, i) => (
                <div
                  key={i}
                  className={`jde-dot${loadingStep > i + 1 ? ' jde-dot--done' : loadingStep === i + 1 ? ' jde-dot--active' : ''}`}
                />
              ))}
            </div>
            <p className="jde-loading-hint">AI is generating 5 recruitment assets — usually 40–60 seconds.</p>
          </div>
        </div>
      )}

      {/* ── Results view ─────────────────────────────────────────────── */}
      {view === 'results' && (
        <div className="jde-results-page">
          {/* Action bar */}
          <div className="jde-action-bar">
            <button className="ag-btn ag-btn--ghost" onClick={loadSavedList}>📂 Saved</button>
            <div className="jde-save-row">
              <input
                className="jde-save-title-input"
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                placeholder="Enhancement title…"
              />
              <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : savedId ? '💾 Update' : '💾 Save'}
              </button>
              {saveMsg && <span className="jde-save-msg">{saveMsg}</span>}
            </div>
            <button className="ag-btn ag-btn--ghost" onClick={() => setShowDownload(true)}>⬇ Download</button>
          </div>

          {/* Tab bar */}
          <div className="jde-tab-bar">
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`jde-tab-btn${activeTab === tab.key ? ' jde-tab-btn--active' : ''}`}
                onClick={() => { setActiveTab(tab.key); setEditingTab(null); }}
              >
                {tab.label}
                {results[tab.field] == null && <span className="jde-tab-missing">⚠</span>}
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
                <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={() => saveEdit(activeTab)}>
                  ✓ Save Edit
                </button>
                <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => setEditingTab(null)}>
                  ✗ Cancel
                </button>
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
            {activeTab === 'questions' && <ClarificationsTab content={activeContent} />}
            {activeTab === 'reachout' && (
              <ReachoutTab
                content={activeContent}
                editing={editingTab === 'reachout'}
                editDraft={editDraft}
                onEditChange={setEditDraft}
              />
            )}
            {activeTab === 'keywords' && <KeywordsTab content={activeContent} />}
          </div>

          {/* Modals */}
          {showSavedList && (
            <SavedListModal
              savedList={savedList}
              onLoad={handleLoadSaved}
              onDelete={handleDeleteSaved}
              onClose={() => setShowSavedList(false)}
            />
          )}

          {manualInputTab && (
            <div className="ag-modal-overlay" onClick={() => setManualInputTab(null)}>
              <div className="ag-modal jde-manual-modal" onClick={e => e.stopPropagation()}>
                <h3 className="ag-modal-title">
                  Instructions — {TABS.find(t => t.key === manualInputTab)?.label}
                </h3>
                <p className="jde-manual-hint">
                  Add specific instructions to guide this asset's regeneration.
                </p>
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

          {showDownload && (
            <DownloadDialog
              activeTab={activeTab}
              results={results}
              saveTitle={saveTitle}
              onClose={() => setShowDownload(false)}
            />
          )}
        </div>
      )}

      {/* ── Input view ───────────────────────────────────────────────── */}
      {view === 'input' && (
        <div className="jde-input-page">
          {loadingError && (
            <div className="jde-error-banner">⚠ {loadingError}</div>
          )}

          <div className="jde-input-card">
            <div className="jde-input-header">
              <h2 className="jde-input-title">Generate Recruitment Assets</h2>
              <p className="jde-input-subtitle">
                Paste a job description or upload a file — Claude will generate a formatted JD, recruiter brief, clarification questions, reachout messages, and sourcing keywords.
              </p>
            </div>

            {/* JD field */}
            <div className="jde-field">
              <div className="jde-field-header">
                <label className="jde-label">Job Description</label>
                <button
                  className="ag-btn ag-btn--ghost ag-btn--sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={extracting}
                >
                  {extracting ? '⟳ Extracting…' : '📎 Upload PDF / DOCX'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </div>
              <textarea
                className="ag-textarea jde-jd-textarea"
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste the full job description here, or upload a PDF / DOCX above…"
                rows={12}
              />
            </div>

            {/* Client notes */}
            <div className="jde-field">
              <label className="jde-label">
                Client Notes <span className="jde-label-hint">(optional — highlighted in output)</span>
              </label>
              <textarea
                className="ag-textarea"
                value={clientNotes}
                onChange={e => setClientNotes(e.target.value)}
                placeholder="Any notes from the client, e.g., 'Must have WordPress experience' or 'Remote-first, no relocation'…"
                rows={3}
              />
            </div>

            {/* Company script collapsible */}
            <div className="jde-script-section">
              <button
                className="jde-script-toggle"
                onClick={() => setShowScript(s => !s)}
              >
                <span className="jde-script-arrow">{showScript ? '▼' : '▶'}</span>
                Company Intro Script
                {companyScript
                  ? <span className="jde-script-badge jde-script-badge--set">set</span>
                  : <span className="jde-script-badge">not set</span>}
              </button>
              {showScript && (
                <div className="jde-script-body">
                  <p className="jde-script-hint">
                    Used verbatim in WhatsApp/LinkedIn messages and the call pitch. Saved to your browser across sessions.
                  </p>
                  <textarea
                    className="ag-textarea"
                    value={companyScript}
                    onChange={e => setCompanyScript(e.target.value)}
                    placeholder="e.g., 'Hi, I'm reaching out from Zeople AI, a recruitment firm specialising in tech and product roles across India…'"
                    rows={4}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="jde-input-actions">
              <button
                className="ag-btn ag-btn--primary jde-generate-btn"
                onClick={handleGenerate}
                disabled={!jdText.trim()}
              >
                ✨ Generate All Assets
              </button>
              <button className="ag-btn ag-btn--ghost" onClick={loadSavedList}>
                📂 Load Saved
              </button>
            </div>
          </div>

          {showSavedList && (
            <SavedListModal
              savedList={savedList}
              onLoad={handleLoadSaved}
              onDelete={handleDeleteSaved}
              onClose={() => setShowSavedList(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
