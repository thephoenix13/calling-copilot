import { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const STEP_LABELS = {
  1: 'Select JD',
  2: 'Enhance JD',
  3: 'Source Candidates',
  4: 'Screening',
  5: 'VI Scheduler',
  6: 'AI Reports',
  7: 'Decision',
};

const NAV_CARDS = [
  {
    id: 'sessions',
    icon: '🔄',
    title: 'Pipeline Sessions',
    desc: 'Run a guided 7-step recruitment pipeline — from JD enhancement to final candidate selection.',
    cta: 'Open',
  },
  {
    id: 'jobs',
    icon: '💼',
    title: 'Jobs',
    desc: 'Manage job postings, enhance JDs with AI, and track qualification status for each requirement.',
    cta: 'Open',
  },
  {
    id: 'candidates',
    icon: '👤',
    title: 'Candidates',
    desc: 'Browse and manage your candidate database, view profiles, and track pipeline history.',
    cta: 'Open',
  },
  {
    id: 'reports',
    icon: '📊',
    title: 'Reports & Analytics',
    desc: 'Pipeline funnel, candidate scores, video interview outcomes, POFU stats, and per-job breakdowns.',
    cta: 'Open',
  },
  {
    id: 'pofu',
    icon: '🎯',
    title: 'Post Offer Follow-Up',
    desc: 'Autonomously engage candidates between offer acceptance and joining day. AI-powered email sequences, risk scoring, and drop prevention.',
    cta: 'Open',
    badge: 'Beta',
  },
];

export default function AgenticHome({ authFetch, isLight, onToggleTheme, onLogout, onNav, onBackToDashboard }) {
  const [stats,          setStats]          = useState({ jobs: null, candidates: null, sessions: null });
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    Promise.all([
      authFetch(`${BACKEND_URL}/jobs`).then(r => r.json()).catch(() => null),
      authFetch(`${BACKEND_URL}/candidates`).then(r => r.json()).catch(() => null),
      authFetch(`${BACKEND_URL}/sessions`).then(r => r.json()).catch(() => null),
    ]).then(([jobsData, candidatesData, sessionsData]) => {
      const sessions = sessionsData?.sessions || [];
      setStats({
        jobs:       jobsData?.jobs?.length       ?? 0,
        candidates: candidatesData?.candidates?.length ?? 0,
        sessions:   sessions.length,
      });
      setRecentSessions(sessions.slice(0, 5));
    });
  }, [authFetch]);

  return (
    <div className="page-content">
      <div className="ag-home-body">

        {/* Stats strip */}
        <div className="ag-stats-strip">
          <div className="ag-stat-card">
            <span className="ag-stat-value">{stats.jobs ?? '—'}</span>
            <span className="ag-stat-label">Active Jobs</span>
          </div>
          <div className="ag-stat-card">
            <span className="ag-stat-value">{stats.candidates ?? '—'}</span>
            <span className="ag-stat-label">Candidates</span>
          </div>
          <div className="ag-stat-card">
            <span className="ag-stat-value">{stats.sessions ?? '—'}</span>
            <span className="ag-stat-label">Pipeline Sessions</span>
          </div>
        </div>

        {/* Module cards */}
        <div className="ag-module-cards">
          {NAV_CARDS.map(card => (
            <div
              key={card.id}
              className={`ag-module-card${card.disabled ? ' ag-module-card--disabled' : ''}`}
              onClick={() => !card.disabled && onNav(card.id)}
            >
              <div className="ag-card-icon">{card.icon}</div>
              <div className="ag-card-title">{card.title}</div>
              <p className="ag-card-desc">{card.desc}</p>
              {card.badge && (
                <span style={{ fontSize: 10, background: 'var(--orange-dim)', color: 'var(--orange)', border: '1px solid var(--orange-border)', borderRadius: 4, padding: '1px 6px', fontWeight: 600, letterSpacing: '0.03em', marginBottom: 6, display: 'inline-block' }}>{card.badge}</span>
              )}
              <div className={`ag-card-cta${card.disabled ? ' ag-card-cta--muted' : ''}`}>
                {card.cta} {!card.disabled && '→'}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="ag-recent-sessions">
            <div className="ag-recent-title">Recent Sessions</div>
            <div className="ag-recent-list">
              {recentSessions.map(s => (
                <div key={s.id} className="ag-recent-row" onClick={() => onNav('sessions')}>
                  <div className="ag-recent-info">
                    <span className="ag-recent-job">{s.job_title || s.name || 'Untitled Session'}</span>
                    {s.job_client && <span className="ag-recent-client">{s.job_client}</span>}
                  </div>
                  <div className="ag-recent-meta">
                    <span className="ag-recent-step">{STEP_LABELS[s.current_step] || `Step ${s.current_step}`}</span>
                    <span className="ag-recent-count">{s.candidate_count} candidate{s.candidate_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="ag-recent-view-all" onClick={() => onNav('sessions')}>
              View all sessions →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
