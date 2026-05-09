// Display labels used for the sidebar user chip. Mirrors the canonical names
// used elsewhere in the app and accepts legacy JWT role values too.
const ROLE_DISPLAY = {
  owner:          'Owner',
  team_lead:      'Team Lead',
  sr_recruiter:   'Sr Recruiter',
  recruiter:      'Recruiter',
  sourcer:        'Sourcer',
  hiring_manager: 'Hiring Manager',
  admin:          'Owner',
  superuser:      'Owner',
  subuser:        'Recruiter',
};

// Per-item `hideFor` lists roles that shouldn't see the nav entry. Mirrors the
// capability map on the server (permissions.js) — adjust both together.
const NAV = [
  {
    section: null,
    items: [
      { id: 'dashboard',       label: 'Home',                icon: IconHome      },
      { id: 'calling-copilot', label: 'Calling CoPilot',     icon: IconPhone,     hideFor: ['sourcer'] },
      { id: 'jobs',            label: 'Job Management',      icon: IconBriefcase },
      { id: 'candidates',      label: 'Candidate Database',  icon: IconUsers     },
      { id: 'jd-enhancer',     label: 'JD Enhancer',         icon: IconZap,       hideFor: ['sourcer'] },
    ],
  },
  {
    section: 'Pipeline',
    items: [
      { id: 'sessions', label: 'Pipeline Sessions',    icon: IconGitBranch },
      { id: 'pofu',     label: 'Post Offer Follow-Up', icon: IconTarget, badge: 'Beta', hideFor: ['sourcer'] },
    ],
  },
  {
    section: 'Evaluation',
    items: [
      { id: 'video-interviews',    label: 'Video Interviews',   icon: IconVideo,     hideFor: ['sourcer'] },
      { id: 'mcq-assessments',     label: 'MCQ Assessments',    icon: IconClipboard, hideFor: ['sourcer'] },
      { id: 'coding-assessments',  label: 'Coding Assessments', icon: IconCode,      hideFor: ['sourcer'] },
    ],
  },
  {
    section: 'Insights',
    items: [
      { id: 'reports',        label: 'Reports & Analytics', icon: IconBarChart },
      { id: 'recruiter-qa',   label: 'Recruiter QA',        icon: IconAward    },
      { id: 'market-intel',   label: 'Market Intelligence', icon: IconMarketIntel,
        hideFor: ['sourcer','hiring_manager'] },
      { id: 'activity',       label: 'Activity Feed',       icon: IconActivity,
        hideFor: ['sr_recruiter','recruiter','sourcer','hiring_manager','subuser'] },
    ],
  },
];

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconZap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
function IconGitBranch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <line x1="6" y1="3" x2="6" y2="15"/>
      <circle cx="18" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
  );
}
function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function IconAward() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <circle cx="12" cy="8" r="6"/>
      <polyline points="8.21 13.89 7 22 12 19 17 22 15.79 13.88"/>
    </svg>
  );
}
function IconActivity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IconMarketIntel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <line x1="3" y1="20" x2="21" y2="20"/>
      <line x1="6" y1="20" x2="6" y2="13"/>
      <line x1="11" y1="20" x2="11" y2="8"/>
      <line x1="16" y1="20" x2="16" y2="11"/>
      <polyline points="3 8 8 4 13 7 21 3"/>
    </svg>
  );
}
function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  );
}
function IconCode() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function AppShell({ children, currentView, onNavigate, isLight, onToggleTheme, onLogout, displayName, userRole }) {
  return (
    <div className={`shell${isLight ? '' : ' dark'}`}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <img src="/zeople-logo.png" alt="Zeople" className="sidebar-logo-mark" />
          <div className="sidebar-logo-text">
            <span className="sidebar-product">Zeople</span>
            <span className="sidebar-tagline">RecruiterOS</span>
          </div>
        </div>

        {/* Nav — filter items the current role can't access; drop empty sections */}
        <nav className="sidebar-nav">
          {NAV.map((group, gi) => {
            const visibleItems = group.items.filter(item => !item.hideFor?.includes(userRole));
            if (visibleItems.length === 0) return null;
            return (
              <div key={gi} className="nav-group">
                {group.section && (
                  <div className="nav-section-label">{group.section}</div>
                )}
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`nav-item${active ? ' nav-item--active' : ''}`}
                      onClick={() => onNavigate(item.id)}
                    >
                      <Icon />
                      <span className="nav-item-label">{item.label}</span>
                      {item.badge && <span className="nav-badge">{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {(userRole === 'owner' || userRole === 'superuser') && (
            <div className="nav-group">
              <div className="nav-section-label">Admin</div>
              <button
                className={`nav-item${currentView === 'settings' ? ' nav-item--active' : ''}`}
                onClick={() => onNavigate('settings')}
              >
                <IconSettings />
                <span className="nav-item-label">Settings</span>
              </button>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-theme-btn" onClick={onToggleTheme} title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}>
            {isLight ? <IconMoon /> : <IconSun />}
            <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
          </button>
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{displayName ? displayName[0].toUpperCase() : 'U'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
              <span className="sidebar-user-name">{displayName || 'User'}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
              }}>
                {ROLE_DISPLAY[userRole] || userRole || '—'}
              </span>
            </div>
            <button className="sidebar-signout" onClick={onLogout} title="Sign out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="shell-content">
        {children}
      </div>
    </div>
  );
}
