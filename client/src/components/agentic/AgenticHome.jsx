import { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const NAV_CARDS = [
  {
    id: 'sessions',
    icon: '🔄',
    title: 'Pipeline Sessions',
    desc: 'Run a guided 7-step recruitment pipeline — from JD enhancement to final candidate selection.',
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
  const [stats, setStats] = useState({ jobs: null, candidates: null });

  useEffect(() => {
    Promise.all([
      authFetch(`${BACKEND_URL}/jobs`).then(r => r.json()).catch(() => null),
      authFetch(`${BACKEND_URL}/candidates`).then(r => r.json()).catch(() => null),
    ]).then(([jobsData, candidatesData]) => {
      setStats({
        jobs:       jobsData?.jobs?.length       ?? 0,
        candidates: candidatesData?.candidates?.length ?? 0,
      });
    });
  }, [authFetch]);

  return (
    <div className={`app${isLight ? ' light' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <button className="report-btn" onClick={onBackToDashboard}>← Dashboard</button>
          <span className="logo">🤖</span>
          <h1>Agentic Mode</h1>
        </div>
        <div className="header-right">
          <button className="theme-toggle-btn" onClick={onToggleTheme}>
            {isLight ? '🌙 Dark' : '☀️ Light'}
          </button>
          <button className="report-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>

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
            <span className="ag-stat-value">—</span>
            <span className="ag-stat-label">Active Sessions</span>
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
      </div>
    </div>
  );
}
