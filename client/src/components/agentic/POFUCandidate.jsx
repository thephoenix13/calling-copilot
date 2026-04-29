import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STATE_OPTIONS = [
  { value: 'offer_accepted', label: 'Offer Accepted' },
  { value: 'resigned',       label: 'Resigned'       },
  { value: 'bgv',            label: 'BGV'            },
  { value: 'confirmed',      label: 'Confirmed'      },
  { value: 'joined',         label: 'Joined'         },
  { value: 'dropped',        label: 'Dropped'        },
];

const TRIGGER_LABELS = {
  day0_welcome:        'Day 0 Welcome',
  resignation_check:   'Resignation Check',
  bgv_nudge:           'BGV Nudge',
  t14_checklist:       'T-14 Checklist',
  t7_warmup:           'T-7 Warm-up',
  t1_excitement:       'T-1 Excitement',
  risk_amber_checkin:  'Amber Check-in',
  risk_red_escalation: 'Red Escalation',
  no_response_nudge:   'No-Response Nudge',
  manual:              'Manual',
  reply:               'Reply (Inbound)',
};

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const RISK_BG     = { low: 'rgba(16,185,129,.1)', medium: 'rgba(245,158,11,.1)', high: 'rgba(239,68,68,.1)' };

function RiskBadge({ level, score }) {
  return (
    <span style={{
      background: RISK_BG[level] || RISK_BG.low,
      color: RISK_COLORS[level] || RISK_COLORS.low,
      border: `1px solid ${RISK_COLORS[level]}40`,
      borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {level === 'high' ? '🔴' : level === 'medium' ? '🟡' : '🟢'} {level.charAt(0).toUpperCase() + level.slice(1)} ({score})
    </span>
  );
}

export default function POFUCandidate({ candidateId, authFetch, isLight, onToggleTheme, onLogout, onBack }) {
  const [candidate, setCandidate] = useState(null);
  const [emails, setEmails]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  // Edit state
  const [editState, setEditState] = useState('');
  const [editDoj, setEditDoj]     = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Preview email panel
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTrigger, setPreviewTrigger] = useState('risk_amber_checkin');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending]     = useState(false);
  const [sendMsg, setSendMsg]     = useState('');

  // Log reply panel
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyLogging, setReplyLogging] = useState(false);

  const fetchCandidate = useCallback(async () => {
    try {
      const data = await authFetch(`${BACKEND_URL}/pofu/${candidateId}`).then(r => r.json());
      setCandidate(data.candidate);
      setEmails(data.emails || []);
      setEditState(data.candidate.state);
      setEditDoj(data.candidate.doj ? data.candidate.doj.split('T')[0] : '');
      setEditNotes(data.candidate.notes || '');
      setEditEmail(data.candidate.candidate_email || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [candidateId, authFetch]);

  useEffect(() => { fetchCandidate(); }, [fetchCandidate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/pofu/${candidateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: editState, doj: editDoj || null, notes: editNotes, candidate_email: editEmail }),
      });
      await fetchCandidate();
    } finally {
      setSaving(false);
    }
  };

  const handlePauseToggle = async () => {
    setSaving(true);
    try {
      await authFetch(`${BACKEND_URL}/pofu/${candidateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_paused: candidate.auto_paused ? 0 : 1 }),
      });
      await fetchCandidate();
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const data = await authFetch(`${BACKEND_URL}/pofu/${candidateId}/preview-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_reason: previewTrigger }),
      }).then(r => r.json());
      setPreviewData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    if (!previewData) return;
    setSending(true);
    setSendMsg('');
    try {
      await authFetch(`${BACKEND_URL}/pofu/${candidateId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_reason: previewTrigger, subject: previewData.subject, body: previewData.body }),
      });
      setSendMsg('Email sent!');
      setPreviewOpen(false);
      setPreviewData(null);
      await fetchCandidate();
    } catch (err) {
      setSendMsg('Failed to send.');
    } finally {
      setSending(false);
    }
  };

  const handleLogReply = async () => {
    if (!replyBody.trim()) return;
    setReplyLogging(true);
    try {
      await authFetch(`${BACKEND_URL}/pofu/${candidateId}/log-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody }),
      });
      setReplyBody('');
      setReplyOpen(false);
      await fetchCandidate();
    } finally {
      setReplyLogging(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${candidate?.candidate_name} from POFU? This cannot be undone.`)) return;
    await authFetch(`${BACKEND_URL}/pofu/${candidateId}`, { method: 'DELETE' });
    onBack();
  };

  if (loading) return <div className="page-content"><div className="sw-loading" style={{ padding: 40 }}>Loading…</div></div>;
  if (!candidate) return <div className="page-content"><div style={{ padding: 40, color: 'var(--text-3)' }}>Not found.</div></div>;

  const dirty = editState !== candidate.state || editDoj !== (candidate.doj ? candidate.doj.split('T')[0] : '') || editNotes !== (candidate.notes || '') || editEmail !== (candidate.candidate_email || '');

  return (
    <div className="page-content page-content--wide">
      <div className="sw-session-breadcrumb" style={{ marginBottom: 20 }}>
        <button className="sw-back-link" onClick={onBack}>← POFU List</button>
        <span className="sw-session-crumb-name">{candidate.candidate_name}</span>
        {candidate.auto_paused && <span style={{ fontSize: 11, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 7px' }}>Paused</span>}
      </div>

      <div className="pofu-candidate-page">
        {/* Left column — profile + edit */}
        <div className="pofu-cand-left">
          {/* Profile card */}
          <div className="pofu-cand-card">
            <div className="pofu-cand-meta">
              {candidate.role_title && <span className="pofu-cand-role">{candidate.role_title}</span>}
              {candidate.company_name && <span className="pofu-cand-company">@ {candidate.company_name}</span>}
            </div>
            <div style={{ margin: '12px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <RiskBadge level={candidate.risk_level} score={candidate.risk_score} />
              <span className="pofu-state-badge" style={{ fontSize: 12 }}>
                {STATE_OPTIONS.find(s => s.value === candidate.state)?.label || candidate.state}
              </span>
            </div>
            {candidate.doj && (
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
                DOJ: <strong>{new Date(candidate.doj).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{candidate.candidate_email}</div>
          </div>

          {/* Edit panel */}
          <div className="pofu-cand-card" style={{ marginTop: 16 }}>
            <div className="pofu-cand-section-title">Update Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="pofu-cand-label">Status</label>
                <select className="ag-input" value={editState} onChange={e => setEditState(e.target.value)}>
                  {STATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="pofu-cand-label">Email</label>
                <input className="ag-input" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="pofu-cand-label">Date of Joining</label>
                <input type="date" className="ag-input" value={editDoj} onChange={e => setEditDoj(e.target.value)} />
              </div>
              <div>
                <label className="pofu-cand-label">Notes</label>
                <textarea className="ag-input" rows={3} placeholder="Internal notes…" value={editNotes} onChange={e => setEditNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={saving || !dirty}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  className="ag-btn ag-btn--ghost"
                  onClick={handlePauseToggle}
                  disabled={saving}
                >
                  {candidate.auto_paused ? '▶ Resume Emails' : '⏸ Pause Emails'}
                </button>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8 }}>
            <button
              onClick={handleDelete}
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              Remove from POFU
            </button>
          </div>
        </div>

        {/* Right column — email history + actions */}
        <div className="pofu-cand-right">
          {/* Action bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button className="ag-btn ag-btn--primary" onClick={() => { setPreviewOpen(true); setSendMsg(''); }}>
              ✉ Send / Preview Email
            </button>
            <button className="ag-btn ag-btn--ghost" onClick={() => setReplyOpen(true)}>
              + Log Reply
            </button>
          </div>

          {sendMsg && (
            <div style={{ fontSize: 13, color: sendMsg.startsWith('Failed') ? '#f87171' : '#10b981', marginBottom: 12 }}>{sendMsg}</div>
          )}

          {/* Email timeline */}
          <div className="pofu-cand-section-title">Email History ({emails.length})</div>
          {emails.length === 0 ? (
            <div className="ag-empty" style={{ marginTop: 12 }}>No emails sent yet. The scheduler will trigger the first one automatically.</div>
          ) : (
            <div className="pofu-email-list">
              {emails.map(em => (
                <div key={em.id} className={`pofu-email-row pofu-email-row--${em.direction}`}>
                  <div className="pofu-email-meta">
                    <span className={`pofu-email-dir-badge pofu-email-dir-badge--${em.direction}`}>
                      {em.direction === 'outbound' ? '↑ Sent' : '↓ Reply'}
                    </span>
                    <span className="pofu-email-trigger">{TRIGGER_LABELS[em.trigger_reason] || em.trigger_reason}</span>
                    {em.ai_generated ? <span className="pofu-email-ai-tag">AI</span> : null}
                    <span className="pofu-email-date">
                      {new Date(em.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {em.subject && <div className="pofu-email-subject">{em.subject}</div>}
                  {em.body && (
                    <pre className="pofu-email-body">{em.body}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview / Send email modal */}
      {previewOpen && (
        <div className="ag-modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="ag-modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">Send Email</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="pofu-cand-label">Email Type</label>
              <select className="ag-input" value={previewTrigger} onChange={e => { setPreviewTrigger(e.target.value); setPreviewData(null); }}>
                {Object.entries(TRIGGER_LABELS).filter(([k]) => k !== 'reply').map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button className="ag-btn ag-btn--ghost" onClick={handlePreview} disabled={previewLoading} style={{ marginBottom: 16 }}>
              {previewLoading ? 'Generating…' : '🔍 Preview AI Draft'}
            </button>

            {previewData && (
              <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>{previewData.subject}</div>
                <pre style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'pre-wrap', margin: 0 }}>{previewData.body}</pre>
              </div>
            )}

            {sendMsg && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 8 }}>{sendMsg}</div>}

            <div className="ag-modal-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => { setPreviewOpen(false); setPreviewData(null); }}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleSend} disabled={!previewData || sending}>
                {sending ? 'Sending…' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log reply modal */}
      {replyOpen && (
        <div className="ag-modal-overlay" onClick={() => setReplyOpen(false)}>
          <div className="ag-modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <h3 className="ag-modal-title">Log Candidate Reply</h3>
            <label className="pofu-cand-label">What did the candidate say?</label>
            <textarea
              className="ag-input"
              rows={5}
              placeholder="Paste or summarise the candidate's reply…"
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              style={{ marginTop: 6, resize: 'vertical' }}
            />
            <div className="ag-modal-actions" style={{ marginTop: 16 }}>
              <button className="ag-btn ag-btn--ghost" onClick={() => setReplyOpen(false)}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleLogReply} disabled={replyLogging || !replyBody.trim()}>
                {replyLogging ? 'Saving…' : 'Log Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
