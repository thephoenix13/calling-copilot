import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const TABS = [
  { id: 'funnel',     label: 'Pipeline Funnel' },
  { id: 'candidates', label: 'Candidates'       },
  { id: 'video',      label: 'Video Interviews' },
  { id: 'pofu',       label: 'Post-Offer'       },
  { id: 'jobs',       label: 'By Job'           },
];

const POFU_STATE_ORDER = ['offer_accepted','resigned','bgv','confirmed','joined','dropped'];
const POFU_STATE_LABELS = {
  offer_accepted: 'Offer Accepted',
  resigned:       'Resigned',
  bgv:            'BGV',
  confirmed:      'Confirmed',
  joined:         'Joined',
  dropped:        'Dropped',
};
const COMP_LABELS = {
  technical_skills: 'Technical Skills',
  communication:    'Communication',
  problem_solving:  'Problem Solving',
  leadership:       'Leadership',
  cultural_fit:     'Cultural Fit',
};
const REC_LABELS = {
  strong_fit:       'Strong Fit',
  good_fit:         'Good Fit',
  needs_review:     'Needs Review',
  not_recommended:  'Not Recommended',
};
const REC_COLORS = {
  strong_fit:      'var(--emerald)',
  good_fit:        '#60a5fa',
  needs_review:    '#facc15',
  not_recommended: '#f87171',
};

// ── Reusable chart primitives ─────────────────────────────────────────────────

function HBar({ label, value, max, color = 'var(--purple)', suffix = '', pct }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  const display = pct != null ? `${pct}%` : suffix ? `${value}${suffix}` : value;
  return (
    <div className="rpt-hbar-row">
      <span className="rpt-hbar-label">{label}</span>
      <div className="rpt-hbar-track">
        <div className="rpt-hbar-fill" style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="rpt-hbar-val">{display}</span>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rpt-stat-card">
      <div className="rpt-stat-value" style={color ? { color } : {}}>{value}</div>
      <div className="rpt-stat-label">{label}</div>
      {sub && <div className="rpt-stat-sub">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="rpt-section-title">{children}</div>;
}

function Card({ children, className = '' }) {
  return <div className={`rpt-card ${className}`}>{children}</div>;
}

function pct(n, total) {
  if (!total) return '—';
  return `${Math.round((n / total) * 100)}%`;
}

// ── Tab components ────────────────────────────────────────────────────────────

function FunnelTab({ data }) {
  const { funnel, video } = data;
  const total      = funnel.sourced || 1;
  const vcTotal    = video.funnel.total || 1;
  const vcStarted  = video.funnel.inProgress + video.funnel.completed + video.funnel.evaluated;
  const vcDone     = video.funnel.completed + video.funnel.evaluated;

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        {/* Screening funnel */}
        <Card>
          <SectionTitle>Screening Pipeline</SectionTitle>
          <div className="rpt-hbar-chart">
            <HBar label="Sourced"          value={funnel.sourced}    max={total} color="var(--purple)"  />
            <HBar label="Passed Screening" value={funnel.screenPass} max={total} color="var(--emerald)" />
            <HBar label="Failed Screening" value={funnel.screenFail} max={total} color="#f87171"        />
            <HBar label="VI Invited"       value={funnel.viInvited}  max={total} color="#60a5fa"        />
            <HBar label="Proceeded"        value={funnel.proceeded}  max={total} color="#f59e0b"        />
            <HBar label="Selected"         value={funnel.selected}   max={total} color="#10b981"        />
          </div>
          <div className="rpt-total-note">{funnel.pooled} pooled · {funnel.screenPend} pending screening</div>
        </Card>

        {/* Video interview funnel */}
        <Card>
          <SectionTitle>Video Interview Funnel</SectionTitle>
          {video.funnel.total === 0 ? (
            <div className="rpt-empty">No video interview candidates yet.</div>
          ) : (
            <>
              <div className="rpt-hbar-chart">
                <HBar label="Invited"   value={video.funnel.total}     max={vcTotal} color="var(--purple)"  />
                <HBar label="Started"   value={vcStarted}              max={vcTotal} color="#60a5fa"        />
                <HBar label="Completed" value={vcDone}                 max={vcTotal} color="#f59e0b"        />
                <HBar label="Evaluated" value={video.funnel.evaluated} max={vcTotal} color="var(--emerald)" />
              </div>
              <div className="rpt-total-note">
                {pct(vcDone, video.funnel.total)} completion rate · {video.funnel.invited} pending
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function CandidatesTab({ data }) {
  const { screening } = data;
  const scoreMax  = Math.max(...screening.scoreBuckets.map(b => b.count), 1);
  const matchMax  = Math.max(...screening.matchBuckets.map(b => b.count), 1);
  const statusTotal = screening.statusBreakdown.pass + screening.statusBreakdown.fail + screening.statusBreakdown.pending;
  const decTotal    = screening.decisions.proceed + screening.decisions.pool;

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        {/* Screening status */}
        <Card>
          <SectionTitle>Screening Status</SectionTitle>
          <div className="rpt-hbar-chart">
            <HBar label="Shortlisted" value={screening.statusBreakdown.pass}    max={statusTotal} color="var(--emerald)" />
            <HBar label="Rejected"    value={screening.statusBreakdown.fail}    max={statusTotal} color="#f87171"        />
            <HBar label="Pending"     value={screening.statusBreakdown.pending} max={statusTotal} color="var(--text-3)"  />
          </div>
          <div className="rpt-total-note">{statusTotal} total candidates across all sessions</div>
        </Card>

        {/* Decision outcomes */}
        <Card>
          <SectionTitle>Decision Outcomes</SectionTitle>
          <div className="rpt-hbar-chart">
            <HBar label="Proceed"  value={screening.decisions.proceed} max={decTotal || 1} color="var(--emerald)" />
            <HBar label="Pool"     value={screening.decisions.pool}    max={decTotal || 1} color="#60a5fa"        />
          </div>
          <div className="rpt-mini-stats">
            <div className="rpt-mini-stat">
              <span className="rpt-mini-val">{screening.viReview.hold}</span>
              <span className="rpt-mini-lbl">On Hold (VI Review)</span>
            </div>
            <div className="rpt-mini-stat">
              <span className="rpt-mini-val">{screening.viReview.reject}</span>
              <span className="rpt-mini-lbl">Rejected (VI Review)</span>
            </div>
          </div>
        </Card>

        {/* AI Interview score distribution */}
        <Card>
          <SectionTitle>AI Interview Score Distribution</SectionTitle>
          {screening.scoreBuckets.every(b => b.count === 0) ? (
            <div className="rpt-empty">No scores recorded yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              {screening.scoreBuckets.map(b => (
                <HBar key={b.range} label={b.range} value={b.count} max={scoreMax} color="var(--orange)" />
              ))}
            </div>
          )}
        </Card>

        {/* Match % distribution */}
        <Card>
          <SectionTitle>Skill Match % Distribution</SectionTitle>
          {screening.matchBuckets.every(b => b.count === 0) ? (
            <div className="rpt-empty">No match data yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              {screening.matchBuckets.map(b => (
                <HBar key={b.range} label={b.range} value={b.count} max={matchMax} color="var(--purple)" />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function VideoTab({ data }) {
  const { video } = data;
  const recTotal  = Object.values(video.recommendations).reduce((s, v) => s + v, 0);
  const scoreMax  = Math.max(...video.scoreBuckets.map(b => b.count), 1);

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        {/* Hiring recommendations */}
        <Card>
          <SectionTitle>Hiring Recommendations</SectionTitle>
          {recTotal === 0 ? (
            <div className="rpt-empty">No evaluations completed yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              {['strong_fit','good_fit','needs_review','not_recommended'].map(key => (
                <HBar
                  key={key}
                  label={REC_LABELS[key] || key}
                  value={video.recommendations[key] || 0}
                  max={recTotal}
                  color={REC_COLORS[key]}
                />
              ))}
            </div>
          )}
          <div className="rpt-total-note">{video.totalEvaluated} candidates evaluated</div>
        </Card>

        {/* Overall score distribution */}
        <Card>
          <SectionTitle>Overall Score Distribution</SectionTitle>
          {video.scoreBuckets.every(b => b.count === 0) ? (
            <div className="rpt-empty">No scores available yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              {video.scoreBuckets.map(b => (
                <HBar key={b.range} label={b.range} value={b.count} max={scoreMax} color="var(--purple)" />
              ))}
            </div>
          )}
        </Card>

        {/* Competency scores */}
        <Card className="rpt-card--full">
          <SectionTitle>Average Competency Scores</SectionTitle>
          {Object.values(video.avgCompetency).every(v => v == null) ? (
            <div className="rpt-empty">No competency data yet.</div>
          ) : (
            <div className="rpt-competency-grid">
              {Object.entries(COMP_LABELS).map(([key, label]) => {
                const val = video.avgCompetency[key];
                return (
                  <div key={key} className="rpt-comp-item">
                    <div className="rpt-comp-header">
                      <span className="rpt-comp-label">{label}</span>
                      <span className="rpt-comp-score">{val != null ? `${val}/100` : '—'}</span>
                    </div>
                    <div className="rpt-comp-track">
                      <div className="rpt-comp-fill" style={{ width: `${val || 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PofuTab({ data }) {
  const { pofu } = data;
  const stateMax = Math.max(...POFU_STATE_ORDER.map(s => pofu.stateCounts[s] || 0), 1);
  const riskTotal = pofu.riskCounts.low + pofu.riskCounts.medium + pofu.riskCounts.high;
  const emailTotal = pofu.emailCounts.outbound + pofu.emailCounts.inbound;
  const responseRate = pofu.emailCounts.outbound > 0
    ? Math.round(pofu.emailCounts.inbound / pofu.emailCounts.outbound * 100)
    : 0;

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        {/* State breakdown */}
        <Card>
          <SectionTitle>Candidate State Progression</SectionTitle>
          {pofu.total === 0 ? (
            <div className="rpt-empty">No POFU candidates yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              {POFU_STATE_ORDER.map((state, i) => {
                const count = pofu.stateCounts[state] || 0;
                const colors = ['#60a5fa','#a78bfa','#f59e0b','#34d399','#10b981','#f87171'];
                return (
                  <HBar key={state} label={POFU_STATE_LABELS[state]} value={count} max={stateMax} color={colors[i]} />
                );
              })}
            </div>
          )}
          <div className="rpt-total-note">{pofu.total} candidates total</div>
        </Card>

        {/* Risk distribution */}
        <Card>
          <SectionTitle>Risk Level Distribution</SectionTitle>
          {riskTotal === 0 ? (
            <div className="rpt-empty">No risk data yet.</div>
          ) : (
            <>
              <div className="rpt-hbar-chart">
                <HBar label="Low"    value={pofu.riskCounts.low}    max={riskTotal} color="var(--emerald)" />
                <HBar label="Medium" value={pofu.riskCounts.medium} max={riskTotal} color="#f59e0b"        />
                <HBar label="High"   value={pofu.riskCounts.high}   max={riskTotal} color="#f87171"        />
              </div>
              <div className="rpt-risk-avg">
                Avg Risk Score: <strong>{pofu.avgRisk}/100</strong>
              </div>
            </>
          )}
        </Card>

        {/* Email stats */}
        <Card>
          <SectionTitle>Email Engagement</SectionTitle>
          <div className="rpt-email-stats">
            <div className="rpt-email-stat">
              <span className="rpt-email-num">{pofu.emailCounts.outbound}</span>
              <span className="rpt-email-lbl">Outbound Emails</span>
            </div>
            <div className="rpt-email-divider" />
            <div className="rpt-email-stat">
              <span className="rpt-email-num" style={{ color: 'var(--emerald)' }}>{pofu.emailCounts.inbound}</span>
              <span className="rpt-email-lbl">Responses Received</span>
            </div>
            <div className="rpt-email-divider" />
            <div className="rpt-email-stat">
              <span className="rpt-email-num" style={{ color: '#60a5fa' }}>{responseRate}%</span>
              <span className="rpt-email-lbl">Response Rate</span>
            </div>
          </div>
        </Card>

        {/* Drop rate */}
        <Card>
          <SectionTitle>Offer Outcome</SectionTitle>
          {pofu.total === 0 ? (
            <div className="rpt-empty">No data yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              <HBar label="Joined"      value={pofu.stateCounts.joined  || 0} max={pofu.total} color="var(--emerald)" />
              <HBar label="Dropped"     value={pofu.stateCounts.dropped || 0} max={pofu.total} color="#f87171"        />
              <HBar label="In Progress" value={pofu.total - (pofu.stateCounts.joined || 0) - (pofu.stateCounts.dropped || 0)} max={pofu.total} color="var(--text-3)" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Job Detail view ───────────────────────────────────────────────────────────

const STATUS_COLORS = { active: 'var(--emerald)', closed: '#f87171', draft: 'var(--text-3)' };

function SkillBar({ skill, count, total }) {
  const w = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div className="rpt-skill-row">
      <span className="rpt-skill-name">{skill}</span>
      <div className="rpt-hbar-track" style={{ flex: 1 }}>
        <div className="rpt-hbar-fill" style={{ width: `${w}%`, background: 'var(--purple)' }} />
      </div>
      <span className="rpt-skill-count">{count}/{total}</span>
    </div>
  );
}

function JobDetail({ jobId, authFetch, onBack }) {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    authFetch(`${BACKEND_URL}/reports/jobs/${jobId}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setDetail(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return <div className="rpt-loading">Loading job analytics…</div>;
  if (error)   return <div className="rpt-error">{error}</div>;
  if (!detail) return null;

  const { job, funnel, screening, skillsCoverage, video, pofu } = detail;
  const fTotal = funnel.sourced || 1;
  const scoreMax = Math.max(...screening.scoreBuckets.map(b => b.count), 1);
  const matchMax = Math.max(...screening.matchBuckets.map(b => b.count), 1);
  const recTotal = Object.values(video.recommendations).reduce((s, v) => s + v, 0);

  return (
    <div className="rpt-job-detail">
      {/* Header */}
      <div className="rpt-job-detail-header">
        <button className="rpt-back-btn" onClick={onBack}>← All Jobs</button>
        <div className="rpt-job-detail-title">
          <h2 className="rpt-job-name">{job.title}</h2>
          <div className="rpt-job-meta-row">
            {job.client_name  && <span className="rpt-job-meta-chip">{job.client_name}</span>}
            {job.department   && <span className="rpt-job-meta-chip">{job.department}</span>}
            {job.location     && <span className="rpt-job-meta-chip">{job.location}</span>}
            <span className="rpt-job-meta-chip" style={{ color: STATUS_COLORS[job.status] }}>
              {job.status}
            </span>
            {job.openings_count > 0 && (
              <span className="rpt-job-meta-chip">{job.openings_count} opening{job.openings_count !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="rpt-job-kpis">
        <StatCard label="Sourced"    value={funnel.sourced}   />
        <StatCard label="Shortlisted" value={funnel.passed}   color="var(--emerald)" sub={funnel.sourced > 0 ? `${Math.round(funnel.passed/funnel.sourced*100)}% pass rate` : undefined} />
        <StatCard label="VI Invited" value={funnel.viInvited} color="var(--purple)"  />
        <StatCard label="Proceeded"  value={funnel.proceeded} color="var(--orange)"  />
        <StatCard label="Selected"   value={funnel.selected}  color="var(--emerald)" />
        {pofu.total > 0 && <StatCard label="In POFU" value={pofu.total} sub={`${pofu.states?.joined || 0} joined`} />}
      </div>

      <div className="rpt-two-col">
        {/* Funnel */}
        <Card>
          <SectionTitle>Hiring Funnel</SectionTitle>
          <div className="rpt-hbar-chart">
            <HBar label="Sourced"     value={funnel.sourced}   max={fTotal} color="var(--purple)"  />
            <HBar label="Shortlisted" value={funnel.passed}    max={fTotal} color="var(--emerald)" />
            <HBar label="VI Invited"  value={funnel.viInvited} max={fTotal} color="#60a5fa"        />
            <HBar label="Proceeded"   value={funnel.proceeded} max={fTotal} color="#f59e0b"        />
            <HBar label="Selected"    value={funnel.selected}  max={fTotal} color="#10b981"        />
          </div>
        </Card>

        {/* AI Score distribution */}
        <Card>
          <SectionTitle>AI Interview Scores</SectionTitle>
          {screening.scoreBuckets.every(b => b.count === 0) ? (
            <div className="rpt-empty">No scores yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              {screening.scoreBuckets.map(b => (
                <HBar key={b.range} label={b.range} value={b.count} max={scoreMax} color="var(--orange)" />
              ))}
            </div>
          )}
        </Card>

        {/* Match % distribution */}
        <Card>
          <SectionTitle>Skill Match % Distribution</SectionTitle>
          {screening.matchBuckets.every(b => b.count === 0) ? (
            <div className="rpt-empty">No match data yet.</div>
          ) : (
            <div className="rpt-hbar-chart">
              {screening.matchBuckets.map(b => (
                <HBar key={b.range} label={b.range} value={b.count} max={matchMax} color="var(--purple)" />
              ))}
            </div>
          )}
        </Card>

        {/* Skills coverage */}
        {(skillsCoverage.required.length > 0 || skillsCoverage.preferred.length > 0) && (
          <Card>
            <SectionTitle>Skills Coverage</SectionTitle>
            {skillsCoverage.required.length > 0 && (
              <>
                <div className="rpt-skill-group-label">Required</div>
                <div className="rpt-skills-list">
                  {skillsCoverage.required.map(s => (
                    <SkillBar key={s.skill} skill={s.skill} count={s.count} total={s.total} />
                  ))}
                </div>
              </>
            )}
            {skillsCoverage.preferred.length > 0 && (
              <>
                <div className="rpt-skill-group-label" style={{ marginTop: 12 }}>Preferred</div>
                <div className="rpt-skills-list">
                  {skillsCoverage.preferred.map(s => (
                    <SkillBar key={s.skill} skill={s.skill} count={s.count} total={s.total} />
                  ))}
                </div>
              </>
            )}
          </Card>
        )}

        {/* Video interview */}
        {video.funnel.total > 0 && (
          <Card>
            <SectionTitle>Video Interview</SectionTitle>
            <div className="rpt-job-kpis" style={{ margin: '0 0 14px' }}>
              <StatCard label="Invited"   value={video.funnel.total}     />
              <StatCard label="Completed" value={video.funnel.completed} color="var(--emerald)" />
              <StatCard label="Evaluated" value={video.funnel.evaluated} color="var(--purple)"  />
            </div>
            {recTotal > 0 && (
              <div className="rpt-hbar-chart">
                {['strong_fit','good_fit','needs_review','not_recommended'].map(key => (
                  <HBar key={key} label={REC_LABELS[key] || key}
                    value={video.recommendations[key] || 0}
                    max={recTotal}
                    color={REC_COLORS[key]}
                  />
                ))}
              </div>
            )}
            {Object.values(video.avgCompetency).some(v => v != null) && (
              <>
                <div className="rpt-section-title" style={{ marginTop: 16 }}>Avg Competency</div>
                <div className="rpt-hbar-chart">
                  {Object.entries(COMP_LABELS).map(([key, label]) => {
                    const val = video.avgCompetency[key];
                    return val != null
                      ? <HBar key={key} label={label} value={val} max={100} color="var(--purple)" suffix="/100" />
                      : null;
                  })}
                </div>
              </>
            )}
          </Card>
        )}

        {/* POFU */}
        {pofu.total > 0 && (
          <Card>
            <SectionTitle>Post-Offer Follow-Up</SectionTitle>
            <div className="rpt-hbar-chart">
              {POFU_STATE_ORDER.map((state, i) => {
                const colors = ['#60a5fa','#a78bfa','#f59e0b','#34d399','#10b981','#f87171'];
                return (
                  <HBar key={state} label={POFU_STATE_LABELS[state]}
                    value={pofu.states[state] || 0} max={pofu.total}
                    color={colors[i]}
                  />
                );
              })}
            </div>
            <div className="rpt-total-note">Avg risk score: {pofu.avgRisk}/100</div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Jobs list + drill-down tab ────────────────────────────────────────────────

function JobsTab({ authFetch }) {
  const [jobs,     setJobs]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState(null); // jobId for drill-down

  useEffect(() => {
    authFetch(`${BACKEND_URL}/reports/jobs`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setJobs(d.jobs || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rpt-loading">Loading jobs…</div>;
  if (error)   return <div className="rpt-error">{error}</div>;

  if (selected) {
    return <JobDetail jobId={selected} authFetch={authFetch} onBack={() => setSelected(null)} />;
  }

  if (!jobs || jobs.length === 0) {
    return <div className="rpt-empty" style={{ padding: '60px 0' }}>No jobs found. Create a job to see analytics here.</div>;
  }

  return (
    <div className="rpt-tab-content">
      <div className="rpt-jobs-table-wrap">
        <table className="rpt-jobs-table">
          <thead>
            <tr>
              <th>Job / Client</th>
              <th>Department</th>
              <th>Status</th>
              <th className="rpt-th-num">Sourced</th>
              <th className="rpt-th-num">Passed</th>
              <th className="rpt-th-num">Pass Rate</th>
              <th className="rpt-th-num">Selected</th>
              <th className="rpt-th-num">VI</th>
              <th className="rpt-th-num">POFU</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className="rpt-jobs-row" onClick={() => setSelected(job.id)}>
                <td>
                  <div className="rpt-job-title-cell">{job.title}</div>
                  {job.client_name && <div className="rpt-job-client-cell">{job.client_name}</div>}
                </td>
                <td className="rpt-td-muted">{job.department || '—'}</td>
                <td>
                  <span className="rpt-status-dot" style={{ color: STATUS_COLORS[job.status] }}>
                    ● {job.status}
                  </span>
                </td>
                <td className="rpt-td-num">{job.sourced}</td>
                <td className="rpt-td-num">{job.passed}</td>
                <td className="rpt-td-num">
                  {job.pass_rate != null
                    ? <span className={`rpt-rate ${job.pass_rate >= 50 ? 'rpt-rate--good' : ''}`}>{job.pass_rate}%</span>
                    : '—'}
                </td>
                <td className="rpt-td-num">{job.selected > 0 ? <strong style={{ color: 'var(--emerald)' }}>{job.selected}</strong> : job.selected}</td>
                <td className="rpt-td-num rpt-td-muted">{job.vi_count}</td>
                <td className="rpt-td-num rpt-td-muted">{job.pofu_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rpt-table-hint">Click a row to view job-level analytics</div>
    </div>
  );
}

// ── Main module ───────────────────────────────────────────────────────────────

export default function ReportsModule({ authFetch }) {
  const [tab,     setTab]     = useState('funnel');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${BACKEND_URL}/reports/summary`);
      if (!res.ok) throw new Error('Failed to load report data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-content"><div className="rpt-loading">Loading reports…</div></div>;
  if (error)   return <div className="page-content"><div className="rpt-error">{error} <button onClick={load} className="ag-btn ag-btn--ghost ag-btn--sm">Retry</button></div></div>;
  if (!data)   return null;

  const { overview, funnel, jobs } = data;
  const fmtDur = (s) => s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;

  return (
    <div className="page-content">
      <div className="rpt-header">
        <div>
          <h1 className="rpt-title">Reports & Analytics</h1>
          <p className="rpt-subtitle">Aggregated data across all your hiring activity</p>
        </div>
        <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={load}>↺ Refresh</button>
      </div>

      {/* KPI summary strip */}
      <div className="rpt-kpi-strip">
        <StatCard label="Active Jobs"       value={overview.activeJobs}                                              sub={`${overview.totalJobs} total`}       color="var(--orange)"  />
        <StatCard label="Candidates"        value={overview.totalCandidates.toLocaleString()}                        sub="in database"                                                />
        <StatCard label="Pipeline Sessions" value={overview.totalSessions}                                           sub={`${funnel.sourced} sourced`}                                />
        <StatCard label="Selected"          value={funnel.selected}                                                  sub={`${funnel.proceeded} proceeded`}     color="var(--emerald)" />
        <StatCard label="Video Interviews"  value={overview.totalVI}                                                 sub={`${data.video.funnel.completed + data.video.funnel.evaluated} completed`} color="var(--purple)" />
        <StatCard label="POFU Candidates"   value={overview.totalPofu}                                               sub={`${data.pofu.stateCounts.joined || 0} joined`}             />
        <StatCard label="Calls Made"        value={overview.calls.total}                                             sub={overview.calls.avgDuration ? `avg ${fmtDur(overview.calls.avgDuration)}` : `${overview.calls.completed} completed`} />
      </div>

      {/* Tabs */}
      <div className="rpt-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`rpt-tab-btn${tab === t.id ? ' rpt-tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'funnel'     && <FunnelTab     data={data} />}
      {tab === 'candidates' && <CandidatesTab data={data} />}
      {tab === 'video'      && <VideoTab      data={data} />}
      {tab === 'pofu'       && <PofuTab       data={data} />}
      {tab === 'jobs'       && <JobsTab       authFetch={authFetch} />}
    </div>
  );
}
