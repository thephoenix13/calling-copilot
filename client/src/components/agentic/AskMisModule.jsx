/**
 * AskMisModule — on-demand MIS reporting chat. Sidebar with conversation
 * history, main panel with messages and an input.
 *
 *  Backend:
 *    POST   /ask-mis/query                  → { conversationId, message }
 *    GET    /ask-mis/conversations          → { conversations: [...] }
 *    GET    /ask-mis/conversations/:id      → { conversation, messages }
 *    DELETE /ask-mis/conversations/:id      → { ok: true }
 *
 *  Each assistant message can carry a `tables` array — each entry is rendered
 *  as a titled, scrollable table with a "Show SQL" toggle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import './AskMisModule.css';

const CHART_PALETTE = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STARTER_PROMPTS = [
  'How many active jobs do we have, broken down by department?',
  'Show the pipeline funnel — sourced, screened, proceeded, selected.',
  'Average MCQ score vs coding assessment score, by assessment.',
  "Selected candidates per week for the last 8 weeks — who's hiring the most?",
  'POFU candidates at high risk, with their date of joining.',
];

const fmtDate = (dt) => {
  if (!dt) return '';
  try {
    const d = new Date(dt.replace ? dt.replace(' ', 'T') + 'Z' : dt);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

export default function AskMisModule({ authFetch, userRole }) {
  const [tab, setTab] = useState('chat'); // 'chat' | 'saved'
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [messages, setMessages]   = useState([]);   // [{ id, role, content, tables?, sqlUsed?, latencyMs?, error?, createdAt }]
  const [loadingList, setLoadingList]   = useState(false);
  const [loadingConv, setLoadingConv]   = useState(false);
  const [pending,     setPending]       = useState(false);
  const [input,       setInput]         = useState('');
  const [errorBanner, setErrorBanner]   = useState('');
  const scrollRef = useRef(null);

  // ── Data load ──────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/ask-mis/conversations`);
      if (!r.ok) throw new Error('Could not load conversations');
      const d = await r.json();
      setConversations(d.conversations || []);
    } catch (e) {
      setErrorBanner(e.message);
    } finally {
      setLoadingList(false);
    }
  }, [authFetch]);

  const openConv = useCallback(async (id) => {
    setActiveId(id);
    setMessages([]);
    if (!id) return;
    setLoadingConv(true);
    try {
      const r = await authFetch(`${BACKEND_URL}/ask-mis/conversations/${id}`);
      if (!r.ok) throw new Error('Could not load conversation');
      const d = await r.json();
      setMessages(d.messages || []);
    } catch (e) {
      setErrorBanner(e.message);
    } finally {
      setLoadingConv(false);
    }
  }, [authFetch]);

  useEffect(() => { loadList(); }, [loadList]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  // ── Submit ──────────────────────────────────────────────────────────────
  // Accepts an explicit question (used by re-run) and optional conversationId
  // (used by Saved Reports refresh, to avoid a stale closure on activeId).
  const submit = useCallback(async (questionArg, conversationIdArg) => {
    const question = (typeof questionArg === 'string' ? questionArg : input).trim();
    if (!question || pending) return;

    const conversationId = conversationIdArg !== undefined ? conversationIdArg : activeId;

    if (typeof questionArg !== 'string') setInput('');
    setPending(true);
    setErrorBanner('');

    // Optimistic user bubble
    const tempUserMsg = { id: `tmp-${Date.now()}`, role: 'user', content: question, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const r = await authFetch(`${BACKEND_URL}/ask-mis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversationId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);

      // Replace temp user msg with persistent forms by reloading the conversation
      setActiveId(d.conversationId);
      const assistantMsg = {
        id: d.message.id,
        role: 'assistant',
        content: d.message.text,
        tables: d.message.tables || [],
        sqlUsed: d.message.sqlUsed || [],
        latencyMs: d.message.latencyMs,
        error: d.message.error || null,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id),
                          { ...tempUserMsg, id: `u-${Date.now()}` },
                          assistantMsg]);

      // Refresh sidebar (new conv, updated_at change)
      loadList();
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Sorry — ${e.message}`,
        error: e.message,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setPending(false);
    }
  }, [input, pending, activeId, authFetch, loadList]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
  };

  const deleteConv = async (id, e) => {
    e?.stopPropagation();
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      const r = await authFetch(`${BACKEND_URL}/ask-mis/conversations/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Could not delete');
      if (id === activeId) newChat();
      loadList();
    } catch (e) {
      setErrorBanner(e.message);
    }
  };

  const patchConv = useCallback(async (id, body) => {
    try {
      const r = await authFetch(`${BACKEND_URL}/ask-mis/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Could not update');
      }
      loadList();
    } catch (e) {
      setErrorBanner(e.message);
    }
  }, [authFetch, loadList]);

  const togglePin = (id, currentPinned, e) => {
    e?.stopPropagation();
    patchConv(id, { pinned: !currentPinned });
  };

  const renameConv = (id, newTitle) => {
    const trimmed = (newTitle || '').trim();
    if (!trimmed) return;
    patchConv(id, { title: trimmed });
  };

  const { pinned, recent } = useMemo(() => {
    const p = [], r = [];
    for (const c of conversations) (c.pinned ? p : r).push(c);
    return { pinned: p, recent: r };
  }, [conversations]);

  const resubmit = useCallback((question) => submit(question), [submit]);

  const isEmpty = messages.length === 0;

  const openFromSaved = (id) => {
    setTab('chat');
    openConv(id);
  };

  const refreshSaved = async (conv) => {
    if (pending) return;
    if (!conv.first_question) {
      setErrorBanner('This report has no original question to re-run.');
      return;
    }
    setTab('chat');
    await openConv(conv.id);
    submit(conv.first_question, conv.id);
  };

  return (
    <div className={`mis-shell${tab === 'saved' ? ' mis-shell--saved' : ''}`}>
      {/* ── Sidebar (chat tab only) ──────────────────────────────────── */}
      {tab === 'chat' && (
      <aside className="mis-sidebar">
        <button className="mis-new-btn" onClick={newChat}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> New chat
        </button>
        <div className="mis-conv-list">
          {loadingList ? (
            <div className="mis-conv-empty">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="mis-conv-empty">No conversations yet.</div>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <div className="mis-sidebar-label">Pinned</div>
                  {pinned.map(c => (
                    <ConvRow
                      key={c.id}
                      conv={c}
                      active={c.id === activeId}
                      onOpen={openConv}
                      onTogglePin={togglePin}
                      onRename={renameConv}
                      onDelete={deleteConv}
                    />
                  ))}
                </>
              )}
              <div className="mis-sidebar-label">{pinned.length ? 'Recent' : 'History'}</div>
              {recent.length === 0 ? (
                <div className="mis-conv-empty">All pinned.</div>
              ) : recent.map(c => (
                <ConvRow
                  key={c.id}
                  conv={c}
                  active={c.id === activeId}
                  onOpen={openConv}
                  onTogglePin={togglePin}
                  onRename={renameConv}
                  onDelete={deleteConv}
                />
              ))}
            </>
          )}
        </div>
      </aside>
      )}

      {/* ── Main panel ───────────────────────────────────────────────── */}
      <section className="mis-main">
        <header className="mis-header">
          <div className="mis-header-top">
            <div>
              <h1 className="mis-title">ZeBot</h1>
              <p className="mis-subtitle">
                On-demand reporting — ask anything about your jobs, pipeline, assessments and interviews.
                Results are scoped to what you can see.
              </p>
            </div>
            <div className="mis-tabs">
              <button
                className={`mis-tab${tab === 'chat' ? ' mis-tab--active' : ''}`}
                onClick={() => setTab('chat')}
              >Chat</button>
              <button
                className={`mis-tab${tab === 'saved' ? ' mis-tab--active' : ''}`}
                onClick={() => setTab('saved')}
              >Saved Reports {pinned.length > 0 && <span className="mis-tab-count">{pinned.length}</span>}</button>
            </div>
          </div>
        </header>

        {errorBanner && (
          <div className="mis-banner mis-banner--error">
            ⚠️ {errorBanner}
            <button className="mis-banner-dismiss" onClick={() => setErrorBanner('')}>✕</button>
          </div>
        )}

        {tab === 'chat' ? (
          <>
            <div className="mis-messages" ref={scrollRef}>
              {loadingConv ? (
                <div className="mis-loading">Loading conversation…</div>
              ) : isEmpty ? (
                <EmptyState onPick={(q) => setInput(q)} />
              ) : (
                messages.map(m => <MessageBubble key={m.id} msg={m} onRerun={resubmit} pending={pending} />)
              )}
              {pending && <TypingIndicator />}
            </div>

            <div className="mis-composer">
              <textarea
                className="mis-input"
                rows={2}
                placeholder="Ask anything — e.g. how many active jobs do we have?"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={pending}
              />
              <button
                className="mis-send-btn"
                onClick={() => submit()}
                disabled={!input.trim() || pending}
                title="Send (Enter)"
              >
                {pending ? '…' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <SavedReportsView
            reports={pinned}
            loading={loadingList}
            onOpen={openFromSaved}
            onRefresh={refreshSaved}
            onUnpin={(id) => patchConv(id, { pinned: false })}
            onDelete={(id) => deleteConv(id)}
            onGoToChat={() => setTab('chat')}
            pending={pending}
          />
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SavedReportsView({ reports, loading, onOpen, onRefresh, onUnpin, onDelete, onGoToChat, pending }) {
  if (loading) {
    return <div className="mis-loading">Loading saved reports…</div>;
  }
  if (!reports.length) {
    return (
      <div className="mis-saved-empty">
        <div className="mis-empty-icon">⭐</div>
        <h2 className="mis-empty-title">No saved reports yet</h2>
        <p className="mis-empty-sub">
          Pin a conversation from the Chat tab — click the ★ next to any conversation in the sidebar —
          and it will land here as a re-runnable saved report.
        </p>
        <button className="mis-empty-cta" onClick={onGoToChat}>← Go to Chat</button>
      </div>
    );
  }
  return (
    <div className="mis-saved-grid">
      {reports.map(r => (
        <SavedReportCard
          key={r.id}
          report={r}
          onOpen={() => onOpen(r.id)}
          onRefresh={() => onRefresh(r)}
          onUnpin={() => onUnpin(r.id)}
          onDelete={() => onDelete(r.id)}
          pending={pending}
        />
      ))}
    </div>
  );
}

function SavedReportCard({ report, onOpen, onRefresh, onUnpin, onDelete, pending }) {
  return (
    <div className="mis-saved-card">
      <div className="mis-saved-card-head">
        <div className="mis-saved-card-title" title={report.title}>{report.title}</div>
        <button className="mis-saved-card-unpin" onClick={(e) => { e.stopPropagation(); onUnpin(); }} title="Unpin">★</button>
      </div>
      {report.first_question && (
        <div className="mis-saved-card-section">
          <div className="mis-saved-card-label">Question</div>
          <div className="mis-saved-card-question">{report.first_question}</div>
        </div>
      )}
      {report.last_answer && (
        <div className="mis-saved-card-section">
          <div className="mis-saved-card-label">Last answer</div>
          <div className="mis-saved-card-answer">{report.last_answer}</div>
        </div>
      )}
      <div className="mis-saved-card-meta">
        <span>Last run {fmtDateLong(report.last_run_at) || fmtDateLong(report.updated_at)}</span>
        <span>{report.message_count} message{report.message_count === 1 ? '' : 's'}</span>
      </div>
      <div className="mis-saved-card-actions">
        <button className="mis-saved-card-btn mis-saved-card-btn--primary" onClick={onRefresh} disabled={pending} title="Re-run the original question and refresh the data">
          ↻ Refresh
        </button>
        <button className="mis-saved-card-btn" onClick={onOpen}>Open</button>
        <button className="mis-saved-card-btn mis-saved-card-btn--danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function fmtDateLong(dt) {
  if (!dt) return '';
  try {
    const d = new Date(dt.replace ? dt.replace(' ', 'T') + 'Z' : dt);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `${days}d ago`;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function ConvRow({ conv, active, onOpen, onTogglePin, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(conv.title);
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== conv.title) onRename(conv.id, t);
    else setDraft(conv.title);
  };
  const cancel = () => { setEditing(false); setDraft(conv.title); };

  return (
    <div
      className={`mis-conv-row${active ? ' mis-conv-row--active' : ''}`}
      onClick={() => !editing && onOpen(conv.id)}
      title={conv.title}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="mis-conv-row-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className="mis-conv-row-title" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          {conv.title}
        </div>
      )}
      <div className="mis-conv-row-meta">
        <button
          className={`mis-conv-row-pin${conv.pinned ? ' mis-conv-row-pin--on' : ''}`}
          onClick={(e) => onTogglePin(conv.id, !!conv.pinned, e)}
          title={conv.pinned ? 'Unpin' : 'Pin'}
        >★</button>
        <button
          className="mis-conv-row-edit"
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          title="Rename"
        >✎</button>
        <span className="mis-conv-row-date">{fmtDate(conv.updated_at)}</span>
        <button className="mis-conv-row-delete" onClick={(e) => onDelete(conv.id, e)} title="Delete">✕</button>
      </div>
    </div>
  );
}

function EmptyState({ onPick }) {
  return (
    <div className="mis-empty">
      <div className="mis-empty-icon">📊</div>
      <h2 className="mis-empty-title">What would you like to know?</h2>
      <p className="mis-empty-sub">Pick a starter or type your own question.</p>
      <div className="mis-empty-prompts">
        {STARTER_PROMPTS.map((p, i) => (
          <button key={i} className="mis-prompt-chip" onClick={() => onPick(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="mis-msg mis-msg--assistant">
      <div className="mis-typing"><span/><span/><span/></div>
    </div>
  );
}

function MessageBubble({ msg, onRerun, pending }) {
  const bubbleRef = useRef(null);

  if (msg.role === 'user') {
    return (
      <div className="mis-msg mis-msg--user">
        <div className="mis-bubble mis-bubble--user">
          <div className="mis-bubble-text">{msg.content}</div>
          {onRerun && (
            <button
              className="mis-rerun-btn"
              onClick={() => onRerun(msg.content)}
              disabled={pending}
              title="Re-run this question with fresh data"
            >↻ Re-run</button>
          )}
        </div>
      </div>
    );
  }

  const downloadPdf = async () => {
    if (!bubbleRef.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    const filename = `zebot-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.pdf`;
    html2pdf()
      .set({
        margin:       [10, 10, 10, 10],
        filename,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(bubbleRef.current)
      .save();
  };

  return (
    <div className="mis-msg mis-msg--assistant">
      <div className="mis-bubble mis-bubble--assistant" ref={bubbleRef}>
        {msg.error && !msg.tables?.length && (
          <div className="mis-bubble-error">⚠️ {msg.error}</div>
        )}
        <div className="mis-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ''}</ReactMarkdown>
        </div>
        {msg.tables?.length > 0 && (
          <div className="mis-tables">
            {msg.tables.map((t, i) => <ResultTable key={i} table={t} />)}
          </div>
        )}
        {msg.latencyMs != null && (
          <div className="mis-msg-footer">
            <span>
              {msg.tables?.length || 0} {msg.tables?.length === 1 ? 'query' : 'queries'} · {(msg.latencyMs / 1000).toFixed(1)}s
            </span>
            <button className="mis-pdf-btn" onClick={downloadPdf} title="Export this answer as PDF">
              ⬇ PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultTable({ table }) {
  const [showSql, setShowSql] = useState(false);
  const { title, sql, columns, rows, rowCount, truncated, chart } = table;
  const hasRows = rows && rows.length > 0;

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
    const wb = XLSX.utils.book_new();
    const sheetName = (title || 'Result').slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, ''); // Excel sheet name rules
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Result');
    const filename = `${(title || 'result').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'result'}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="mis-table-card">
      <div className="mis-table-header">
        <span className="mis-table-title">{title}</span>
        <div className="mis-table-actions">
          <span className="mis-table-rowcount">
            {hasRows ? (truncated ? `${rowCount} rows (truncated)` : `${rowCount} row${rowCount === 1 ? '' : 's'}`) : 'No rows'}
          </span>
          {hasRows && (
            <button className="mis-table-sql-btn" onClick={exportExcel} title="Download as Excel (.xlsx)">
              ⬇ Excel
            </button>
          )}
          <button className="mis-table-sql-btn" onClick={() => setShowSql(s => !s)}>
            {showSql ? 'Hide SQL' : 'Show SQL'}
          </button>
        </div>
      </div>
      {showSql && (
        <pre className="mis-table-sql"><code>{sql}</code></pre>
      )}
      {chart && hasRows && (
        <ChartBlock spec={chart} rows={rows} />
      )}
      {hasRows ? (
        <div className="mis-table-wrap">
          <table className="mis-table">
            <thead>
              <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map(c => <td key={c}>{formatCell(r[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mis-table-empty">Query returned no rows.</div>
      )}
    </div>
  );
}

function ChartBlock({ spec, rows }) {
  const { type, x, y, stacked } = spec;
  const data = useMemo(() => rows.map(r => ({ ...r })), [rows]);

  if (type === 'pie') {
    const yKey = y[0];
    const pieData = data.map(d => ({ name: String(d[x]), value: Number(d[yKey]) || 0 }));
    return (
      <div className="mis-chart">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'line') {
    return (
      <div className="mis-chart">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
            <XAxis dataKey={x} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {y.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {y.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'area') {
    return (
      <div className="mis-chart">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
            <XAxis dataKey={x} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {y.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {y.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                fillOpacity={0.25}
                stackId={stacked ? 'stack' : undefined} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // default: bar
  return (
    <div className="mis-chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
          <XAxis dataKey={x} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {y.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {y.map((key, i) => (
            <Bar key={key} dataKey={key}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              stackId={stacked ? 'stack' : undefined}
              radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
