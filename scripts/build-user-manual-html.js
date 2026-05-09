/**
 * scripts/build-user-manual-html.js
 *
 * Generates dist/Zeople-RecruiterOS-User-Manual.html — a comprehensive
 * single-page user manual for internal QA testing. Covers every role,
 * every module, common workflows, the HM portal, login credentials.
 *
 * Run with:  node scripts/build-user-manual-html.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'zeople-logo.png');
const OUT  = path.join(ROOT, 'dist', 'Zeople-RecruiterOS-User-Manual.html');
if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });

const LOGO_URI = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');

// ─── Content data ──────────────────────────────────────────────────────────

const ROLES = [
  { key: 'owner',          color: '#F97316', label: 'Owner',           summary: 'Top of an agency. Billing, all settings, full visibility, manages the team.' },
  { key: 'team_lead',      color: '#3b82f6', label: 'Team Lead',       summary: 'Sees all of the team\'s pipeline work, can review QA across recruiters, can assign jobs.' },
  { key: 'sr_recruiter',   color: '#7c3aed', label: 'Sr Recruiter',    summary: 'Senior IC. Same operational scope as Recruiter, plus can manage assignees / hiring managers on jobs.' },
  { key: 'recruiter',      color: '#10b981', label: 'Recruiter',       summary: 'Day-to-day operator. Runs pipelines, makes calls, sources candidates, sends assessments.' },
  { key: 'sourcer',        color: '#a78bfa', label: 'Sourcer',         summary: 'Lightweight role. Only sources candidates (Step 3 of pipeline). No decisions, no calls, no assessments.' },
  { key: 'hiring_manager', color: '#dc2626', label: 'Hiring Manager',  summary: 'External stakeholder. Sees only jobs they\'re attached to. Reviews shortlisted candidates and submits feedback. Lands on a separate portal — no recruiter sidebar.' },
];

// Permission matrix: who can do what (F = full, W = write/edit, R = read, — = no access)
const PERMS = [
  ['Module',                   'Owner', 'Team Lead', 'Sr Recruiter', 'Recruiter', 'Sourcer', 'Hiring Manager'],
  ['Home / Dashboard',         'F', 'F', 'F', 'F', 'F', '— *'],
  ['Calling CoPilot',          'F', 'F', 'F', 'F', '—', '—'],
  ['Job Management — list',    'F', 'F (team)', 'W', 'W', 'R', 'R *attached only*'],
  ['Job Management — assign',  'F', 'F', 'F', '—', '—', '—'],
  ['Job Management — delete',  'F', 'F', '—', '—', '—', '—'],
  ['Candidate Database',       'F', 'F', 'W', 'W', 'W (add only)', '—'],
  ['JD Enhancer',              'F', 'F', 'W', 'W', 'R', '—'],
  ['Pipeline Sessions',        'F', 'F (team)', 'W', 'W', 'W *Step 3 only*', 'R *attached jobs*'],
  ['Video Interviews',         'F', 'F', 'W', 'W', '—', 'R'],
  ['MCQ Assessments',          'F', 'F', 'W', 'W', '—', 'R'],
  ['Coding Assessments',       'F', 'F', 'W', 'W', '—', 'R'],
  ['POFU',                     'F', 'F', 'W', 'W', '—', '—'],
  ['Reports & Analytics',      'F (company)', 'F (team)', 'R (own)', 'R (own)', 'R (own)', '—'],
  ['Recruiter QA',             'F (all)', 'F (team)', 'R (own)', 'R (own)', 'R (own)', '—'],
  ['Activity Feed',            'F', 'F', '—', '—', '—', '—'],
  ['Settings → Team',          'F', '—', '—', '—', '—', '—'],
  ['Settings → Company',       'F', '—', '—', '—', '—', '—'],
  ['HM Feedback (write)',      '—', '—', '—', '—', '—', 'F *on attached*'],
];

const MODULES = [
  {
    name: 'Home',
    who: 'Everyone (recruiter-side roles)',
    purpose: 'Personalised greeting, recent-activity snapshot, KPI cards, quick links into modules.',
    notes: ['First screen after login.', 'Numbers refresh on load.', 'Hiring Managers don\'t see this — they land on the HM portal directly.'],
  },
  {
    name: 'Calling CoPilot',
    who: 'Recruiters, Sr Recruiters, Team Leads, Owners',
    purpose: 'Live AI coaching during recruiter calls. Real-time transcription + suggested follow-up questions. Generates QA + Candidate reports after every call.',
    notes: [
      'After a call, two reports are saved: a 7-dimension recruiter QA scorecard and a candidate evaluation.',
      'The "Demo Vid" button has been removed — to demo the flow to someone, run a real (or simulated) call from inside a Pipeline Session.',
      'Live AI Suggestions appear in the right panel ~1 second after each candidate response. Speed has been tuned for a fast walkthrough.',
      'Sourcers and Hiring Managers cannot access this module.',
    ],
  },
  {
    name: 'Job Management',
    who: 'Everyone except Hiring Managers see all company jobs (HMs see only attached ones).',
    purpose: 'Create and manage job postings; assign teammates; attach external Hiring Managers; review HM feedback per candidate.',
    notes: [
      'List view has a **My Jobs / All Jobs** filter and a **Lead** column (the primary recruiter on each job).',
      'Job Detail card has FOUR collaboration panels: Skills, Team (assignees), Hiring Managers, and Hiring Manager Feedback.',
      'Adding a "Lead" assignee auto-demotes the previous Lead to Collaborator (one Lead per job).',
      'Owner / Team Lead / Sr Recruiter can manage assignees and HMs. Recruiter can edit job content but not assignees.',
      'Sourcers and Hiring Managers see the list but no Edit/Delete/+ New buttons.',
    ],
  },
  {
    name: 'Candidate Database',
    who: 'Everyone except Hiring Managers (HMs use the per-job candidate list in their portal).',
    purpose: 'Searchable database of candidates with contact details, experience, skills, resume text, and history. AI Content Check available on any resume.',
    notes: [
      'Sourcers can ADD candidates but not delete them — they\'re the primary sourcing role.',
      'Resume parser auto-extracts structured fields from PDF / DOCX uploads.',
      'Candidates are scoped to your company — different agencies don\'t share a pool.',
    ],
  },
  {
    name: 'JD Enhancer',
    who: 'Recruiters, Sr Recruiters, Team Leads, Owners (Sourcer can read only).',
    purpose: 'Paste a raw job description, get five ready-to-use assets back: Formatted JD, Recruiter Brief, Clarification Questions for the HM, Reachout Material, and Sourcing Keywords.',
    notes: [
      'Each asset has a copy button.',
      'Generated assets are bound to the session if you used it from inside a Pipeline Session, or saved standalone otherwise.',
    ],
  },
  {
    name: 'Pipeline Sessions',
    who: 'Recruiters / Sr Recruiters / Team Leads / Owners run them. Sourcers can act on Step 3 only. HMs see attached-job sessions read-only.',
    purpose: '7-step agentic hiring workflow: Select JD → Enhance JD → Source Candidates → Recruiter Screening → Assessment Round → Decision → Pipeline Tracker.',
    notes: [
      '**Step 1** Select the job for this drive (binds session to job_id).',
      '**Step 2** Enhance JD — AI generates the 5 assets reused everywhere downstream.',
      '**Step 3** Source candidates from the database; AI scores resume match and runs an AI Content Check.',
      '**Step 4** Recruiter screening — Pass / On Hold / Reject. Optionally launch a live screening call (Calling CoPilot opens with JD + resume context).',
      '**Step 5** Send Video Interview / MCQ / Coding assessments. AI evaluates submissions.',
      '**Step 6** Set interview level (L1/L2/L3), decision (Proceed/Pool), schedule the next round.',
      '**Step 7** Kanban board — move candidates through Selected / On Hold / Rejected.',
      'Sourcer view: a purple banner above the steps explains the role; Steps 4–8 buttons are disabled.',
      'Steps unlock progressively — you can\'t jump ahead until the prior step has enough data.',
    ],
  },
  {
    name: 'Video Interviews',
    who: 'Recruiters and up. HMs can read evaluations on attached jobs. Sourcers cannot access.',
    purpose: 'Async video interview templates. Send invites, candidates record on their own time, AI evaluates each response across 5 competencies.',
    notes: [
      'Question Generator: AI builds a mix of behavioral / technical / situational questions from the JD.',
      'Evaluator: scores Communication, Technical Skills, Problem Solving, Leadership, Cultural Fit + a hiring recommendation.',
      'Results auto-flow into Pipeline Session Step 5.',
    ],
  },
  {
    name: 'MCQ & Coding Assessments',
    who: 'Recruiters and up. Sourcers and HMs cannot access.',
    purpose: 'Build pre-screen tests. Candidates take them on a personal invite link. AI evaluator runs after submission.',
    notes: [
      'MCQ: 4-option multiple choice with topic + difficulty tags. Configurable time limit and pass score.',
      'Coding: in-browser code editor with starter code. Three problem types: write / fix / complete.',
      'Both produce an AI evaluation alongside the raw score.',
    ],
  },
  {
    name: 'Post Offer Follow-Up (POFU)',
    who: 'Recruiters and up. Sourcers and HMs cannot access.',
    purpose: 'Once a candidate accepts an offer, automated check-in emails fire at the right intervals. Tracks the offer-to-Day-1 lifecycle and flags drop risk.',
    notes: [
      'Lifecycle states: offer_accepted → resigned → BGV → confirmed → joined / dropped.',
      'Risk score (0–100) and risk level (low / medium / high) per candidate.',
      'Emails are AI-generated based on the trigger reason (weekly check-in, silence follow-up, DOJ reminder, BGV request, etc.).',
      'Auto-pauses if the candidate replies; resumes on silence.',
    ],
  },
  {
    name: 'Reports & Analytics',
    who: 'Owner / Team Lead see company-wide aggregations. Everyone else sees their own work. HMs cannot access.',
    purpose: 'Eight-tab analytics across the full hiring funnel — Pipeline, Efficiency, Candidates, Assessments, Video Interviews, Post-Offer, Activity, By Job.',
    notes: [
      'KPI strip on every view: Active Jobs, Avg Time-to-Hire, Selection Rate, Pipeline Sessions, Candidates, Assessments Done, Video Interviews, POFU, Calls Made.',
      'Owner / Team Lead numbers reflect the whole team. Recruiter / Sourcer numbers reflect just their own work.',
    ],
  },
  {
    name: 'Recruiter QA',
    who: 'Owner / Team Lead see all company QA reports. Recruiters / Sr Recruiters see their own. Sourcers and HMs cannot access.',
    purpose: 'Aggregator for per-call QA scorecards. KPI strip + searchable list + drill-down to the full Per-Call QA Report.',
    notes: [
      'Coaching surface — Team Leads can spot patterns ("recruiter X is consistently weak on Closing Effectiveness").',
      'Each scorecard has 7 weighted dimensions, red flags, and weak/better coaching nudges grounded in the call transcript.',
    ],
  },
  {
    name: 'Activity Feed',
    who: 'Owner / Team Lead only. Hidden in nav for everyone else.',
    purpose: 'Append-only timeline of company actions: job created/updated/deleted, assignees added/removed, HMs attached/detached, HM feedback submitted, session candidate state changes.',
    notes: [
      'Filter chips: All / Jobs / Sessions / Pipeline updates / Candidate Feedback.',
      'Each row shows colored avatar with initials, who did what, the entity reference, and a relative timestamp ("12 min ago", "3 hr ago", "2 d ago").',
      'Used for compliance, dispute resolution, and Team Lead coaching context.',
    ],
  },
  {
    name: 'Settings (Owner only)',
    who: 'Owner only. Hidden for everyone else.',
    purpose: 'Three tabs: Company Info, Team Management, My Account.',
    notes: [
      '**Team Management** — invite recruiters by email, assign roles (Team Lead / Sr Recruiter / Recruiter / Sourcer / Hiring Manager), activate/deactivate accounts.',
      '**Company Info** — company name, industry, website, logo URL, contact email.',
      '**My Account** — show current sign-in (with role pill), update display name, change password.',
      'New team members inherit the Owner\'s company.',
    ],
  },
  {
    name: 'Hiring Manager Portal',
    who: 'Hiring Managers only. Lands here automatically — no recruiter sidebar.',
    purpose: 'Slimmed-down stakeholder view: jobs they\'re attached to, candidates the recruiter has shortlisted on each, AI evaluation scores, a feedback form.',
    notes: [
      'Layout: navy header with the Zeople logo, "Hiring Manager Portal" label, sign-out button. Body: jobs grid → click into a job → candidates with scores + feedback form.',
      '**Feedback form** — 5-level recommendation pills (Strong Yes / Yes / Maybe / No / Strong No) + a free-form notes textarea.',
      'Submissions persist and prefill on next visit.',
      'HM cannot navigate to /jobs, /candidates, /sessions etc. directly — even via URL — for jobs they aren\'t attached to.',
    ],
  },
];

const WORKFLOWS = [
  {
    title: 'Run a hiring drive end-to-end',
    audience: 'Recruiter / Sr Recruiter',
    steps: [
      'Job Management → click an active job → ensure you (or a teammate) are listed as **Lead** in the Team panel.',
      'Pipeline Sessions → + New Session → pick the job and a name.',
      'Step 1 confirms the JD selection. Step 2 click **Generate Assets** to produce the 5 sourcing aids.',
      'Step 3 click **Add Candidates** to source from the database. AI scores resume match + flags AI-written resumes.',
      'Step 4 mark candidates Pass / On Hold / Reject. Optionally click **Screen via Call** to open Calling CoPilot with JD + resume context. After the call, the QA + Candidate reports save automatically.',
      'Step 5 pick a sub-mode (Video / MCQ / Coding) and send invites. When candidates submit, click **Evaluate** for AI scoring.',
      'Step 6 set interview level (L1/L2/L3) + Proceed/Pool decision + schedule the next interview.',
      'Step 7 use the Kanban board to move candidates to Selected / On Hold / Rejected as panels report back.',
      'On offer acceptance, the candidate auto-transfers to POFU.',
    ],
  },
  {
    title: 'Invite a teammate (Owner)',
    audience: 'Owner only',
    steps: [
      'Sidebar → **Settings** → **Team Management** tab.',
      'Click **+ Add Member**.',
      'Enter email, display name, password (min 6 chars), and pick a role from the dropdown.',
      'Click **Create Account**. The new user can log in immediately with the password you set.',
      'For Sourcers / Hiring Managers, the sidebar they see will be limited automatically — you don\'t need to configure visibility.',
    ],
  },
  {
    title: 'Bring in a Hiring Manager and review their feedback',
    audience: 'Owner / Team Lead / Sr Recruiter',
    steps: [
      '(Once) Settings → Team Management → invite the HM with role **Hiring Manager**.',
      'Job Management → open the relevant job → scroll to **Hiring Managers** panel → click **+ Add Hiring Manager** → pick from the modal.',
      'The HM now sees that one job in their portal when they sign in. Recruiters can keep working as normal.',
      'After the HM submits feedback on candidates, refresh the same Job Detail page — the **Hiring Manager Feedback** panel populates with each entry: HM name, recommendation pill (Strong Yes / Yes / etc.), italic notes, and timestamp.',
    ],
  },
  {
    title: 'Coach a recruiter using Recruiter QA',
    audience: 'Owner / Team Lead',
    steps: [
      'Sidebar → **Insights** → **Recruiter QA**.',
      'KPI strip shows team aggregates: Calls Reviewed, Avg QA Score, Needs Coaching %, Weakest Dimension.',
      'Sort the list by **Lowest Score First** to find calls that need attention.',
      'Click any row to open the full Per-Call QA Report — 8 weighted dimensions, red flags, weak vs. better coaching prompts grounded in the transcript.',
      'Use the coaching nudges as discussion points in your 1:1.',
    ],
  },
  {
    title: 'Use the Sourcer flow',
    audience: 'Sourcer',
    steps: [
      'Login. Sidebar shows: Home, Job Management, Candidate Database, Pipeline Sessions, JD Enhancer, Reports & Analytics, Recruiter QA. (No Calling CoPilot, no Evaluation modules, no POFU — by design.)',
      'Open a Pipeline Session → land directly on Step 3. A purple banner reads: "Sourcer view — you can add candidates and run AI evaluations in Step 3. Steps 4–8 are read-only or disabled."',
      'Source candidates using the database, manual add, or bulk upload. AI scores match and flags AI-written resumes.',
      'Hand off to a Recruiter — they\'ll handle Steps 4 onward.',
    ],
  },
  {
    title: 'Audit company activity (Owner / Team Lead)',
    audience: 'Owner / Team Lead',
    steps: [
      'Sidebar → **Insights** → **Activity Feed**.',
      'Use the filter chips to narrow: All / Jobs / Sessions / Pipeline updates / Candidate Feedback.',
      'Each row tells you who did what, when, and links to the entity by ID.',
      'Useful for compliance, dispute resolution, and "what happened" investigations.',
    ],
  },
];

const TEST_PLAN = [
  {
    section: 'Login & roles',
    items: [
      'Log in as **Pratik (Owner)**. Sidebar should show all modules including **Insights → Activity Feed** and **Admin → Settings**. Bottom-left chip shows "OWNER".',
      'Log in as **Divakar (Owner)**. Should see same modules. **Should NOT see Pratik\'s jobs / candidates / activity** (cross-tenant isolation).',
      'Settings → Team Management → invite a **Team Lead**. Log in as them. Activity Feed visible. Settings hidden. They see the team\'s sessions, calls, QA reports, /reports/summary numbers.',
      'Invite a **Recruiter**. Sidebar narrower (no Activity Feed, no Settings, no Users). They only see their own pipeline data.',
      'Invite a **Sourcer**. Sidebar very narrow. Pipeline session opens to Step 3 with banner; Steps 4–8 disabled.',
      'Invite a **Hiring Manager**. They land on the HM portal — no recruiter sidebar. Empty state until you attach them to a job.',
    ],
  },
  {
    section: 'Permissions hardening',
    items: [
      'As a **Recruiter**, try to delete a job from Job Management. Button hidden. (API call would also 403.)',
      'As a **Sourcer**, the +New Job button should be hidden, Edit/Delete row actions show "Read-only".',
      'As a **Sourcer**, sidebar items for Calling CoPilot, Video Interviews, MCQ Assessments, Coding Assessments, POFU, Settings should all be hidden.',
      'As a **Hiring Manager**, you can\'t reach /jobs, /candidates, /pofu, etc. — even by URL. The only routes available are /hm/*.',
    ],
  },
  {
    section: 'Job collaboration',
    items: [
      'Open a Job Detail. Confirm the **Team** panel shows a Lead (with orange chip), and that you can add a Collaborator from the modal.',
      'Try adding a teammate as **Lead**. Verify the previous Lead auto-demotes to Collaborator (one Lead per job).',
      'Try removing the LAST assignee. Should be blocked with "Cannot remove the last assignee. Add another first."',
      'Open the **Hiring Managers** panel → + Add Hiring Manager → pick a teammate with role HM → confirm chip appears.',
    ],
  },
  {
    section: 'HM portal end-to-end',
    items: [
      'Log in as the HM. See only the job(s) they\'re attached to.',
      'Click a job → see candidate list with match %, VI score, status.',
      'Submit feedback (Strong Yes + a note). Refresh — the form prefills.',
      'Switch to the Owner login → open the same job → confirm the **Hiring Manager Feedback** panel shows the feedback you just submitted.',
    ],
  },
  {
    section: 'Activity audit',
    items: [
      'As Owner, perform a few actions: create a job, attach an HM, submit HM feedback (in the HM portal), delete a session.',
      'Open Activity Feed. Confirm each action appears as a separate row with the right action label and entity reference.',
      'Use the filter chips to narrow to "Jobs" only — verify the job-related rows isolate correctly.',
    ],
  },
  {
    section: 'Demo data exploration',
    items: [
      'Job Management list → confirm 13 jobs exist (10 in Pratik\'s workspace, 3 in Divakar\'s).',
      'Recruiter QA → confirm 9–18 QA reports exist (varying scores 30–92, varying verdicts).',
      'POFU → confirm 12+ candidates across all 6 lifecycle states.',
    ],
  },
];

const LIMITATIONS = [
  '**Demo Vid button removed** — to demo the platform to someone, run a real screening call from a Pipeline Session.',
  '**No magic-link auth for HMs** — HMs use a password set by the Owner during invite. They\'ll need to be told their password.',
  '**Sr Recruiter** is functionally identical to Recruiter except they have `jobs.assign` capability — they can manage assignees + HMs without needing Owner/Team Lead.',
  '**Single Owner per company** — there\'s no UI flow to transfer ownership yet. Workaround: Owner manually edits via /settings/team.',
  '**No CSV / Excel export** from Reports & Analytics yet — flagged in the roadmap.',
  '**No source-of-hire tracking, offer acceptance analytics, or cost-per-hire** — these are gaps vs. enterprise ATS, intentionally not in scope yet.',
  '**Activity log captures user actions, not AI-only side effects** — e.g., a VI evaluation generated by AI is NOT a separate entry in the feed (it\'s implied by the candidate state change that follows).',
  '**Team Lead view of /reports/summary** treats "team" as everyone in the same company. There\'s no concept of "my direct reports" vs "the whole company" yet.',
];

// ─── Render helpers ────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Markdown-lite for inline **bold** and *italic*
const mdInline = (s) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');

const sectionAnchor = (n) => `s${n}`;

// ─── HTML ──────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zeople RecruiterOS — User Manual</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --orange:    #F97316;
    --orange-dim:#FEEBD6;
    --navy:      #1A2B4A;
    --bg:        #F1F5F9;
    --card:      #FFFFFF;
    --text-1:    #1E293B;
    --text-2:    #64748B;
    --text-3:    #94A3B8;
    --border:    #E2E8F0;
    --emerald:   #059669;
    --emerald-bg:#ECFDF5;
    --red:       #DC2626;
    --amber:     #F59E0B;
    --muted:     #F8FAFC;
    --mono:      'JetBrains Mono', Consolas, monospace;
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, .04);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--text-1);
    -webkit-font-smoothing: antialiased; line-height: 1.55;
    padding: 24px 16px 40px;
  }
  .page { max-width: 1320px; margin: 0 auto; }

  /* ── Header ── */
  .topbar { height: 6px; background: var(--orange); border-radius: 6px 6px 0 0; }
  .header {
    background: var(--card); border: 1px solid var(--border); border-top: none;
    border-radius: 0 0 12px 12px; padding: 20px 26px;
    display: flex; align-items: center; gap: 18px; box-shadow: var(--shadow-sm);
  }
  .header__logo {
    width: 48px; height: 48px; border-radius: 8px; background: var(--navy);
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .header__logo img { width: 38px; height: 38px; object-fit: contain; }
  .header__text { flex: 1; min-width: 0; }
  .header__brand {
    font-size: 11px; font-weight: 700; color: var(--orange);
    letter-spacing: .25em; margin-bottom: 4px;
  }
  .header__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
  .header__sub   { font-size: 13.5px; color: var(--text-2); margin-top: 3px; }
  .header__chip {
    font-size: 10px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase;
    background: var(--orange-dim); color: var(--orange);
    padding: 4px 10px; border-radius: 999px; white-space: nowrap;
  }

  /* ── TOC ── */
  .toc {
    margin-top: 18px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px 22px; box-shadow: var(--shadow-sm);
  }
  .toc__title {
    font-size: 11px; font-weight: 700; letter-spacing: .2em; color: var(--text-3);
    text-transform: uppercase; margin-bottom: 12px;
  }
  .toc__list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 24px; }
  .toc__list a {
    display: flex; gap: 10px; font-size: 13px; color: var(--text-1);
    text-decoration: none; padding: 4px 0;
  }
  .toc__list a:hover { color: var(--orange); }
  .toc__list a span:first-child {
    font-family: var(--mono); color: var(--text-3); font-size: 11px; min-width: 28px;
  }

  /* ── Section ── */
  .section { margin-top: 28px; scroll-margin-top: 24px; }
  .section__head {
    display: flex; align-items: center; gap: 14px; margin-bottom: 14px;
    padding-bottom: 10px; border-bottom: 1px solid var(--border);
  }
  .section__num {
    font-family: var(--mono); font-weight: 700; font-size: 13px; color: var(--orange);
    letter-spacing: .1em; background: var(--orange-dim);
    padding: 6px 10px; border-radius: 6px; line-height: 1;
  }
  .section__title { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
  .section__sub   { font-size: 13px; color: var(--text-2); }

  /* ── Card / role / module ── */
  .card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px 18px; box-shadow: var(--shadow-sm);
  }

  /* ── Roles grid ── */
  .roles { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .role {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px; box-shadow: var(--shadow-sm);
    border-left: 4px solid var(--orange);
  }
  .role__head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .role__pill {
    font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    padding: 3px 9px; border-radius: 999px; color: #fff;
  }
  .role__summary { font-size: 12.5px; color: var(--text-2); line-height: 1.55; }

  /* ── Permission matrix ── */
  .matrix-wrap { overflow-x: auto; }
  .matrix {
    width: 100%; border-collapse: collapse; font-size: 12.5px;
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    box-shadow: var(--shadow-sm);
  }
  .matrix th, .matrix td {
    padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border);
  }
  .matrix th {
    background: var(--navy); color: #fff;
    font-weight: 600; font-size: 11px; letter-spacing: .05em;
    text-transform: uppercase;
  }
  .matrix th:first-child { border-top-left-radius: 10px; }
  .matrix th:last-child  { border-top-right-radius: 10px; }
  .matrix tr:last-child td { border-bottom: 0; }
  .matrix tr:nth-child(even) td { background: var(--muted); }
  .matrix td:first-child { font-weight: 600; color: var(--text-1); }
  .matrix td.cell-F { color: var(--emerald); font-weight: 700; }
  .matrix td.cell-W { color: #2563eb;        font-weight: 700; }
  .matrix td.cell-R { color: var(--text-2);  font-weight: 600; }
  .matrix td.cell-N { color: var(--text-3);  text-align: center; }
  .matrix-key { font-size: 11px; color: var(--text-3); margin-top: 8px; padding: 0 4px; }

  /* ── Module cards ── */
  .modules { display: grid; gap: 12px; }
  .module {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px 18px; box-shadow: var(--shadow-sm);
  }
  .module__head {
    display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; flex-wrap: wrap;
  }
  .module__name { font-size: 16px; font-weight: 700; color: var(--text-1); }
  .module__who  { font-size: 11px; color: var(--orange); font-weight: 600; letter-spacing: .04em; }
  .module__purpose { font-size: 13px; color: var(--text-2); margin-bottom: 10px; line-height: 1.55; }
  .module__notes {
    margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--text-1); line-height: 1.55;
  }
  .module__notes li { padding: 2px 0; }

  /* ── Workflows ── */
  .workflow {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px 18px; box-shadow: var(--shadow-sm);
    margin-bottom: 12px;
  }
  .workflow__head {
    display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;
    border-bottom: 1px dashed var(--border); padding-bottom: 8px; gap: 10px; flex-wrap: wrap;
  }
  .workflow__title { font-size: 15px; font-weight: 700; color: var(--text-1); }
  .workflow__audience {
    font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--orange); white-space: nowrap;
  }
  .workflow__steps { margin: 0; padding-left: 22px; font-size: 13px; line-height: 1.6; counter-reset: step; }
  .workflow__steps li { padding: 3px 0; color: var(--text-1); }

  /* ── Test plan ── */
  .test-section {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px 18px; box-shadow: var(--shadow-sm);
    margin-bottom: 12px;
    border-left: 4px solid var(--emerald);
  }
  .test-section__title { font-size: 14px; font-weight: 700; color: var(--text-1); margin-bottom: 8px; }
  .test-list { margin: 0; padding-left: 20px; font-size: 12.5px; line-height: 1.6; color: var(--text-1); }
  .test-list li { padding: 3px 0; }

  /* ── Limitations ── */
  .limit-card {
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-left: 4px solid var(--amber);
    border-radius: 10px; padding: 16px 18px; box-shadow: var(--shadow-sm);
  }
  .limit-list { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-1); line-height: 1.65; }
  .limit-list li { padding: 3px 0; }

  /* ── Credentials ── */
  .creds {
    background: rgba(220, 38, 38, 0.05);
    border: 1px solid rgba(220, 38, 38, 0.25);
    border-left: 4px solid var(--red);
    border-radius: 10px; padding: 16px 18px; box-shadow: var(--shadow-sm);
  }
  .creds__warn {
    font-size: 11px; font-weight: 700; letter-spacing: .15em; color: var(--red);
    text-transform: uppercase; margin-bottom: 10px;
  }
  .cred-table {
    width: 100%; border-collapse: collapse; font-size: 13px;
  }
  .cred-table th, .cred-table td {
    padding: 8px 12px; border-bottom: 1px solid rgba(220, 38, 38, 0.15);
    text-align: left;
  }
  .cred-table th { font-weight: 700; color: var(--red); font-size: 11px; letter-spacing: .05em; }
  .cred-table code {
    font-family: var(--mono); font-size: 12px; color: var(--text-1);
    background: var(--card); padding: 2px 6px; border-radius: 4px;
    border: 1px solid var(--border);
  }
  .cred-note { font-size: 11.5px; color: var(--text-2); margin-top: 12px; line-height: 1.5; }

  /* ── Footer ── */
  .footer {
    margin-top: 32px; padding: 16px 22px;
    background: var(--navy); color: rgba(255,255,255,.85);
    border-radius: 12px;
    font-size: 12px; line-height: 1.65;
  }
  .footer strong { color: #fff; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .toc__list { grid-template-columns: 1fr; }
    .roles { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="topbar"></div>

    <header class="header">
      <div class="header__logo"><img src="${LOGO_URI}" alt="Zeople"></div>
      <div class="header__text">
        <div class="header__brand">ZEOPLE · RECRUITEROS</div>
        <h1 class="header__title">User Manual &amp; Internal Test Plan</h1>
        <div class="header__sub">Comprehensive guide for the recruiting team — covers every role, every module, common workflows, and a structured test plan.</div>
      </div>
      <span class="header__chip">v1 · Internal</span>
    </header>

    <!-- Table of Contents -->
    <nav class="toc">
      <div class="toc__title">Contents</div>
      <div class="toc__list">
        <a href="#${sectionAnchor(1)}"><span>01</span><span>Getting Started</span></a>
        <a href="#${sectionAnchor(2)}"><span>02</span><span>Roles at a glance</span></a>
        <a href="#${sectionAnchor(3)}"><span>03</span><span>Permission matrix</span></a>
        <a href="#${sectionAnchor(4)}"><span>04</span><span>The sidebar &amp; what each role sees</span></a>
        <a href="#${sectionAnchor(5)}"><span>05</span><span>Module reference (14)</span></a>
        <a href="#${sectionAnchor(6)}"><span>06</span><span>Hiring Manager Portal</span></a>
        <a href="#${sectionAnchor(7)}"><span>07</span><span>Common workflows</span></a>
        <a href="#${sectionAnchor(8)}"><span>08</span><span>Test plan for QA team</span></a>
        <a href="#${sectionAnchor(9)}"><span>09</span><span>Known limitations</span></a>
        <a href="#${sectionAnchor(10)}"><span>10</span><span>Login credentials</span></a>
      </div>
    </nav>

    <!-- 01. Getting Started -->
    <section class="section" id="${sectionAnchor(1)}">
      <header class="section__head">
        <span class="section__num">01</span>
        <div>
          <h2 class="section__title">Getting Started</h2>
          <div class="section__sub">First-time login and what to expect.</div>
        </div>
      </header>
      <div class="card">
        <p style="font-size: 13.5px; color: var(--text-1); margin: 0 0 12px;">
          Zeople RecruiterOS is an AI-powered multi-tenant recruiting platform. Each <strong>company</strong> (your agency) has its own users, jobs, candidates, and pipeline. Users belong to a company; data never leaks across companies. Inside a company, the <strong>6-role hierarchy</strong> determines what each person can see and do.
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <div style="font-size: 11px; font-weight: 700; letter-spacing: .12em; color: var(--text-3); text-transform: uppercase; margin-bottom: 6px;">Login URL (dev)</div>
            <code style="font-family: var(--mono); font-size: 13px; color: var(--text-1); background: var(--muted); padding: 6px 10px; border-radius: 6px; display: inline-block;">http://localhost:5174/</code>
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 700; letter-spacing: .12em; color: var(--text-3); text-transform: uppercase; margin-bottom: 6px;">Backend API</div>
            <code style="font-family: var(--mono); font-size: 13px; color: var(--text-1); background: var(--muted); padding: 6px 10px; border-radius: 6px; display: inline-block;">http://localhost:3000</code>
          </div>
        </div>
        <p style="font-size: 13px; color: var(--text-2); margin: 14px 0 0;">
          On first login you land on either the <strong>Home / Welcome Dashboard</strong> (recruiter-side roles) or the <strong>Hiring Manager Portal</strong> (HMs). The bottom-left of the sidebar shows your name and role chip — for an Owner this reads <strong style="color: var(--orange);">OWNER</strong>.
        </p>
      </div>
    </section>

    <!-- 02. Roles at a glance -->
    <section class="section" id="${sectionAnchor(2)}">
      <header class="section__head">
        <span class="section__num">02</span>
        <div>
          <h2 class="section__title">Roles at a glance</h2>
          <div class="section__sub">Six roles, ordered top-down by authority.</div>
        </div>
      </header>
      <div class="roles">
        ${ROLES.map(r => `
          <div class="role" style="border-left-color: ${r.color}">
            <div class="role__head">
              <span class="role__pill" style="background: ${r.color}">${esc(r.label)}</span>
            </div>
            <div class="role__summary">${esc(r.summary)}</div>
          </div>`).join('')}
      </div>
    </section>

    <!-- 03. Permission matrix -->
    <section class="section" id="${sectionAnchor(3)}">
      <header class="section__head">
        <span class="section__num">03</span>
        <div>
          <h2 class="section__title">Permission matrix</h2>
          <div class="section__sub">What each role can do per module.</div>
        </div>
      </header>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead>
            <tr>${PERMS[0].map(h => `<th>${esc(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${PERMS.slice(1).map(row => `
              <tr>
                ${row.map((cell, i) => {
                  if (i === 0) return `<td>${esc(cell)}</td>`;
                  let cls = 'cell-N';
                  if (cell.startsWith('F')) cls = 'cell-F';
                  else if (cell.startsWith('W')) cls = 'cell-W';
                  else if (cell.startsWith('R')) cls = 'cell-R';
                  return `<td class="${cls}">${mdInline(cell)}</td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="matrix-key">
        <strong>F</strong> = Full access · <strong>W</strong> = Read &amp; write · <strong>R</strong> = Read only · <strong>—</strong> = No access ·
        <em>* footnotes in italics indicate scope (e.g., "team", "attached only", "Step 3 only")</em>
      </div>
    </section>

    <!-- 04. Sidebar tour -->
    <section class="section" id="${sectionAnchor(4)}">
      <header class="section__head">
        <span class="section__num">04</span>
        <div>
          <h2 class="section__title">The sidebar — what each role sees</h2>
          <div class="section__sub">Nav items hide automatically based on the signed-in role.</div>
        </div>
      </header>
      <div class="card">
        <p style="font-size: 13px; color: var(--text-2); margin: 0 0 12px;">
          The left sidebar dynamically filters based on your role. Below is what each role sees, top to bottom:
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; font-size: 12.5px; line-height: 1.65; color: var(--text-1);">
          <div>
            <strong style="color: var(--orange); font-size: 12px; letter-spacing: .08em;">OWNER / TEAM LEAD</strong>
            <ul style="margin: 6px 0 0; padding-left: 20px;">
              <li>Home, Calling CoPilot, Job Management, Candidate Database, JD Enhancer</li>
              <li><em>Pipeline:</em> Pipeline Sessions, Post Offer Follow-Up</li>
              <li><em>Evaluation:</em> Video Interviews, MCQ Assessments, Coding Assessments</li>
              <li><em>Insights:</em> Reports &amp; Analytics, Recruiter QA, Activity Feed</li>
              <li><em>Admin:</em> Settings <em>(Owner only)</em></li>
            </ul>
          </div>
          <div>
            <strong style="color: #10b981; font-size: 12px; letter-spacing: .08em;">SR RECRUITER / RECRUITER</strong>
            <ul style="margin: 6px 0 0; padding-left: 20px;">
              <li>Home, Calling CoPilot, Job Management, Candidate Database, JD Enhancer</li>
              <li><em>Pipeline:</em> Pipeline Sessions, Post Offer Follow-Up</li>
              <li><em>Evaluation:</em> Video Interviews, MCQ Assessments, Coding Assessments</li>
              <li><em>Insights:</em> Reports &amp; Analytics, Recruiter QA</li>
              <li><em>(no Activity Feed, no Settings)</em></li>
            </ul>
          </div>
          <div>
            <strong style="color: #a78bfa; font-size: 12px; letter-spacing: .08em;">SOURCER</strong>
            <ul style="margin: 6px 0 0; padding-left: 20px;">
              <li>Home, Job Management <em>(read-only)</em>, Candidate Database</li>
              <li><em>Pipeline:</em> Pipeline Sessions <em>(Step 3 only)</em></li>
              <li><em>Insights:</em> Reports &amp; Analytics, Recruiter QA <em>(own data)</em></li>
              <li><em>(no Calling CoPilot, no Evaluation, no POFU, no JD Enhancer is shown but read-allowed)</em></li>
            </ul>
          </div>
          <div>
            <strong style="color: var(--red); font-size: 12px; letter-spacing: .08em;">HIRING MANAGER</strong>
            <ul style="margin: 6px 0 0; padding-left: 20px;">
              <li>Lands on the dedicated <strong>Hiring Manager Portal</strong> (no recruiter sidebar).</li>
              <li>Sees: their attached jobs, candidates per job, AI scores, feedback form.</li>
              <li>Cannot reach any recruiter route, even via direct URL.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- 05. Module reference -->
    <section class="section" id="${sectionAnchor(5)}">
      <header class="section__head">
        <span class="section__num">05</span>
        <div>
          <h2 class="section__title">Module reference</h2>
          <div class="section__sub">14 modules across the platform. The colored eyebrow on each card shows the audience.</div>
        </div>
      </header>
      <div class="modules">
        ${MODULES.map(m => `
          <div class="module">
            <div class="module__head">
              <div class="module__name">${esc(m.name)}</div>
              <div class="module__who">${esc(m.who)}</div>
            </div>
            <div class="module__purpose">${mdInline(m.purpose)}</div>
            <ul class="module__notes">
              ${m.notes.map(n => `<li>${mdInline(n)}</li>`).join('')}
            </ul>
          </div>`).join('')}
      </div>
    </section>

    <!-- 06. HM Portal — has its own bigger module card so we don't repeat ourselves -->
    <section class="section" id="${sectionAnchor(6)}">
      <header class="section__head">
        <span class="section__num">06</span>
        <div>
          <h2 class="section__title">Hiring Manager Portal — focus</h2>
          <div class="section__sub">A separate UI for external client stakeholders.</div>
        </div>
      </header>
      <div class="card" style="border-left: 4px solid var(--red);">
        <p style="font-size: 13.5px; color: var(--text-1); margin: 0 0 10px;">
          The HM Portal exists to let your <strong>clients</strong> (the people you're recruiting for) review your shortlist and give feedback — without giving them recruiter-level access. When a user with role <code style="font-family: var(--mono); font-size: 12px; padding: 1px 6px; background: var(--muted); border-radius: 4px;">hiring_manager</code> logs in, they bypass the recruiter <code style="font-family: var(--mono); font-size: 12px; padding: 1px 6px; background: var(--muted); border-radius: 4px;">AppShell</code> entirely and land on a dedicated portal.
        </p>
        <p style="font-size: 13px; color: var(--text-2); margin: 0 0 10px;">
          The HM only sees jobs they're explicitly attached to (via Job Detail → Hiring Managers panel → + Add Hiring Manager). Inside each job they see:
        </p>
        <ul style="margin: 0 0 10px; padding-left: 22px; font-size: 13px; color: var(--text-1); line-height: 1.65;">
          <li>Job basics — title, client, location, required skills.</li>
          <li>Shortlisted candidates (those past Step 4 screening) with: name, current title/company, match %, VI score, pipeline status.</li>
          <li>Recruiter\'s comment (if the recruiter wrote a vi_review note).</li>
          <li>A feedback form per candidate: 5-level recommendation pill + free-form notes.</li>
        </ul>
        <p style="font-size: 13px; color: var(--text-2); margin: 0;">
          Submitted feedback flows back to the recruiter UI in two places: the <strong>Hiring Manager Feedback panel</strong> on Job Detail (grouped by candidate) and an <code style="font-family: var(--mono); font-size: 12px; padding: 1px 6px; background: var(--muted); border-radius: 4px;">hm.feedback.submit</code> entry in the <strong>Activity Feed</strong>.
        </p>
      </div>
    </section>

    <!-- 07. Workflows -->
    <section class="section" id="${sectionAnchor(7)}">
      <header class="section__head">
        <span class="section__num">07</span>
        <div>
          <h2 class="section__title">Common workflows</h2>
          <div class="section__sub">Step-by-step for the most frequent tasks.</div>
        </div>
      </header>
      ${WORKFLOWS.map(wf => `
        <div class="workflow">
          <div class="workflow__head">
            <div class="workflow__title">${esc(wf.title)}</div>
            <div class="workflow__audience">${esc(wf.audience)}</div>
          </div>
          <ol class="workflow__steps">
            ${wf.steps.map(s => `<li>${mdInline(s)}</li>`).join('')}
          </ol>
        </div>`).join('')}
    </section>

    <!-- 08. Test plan -->
    <section class="section" id="${sectionAnchor(8)}">
      <header class="section__head">
        <span class="section__num">08</span>
        <div>
          <h2 class="section__title">Test plan for the QA team</h2>
          <div class="section__sub">Structured scenarios to verify the platform end-to-end.</div>
        </div>
      </header>
      ${TEST_PLAN.map(ts => `
        <div class="test-section">
          <div class="test-section__title">${esc(ts.section)}</div>
          <ul class="test-list">
            ${ts.items.map(it => `<li>${mdInline(it)}</li>`).join('')}
          </ul>
        </div>`).join('')}
      <div style="font-size: 12px; color: var(--text-3); margin-top: 8px; line-height: 1.55;">
        Two automated test scripts also exist for engineers:
        <code style="font-family: var(--mono); font-size: 11.5px; padding: 1px 6px; background: var(--muted); border-radius: 4px;">node scripts/smoke.js</code> (59 invariants)
        and
        <code style="font-family: var(--mono); font-size: 11.5px; padding: 1px 6px; background: var(--muted); border-radius: 4px;">node scripts/selftest.js</code> (6 deeper probes).
        Run after any change.
      </div>
    </section>

    <!-- 09. Limitations -->
    <section class="section" id="${sectionAnchor(9)}">
      <header class="section__head">
        <span class="section__num">09</span>
        <div>
          <h2 class="section__title">Known limitations</h2>
          <div class="section__sub">Things to know before pinging engineering.</div>
        </div>
      </header>
      <div class="limit-card">
        <ul class="limit-list">
          ${LIMITATIONS.map(l => `<li>${mdInline(l)}</li>`).join('')}
        </ul>
      </div>
    </section>

    <!-- 10. Credentials -->
    <section class="section" id="${sectionAnchor(10)}">
      <header class="section__head">
        <span class="section__num">10</span>
        <div>
          <h2 class="section__title">Login credentials</h2>
          <div class="section__sub">For internal QA testing only — not for external sharing.</div>
        </div>
      </header>
      <div class="creds">
        <div class="creds__warn">⚠ Internal use — Do not share outside the team</div>
        <table class="cred-table">
          <thead>
            <tr><th>Account</th><th>Email</th><th>Password</th><th>Role</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Pratik (seeded)</td>
              <td><code>pratik@zeople-ai.com</code></td>
              <td><code>password123</code></td>
              <td>Owner</td>
            </tr>
            <tr>
              <td>Divakar (seeded)</td>
              <td><code>divakar@zeople-ai.com</code></td>
              <td><code>password123</code></td>
              <td>Owner</td>
            </tr>
          </tbody>
        </table>
        <p class="cred-note">
          To test the other 4 roles, log in as Pratik or Divakar → <strong>Settings → Team Management → + Add Member</strong>. Pick a role, set a password, and you're done. New users join the same company as the inviting Owner.
        </p>
        <p class="cred-note">
          Two Owner accounts exist <em>by design</em> to verify cross-tenant isolation — Pratik's company (<em>Pratik's Workspace</em>) and Divakar's company (<em>Zeople AI</em>) cannot see each other's jobs / candidates / activity.
        </p>
      </div>
    </section>

    <footer class="footer">
      <strong>Zeople RecruiterOS — User Manual v1.</strong>
      Source: <code style="font-family: var(--mono); color: rgba(255,255,255,.85); background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 4px;">scripts/build-user-manual-html.js</code>.
      Regenerate with <code style="font-family: var(--mono); color: rgba(255,255,255,.85); background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 4px;">node scripts/build-user-manual-html.js &amp;&amp; node scripts/build-user-manual-pdf.js</code>.
      Generated ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.
    </footer>
  </div>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log('✅ Wrote ' + OUT);
