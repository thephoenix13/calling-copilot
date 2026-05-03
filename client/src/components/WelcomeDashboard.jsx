function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(displayName) {
  if (!displayName) return 'there';
  return displayName.split(' ')[0];
}

/* ── Inline SVG icons (same paths as AppShell.jsx) ─────────────────────── */

function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function IconGitBranch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15"/>
      <circle cx="18" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}

/* ── Data ───────────────────────────────────────────────────────────────── */

const STEPS = [
  'Add your open positions in Job Management — client name, required skills, and budget.',
  'Build your Candidate Database. Upload resumes and let AI parse and score each profile.',
  'Create a Pipeline Session to run the full hiring workflow: source, screen, interview, and decide.',
  'Use Calling CoPilot for any live recruiter call with real-time AI transcription and guidance.',
];

const CARDS = [
  {
    id: 'calling-copilot',
    title: 'Calling CoPilot',
    desc: 'Make AI-assisted recruiter calls with live transcription, interview coaching, and automatic post-call reports.',
    Icon: IconPhone,
  },
  {
    id: 'jobs',
    title: 'Job Management',
    desc: 'Create and manage all open requisitions with client, budget, skills, and location details.',
    Icon: IconBriefcase,
  },
  {
    id: 'candidates',
    title: 'Candidate Database',
    desc: 'Build your talent pool. Upload resumes and let AI parse, score, and flag AI-written content.',
    Icon: IconUsers,
  },
  {
    id: 'jd-enhancer',
    title: 'JD Enhancer',
    desc: 'Transform a raw job brief into a polished JD, recruiter brief, sourcing keywords, and outreach templates — in one click.',
    Icon: IconZap,
  },
  {
    id: 'sessions',
    title: 'Pipeline Sessions',
    desc: 'Run complete end-to-end hiring pipelines from sourcing through to final decision and offer.',
    Icon: IconGitBranch,
  },
  {
    id: 'pofu',
    title: 'Post Offer Follow-Up',
    desc: 'Automated email sequences to keep offer-stage candidates warm until their date of joining.',
    Icon: IconTarget,
    beta: true,
  },
];

/* ── Component ──────────────────────────────────────────────────────────── */

export default function WelcomeDashboard({ displayName, onNavigate }) {
  const greeting = getGreeting();
  const firstName = getFirstName(displayName);

  return (
    <div className="page-content wd-page">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="wd-hero">
        <h1 className="wd-greeting">{greeting}, {firstName}.</h1>
        <p className="wd-subtitle">Welcome to RecruiterOS — your AI-powered recruiting platform.</p>
      </div>

      {/* ── How to get started ───────────────────────────────────────────── */}
      <div className="wd-section">
        <div className="wd-section-label">How to get started</div>
        <ol className="wd-steps">
          {STEPS.map((text, i) => (
            <li key={i} className="wd-step">
              <div className="wd-step-num">{i + 1}</div>
              <p className="wd-step-text">{text}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Platform modules ─────────────────────────────────────────────── */}
      <div className="wd-section">
        <div className="wd-section-label">Platform modules</div>
        <div className="wd-cards">
          {CARDS.map(({ id, title, desc, Icon, beta }) => (
            <div
              key={id}
              className="wd-card"
              onClick={() => onNavigate(id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate(id); }}
            >
              <div className="wd-card-icon">
                <Icon />
              </div>
              <div className="wd-card-title">
                {title}
                {beta && <span className="nav-badge">Beta</span>}
              </div>
              <p className="wd-card-desc">{desc}</p>
              <button
                className="wd-card-cta"
                onClick={(e) => { e.stopPropagation(); onNavigate(id); }}
                tabIndex={-1}
              >
                Open →
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
