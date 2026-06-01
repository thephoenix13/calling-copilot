# Zeople RecruiterOS — Product Overview

Zeople RecruiterOS is an AI-powered recruiting platform that helps recruiters manage the full hiring lifecycle — from sourcing and screening candidates to making final decisions and tracking post-offer follow-up — in one place.

---

## What's Been Built

### 1. Welcome Dashboard
The first screen after login. Shows a personalised greeting (Good morning / afternoon / evening + recruiter's first name), a live snapshot of recent activity across jobs, candidates, sessions, assessments, and POFU, plus quick-action links to jump into any module. KPIs refresh on load.

---

### 2. Calling CoPilot
The original core feature. When a recruiter calls a candidate, the system transcribes the conversation in real time and surfaces live AI suggestions — helping the recruiter ask the right questions and stay on track. After the call, two AI-generated reports are available:
- **Per-Call QA Report** — scores the recruiter's performance (coverage, tone, structure)
- **Candidate Evaluation Report** — assesses the candidate based on what was said

An **Auto Demo** mode simulates a full recruiter–candidate conversation with AI-generated responses, so you can see the tool in action without making a real call.

---

### 3. Job Management
Recruiters can create and manage job postings — with details like title, department, client name, location, salary range, required skills, preferred skills, and headcount. Jobs feed into the pipeline and JD Enhancer.

---

### 4. Candidate Database
A searchable database of all candidates. Each profile stores contact details, experience, skills, resume text, and work history. Candidates from the database can be pulled directly into any pipeline session. An **AI Content Check** can be run on any resume to flag AI-generated writing.

---

### 5. JD Enhancer
Paste a raw or rough job description and the AI produces five ready-to-use assets:
- **Formatted JD** — clean, structured job description
- **Recruiter Brief** — internal briefing notes for the recruiter
- **Clarification Questions** — questions to ask the hiring manager
- **Reachout Material** — outreach copy for LinkedIn, email, etc.
- **Sourcing Keywords** — boolean strings and keywords for candidate search

Each asset has a copy button. All five outputs are saved to the session so you can come back to them.

---

### 6. Pipeline Sessions (Agentic Hiring Pipeline)
The heart of the platform. Each session tracks a hiring drive for a specific role through seven progressive steps:

| Step | Name | What happens |
|------|------|-------------|
| 1 | Select JD | Pick the job this session is for |
| 2 | Enhance JD | Run the JD through AI to generate all five assets |
| 3 | Source Candidates | Add candidates from the database; AI scores their resume match and runs an AI content check |
| 4 | Recruiter Screening | Mark each candidate Pass / On Hold / Reject; optionally launch a live screening call |
| 5 | Assessment Round | Send shortlisted candidates a Video Interview, MCQ Test, or Coding Challenge; view AI interview reports |
| 6 | Decision | Set interview level (L1/L2/L3), mark Proceed or Pool, and schedule a live interview date & time per candidate |
| 7 | Pipeline Tracker | Kanban board — move candidates through Selected / On Hold / Rejected; inline interview scheduler on each card; voice note recording per candidate |

Steps unlock progressively — you can't jump ahead until the previous step has enough data.

**Step 5 sub-modes:** The assessment step has four selectable sub-views — Video Interview Scheduler, MCQ Scheduler, Coding Scheduler, and AI Interview Reports. Each sub-view handles sending invites and displaying results for that assessment type.

**Interview Scheduler (Steps 6 & 7):** When a decision of "Proceed" is set in Step 6, a date-and-time picker appears to schedule the candidate's next live interview. The scheduled date is included in any notification email sent to the candidate. In Step 7, each Kanban card shows a schedule button — clicking it opens an inline editor to set or update the interview datetime without leaving the tracker view.

---

### 7. Video Interviews
Recruiters create asynchronous video interview templates with a set of questions. Shortlisted candidates receive an email invite, record their answers on their own time, and the AI evaluates each response — scoring communication, relevance, and competency. Results appear in Step 5 of the pipeline.

---

### 8. MCQ Assessments
Recruiters build multiple-choice question tests with configurable time limits and pass scores. Candidates receive a personal invite link, complete the test in one sitting, and the AI provides a written evaluation alongside the raw score.

---

### 9. Coding Assessments
Similar to MCQ but for technical roles. Recruiters create coding challenges with problem statements and starter code. Candidates write or fix code directly in the browser within a time limit. The AI evaluates their submissions.

---

### 10. Post Offer Follow-Up (POFU)
Once a candidate accepts an offer, POFU takes over. It automatically sends personalised check-in emails at the right intervals — checking if they've resigned, cleared background verification, confirmed their joining date, and actually joined. The system tracks risk level for each candidate and flags anyone who might drop out before Day 1.

---

### 11. Reports & Analytics
A comprehensive analytics module covering the full hiring funnel. Loads two data streams in parallel (summary + row-level details) and displays them across eight tabs:

| Tab | What it shows |
|-----|--------------|
| **Pipeline Funnel** | Sourced → Shortlisted → VI Invited → Proceeded → Selected bars; Video Interview completion funnel; Session Breakdown table |
| **Efficiency** | Stage conversion rates with bottleneck detection (flags the weakest stage); Time-in-stage (avg days from sourcing to VI, VI to selected); Overall selection rate and avg time-to-hire; Candidate Stage Detail table |
| **Candidates** | Screening status breakdown, decision outcomes, AI interview score distribution, skill match % distribution; All Pipeline Candidates table |
| **Assessments** | MCQ and Coding assessment stats (invited, completed, avg score, pass rate, avg time); Score distributions; MCQ and Coding invite records tables |
| **Video Interviews** | Hiring recommendation breakdown, overall score distribution, average competency scores (5 dimensions); Video Interview Candidates table |
| **Post-Offer** | POFU state progression, risk level distribution, email engagement (outbound/response rate), offer outcome; POFU Candidates table |
| **Activity** | Session-level activity log — sourced, shortlisted, proceeded, selected, avg days per session |
| **By Job** | Per-job pipeline metrics (sourced, shortlisted, pass rate, proceeded, selected, VI count, POFU count, days open); Totals row; Unlinked Sessions row for candidates in sessions without a job attached; Click any job row to drill into job-specific analytics including skills coverage |

**KPI strip** at the top of every report view shows: Active Jobs, Avg Time-to-Hire, Selection Rate, Pipeline Sessions, Total Candidates, Assessments Done, Video Interviews, POFU Candidates, and Calls Made.

**Data consistency:** All tabs count from the same source (all session_candidates for the user). The By Job tab includes sessions linked to any job the user's sessions reference, not just jobs they created — keeping totals consistent across tabs.

---

### 12. Recruiter QA
A coaching-focused view that surfaces every saved Per-Call QA Report in one place, so recruiters and team leads can spot patterns, weak dimensions, and calls that need review.

**KPI strip** across the top: Calls Reviewed, Avg QA Score, Needs Coaching % (calls below 70), and the most common Weakest Dimension across all reviewed calls.

**Searchable list** of every reviewed call with: recruiter, candidate, role, date, duration, color-coded QA score (red < 45, amber 45–69, green ≥ 70), submission verdict pill, risk level pill, and the weakest dimension for that specific call. Search across recruiter / candidate / role; sort by most recent, lowest score, or highest score.

**Drill-down:** Clicking any row opens the full Per-Call QA Report inline — same evidence-grounded scorecard, red flags, and weak vs. better coaching nudges that are generated when a call ends in Calling CoPilot.

**Where the data comes from:** QA reports are AI-generated and persisted automatically when a call ends in Calling CoPilot. Recruiter QA reads them directly — no extra setup. If no calls have produced reports yet, the module shows an empty state pointing to Calling CoPilot.

---

### 13. Market Intelligence
A 4-stage Claude research pipeline that produces a hiring-market report (salary bands, demand signals, talent pool, competitor activity, talent reputation) for a specific role and Indian location. Each report is created from a `JobContext` (title, location, industry, employment type, experience level, must-have skills) — either filled in by hand or extracted automatically by uploading a JD as PDF / DOCX / TXT, or pasting JD text.

Behind the scenes:

| Stage | Model | What it does |
|------|------|------|
| 0 | Haiku 4.5 | Parse uploaded/pasted JD into a structured JobContext (tool-use, enum-validated) |
| 2 | Opus 4.7 | Web research with `web_search` + `web_fetch`, adaptive thinking |
| 3 | Sonnet 4.6 | Structure the research into a JSON-schema-validated report payload |
| 4 | Haiku 4.5 | Write the executive summary |
| 5 | Sonnet 4.6 | *(optional refresh)* Glassdoor reputation enrichment for the top competitor companies |

The form returns immediately with a `pending` row; the UI polls until status reaches `completed` or `failed`. Failed reports can be **retried** without re-running Stage 2 (the cached `research_doc` is reused, saving ~90s and the web-search cost). Completed reports are **editable** and can be refreshed for reputation data.

Reports can optionally be linked to a job in the company's database (the link is shown in the list view).

---

### 14. Activity Feed *(Owner / Team Lead only)*
A company-wide append-only log of who did what. Surfaces job creates/updates, assignee and hiring-manager attachments, hiring-manager feedback submissions, session creates, and per-candidate pipeline updates. Each row shows actor, action, target entity, summary, and a relative timestamp ("just now / 12 min ago / 3 d ago").

A filter dropdown narrows the feed to Jobs / Sessions / Pipeline updates / Candidate feedback.

The log is best-effort — `logActivity()` calls in route handlers never fail a request, so a stale or missing row never blocks user actions.

---

### 15. Hiring Manager Portal
External hiring managers (`role = hiring_manager`) get a completely separate, slimmed-down portal — they bypass the normal recruiter sidebar entirely. The portal has two views:

- **Your Jobs** — every job they've been attached to (`job_hiring_managers` join). Cards show client, location, top 4 required skills, and openings count.
- **Job Detail** — the shortlist for a single job (only candidates that have passed or are on hold at the screening stage), with each candidate's match %, AI interview score, current pipeline status, and any recruiter note.

For each shortlisted candidate the HM submits a structured **recommendation** (Strong Yes / Yes / Maybe / No / Strong No) and free-text notes. The form upserts on `(job_id, candidate_id, hm_user_id)` so re-opening a candidate restores their previous answer.

HMs never see the candidate database, the pipeline session, or any other job. Every endpoint in `/hm/*` re-checks attachment via `job_hiring_managers` before returning data.

---

### 16. Settings *(Owner only)*
Available to account owners (legacy `superuser` JWTs are still accepted). Three tabs:
- **Company Info** — name, industry, website, address, contact email
- **Team Management** — create teammates with one of 5 internal roles (Owner / Team Lead / Sr Recruiter / Recruiter / Sourcer) or invite a Hiring Manager and attach them to specific jobs; activate or deactivate members
- **My Account** — update display name and password

---

## How the Invite Emails Work

When candidates are invited to any assessment or video interview, they receive a personalised email that references the recent call:

> *"It was great speaking with you earlier. As promised, here's the MCQ assessment I mentioned for the **Software Engineer** role — this is the next step in our process."*

The email is signed with the recruiter's name, includes the time limit and passing score, and has a single call-to-action button. All invite links are unique and personal to the candidate.

When a Decision is saved in Step 6 with a scheduled interview date, a notification email to the candidate includes the date and time of their upcoming live interview.

---

## User Roles

The platform has a 6-role hierarchy. Five roles are internal recruiting team members; **Hiring Manager** is the only external role (and gets the separate portal in §15).

| Role | What they can do |
|------|------------------|
| **Owner** | Everything. The only role that can edit company info, manage billing, and invite or deactivate teammates. Sees all data across the company. |
| **Team Lead** | Full access to all recruiting features. Sees all data across the company. Can manage job assignees and attach hiring managers, view team-level QA. Cannot edit company info or invite owners. |
| **Sr Recruiter** | All recruiter features plus the ability to assign teammates and hiring managers to jobs. Sees only their own pipeline rows. |
| **Recruiter** | Standard recruiter access — create jobs, run pipelines, place calls, send assessments, manage POFU. Sees only their own pipeline rows. |
| **Sourcer** | Restricted to sourcing — Jobs / Candidate Database / Pipeline Step 3 (Source Candidates). Hidden from Calling CoPilot, JD Enhancer, POFU, evaluation modules, and Market Intelligence. |
| **Hiring Manager** | External stakeholder. Bypasses the standard sidebar entirely and gets the slim portal in §15. Sees only candidates on jobs they're attached to. |

Legacy JWTs with the older roles (`admin` → Owner, `superuser` → Owner, `subuser` → Recruiter) continue to work; the DB migration (`db.js`) remaps existing rows on first start of a new build.

---

## Permissions & Data Scoping

Two layers control who sees what:

**1. Capability map** (`server/middleware/permissions.js`) — every mutating endpoint declares a capability (e.g. `jobs.create`, `mi.write`, `pofu.write`); the map lists which roles hold that capability. The `requireCapability()` and `requireRole()` middlewares enforce it.

**2. Row-level scoping** (`server/utils/scoping.js`) — read endpoints call `visibleUserIds(req)` to get the set of `user_ids` whose rows the caller is allowed to see:
- **Owner / Team Lead** — every active member of their company
- **Sr Recruiter / Recruiter / Sourcer** — only themselves
- **Hiring Manager** — never goes through this path; HM endpoints scope by `job_hiring_managers` attachment instead

On top of that, **company scoping** is enforced at the table level: `jobs.company_id`, `candidates.company_id`, and `mi_reports.company_id` are populated when a row is created and filtered on every read. A user from one company can never see data from another, even if they know the row ID.

The pipeline is also **assignment-aware**: `job_assignees` powers the "My Jobs" filter in Jobs Management, and `job_hiring_managers` is the source of truth for which jobs each Hiring Manager sees.

---

## Reports & Analytics — Comparison with Prominent ATS

Platforms compared: Greenhouse, Lever, Workday, iCIMS, ZOHO Recruit, CEIPAL, SmartRecruiters, BambooHR.

| Analytics Feature | Prominent ATS | Zeople RecruiterOS |
|---|:---:|:---:|
| Pipeline funnel (stage-by-stage counts) | ✅ | ✅ |
| Stage conversion rates | ✅ | ✅ |
| Time-to-hire | ✅ | ✅ |
| Time-to-fill | ✅ | ❌ |
| Time-in-stage (per stage) | ✅ | ✅ |
| Days open per job | ✅ | ✅ |
| Per-job drill-down analytics | ✅ | ✅ |
| Source of hire (LinkedIn, referral, job board) | ✅ | ❌ |
| Source-to-hire conversion / ROI | ✅ | ❌ |
| Offer acceptance rate | ✅ | ❌ |
| Cost-per-hire | ✅ | ❌ |
| Recruiter performance scorecards | ✅ | ✅ native — AI-graded per-call QA |
| Multi-recruiter comparison | ✅ | 🔶 list view with recruiter column |
| DEI / diversity funnel | ✅ | ❌ |
| Candidate assessment analytics | ✅ (via integrations) | ✅ native — MCQ + Coding |
| Video interview analytics | ✅ (via HireVue etc.) | ✅ native |
| AI resume match / quality scoring | 🔶 some | ✅ |
| AI content check on resumes | ❌ | ✅ |
| AI interview / call scoring | ❌ | ✅ |
| Skill coverage heatmap per job | ❌ | ✅ |
| Post-offer drop risk scoring | ❌ | ✅ |
| Post-offer state tracking (BGV, resigned, joined) | ❌ | ✅ |
| Bottleneck detection (flags weakest stage) | ❌ | ✅ |
| Call analytics (calls made, avg duration) | ❌ | ✅ |
| Per hiring-drive / session analytics | ❌ | ✅ |
| Row-level detail drill-through tables | ✅ | ✅ |
| Real-time dashboard | ✅ | ✅ |
| CSV / Excel export | ✅ | ❌ |
| Custom report builder | ✅ | ❌ |
| Scheduled email reports | ✅ | ❌ |
| BI tool integration (PowerBI, Looker) | ✅ | ❌ |

**Where Zeople leads:** AI-native features that no standard ATS offers — call scoring, recruiter QA scorecards with coaching nudges, AI resume content check, native video interview analytics, post-offer risk scoring, and per-session hiring-drive analytics.

**Key gaps vs. enterprise ATS:** Source of hire tracking, offer analytics, cost-per-hire, aggregated multi-recruiter leaderboards (per-call scorecards exist; team-level comparison is on the roadmap), and export / reporting infrastructure (CSV, scheduled reports, BI integrations).

---

## Tech Stack (brief)
- **Frontend:** React 18 + Vite (Hiring Managers get a separate slim portal at the same URL — no extra deployment)
- **Backend:** Node.js + Express, with `express-ws` for the Twilio media-stream WebSocket and Socket.io (polling) for live transcript broadcast
- **Database:** SQLite (via better-sqlite3, WAL mode), with idempotent in-app migrations on every start
- **Auth:** JWT with bcrypt-hashed passwords; capability map + per-row scoping enforce 6-role permissions
- **AI:** Anthropic Claude — Opus 4.7 / Sonnet 4.6 / Haiku 4.5 used across reports, evaluations, JD enhancement, POFU emails, AI content check, and the 4-stage Market Intelligence research pipeline (with `web_search` + `web_fetch` tool use)
- **Communication:** Twilio (calls + recordings), Hostinger SMTP (assessment / VI / POFU emails), Deepgram (live dual-track transcription — recruiter + candidate on separate connections)
- **Scheduling:** node-cron — POFU follow-up engine runs every 6 hours
