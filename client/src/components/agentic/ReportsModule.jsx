import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const TABS = [
  { id: 'funnel',      label: 'Pipeline Funnel'  },
  { id: 'efficiency',  label: 'Efficiency'        },
  { id: 'candidates',  label: 'Candidates'        },
  { id: 'assessments', label: 'Assessments'       },
  { id: 'video',       label: 'Video Interviews'  },
  { id: 'pofu',        label: 'Post-Offer'        },
  { id: 'activity',    label: 'Activity'          },
  { id: 'jobs',        label: 'By Job'            },
];

const POFU_STATE_ORDER  = ['offer_accepted','resigned','bgv','confirmed','joined','dropped'];
const POFU_STATE_LABELS = {
  offer_accepted: 'Offer Accepted', resigned: 'Resigned', bgv: 'BGV',
  confirmed: 'Confirmed', joined: 'Joined', dropped: 'Dropped',
};
const COMP_LABELS = {
  technical_skills: 'Technical Skills', communication: 'Communication',
  problem_solving: 'Problem Solving', leadership: 'Leadership', cultural_fit: 'Cultural Fit',
};
const REC_LABELS = {
  strong_fit: 'Strong Fit', good_fit: 'Good Fit',
  needs_review: 'Needs Review', not_recommended: 'Not Recommended',
};
const REC_COLORS = {
  strong_fit: 'var(--emerald)', good_fit: '#60a5fa',
  needs_review: '#facc15', not_recommended: '#f87171',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt.replace ? dt.replace(' ', 'T') : dt)
      .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const Badge = ({ text, color }) => (
  <span style={{
    display: 'inline-block', fontSize: 11, fontWeight: 600,
    padding: '2px 7px', borderRadius: 4,
    background: `${color}18`, color, border: `1px solid ${color}40`,
  }}>{text}</span>
);

const SCREEN_COLORS  = { pass: 'var(--emerald)', fail: '#f87171', pending: '#94a3b8', on_hold: '#f59e0b' };
const DECISION_COLORS = { proceed: 'var(--emerald)', pool: '#60a5fa' };
const PIPE_COLORS    = { selected: 'var(--emerald)', hold: '#f59e0b', reject: '#f87171', pending: '#94a3b8' };
const VI_COLORS      = { invited: '#94a3b8', in_progress: '#f59e0b', completed: '#60a5fa', evaluated: 'var(--emerald)' };
const RISK_COLORS    = { low: 'var(--emerald)', medium: '#f59e0b', high: '#f87171' };
const POFU_COLORS    = { offer_accepted: '#60a5fa', resigned: '#a78bfa', bgv: '#f59e0b', confirmed: '#34d399', joined: '#10b981', dropped: '#f87171' };

// ── Reusable chart primitives ─────────────────────────────────────────────────

function HBar({ label, value, max, color = 'var(--purple)', suffix = '', pct }) {
  const width   = max > 0 ? Math.round((value / max) * 100) : 0;
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

function SectionTitle({ children }) { return <div className="rpt-section-title">{children}</div>; }
function Card({ children, className = '' }) { return <div className={`rpt-card ${className}`}>{children}</div>; }
function pct(n, total) { if (!total) return '—'; return `${Math.round((n / total) * 100)}%`; }

// ── Generic detail table ──────────────────────────────────────────────────────

function DetailTable({ title, columns, rows, empty = 'No records yet.' }) {
  const count = rows?.length ?? 0;
  return (
    <Card className="rpt-card--full" style={{ marginTop: 20 }}>
      <SectionTitle>{title} <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 12 }}>({count} record{count !== 1 ? 's' : ''})</span></SectionTitle>
      {count === 0 ? (
        <div className="rpt-empty">{empty}</div>
      ) : (
        <div className="rpt-jobs-table-wrap">
          <table className="rpt-jobs-table">
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c.key} className={c.num ? 'rpt-th-num' : ''}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="rpt-detail-row">
                  {columns.map(c => (
                    <td key={c.key} className={c.num ? 'rpt-td-num' : c.muted ? 'rpt-td-muted' : ''}>
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Pipeline Funnel tab ───────────────────────────────────────────────────────

function FunnelTab({ data }) {
  const { funnel, video, activity } = data;
  const total     = funnel.sourced || 1;
  const vcTotal   = video.funnel.total || 1;
  const vcStarted = video.funnel.inProgress + video.funnel.completed + video.funnel.evaluated;
  const vcDone    = video.funnel.completed + video.funnel.evaluated;
  const sessions  = activity?.sessions || [];

  const sessionCols = [
    { key: 'name',       label: 'Session' },
    { key: 'job_title',  label: 'Job',        muted: true },
    { key: 'sourced',    label: 'Sourced',    num: true },
    { key: 'passed',     label: 'Shortlisted',num: true },
    { key: 'proceeded',  label: 'Proceeded',  num: true },
    { key: 'selected',   label: 'Selected',   num: true,
      render: r => r.selected > 0 ? <strong style={{ color: 'var(--emerald)' }}>{r.selected}</strong> : r.selected },
    { key: 'created_at', label: 'Date', muted: true, render: r => fmtDate(r.created_at) },
  ];

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        <Card>
          <SectionTitle>Screening Pipeline</SectionTitle>
          <div className="rpt-hbar-chart">
            <HBar label="Sourced"         value={funnel.sourced}    max={total} color="var(--purple)"  />
            <HBar label="Shortlisted"     value={funnel.screenPass} max={total} color="var(--emerald)" />
            <HBar label="Failed Screening"value={funnel.screenFail} max={total} color="#f87171"        />
            <HBar label="VI Invited"      value={funnel.viInvited}  max={total} color="#60a5fa"        />
            <HBar label="Proceeded"       value={funnel.proceeded}  max={total} color="#f59e0b"        />
            <HBar label="Selected"        value={funnel.selected}   max={total} color="#10b981"        />
          </div>
          <div className="rpt-total-note">{funnel.pooled} pooled · {funnel.screenPend} pending screening</div>
        </Card>
        <Card>
          <SectionTitle>Video Interview Funnel</SectionTitle>
          {video.funnel.total === 0 ? <div className="rpt-empty">No video interview candidates yet.</div> : (
            <>
              <div className="rpt-hbar-chart">
                <HBar label="Invited"   value={video.funnel.total}     max={vcTotal} color="var(--purple)"  />
                <HBar label="Started"   value={vcStarted}              max={vcTotal} color="#60a5fa"        />
                <HBar label="Completed" value={vcDone}                 max={vcTotal} color="#f59e0b"        />
                <HBar label="Evaluated" value={video.funnel.evaluated} max={vcTotal} color="var(--emerald)" />
              </div>
              <div className="rpt-total-note">{pct(vcDone, video.funnel.total)} completion rate</div>
            </>
          )}
        </Card>
      </div>
      <DetailTable title="Session Breakdown" columns={sessionCols} rows={sessions} />
    </div>
  );
}

// ── Efficiency tab ────────────────────────────────────────────────────────────

function EfficiencyTab({ data, details }) {
  const { funnel, timing, conversions } = data;

  const stages = [
    { label: 'Sourced',     count: funnel.sourced,    rate: null },
    { label: 'Shortlisted', count: funnel.screenPass, rate: conversions.sourcedToScreened   },
    { label: 'VI Invited',  count: funnel.viInvited,  rate: conversions.screenedToVI        },
    { label: 'Proceeded',   count: funnel.proceeded,  rate: conversions.viToProceeded       },
    { label: 'Selected',    count: funnel.selected,   rate: conversions.proceededToSelected },
  ];
  const validRates = stages.filter(s => s.rate != null).map(s => s.rate);
  const minRate    = validRates.length ? Math.min(...validRates) : null;
  const maxCount   = funnel.sourced || 1;

  const timeStages = [
    timing.avgSourcingToVI  != null && { label: 'Sourcing → VI Invite', days: timing.avgSourcingToVI  },
    timing.avgVIToSelected  != null && { label: 'VI Invite → Selected', days: timing.avgVIToSelected  },
  ].filter(Boolean);
  const maxDays = Math.max(...timeStages.map(t => t.days), 1);
  const selectionRate = funnel.sourced > 0 ? Math.round(funnel.selected / funnel.sourced * 100) : null;

  const candidates = details?.candidates || [];

  const candCols = [
    { key: 'candidate_name',    label: 'Candidate' },
    { key: 'job_title',         label: 'Job',         muted: true },
    { key: 'screening_status',  label: 'Screening',
      render: r => r.screening_status
        ? <Badge text={r.screening_status} color={SCREEN_COLORS[r.screening_status] || '#94a3b8'} /> : '—' },
    { key: 'decision',          label: 'Decision',
      render: r => r.decision
        ? <Badge text={r.decision} color={DECISION_COLORS[r.decision] || '#94a3b8'} /> : '—' },
    { key: 'interview_level',   label: 'Level',       muted: true,
      render: r => r.interview_level || '—' },
    { key: 'pipeline_status',   label: 'Pipeline',
      render: r => r.pipeline_status
        ? <Badge text={r.pipeline_status} color={PIPE_COLORS[r.pipeline_status] || '#94a3b8'} /> : '—' },
    { key: 'added_at',          label: 'Added',       muted: true, render: r => fmtDate(r.added_at) },
  ];

  return (
    <div className="rpt-tab-content">
      <Card className="rpt-card--full">
        <SectionTitle>Stage Conversion Rates</SectionTitle>
        {funnel.sourced === 0 ? <div className="rpt-empty">No pipeline data yet.</div> : (
          <div className="rpt-conv-funnel">
            {stages.map((stage, i) => {
              const barW        = Math.round(stage.count / maxCount * 100);
              const isBottleneck = stage.rate != null && stage.rate === minRate && minRate < 70;
              const dropped     = i > 0 ? stages[i - 1].count - stage.count : 0;
              return (
                <div key={stage.label} className={`rpt-conv-row${isBottleneck ? ' rpt-conv-row--bottleneck' : ''}`}>
                  <div className="rpt-conv-label">{stage.label}</div>
                  <div className="rpt-conv-bar-wrap">
                    <div className="rpt-conv-bar" style={{
                      width: `${barW}%`,
                      background: i === 0 ? 'var(--purple)' : isBottleneck ? '#f87171' : 'var(--emerald)',
                    }}>
                      <span className="rpt-conv-count">{stage.count}</span>
                    </div>
                  </div>
                  <div className="rpt-conv-meta">
                    {stage.rate != null
                      ? <span className={`rpt-conv-rate${isBottleneck ? ' rpt-conv-rate--warn' : ''}`}>{stage.rate}%{isBottleneck ? ' ⚠ bottleneck' : ''}</span>
                      : <span className="rpt-conv-rate rpt-conv-rate--base">baseline</span>}
                    {dropped > 0 && <span className="rpt-conv-drop">−{dropped} dropped</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <div className="rpt-two-col">
        <Card>
          <SectionTitle>Time in Stage (Avg Days)</SectionTitle>
          {timing.avgTimeToHire == null ? (
            <div className="rpt-empty">Time data appears once candidates reach Selected.</div>
          ) : (
            <>
              <div className="rpt-hbar-chart">
                {timeStages.map(t => <HBar key={t.label} label={t.label} value={t.days} max={maxDays} suffix=" days" color="#60a5fa" />)}
              </div>
              <div className="rpt-total-note" style={{ marginTop: 12 }}>Avg total time to hire: <strong>{timing.avgTimeToHire} days</strong></div>
            </>
          )}
        </Card>
        <Card>
          <SectionTitle>Overall Performance</SectionTitle>
          <div className="rpt-perf-grid">
            <div className="rpt-perf-item">
              <div className="rpt-perf-val" style={{ color: 'var(--emerald)' }}>{selectionRate != null ? `${selectionRate}%` : '—'}</div>
              <div className="rpt-perf-lbl">Overall Selection Rate</div>
              <div className="rpt-perf-sub">{funnel.selected} selected of {funnel.sourced} sourced</div>
            </div>
            <div className="rpt-perf-item">
              <div className="rpt-perf-val" style={{ color: 'var(--orange)' }}>{timing.avgTimeToHire != null ? `${timing.avgTimeToHire}d` : '—'}</div>
              <div className="rpt-perf-lbl">Avg Time to Hire</div>
              <div className="rpt-perf-sub">days from sourcing to selected</div>
            </div>
            <div className="rpt-perf-item">
              <div className="rpt-perf-val" style={{ color: 'var(--purple)' }}>{funnel.screenPass > 0 ? `${Math.round(funnel.selected / funnel.screenPass * 100)}%` : '—'}</div>
              <div className="rpt-perf-lbl">Shortlist-to-Hire Rate</div>
              <div className="rpt-perf-sub">of shortlisted candidates selected</div>
            </div>
          </div>
        </Card>
      </div>
      <DetailTable title="Candidate Stage Detail" columns={candCols} rows={candidates} />
    </div>
  );
}

// ── Candidates tab ────────────────────────────────────────────────────────────

function CandidatesTab({ data, details }) {
  const { screening } = data;
  const scoreMax    = Math.max(...screening.scoreBuckets.map(b => b.count), 1);
  const matchMax    = Math.max(...screening.matchBuckets.map(b => b.count), 1);
  const statusTotal = screening.statusBreakdown.pass + screening.statusBreakdown.fail + screening.statusBreakdown.pending;
  const decTotal    = screening.decisions.proceed + screening.decisions.pool;
  const candidates  = details?.candidates || [];

  const cols = [
    { key: 'candidate_name',  label: 'Candidate' },
    { key: 'candidate_title', label: 'Title',       muted: true },
    { key: 'job_title',       label: 'Job',         muted: true },
    { key: 'session_name',    label: 'Session',     muted: true },
    { key: 'match_percentage',label: 'Match %',     num: true,
      render: r => r.match_percentage != null ? `${Math.round(r.match_percentage)}%` : '—' },
    { key: 'ai_interview_score', label: 'AI Score', num: true,
      render: r => r.ai_interview_score != null ? `${r.ai_interview_score}/100` : '—' },
    { key: 'screening_status',label: 'Screening',
      render: r => r.screening_status
        ? <Badge text={r.screening_status} color={SCREEN_COLORS[r.screening_status] || '#94a3b8'} /> : '—' },
    { key: 'decision',        label: 'Decision',
      render: r => r.decision
        ? <Badge text={r.decision} color={DECISION_COLORS[r.decision] || '#94a3b8'} /> : '—' },
    { key: 'interview_level', label: 'Level',       muted: true,
      render: r => r.interview_level || '—' },
    { key: 'pipeline_status', label: 'Pipeline',
      render: r => r.pipeline_status
        ? <Badge text={r.pipeline_status} color={PIPE_COLORS[r.pipeline_status] || '#94a3b8'} /> : '—' },
    { key: 'added_at',        label: 'Added',       muted: true, render: r => fmtDate(r.added_at) },
  ];

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        <Card>
          <SectionTitle>Screening Status</SectionTitle>
          <div className="rpt-hbar-chart">
            <HBar label="Shortlisted" value={screening.statusBreakdown.pass}    max={statusTotal} color="var(--emerald)" />
            <HBar label="Rejected"    value={screening.statusBreakdown.fail}    max={statusTotal} color="#f87171"        />
            <HBar label="Pending"     value={screening.statusBreakdown.pending} max={statusTotal} color="var(--text-3)"  />
          </div>
          <div className="rpt-total-note">{statusTotal} total across all sessions</div>
        </Card>
        <Card>
          <SectionTitle>Decision Outcomes</SectionTitle>
          <div className="rpt-hbar-chart">
            <HBar label="Proceed" value={screening.decisions.proceed} max={decTotal || 1} color="var(--emerald)" />
            <HBar label="Pool"    value={screening.decisions.pool}    max={decTotal || 1} color="#60a5fa"        />
          </div>
          <div className="rpt-mini-stats">
            <div className="rpt-mini-stat"><span className="rpt-mini-val">{screening.viReview.hold}</span><span className="rpt-mini-lbl">On Hold (VI)</span></div>
            <div className="rpt-mini-stat"><span className="rpt-mini-val">{screening.viReview.reject}</span><span className="rpt-mini-lbl">Rejected (VI)</span></div>
          </div>
        </Card>
        <Card>
          <SectionTitle>AI Interview Score Distribution</SectionTitle>
          {screening.scoreBuckets.every(b => b.count === 0) ? <div className="rpt-empty">No scores yet.</div> : (
            <div className="rpt-hbar-chart">
              {screening.scoreBuckets.map(b => <HBar key={b.range} label={b.range} value={b.count} max={scoreMax} color="var(--orange)" />)}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle>Skill Match % Distribution</SectionTitle>
          {screening.matchBuckets.every(b => b.count === 0) ? <div className="rpt-empty">No match data yet.</div> : (
            <div className="rpt-hbar-chart">
              {screening.matchBuckets.map(b => <HBar key={b.range} label={b.range} value={b.count} max={matchMax} color="var(--purple)" />)}
            </div>
          )}
        </Card>
      </div>
      <DetailTable title="All Pipeline Candidates" columns={cols} rows={candidates} />
    </div>
  );
}

// ── Assessments tab ───────────────────────────────────────────────────────────

function AssessmentsTab({ data, details }) {
  const { assessments } = data;
  const { mcq, coding } = assessments;
  const mcqMax    = Math.max(...(mcq.scoreBuckets    || []).map(b => b.count), 1);
  const codingMax = Math.max(...(coding.scoreBuckets || []).map(b => b.count), 1);
  const mcqRows    = details?.mcqInvites    || [];
  const codingRows = details?.codingInvites || [];

  const assessCols = (type) => [
    { key: 'candidate_name',    label: 'Candidate' },
    { key: 'candidate_email',   label: 'Email',      muted: true },
    { key: 'assessment_title',  label: type === 'mcq' ? 'MCQ Assessment' : 'Coding Assessment' },
    { key: 'status',            label: 'Status',
      render: r => <Badge
        text={r.status}
        color={r.status === 'completed' ? 'var(--emerald)' : r.status === 'started' ? '#f59e0b' : '#94a3b8'}
      /> },
    { key: 'score',             label: 'Score',      num: true,
      render: r => r.score != null ? `${r.score}/100` : '—' },
    { key: 'pass_fail',         label: 'Result',
      render: r => {
        if (r.score == null) return '—';
        const pass = r.score >= (r.pass_score || 60);
        return <Badge text={pass ? 'Pass' : 'Fail'} color={pass ? 'var(--emerald)' : '#f87171'} />;
      }},
    { key: 'time_taken_sec',    label: 'Time',       muted: true,
      render: r => r.time_taken_sec != null ? `${Math.round(r.time_taken_sec / 60)}m` : '—' },
    { key: 'invited_at',        label: 'Invited',    muted: true, render: r => fmtDate(r.invited_at) },
    { key: 'completed_at',      label: 'Completed',  muted: true, render: r => fmtDate(r.completed_at) },
  ];

  const AssessBlock = ({ title, stats, scoreMax, barColor, rows, type }) => (
    <>
      <Card className="rpt-card--full">
        <SectionTitle>{title}</SectionTitle>
        {stats.totalInvited === 0 ? <div className="rpt-empty">No {title.toLowerCase()} sent yet.</div> : (
          <>
            <div className="rpt-assess-kpis">
              <StatCard label="Assessments"  value={stats.totalAssessments} />
              <StatCard label="Invited"      value={stats.totalInvited} />
              <StatCard label="Completed"    value={stats.completed}
                sub={stats.totalInvited > 0 ? `${Math.round(stats.completed / stats.totalInvited * 100)}% rate` : undefined}
                color="var(--emerald)" />
              <StatCard label="Avg Score"    value={stats.avgScore != null ? `${stats.avgScore}/100` : '—'} color="var(--orange)" />
              <StatCard label="Pass Rate"    value={stats.totalScored > 0 ? `${Math.round(stats.passedCount / stats.totalScored * 100)}%` : '—'} color="var(--purple)" />
              <StatCard label="Avg Time"     value={stats.avgTimeSec != null ? `${Math.round(stats.avgTimeSec / 60)}m` : '—'} />
            </div>
            {stats.scoreBuckets?.some(b => b.count > 0) && (
              <div style={{ marginTop: 16 }}>
                <div className="rpt-section-title" style={{ marginBottom: 8 }}>Score Distribution</div>
                <div className="rpt-hbar-chart">
                  {stats.scoreBuckets.map(b => <HBar key={b.range} label={b.range} value={b.count} max={scoreMax} color={barColor} />)}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
      <DetailTable title={`${title} — Invite Records`} columns={assessCols(type)} rows={rows} />
    </>
  );

  return (
    <div className="rpt-tab-content">
      <AssessBlock title="MCQ Assessments"    stats={mcq}    scoreMax={mcqMax}    barColor="var(--orange)" rows={mcqRows}    type="mcq"    />
      <AssessBlock title="Coding Assessments" stats={coding} scoreMax={codingMax} barColor="#60a5fa"       rows={codingRows} type="coding" />
    </div>
  );
}

// ── Video Interviews tab ──────────────────────────────────────────────────────

function VideoTab({ data, details }) {
  const { video } = data;
  const recTotal  = Object.values(video.recommendations).reduce((s, v) => s + v, 0);
  const scoreMax  = Math.max(...video.scoreBuckets.map(b => b.count), 1);
  const rows      = details?.videoCandidates || [];

  const cols = [
    { key: 'candidate_name',       label: 'Candidate' },
    { key: 'candidate_email',      label: 'Email',       muted: true },
    { key: 'interview_title',      label: 'Interview' },
    { key: 'job_title',            label: 'Job',         muted: true },
    { key: 'status',               label: 'Status',
      render: r => <Badge text={r.status} color={VI_COLORS[r.status] || '#94a3b8'} /> },
    { key: 'overall_score',        label: 'Score',       num: true,
      render: r => r.overall_score != null ? `${r.overall_score}/100` : '—' },
    { key: 'hiring_recommendation',label: 'Recommendation',
      render: r => r.hiring_recommendation
        ? <Badge text={REC_LABELS[r.hiring_recommendation] || r.hiring_recommendation} color={REC_COLORS[r.hiring_recommendation] || '#94a3b8'} />
        : '—' },
    { key: 'invited_at',           label: 'Invited',     muted: true, render: r => fmtDate(r.invited_at) },
    { key: 'completed_at',         label: 'Completed',   muted: true, render: r => fmtDate(r.completed_at) },
  ];

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        <Card>
          <SectionTitle>Hiring Recommendations</SectionTitle>
          {recTotal === 0 ? <div className="rpt-empty">No evaluations completed yet.</div> : (
            <div className="rpt-hbar-chart">
              {['strong_fit','good_fit','needs_review','not_recommended'].map(key => (
                <HBar key={key} label={REC_LABELS[key] || key}
                  value={video.recommendations[key] || 0} max={recTotal} color={REC_COLORS[key]} />
              ))}
            </div>
          )}
          <div className="rpt-total-note">{video.totalEvaluated} candidates evaluated</div>
        </Card>
        <Card>
          <SectionTitle>Overall Score Distribution</SectionTitle>
          {video.scoreBuckets.every(b => b.count === 0) ? <div className="rpt-empty">No scores yet.</div> : (
            <div className="rpt-hbar-chart">
              {video.scoreBuckets.map(b => <HBar key={b.range} label={b.range} value={b.count} max={scoreMax} color="var(--purple)" />)}
            </div>
          )}
        </Card>
        <Card className="rpt-card--full">
          <SectionTitle>Average Competency Scores</SectionTitle>
          {Object.values(video.avgCompetency).every(v => v == null) ? <div className="rpt-empty">No competency data yet.</div> : (
            <div className="rpt-competency-grid">
              {Object.entries(COMP_LABELS).map(([key, label]) => {
                const val = video.avgCompetency[key];
                return (
                  <div key={key} className="rpt-comp-item">
                    <div className="rpt-comp-header">
                      <span className="rpt-comp-label">{label}</span>
                      <span className="rpt-comp-score">{val != null ? `${val}/100` : '—'}</span>
                    </div>
                    <div className="rpt-comp-track"><div className="rpt-comp-fill" style={{ width: `${val || 0}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <DetailTable title="Video Interview Candidates" columns={cols} rows={rows} />
    </div>
  );
}

// ── Post-Offer tab ────────────────────────────────────────────────────────────

function PofuTab({ data, details }) {
  const { pofu } = data;
  const stateMax     = Math.max(...POFU_STATE_ORDER.map(s => pofu.stateCounts[s] || 0), 1);
  const riskTotal    = pofu.riskCounts.low + pofu.riskCounts.medium + pofu.riskCounts.high;
  const responseRate = pofu.emailCounts.outbound > 0
    ? Math.round(pofu.emailCounts.inbound / pofu.emailCounts.outbound * 100) : 0;
  const rows = details?.pofuCandidates || [];

  const cols = [
    { key: 'candidate_name',  label: 'Candidate' },
    { key: 'candidate_email', label: 'Email',       muted: true },
    { key: 'role_title',      label: 'Role',        muted: true },
    { key: 'company_name',    label: 'Company',     muted: true },
    { key: 'state',           label: 'State',
      render: r => <Badge text={POFU_STATE_LABELS[r.state] || r.state} color={POFU_COLORS[r.state] || '#94a3b8'} /> },
    { key: 'risk_level',      label: 'Risk',
      render: r => <Badge text={r.risk_level} color={RISK_COLORS[r.risk_level] || '#94a3b8'} /> },
    { key: 'risk_score',      label: 'Risk Score',  num: true,
      render: r => r.risk_score != null ? `${r.risk_score}/100` : '—' },
    { key: 'doj',             label: 'DOJ',         muted: true, render: r => fmtDate(r.doj) },
    { key: 'last_email_at',   label: 'Last Contact',muted: true, render: r => fmtDate(r.last_email_at) },
    { key: 'created_at',      label: 'Enrolled',    muted: true, render: r => fmtDate(r.created_at) },
  ];

  return (
    <div className="rpt-tab-content">
      <div className="rpt-two-col">
        <Card>
          <SectionTitle>Candidate State Progression</SectionTitle>
          {pofu.total === 0 ? <div className="rpt-empty">No POFU candidates yet.</div> : (
            <div className="rpt-hbar-chart">
              {POFU_STATE_ORDER.map((state, i) => {
                const colors = ['#60a5fa','#a78bfa','#f59e0b','#34d399','#10b981','#f87171'];
                return <HBar key={state} label={POFU_STATE_LABELS[state]} value={pofu.stateCounts[state] || 0} max={stateMax} color={colors[i]} />;
              })}
            </div>
          )}
          <div className="rpt-total-note">{pofu.total} candidates total</div>
        </Card>
        <Card>
          <SectionTitle>Risk Level Distribution</SectionTitle>
          {riskTotal === 0 ? <div className="rpt-empty">No risk data yet.</div> : (
            <>
              <div className="rpt-hbar-chart">
                <HBar label="Low"    value={pofu.riskCounts.low}    max={riskTotal} color="var(--emerald)" />
                <HBar label="Medium" value={pofu.riskCounts.medium} max={riskTotal} color="#f59e0b"        />
                <HBar label="High"   value={pofu.riskCounts.high}   max={riskTotal} color="#f87171"        />
              </div>
              <div className="rpt-risk-avg">Avg Risk Score: <strong>{pofu.avgRisk}/100</strong></div>
            </>
          )}
        </Card>
        <Card>
          <SectionTitle>Email Engagement</SectionTitle>
          <div className="rpt-email-stats">
            <div className="rpt-email-stat"><span className="rpt-email-num">{pofu.emailCounts.outbound}</span><span className="rpt-email-lbl">Outbound</span></div>
            <div className="rpt-email-divider" />
            <div className="rpt-email-stat"><span className="rpt-email-num" style={{ color: 'var(--emerald)' }}>{pofu.emailCounts.inbound}</span><span className="rpt-email-lbl">Responses</span></div>
            <div className="rpt-email-divider" />
            <div className="rpt-email-stat"><span className="rpt-email-num" style={{ color: '#60a5fa' }}>{responseRate}%</span><span className="rpt-email-lbl">Response Rate</span></div>
          </div>
        </Card>
        <Card>
          <SectionTitle>Offer Outcome</SectionTitle>
          {pofu.total === 0 ? <div className="rpt-empty">No data yet.</div> : (
            <div className="rpt-hbar-chart">
              <HBar label="Joined"      value={pofu.stateCounts.joined  || 0} max={pofu.total} color="var(--emerald)" />
              <HBar label="Dropped"     value={pofu.stateCounts.dropped || 0} max={pofu.total} color="#f87171"        />
              <HBar label="In Progress" value={pofu.total - (pofu.stateCounts.joined || 0) - (pofu.stateCounts.dropped || 0)} max={pofu.total} color="var(--text-3)" />
            </div>
          )}
        </Card>
      </div>
      <DetailTable title="POFU Candidates" columns={cols} rows={rows} />
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────────

function ActivityTab({ data }) {
  const sessions = data.activity?.sessions || [];

  const cols = [
    { key: 'name',       label: 'Session' },
    { key: 'job_title',  label: 'Job',         muted: true },
    { key: 'client_name',label: 'Client',      muted: true },
    { key: 'sourced',    label: 'Sourced',      num: true },
    { key: 'passed',     label: 'Shortlisted',  num: true },
    { key: 'pass_rate',  label: 'Pass %',       num: true,
      render: r => {
        const rate = r.sourced > 0 ? Math.round(r.passed / r.sourced * 100) : null;
        return rate != null
          ? <span className={`rpt-rate${rate >= 50 ? ' rpt-rate--good' : ''}`}>{rate}%</span>
          : '—';
      }},
    { key: 'proceeded',  label: 'Proceeded',    num: true },
    { key: 'selected',   label: 'Selected',     num: true,
      render: r => r.selected > 0 ? <strong style={{ color: 'var(--emerald)' }}>{r.selected}</strong> : r.selected },
    { key: 'avg_days',   label: 'Avg Days',     num: true, muted: true,
      render: r => r.avg_days != null ? `${r.avg_days}d` : '—' },
    { key: 'created_at', label: 'Date',         muted: true, render: r => fmtDate(r.created_at) },
  ];

  return (
    <div className="rpt-tab-content">
      <DetailTable title="Session Activity" columns={cols} rows={sessions}
        empty="No sessions yet." />
    </div>
  );
}

// ── By Job tab ────────────────────────────────────────────────────────────────

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
  const fTotal   = funnel.sourced || 1;
  const scoreMax = Math.max(...screening.scoreBuckets.map(b => b.count), 1);
  const matchMax = Math.max(...screening.matchBuckets.map(b => b.count), 1);
  const recTotal = Object.values(video.recommendations).reduce((s, v) => s + v, 0);

  return (
    <div className="rpt-job-detail">
      <div className="rpt-job-detail-header">
        <button className="rpt-back-btn" onClick={onBack}>← All Jobs</button>
        <div className="rpt-job-detail-title">
          <h2 className="rpt-job-name">{job.title}</h2>
          <div className="rpt-job-meta-row">
            {job.client_name && <span className="rpt-job-meta-chip">{job.client_name}</span>}
            {job.department  && <span className="rpt-job-meta-chip">{job.department}</span>}
            {job.location    && <span className="rpt-job-meta-chip">{job.location}</span>}
            <span className="rpt-job-meta-chip" style={{ color: STATUS_COLORS[job.status] }}>{job.status}</span>
            {job.openings_count > 0 && <span className="rpt-job-meta-chip">{job.openings_count} opening{job.openings_count !== 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>
      <div className="rpt-job-kpis">
        <StatCard label="Sourced"     value={funnel.sourced} />
        <StatCard label="Shortlisted" value={funnel.passed} color="var(--emerald)"
          sub={funnel.sourced > 0 ? `${Math.round(funnel.passed / funnel.sourced * 100)}% pass rate` : undefined} />
        <StatCard label="VI Invited"  value={funnel.viInvited} color="var(--purple)" />
        <StatCard label="Proceeded"   value={funnel.proceeded} color="var(--orange)" />
        <StatCard label="Selected"    value={funnel.selected}  color="var(--emerald)" />
        {pofu.total > 0 && <StatCard label="In POFU" value={pofu.total} sub={`${pofu.states?.joined || 0} joined`} />}
      </div>
      <div className="rpt-two-col">
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
        <Card>
          <SectionTitle>AI Interview Scores</SectionTitle>
          {screening.scoreBuckets.every(b => b.count === 0) ? <div className="rpt-empty">No scores yet.</div> : (
            <div className="rpt-hbar-chart">
              {screening.scoreBuckets.map(b => <HBar key={b.range} label={b.range} value={b.count} max={scoreMax} color="var(--orange)" />)}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle>Skill Match % Distribution</SectionTitle>
          {screening.matchBuckets.every(b => b.count === 0) ? <div className="rpt-empty">No match data yet.</div> : (
            <div className="rpt-hbar-chart">
              {screening.matchBuckets.map(b => <HBar key={b.range} label={b.range} value={b.count} max={matchMax} color="var(--purple)" />)}
            </div>
          )}
        </Card>
        {(skillsCoverage.required.length > 0 || skillsCoverage.preferred.length > 0) && (
          <Card>
            <SectionTitle>Skills Coverage</SectionTitle>
            {skillsCoverage.required.length > 0 && (
              <><div className="rpt-skill-group-label">Required</div>
              <div className="rpt-skills-list">{skillsCoverage.required.map(s => <SkillBar key={s.skill} {...s} />)}</div></>
            )}
            {skillsCoverage.preferred.length > 0 && (
              <><div className="rpt-skill-group-label" style={{ marginTop: 12 }}>Preferred</div>
              <div className="rpt-skills-list">{skillsCoverage.preferred.map(s => <SkillBar key={s.skill} {...s} />)}</div></>
            )}
          </Card>
        )}
        {video.funnel.total > 0 && (
          <Card>
            <SectionTitle>Video Interview</SectionTitle>
            <div className="rpt-job-kpis" style={{ margin: '0 0 14px' }}>
              <StatCard label="Invited"   value={video.funnel.total} />
              <StatCard label="Completed" value={video.funnel.completed} color="var(--emerald)" />
              <StatCard label="Evaluated" value={video.funnel.evaluated} color="var(--purple)"  />
            </div>
            {recTotal > 0 && (
              <div className="rpt-hbar-chart">
                {['strong_fit','good_fit','needs_review','not_recommended'].map(key => (
                  <HBar key={key} label={REC_LABELS[key] || key}
                    value={video.recommendations[key] || 0} max={recTotal} color={REC_COLORS[key]} />
                ))}
              </div>
            )}
          </Card>
        )}
        {pofu.total > 0 && (
          <Card>
            <SectionTitle>Post-Offer Follow-Up</SectionTitle>
            <div className="rpt-hbar-chart">
              {POFU_STATE_ORDER.map((state, i) => {
                const colors = ['#60a5fa','#a78bfa','#f59e0b','#34d399','#10b981','#f87171'];
                return <HBar key={state} label={POFU_STATE_LABELS[state]} value={pofu.states[state] || 0} max={pofu.total} color={colors[i]} />;
              })}
            </div>
            <div className="rpt-total-note">Avg risk score: {pofu.avgRisk}/100</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function JobsTab({ authFetch }) {
  const [jobs,     setJobs]     = useState(null);
  const [unlinked, setUnlinked] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    authFetch(`${BACKEND_URL}/reports/jobs`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setJobs(d.jobs || []);
        setUnlinked(d.unlinked || null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rpt-loading">Loading jobs…</div>;
  if (error)   return <div className="rpt-error">{error}</div>;
  if (selected) return <JobDetail jobId={selected} authFetch={authFetch} onBack={() => setSelected(null)} />;
  if (!jobs || jobs.length === 0) return <div className="rpt-empty" style={{ padding: '60px 0' }}>No jobs found.</div>;

  const totals = jobs.reduce(
    (acc, j) => ({ sourced: acc.sourced + j.sourced, passed: acc.passed + j.passed, proceeded: acc.proceeded + j.proceeded, selected: acc.selected + j.selected }),
    { sourced: 0, passed: 0, proceeded: 0, selected: 0 }
  );
  if (unlinked) { totals.sourced += unlinked.sourced; totals.passed += unlinked.passed; totals.proceeded += unlinked.proceeded; totals.selected += unlinked.selected; }

  return (
    <div className="rpt-tab-content">
      <div className="rpt-jobs-table-wrap">
        <table className="rpt-jobs-table">
          <thead>
            <tr>
              <th>Job / Client</th>
              <th>Department</th>
              <th>Status</th>
              <th className="rpt-th-num">Days Open</th>
              <th className="rpt-th-num">Sourced</th>
              <th className="rpt-th-num">Shortlisted</th>
              <th className="rpt-th-num">Pass Rate</th>
              <th className="rpt-th-num">Proceeded</th>
              <th className="rpt-th-num">Selected</th>
              <th className="rpt-th-num">VI</th>
              <th className="rpt-th-num">POFU</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className="rpt-jobs-row" onClick={() => setSelected(job.id)}>
                <td><div className="rpt-job-title-cell">{job.title}</div>{job.client_name && <div className="rpt-job-client-cell">{job.client_name}</div>}</td>
                <td className="rpt-td-muted">{job.department || '—'}</td>
                <td><span className="rpt-status-dot" style={{ color: STATUS_COLORS[job.status] }}>● {job.status}</span></td>
                <td className="rpt-td-num rpt-td-muted">
                  {job.status === 'active'
                    ? <span className={`rpt-days-open${job.time_open > 30 ? ' rpt-days-open--warn' : ''}`}>{job.time_open}d</span>
                    : '—'}
                </td>
                <td className="rpt-td-num">{job.sourced}</td>
                <td className="rpt-td-num">{job.passed}</td>
                <td className="rpt-td-num">
                  {job.pass_rate != null ? <span className={`rpt-rate${job.pass_rate >= 50 ? ' rpt-rate--good' : ''}`}>{job.pass_rate}%</span> : '—'}
                </td>
                <td className="rpt-td-num">{job.proceeded}</td>
                <td className="rpt-td-num">{job.selected > 0 ? <strong style={{ color: 'var(--emerald)' }}>{job.selected}</strong> : job.selected}</td>
                <td className="rpt-td-num rpt-td-muted">{job.vi_count}</td>
                <td className="rpt-td-num rpt-td-muted">{job.pofu_count}</td>
              </tr>
            ))}
            {unlinked && (
              <tr className="rpt-jobs-row rpt-jobs-row--unlinked" style={{ cursor: 'default' }}>
                <td><div className="rpt-job-title-cell" style={{ color: 'var(--text-3)' }}>Unlinked Sessions</div><div className="rpt-job-client-cell">Sessions without a job attached</div></td>
                <td className="rpt-td-muted">—</td>
                <td><span className="rpt-status-dot" style={{ color: 'var(--text-3)' }}>● unlinked</span></td>
                <td className="rpt-td-num rpt-td-muted">—</td>
                <td className="rpt-td-num">{unlinked.sourced}</td>
                <td className="rpt-td-num">{unlinked.passed}</td>
                <td className="rpt-td-num">{unlinked.pass_rate != null ? `${unlinked.pass_rate}%` : '—'}</td>
                <td className="rpt-td-num">{unlinked.proceeded}</td>
                <td className="rpt-td-num">{unlinked.selected > 0 ? <strong style={{ color: 'var(--emerald)' }}>{unlinked.selected}</strong> : unlinked.selected}</td>
                <td className="rpt-td-num rpt-td-muted">—</td>
                <td className="rpt-td-num rpt-td-muted">—</td>
              </tr>
            )}
            <tr className="rpt-jobs-row--total">
              <td><strong>Total</strong></td><td /><td /><td />
              <td className="rpt-td-num"><strong>{totals.sourced}</strong></td>
              <td className="rpt-td-num"><strong>{totals.passed}</strong></td>
              <td className="rpt-td-num">{totals.sourced > 0 ? <strong>{Math.round(totals.passed / totals.sourced * 100)}%</strong> : '—'}</td>
              <td className="rpt-td-num"><strong>{totals.proceeded}</strong></td>
              <td className="rpt-td-num"><strong style={{ color: 'var(--emerald)' }}>{totals.selected}</strong></td>
              <td /><td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rpt-table-hint">Click a job row for detailed analytics · Totals match Pipeline Funnel tab{unlinked ? ' · Link sessions to jobs to remove the Unlinked row' : ''}</div>
    </div>
  );
}

// ── Main module ───────────────────────────────────────────────────────────────

export default function ReportsModule({ authFetch, onBack }) {
  const [tab,     setTab]     = useState('funnel');
  const [data,    setData]    = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, detRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/reports/summary`),
        authFetch(`${BACKEND_URL}/reports/details`),
      ]);
      if (!sumRes.ok) throw new Error('Failed to load summary');
      if (!detRes.ok) throw new Error('Failed to load details');
      const [sum, det] = await Promise.all([sumRes.json(), detRes.json()]);
      setData(sum);
      setDetails(det);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-content"><div className="rpt-loading">Loading reports…</div></div>;
  if (error)   return <div className="page-content"><div className="rpt-error">{error} <button onClick={load} className="ag-btn ag-btn--ghost ag-btn--sm">Retry</button></div></div>;
  if (!data)   return null;

  const { overview, funnel, jobs, timing, assessments } = data;
  const fmtDur = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  const selectionRate    = funnel.sourced > 0 ? Math.round(funnel.selected / funnel.sourced * 100) : null;
  const totalAssessments = (assessments?.mcq?.completed || 0) + (assessments?.coding?.completed || 0);

  return (
    <div className="page-content">
      <div className="rpt-header">
        <div className="rpt-header-left">
          {onBack && <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={onBack}>← Back</button>}
          <div>
            <h1 className="rpt-title">Reports & Analytics</h1>
            <p className="rpt-subtitle">Aggregated data across all your hiring activity</p>
          </div>
        </div>
        <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={load}>↺ Refresh</button>
      </div>

      {/* KPI summary strip */}
      <div className="rpt-kpi-strip">
        <StatCard label="Active Jobs"       value={overview.activeJobs}                                          sub={`${overview.totalJobs} total`}                    color="var(--orange)"  />
        <StatCard label="Avg Time to Hire"  value={timing?.avgTimeToHire != null ? `${timing.avgTimeToHire}d` : '—'} sub="sourcing → selected"                        color="#60a5fa"        />
        <StatCard label="Selection Rate"    value={selectionRate != null ? `${selectionRate}%` : '—'}            sub={`${funnel.selected} selected`}                   color="var(--emerald)" />
        <StatCard label="Pipeline Sessions" value={overview.totalSessions}                                        sub={`${funnel.sourced} sourced`}                                            />
        <StatCard label="Candidates"        value={overview.totalCandidates.toLocaleString()}                    sub="in database"                                                            />
        <StatCard label="Assessments Done"  value={totalAssessments}                                             sub="MCQ + coding completed"                          color="var(--purple)"  />
        <StatCard label="Video Interviews"  value={overview.totalVI}                                             sub={`${data.video.funnel.completed + data.video.funnel.evaluated} completed`} color="var(--purple)" />
        <StatCard label="POFU Candidates"   value={overview.totalPofu}                                           sub={`${data.pofu.stateCounts.joined || 0} joined`}                          />
        <StatCard label="Calls Made"        value={overview.calls.total}                                         sub={overview.calls.avgDuration ? `avg ${fmtDur(overview.calls.avgDuration)}` : `${overview.calls.completed} completed`} />
      </div>

      {/* Tabs */}
      <div className="rpt-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`rpt-tab-btn${tab === t.id ? ' rpt-tab-btn--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'funnel'      && <FunnelTab      data={data}                   />}
      {tab === 'efficiency'  && <EfficiencyTab  data={data} details={details} />}
      {tab === 'candidates'  && <CandidatesTab  data={data} details={details} />}
      {tab === 'assessments' && <AssessmentsTab data={data} details={details} />}
      {tab === 'video'       && <VideoTab       data={data} details={details} />}
      {tab === 'pofu'        && <PofuTab        data={data} details={details} />}
      {tab === 'activity'    && <ActivityTab    data={data}                   />}
      {tab === 'jobs'        && <JobsTab        authFetch={authFetch}         />}
    </div>
  );
}
