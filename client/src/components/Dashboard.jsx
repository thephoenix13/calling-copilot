export default function Dashboard({ displayName, onSelect, onLogout, isLight, onToggleTheme }) {
  const modes = [
    {
      id: 'calling-copilot',
      icon: '📞',
      title: 'Calling CoPilot',
      desc: 'Real-time AI coaching during live recruiter calls — live transcription, smart follow-up suggestions, and instant post-call evaluation reports.',
      cta: 'Launch',
    },
    {
      id: 'agentic',
      icon: '🤖',
      title: 'Agentic Mode',
      desc: 'Autonomous AI agents for end-to-end recruitment workflows — from sourcing and screening to scheduling and reporting.',
      cta: 'Open',
    },
  ];

  return (
    <div className={`app${isLight ? ' light' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <span className="logo">📞</span>
          <h1>Recruiter CoPilot</h1>
        </div>
        <div className="header-right">
          <button className="theme-toggle-btn" onClick={onToggleTheme}>
            {isLight ? '🌙 Dark' : '☀️ Light'}
          </button>
          <button className="report-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-hero">
        <h2 className="dashboard-welcome">
          {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
        </h2>
        <p className="dashboard-subtitle">Choose a mode to get started</p>
      </div>

      <div className="dashboard-cards">
        {modes.map((m) => (
          <div key={m.id} className="dashboard-card" onClick={() => onSelect(m.id)}>
            <div className="dashboard-card-icon">{m.icon}</div>
            <div className="dashboard-card-title">{m.title}</div>
            <p className="dashboard-card-desc">{m.desc}</p>
            <div className="dashboard-card-cta">{m.cta} →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
