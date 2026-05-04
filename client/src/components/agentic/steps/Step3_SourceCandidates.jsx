import { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ── Compact AI verdict badge ──────────────────────────────────────────────────
const AIC_LABELS = {
  human:        { label: 'Human',     cls: 'aic-badge--human' },
  likely_human: { label: 'Likely Human', cls: 'aic-badge--human' },
  mixed:        { label: 'AI-Assisted', cls: 'aic-badge--mixed' },
  likely_ai:    { label: 'Likely AI', cls: 'aic-badge--ai' },
  ai_generated: { label: 'AI-Written', cls: 'aic-badge--ai' },
};
function AicBadge({ result }) {
  const { label, cls } = AIC_LABELS[result.verdict] || { label: result.verdict, cls: '' };
  return (
    <span className={`aic-badge aic-badge--sm ${cls}`} title={result.summary}>
      {label} · {result.confidence}%
    </span>
  );
}

function calcMatch(candidateSkills, reqSkills, prefSkills) {
  const cs = (candidateSkills || []).map(s => s.toLowerCase().trim());
  let score = 0;
  if (reqSkills.length  > 0) score += (reqSkills.filter(s  => cs.includes(s.toLowerCase().trim())).length / reqSkills.length)  * 80;
  if (prefSkills.length > 0) score += (prefSkills.filter(s => cs.includes(s.toLowerCase().trim())).length / prefSkills.length) * 20;
  return Math.round(score);
}

function MatchBadge({ pct }) {
  const cls = pct >= 70 ? 'sw-match--high' : pct >= 40 ? 'sw-match--mid' : 'sw-match--low';
  return <span className={`sw-match-badge ${cls}`}>{pct}%</span>;
}

function MatchReason({ skills, reqSkills, prefSkills, strengths, verdict }) {
  const cs       = (skills || []).map(s => s.toLowerCase().trim());
  const matched  = reqSkills.filter(s => cs.includes(s.toLowerCase().trim()));
  const missing  = reqSkills.filter(s => !cs.includes(s.toLowerCase().trim()));
  const matchPref = prefSkills.filter(s => cs.includes(s.toLowerCase().trim()));
  return (
    <div className="sw-match-reason">
      {matched.length > 0 && (
        <div className="sw-mr-row">
          <span className="sw-mr-label sw-mr-label--match">Matched</span>
          <div className="sw-mr-chips">
            {matched.map(s => <span key={s} className="skill-chip skill-chip--match">{s}</span>)}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div className="sw-mr-row">
          <span className="sw-mr-label sw-mr-label--miss">Missing</span>
          <div className="sw-mr-chips">
            {missing.map(s => <span key={s} className="skill-chip skill-chip--miss">{s}</span>)}
          </div>
        </div>
      )}
      {matchPref.length > 0 && (
        <div className="sw-mr-row">
          <span className="sw-mr-label sw-mr-label--pref">Preferred</span>
          <div className="sw-mr-chips">
            {matchPref.map(s => <span key={s} className="skill-chip skill-chip--pref">{s}</span>)}
          </div>
        </div>
      )}
      {verdict && (
        <p className="sw-mr-verdict">{verdict}</p>
      )}
      {strengths?.length > 0 && (
        <div className="sw-mr-row" style={{ alignItems: 'flex-start' }}>
          <span className="sw-mr-label sw-mr-label--match">Strengths</span>
          <ul className="sw-mr-strengths">
            {strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="sw-eval-badge sw-eval-badge--pending">Evaluating…</span>;
  const cls = score.overall >= 70 ? 'sw-eval-badge--high' : score.overall >= 40 ? 'sw-eval-badge--mid' : 'sw-eval-badge--low';
  return (
    <span className={`sw-eval-badge ${cls}`} title={score.verdict}>
      {score.overall}/100 {score.experienceLevel && `· ${score.experienceLevel}`}
    </span>
  );
}

const EMPTY_PROFILE = {
  name: '', email: '', phone: '', location: '', current_title: '', current_company: '',
  experience_years: '', skills: '', education: '', linkedin_url: '',
  resume_filename: '', resume_text: '',
};

export default function Step3_SourceCandidates({ session, authFetch, onComplete, onRefresh }) {
  const [candidates, setCandidates]   = useState([]);
  const [selected, setSelected]       = useState({});
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [evaluating, setEvaluating]   = useState({});
  // AI check: { [candidateId]: { checking: bool, result: null | {...} } }
  const [aiChecks, setAiChecks]       = useState({});
  // Eval report modal
  const [reportSc, setReportSc]       = useState(null); // session_candidate row
  // Match reason expand
  const [reasonId, setReasonId]       = useState(null);
  const toggleReason = (id) => setReasonId(prev => prev === id ? null : id);
  // Add new profile modal
  const [showAddModal, setShowAddModal]   = useState(false);
  const [newProfile, setNewProfile]       = useState(EMPTY_PROFILE);
  const [addingProfile, setAddingProfile] = useState(false);
  const [addProfileErr, setAddProfileErr] = useState('');
  const [parsing, setParsing]             = useState(false);
  const fileInputRef                      = useRef(null);

  const runAiCheck = useCallback(async (candidate) => {
    const text = candidate.resume_text;
    if (!text || text.trim().length < 100) return;
    setAiChecks(prev => ({ ...prev, [candidate.id]: { checking: true, result: null } }));
    try {
      const res  = await authFetch(`${BACKEND_URL}/ai/check-ai-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setAiChecks(prev => ({
        ...prev,
        [candidate.id]: { checking: false, result: res.ok ? data : null },
      }));
    } catch {
      setAiChecks(prev => ({ ...prev, [candidate.id]: { checking: false, result: null } }));
    }
  }, [authFetch]);

  const job       = session.job;
  const reqSkills = job?.required_skills  || [];
  const prefSkills = job?.preferred_skills || [];
  const alreadyAdded = new Set(session.candidates.map(sc => sc.candidate_id));

  useEffect(() => {
    authFetch(`${BACKEND_URL}/candidates`).then(r => r.json())
      .then(d => {
        const all = (d.candidates || []).filter(c => !alreadyAdded.has(c.id));
        const scored = all
          .map(c => ({ ...c, _match: calcMatch(c.skills, reqSkills, prefSkills) }))
          .sort((a, b) => b._match - a._match)
          .slice(0, 50);
        setCandidates(scored);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session.id]);

  const toggleSelect = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const selectAll    = () => setSelected(Object.fromEntries(candidates.map(c => [c.id, true])));
  const clearAll     = () => setSelected({});
  const selCount     = Object.values(selected).filter(Boolean).length;

  const handleAdd = async () => {
    const ids = candidates.filter(c => selected[c.id]).map(c => c.id);
    if (!ids.length) return;
    setAdding(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: ids }),
      });
      const data = await res.json();
      setSelected({});
      await onRefresh();

      // Fire evaluations in background
      if (data.added?.length) {
        data.added.forEach(sc => {
          setEvaluating(e => ({ ...e, [sc.id]: true }));
          authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${sc.id}/evaluate`, { method: 'POST' })
            .then(() => onRefresh())
            .catch(console.error)
            .finally(() => setEvaluating(e => ({ ...e, [sc.id]: false })));
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleResumeUpload = async (file) => {
    if (!file) return;
    setParsing(true);
    setAddProfileErr('');
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res  = await authFetch(`${BACKEND_URL}/candidates/parse-resume`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      const f = data.fields || {};
      setNewProfile(p => ({
        ...p,
        name:             f.name             || p.name,
        email:            f.email            || p.email,
        phone:            f.phone            || p.phone,
        location:         f.location         || p.location,
        current_title:    f.current_title    || p.current_title,
        current_company:  f.current_company  || p.current_company,
        experience_years: f.experience_years != null ? String(f.experience_years) : p.experience_years,
        skills:           Array.isArray(f.skills) && f.skills.length ? f.skills.join(', ') : p.skills,
        education:        f.education        || p.education,
        linkedin_url:     f.linkedin_url     || p.linkedin_url,
        resume_filename:  data.resumeFilename || '',
        resume_text:      data.resumeText     || '',
      }));
    } catch (err) {
      setAddProfileErr(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleAddNewProfile = async () => {
    if (!newProfile.name.trim()) { setAddProfileErr('Name is required.'); return; }
    setAddingProfile(true);
    setAddProfileErr('');
    try {
      const skillsArr = newProfile.skills
        ? newProfile.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      // 1. Create candidate in DB
      const cRes  = await authFetch(`${BACKEND_URL}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:             newProfile.name.trim(),
          email:            newProfile.email.trim()           || null,
          phone:            newProfile.phone.trim()           || null,
          location:         newProfile.location.trim()        || null,
          current_title:    newProfile.current_title.trim()   || null,
          current_company:  newProfile.current_company.trim() || null,
          experience_years: newProfile.experience_years ? Number(newProfile.experience_years) : null,
          skills:           skillsArr,
          education:        newProfile.education.trim()       || null,
          linkedin_url:     newProfile.linkedin_url.trim()    || null,
          resume_filename:  newProfile.resume_filename        || null,
          resume_text:      newProfile.resume_text            || null,
        }),
      });
      if (!cRes.ok) { const e = await cRes.json(); throw new Error(e.error || 'Failed to create candidate'); }
      const candidate = await cRes.json();

      // 2. Add to session
      const sRes  = await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: [candidate.id] }),
      });
      const sData = await sRes.json();
      setShowAddModal(false);
      setNewProfile(EMPTY_PROFILE);
      await onRefresh();

      // 3. Evaluate in background
      if (sData.added?.length) {
        sData.added.forEach(sc => {
          setEvaluating(e => ({ ...e, [sc.id]: true }));
          authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${sc.id}/evaluate`, { method: 'POST' })
            .then(() => onRefresh())
            .catch(console.error)
            .finally(() => setEvaluating(e => ({ ...e, [sc.id]: false })));
        });
      }
    } catch (err) {
      setAddProfileErr(err.message);
    } finally {
      setAddingProfile(false);
    }
  };

  const handleContinue = async () => {
    await onComplete({}, 4);
  };

  const handleRemove = async (scId) => {
    await authFetch(`${BACKEND_URL}/sessions/${session.id}/candidates/${scId}`, { method: 'DELETE' });
    await onRefresh();
  };

  const addedCandidates = session.candidates || [];

  return (
    <div className="sw-step-page">
      <div className="sw-step-header">
        <h2 className="sw-step-title">Step 3 — Source Candidates</h2>
        <p className="sw-step-desc">Select candidates from your database, scored against this job's skills.</p>
      </div>

      <div className="ai-disclaimer-banner">
        <span className="ai-disclaimer-icon">ℹ</span>
        Match scores and AI content checks are <strong>recommendations only</strong>. All candidate selection decisions require your review and judgement.
      </div>

      {/* Already added */}
      {addedCandidates.length > 0 && (
        <div className="sw-content-card" style={{ marginBottom: 16 }}>
          <div className="sw-section-title">Added to Session ({addedCandidates.length})</div>
          <div className="sw-added-list">
            {addedCandidates.map(sc => (
              <div key={sc.id}>
                <div className="sw-added-row">
                  <div className="sw-added-info">
                    <span className="sw-added-name">{sc.candidate_name}</span>
                    {sc.candidate_title && <span className="sw-added-title"> · {sc.candidate_title}</span>}
                  </div>
                  <div className="sw-added-badges">
                    <MatchBadge pct={Math.round(sc.match_percentage || 0)} />
                    <button
                      className={`sw-why-btn${reasonId === `added-${sc.id}` ? ' sw-why-btn--active' : ''}`}
                      onClick={() => toggleReason(`added-${sc.id}`)}
                    >Why?</button>
                    {evaluating[sc.id] ? (
                      <span className="sw-eval-badge sw-eval-badge--pending">Evaluating…</span>
                    ) : sc.resume_score ? (
                      <>
                        <ScoreBadge score={sc.resume_score} />
                        <button
                          className="aic-check-btn"
                          style={{ marginLeft: 4 }}
                          onClick={() => setReportSc(sc)}
                        >View Report</button>
                      </>
                    ) : (
                      <span className="sw-eval-badge sw-eval-badge--pending">No eval</span>
                    )}
                  </div>
                  <button className="ag-action-btn ag-action-btn--danger" onClick={() => handleRemove(sc.id)}>✕</button>
                </div>
                {reasonId === `added-${sc.id}` && (
                  <MatchReason
                    skills={sc.skills || []}
                    reqSkills={reqSkills}
                    prefSkills={prefSkills}
                    strengths={sc.resume_score?.strengths}
                    verdict={sc.resume_score?.verdict}
                  />
                )}
              </div>
            ))}
          </div>
          {addedCandidates.length > 0 && (
            <div className="sw-step-actions" style={{ marginTop: 12 }}>
              <button className="ag-btn ag-btn--primary" onClick={handleContinue}>Continue to Screening →</button>
            </div>
          )}
        </div>
      )}

      {/* Available candidates */}
      <div className="sw-content-card">
        <div className="sw-section-header">
          <div className="sw-section-title">Available Candidates (top 50 by match)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={selectAll}>Select All</button>
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={clearAll}>Clear</button>
            <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => { setShowAddModal(true); setAddProfileErr(''); }}>+ New Profile</button>
            <button
              className="ag-btn ag-btn--primary ag-btn--sm"
              onClick={handleAdd}
              disabled={selCount === 0 || adding}
            >
              {adding ? 'Adding…' : `+ Add ${selCount > 0 ? selCount : ''} Selected`}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="ag-empty">Loading candidates…</div>
        ) : candidates.length === 0 ? (
          <div className="ag-empty">No more candidates to add. Add more in the Candidate Database module.</div>
        ) : (
          <div className="sw-candidates-table-wrap">
            <table className="ag-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Name</th>
                  <th>Current Title</th>
                  <th>Match</th>
                  <th>Skills</th>
                  <th style={{ width: 120 }}>AI Content</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => {
                  const matched   = reqSkills.filter(s => (c.skills || []).map(x => x.toLowerCase()).includes(s.toLowerCase()));
                  const unmatched = reqSkills.filter(s => !matched.includes(s));
                  const aic       = aiChecks[c.id];
                  const hasResume = c.resume_text?.trim().length >= 100;
                  const isReasonOpen = reasonId === `avail-${c.id}`;
                  return (
                    <>
                      <tr key={c.id} className={selected[c.id] ? 'sw-row--selected' : ''} onClick={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }}>
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggleSelect(c.id)} />
                        </td>
                        <td><span className="sw-cand-name">{c.name}</span></td>
                        <td><span className="sw-cand-title">{c.current_title || '—'}</span></td>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          <MatchBadge pct={c._match} />
                          <button
                            className={`sw-why-btn${isReasonOpen ? ' sw-why-btn--active' : ''}`}
                            style={{ marginLeft: 6 }}
                            onClick={() => toggleReason(`avail-${c.id}`)}
                          >Why?</button>
                        </td>
                        <td>
                          <div className="sw-skill-row">
                            {matched.slice(0, 4).map(s   => <span key={s} className="skill-chip skill-chip--match">{s}</span>)}
                            {unmatched.slice(0, 3).map(s => <span key={s} className="skill-chip skill-chip--miss">{s}</span>)}
                            {(matched.length + unmatched.length) > 7 && <span className="sw-more">+{(matched.length + unmatched.length) - 7}</span>}
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {!hasResume ? (
                            <span className="aic-no-resume">No resume</span>
                          ) : aic?.checking ? (
                            <span className="aic-checking"><span className="spinner" style={{ width: 12, height: 12 }} /> Checking…</span>
                          ) : aic?.result ? (
                            <AicBadge result={aic.result} />
                          ) : (
                            <button className="aic-check-btn" onClick={() => runAiCheck(c)}>
                              Check AI
                            </button>
                          )}
                        </td>
                      </tr>
                      {isReasonOpen && (
                        <tr key={`reason-${c.id}`} className="sw-reason-row">
                          <td colSpan={6} style={{ padding: 0 }}>
                            <MatchReason
                              skills={c.skills}
                              reqSkills={reqSkills}
                              prefSkills={prefSkills}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add new profile modal */}
      {showAddModal && (
        <div className="ag-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="ag-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="ag-modal-header">
              <h3 className="ag-modal-title">Add New Profile</h3>
              <button className="jde-assets-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="ag-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Resume upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleResumeUpload(e.target.files[0]); e.target.value = ''; }}
              />
              <div
                className={`sw-resume-dropzone${parsing ? ' sw-resume-dropzone--loading' : newProfile.resume_filename ? ' sw-resume-dropzone--done' : ''}`}
                onClick={() => !parsing && fileInputRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (!parsing && e.dataTransfer.files[0]) handleResumeUpload(e.dataTransfer.files[0]); }}
              >
                {parsing ? (
                  <><span className="spinner" style={{ width: 14, height: 14 }} /> Parsing resume…</>
                ) : newProfile.resume_filename ? (
                  <><span style={{ color: 'var(--emerald)' }}>✓</span> {newProfile.resume_filename} — <span style={{ color: 'var(--purple)' }}>replace</span></>
                ) : (
                  <>Upload Resume <span className="sw-field-hint">PDF, DOCX or TXT — fields auto-fill</span></>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="sw-field-group">
                  <label className="sw-field-label">Name <span style={{ color: '#f87171' }}>*</span></label>
                  <input className="ag-input" placeholder="Full name" value={newProfile.name}
                    onChange={e => setNewProfile(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="sw-field-group">
                  <label className="sw-field-label">Email</label>
                  <input className="ag-input" placeholder="email@example.com" value={newProfile.email}
                    onChange={e => setNewProfile(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="sw-field-group">
                  <label className="sw-field-label">Current Title</label>
                  <input className="ag-input" placeholder="e.g. Senior Engineer" value={newProfile.current_title}
                    onChange={e => setNewProfile(p => ({ ...p, current_title: e.target.value }))} />
                </div>
                <div className="sw-field-group">
                  <label className="sw-field-label">Current Company</label>
                  <input className="ag-input" placeholder="e.g. Acme Corp" value={newProfile.current_company}
                    onChange={e => setNewProfile(p => ({ ...p, current_company: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="sw-field-group">
                  <label className="sw-field-label">Experience (years)</label>
                  <input className="ag-input" type="number" min="0" placeholder="e.g. 5" value={newProfile.experience_years}
                    onChange={e => setNewProfile(p => ({ ...p, experience_years: e.target.value }))} />
                </div>
                <div className="sw-field-group">
                  <label className="sw-field-label">Location</label>
                  <input className="ag-input" placeholder="e.g. Bangalore" value={newProfile.location}
                    onChange={e => setNewProfile(p => ({ ...p, location: e.target.value }))} />
                </div>
              </div>
              <div className="sw-field-group">
                <label className="sw-field-label">Skills <span className="sw-field-hint">(comma-separated)</span></label>
                <input className="ag-input" placeholder="e.g. React, Node.js, SQL" value={newProfile.skills}
                  onChange={e => setNewProfile(p => ({ ...p, skills: e.target.value }))} />
              </div>
              <div className="sw-field-group">
                <label className="sw-field-label">LinkedIn URL</label>
                <input className="ag-input" placeholder="https://linkedin.com/in/..." value={newProfile.linkedin_url}
                  onChange={e => setNewProfile(p => ({ ...p, linkedin_url: e.target.value }))} />
              </div>
              {addProfileErr && <div className="ag-error">{addProfileErr}</div>}
            </div>
            <div className="ag-modal-footer">
              <button className="ag-btn ag-btn--ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleAddNewProfile} disabled={addingProfile}>
                {addingProfile ? 'Adding…' : 'Add to Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eval report modal */}
      {reportSc && reportSc.resume_score && (
        <div className="ag-modal-overlay" onClick={() => setReportSc(null)}>
          <div className="eval-report-modal" onClick={e => e.stopPropagation()}>
            <div className="eval-report-header">
              <div>
                <div className="eval-report-title">{reportSc.candidate_name}</div>
                {reportSc.candidate_title && (
                  <div className="eval-report-subtitle">{reportSc.candidate_title}</div>
                )}
              </div>
              <button className="jde-assets-modal-close" onClick={() => setReportSc(null)}>✕</button>
            </div>

            {(() => {
              const s = reportSc.resume_score;
              const scoreBar = (label, val) => (
                <div key={label} className="eval-score-row">
                  <span className="eval-score-label">{label}</span>
                  <div className="eval-score-bar-wrap">
                    <div
                      className="eval-score-bar"
                      style={{
                        width: `${val}%`,
                        background: val >= 70 ? 'var(--emerald)' : val >= 40 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="eval-score-num">{val}</span>
                </div>
              );
              return (
                <div className="eval-report-body">
                  <div className="eval-scores">
                    {scoreBar('Overall Match', s.overall)}
                    {s.contentQuality != null && scoreBar('Content Quality', s.contentQuality)}
                    {s.aiWritingDetection != null && scoreBar('Human Authenticity', 100 - s.aiWritingDetection)}
                  </div>

                  <div className="eval-section">
                    <div className="eval-section-label">Experience Level</div>
                    <span className="sw-eval-badge sw-eval-badge--mid" style={{ textTransform: 'capitalize' }}>
                      {s.experienceLevel || '—'}
                    </span>
                  </div>

                  {s.verdict && (
                    <div className="eval-section">
                      <div className="eval-section-label">Verdict</div>
                      <p className="eval-verdict-text">{s.verdict}</p>
                    </div>
                  )}

                  {s.strengths?.length > 0 && (
                    <div className="eval-section">
                      <div className="eval-section-label">Key Strengths</div>
                      <ul className="eval-strengths">
                        {s.strengths.map((str, i) => <li key={i}>{str}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
