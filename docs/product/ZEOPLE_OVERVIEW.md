# Zeople RecruiterOS — Product Overview

> **Zeople is the AI Co-Pilot for Recruiting Agencies and Staffing Firms — protecting agency revenue from the first recruiter call to the candidate's first day on the job.**

This document is the canonical product reference. It describes what Zeople is, who it serves, the problem it solves, the two pillars it is built around, the supporting workflow that makes them effective, the competitive landscape, and the technical foundation. All forward-looking product, sales, and positioning work draws from this.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem We Solve](#2-the-problem-we-solve)
3. [Our Thesis](#3-our-thesis)
4. [Pillar 1 — Calling CoPilot](#4-pillar-1--calling-copilot)
5. [Pillar 2 — Post-Offer Follow-Up (POFU)](#5-pillar-2--post-offer-follow-up-pofu)
6. [Why the Two Pillars Win Together](#6-why-the-two-pillars-win-together)
7. [The Supporting System](#7-the-supporting-system)
8. [Who Zeople Is For](#8-who-zeople-is-for)
9. [Competitive Landscape](#9-competitive-landscape)
10. [Roles, Permissions, and Data Scoping](#10-roles-permissions-and-data-scoping)
11. [Technical Foundation](#11-technical-foundation)
12. [Key Metrics and How We Measure Success](#12-key-metrics-and-how-we-measure-success)
13. [Product Principles](#13-product-principles)
14. [Roadmap Direction](#14-roadmap-direction)

---

## 1. Executive Summary

Recruiting agencies and staffing firms operate on a brutally simple economic equation: they earn placement fees only when a candidate **actually joins** the client company. Yet two breakdowns systematically destroy agency P&L:

- **At the top of the funnel:** every placement starts with a recruiter call, but recruiter quality varies enormously and is impossible to coach at scale. With AI-generated resumes flooding the market, the call itself is now the primary candidate-quality signal — and most agencies are flying blind on what happens during those thousands of calls.
- **At the bottom of the funnel:** 30–50% of accepted offers never result in a Day-1 join. Counter-offers, background verification failures, multiple-offer juggling, notice-period games, and post-acceptance ghosting silently kill placements that have already been earned.

**Zeople is the first product to address both breakdowns in a single workflow purpose-built for recruiting agencies.** It is built around two pillars:

- **Calling CoPilot** — live AI transcription, in-call guidance, and post-call evaluation that scores every recruiter call, evaluates every candidate, and produces a coaching loop for every recruiter.
- **Post-Offer Follow-Up (POFU)** — an automated, AI-driven engagement engine that monitors every accepted offer from acceptance through joining, scores drop risk in real time, and triggers interventions early enough to save placements that would otherwise be lost.

The rest of the platform — pipeline sessions, JD enhancement, assessments, candidate database, hiring manager portal, analytics, market intelligence — is the connective workflow that makes the two pillars effective inside a complete agency operation.

---

## 2. The Problem We Solve

### 2.1 The agency revenue equation

Recruiting agencies and staffing firms are paid on **placements** — and a placement is realized only when a candidate **joins** their client. Every step before that (sourcing, screening, submitting, offer extension, offer acceptance) is unpaid work-in-progress. The agency P&L flows from one number:

> **Placements that result in Day-1 joins.**

Two leakage points sit on either side of this number, and both have been historically unaddressable:

### 2.2 Top-of-funnel: recruiter calls don't scale

Every placement begins with a recruiter on a phone or video call with a candidate. The recruiter qualifies fit, probes for red flags, builds trust, and produces a submission to the client. The quality of that call is the single largest determinant of whether the submission converts into an interview, an offer, and ultimately a placement.

- Most agencies have **1–2 strong recruiters and 8–12 average ones**. The variance in call quality is enormous.
- Delivery heads can listen to maybe 5–10 calls per week out of the thousands their team makes. Coaching is anecdotal, not systematic.
- AI-generated resumes are now mainstream. Pre-call signals (resume, profile) are becoming unreliable. **The call itself is now the primary trustworthy signal about a candidate**, and agencies have no infrastructure to extract that signal at scale.
- New-hire recruiter ramp-up is slow (often 60–90 days to productivity) because there is no systematic feedback loop on what makes a great call versus an average one.

### 2.3 Bottom-of-funnel: offer-to-join leakage

When a candidate accepts an offer, most agencies and most ATSes treat it as the finish line. In reality, it is the **risk peak**. Between offer acceptance and Day-1 join, the agency is exposed:

- **Counter-offers** from the candidate's current employer (rampant in hot tech markets — often 30–40% of accepts receive a counter).
- **Background verification (BGV) failures** — discrepancies in employment dates, education records, criminal checks.
- **Multiple-offer juggling** — candidates accept multiple offers and pick one closer to joining, often without informing the others.
- **Notice-period games** — in markets with 60–90 day notice periods, candidates have weeks during which loyalty erodes, counter-offers accumulate, and competing offers arrive.
- **Post-acceptance disengagement** — the candidate stops responding to emails, goes silent on the recruiter, and never shows up on Day 1.

**Industry-wide, 30–50% of accepted offers do not result in a Day-1 join.** In hot tech markets and at agencies that serve them, the rate can exceed 50%. Every dropped offer is paid-for-zero work: the agency invested calls, screenings, assessments, hiring manager time, and offer negotiation effort — and the placement fee never arrives.

### 2.4 What existing tools miss

Major ATSes — Greenhouse, Lever, Workday, iCIMS, Bullhorn, Zoho Recruit — are built around **requisition and pipeline management**. They track candidates through stages but address neither problem natively:

- They do not evaluate calls (some integrate with third-party call-intelligence tools designed for sales, not recruiting).
- They do not actively engage candidates between offer-accept and joining; the candidate sits in a "pending start" stage as a static row.
- They do not predict drop risk or trigger interventions.

Specialist tools exist for each problem individually (Metaview, Sybill for calls; generic CRM drip-campaign tools for engagement), but no product packages both for the agency workflow.

---

## 3. Our Thesis

Two AI breakthroughs in the last 18 months make a new kind of agency tool possible:

1. **Real-time, production-grade call evaluation.** Modern LLMs can transcribe a call in real time, surface in-call guidance, and produce a structured post-call evaluation (recruiter performance, candidate quality, risk flags) at a cost low enough to run on every single call — not just a sampled few.
2. **Reliable behavioral signal extraction from candidate communication.** AI can read a candidate's response (or non-response) to a post-offer check-in, infer engagement, hesitation, or active disengagement, and trigger interventions early enough to save the placement.

**Zeople is the first product to package both capabilities into a single workflow purpose-built for recruiting agencies and staffing firms.** Each capability alone is a feature; the two combined wrap around the agency revenue equation and protect it end-to-end.

The thesis is simple:

> If we make every recruiter call better (CoPilot) and every offer convert to a join (POFU), we directly increase agency revenue per recruiter — the single metric agencies optimize for.

---

## 4. Pillar 1 — Calling CoPilot

> **Goal: make more offers happen, by making every recruiter call structurally better — in real time and after the fact.**

### 4.1 What it does

The Calling CoPilot is an AI layer that sits inside every recruiter call from dial-out to wrap-up. It has four functional modes:

#### A. Live transcription
- Dual-track transcription via Deepgram (recruiter and candidate on separate audio streams, prevents speaker confusion).
- Real-time display in the recruiter's browser window during the call.
- Persisted automatically — every call becomes a searchable, structured artifact.

#### B. In-call AI guidance
- Claude monitors the live transcript as the call progresses.
- Surfaces context-aware nudges: "the candidate mentioned a notice period — confirm the exact date," "skill X required for this role hasn't been probed yet," "candidate appears hesitant about location — ask directly."
- Helps average recruiters perform closer to the level of strong ones, in real time, without supervisor presence.

#### C. Post-call AI evaluation — two reports per call

After the call ends, Zeople automatically generates two structured AI reports:

**1. Per-Call QA Report (recruiter-facing)**
- Scores the recruiter's call across five dimensions: coverage, structure, tone/empathy, probing depth, and closing.
- Evidence-grounded — every score cites specific quotes from the transcript.
- Identifies the weakest dimension for the specific call.
- Generates targeted coaching nudges (what worked, what to do differently).
- Color-coded score (red < 45, amber 45–69, green ≥ 70).

**2. Candidate Evaluation Report (candidate-facing)**
- Structured assessment of the candidate's fit for the role, based on what was actually said.
- Skill match analysis, experience alignment, motivation signals, red flags.
- Submission verdict (proceed / hold / reject) with justification.

These reports are not optional or sampled — they are generated for every completed call.

#### D. Auto Demo mode
- Simulates a full recruiter-candidate conversation with AI on both sides.
- Used for training, prospect demos, and onboarding new recruiters.
- Lets agency leadership demonstrate the platform without risking a real call.

### 4.2 The coaching loop — Recruiter QA

Every Per-Call QA Report flows into a coaching surface:

- **Searchable list** of all reviewed calls across the team — recruiter, candidate, role, date, duration, score, weakest dimension, submission verdict, risk level.
- **KPI strip** at the top: total calls reviewed, average QA score, "needs coaching" percentage (calls below 70), and the most common weakest dimension across the team.
- **Drill-down**: clicking any call opens the full evidence-grounded scorecard.
- **Pattern detection**: delivery heads can spot recruiters who consistently underperform on a specific dimension and target coaching directly.

This converts a previously impossible task — coaching every recruiter on every call — into a tractable, data-driven workflow.

### 4.3 What CoPilot moves

| Metric | Mechanism |
|---|---|
| **Submission quality** | Better-qualified candidates because the call extracts deeper signal |
| **Submission-to-interview conversion** | Stronger evidence in the submission note, sourced from the call evaluation |
| **Recruiter ramp time** | New hires self-correct from QA feedback instead of waiting for supervisor review |
| **Recruiter retention** | Top performers see their excellence recognized; average performers see a path to improvement |
| **Manager leverage** | A delivery head can effectively oversee 30 recruiters instead of 8 |

### 4.4 What makes CoPilot defensible

- **Every call compounds the data moat.** Transcripts, evaluations, and outcomes form a proprietary dataset over time.
- **Dual-track audio is technically non-trivial.** Single-stream call intelligence (the cheaper approach used by most sales-tool vendors) cannot reliably separate speakers, which makes recruiting-specific evaluation unreliable. Zeople invested in dual-track from day one.
- **Recruiting-specific evaluation rubrics**, built and tuned for this workflow — not generic sales-call frameworks repurposed.

---

## 5. Pillar 2 — Post-Offer Follow-Up (POFU)

> **Goal: make sure offers actually become joins — by actively monitoring every accepted offer and intervening before the candidate drops.**

### 5.1 What it does

POFU activates the moment a candidate accepts an offer. It treats the period between offer-accept and Day-1 join as an active engagement window, not a passive waiting room.

#### A. Automated, personalized check-ins
- At configurable intervals (e.g., T+3 days, T+1 week, T+notice-period midpoint, T-7 days before joining), the system sends the candidate a personalized email check-in.
- Emails are generated with context: the candidate's role, the start date, the recruiter's name, the agency's tone of voice.
- Each touchpoint asks a specific question relevant to the current stage of the post-offer journey.

#### B. State tracking across the post-offer journey
The system tracks the candidate's progression through structured states:
- **Resigned from current employer** — confirmation that the candidate has officially resigned (the single highest leading indicator of join probability).
- **BGV cleared** — background verification status.
- **Joining date confirmed** — formal confirmation that the candidate intends to honour the agreed start date.
- **Joined** — actual Day-1 confirmation.

#### C. AI-driven risk scoring
- Every candidate in POFU carries a continuously updated risk level (low / medium / high).
- Risk is scored from multiple signals: response latency, sentiment in replies, state progression delays, missed milestones, explicit hesitation language.
- High-risk candidates are surfaced to the recruiter immediately so a human can intervene.

#### D. Intervention nudges
- When risk crosses a threshold, the system flags the candidate and recommends a specific intervention (recruiter call, hiring manager outreach, joining-bonus discussion, schedule adjustment).
- The recruiter does not have to remember to check on every candidate; the system surfaces the ones who need attention.

#### E. Offer outcome tracking
- Final outcome per candidate (joined / dropped / TBD) is captured for analytics.
- Reasons for drops are categorized (counter-offer, BGV fail, ghosted, other offer, personal reasons) — building agency-specific intelligence about why offers fail.

### 5.2 The POFU engine

A background process (running every 6 hours via node-cron) drives the engagement cycle:

- Identifies candidates due for the next check-in based on their offer timeline.
- Generates and sends the appropriate personalized email.
- Parses incoming responses for state updates and risk signals.
- Recalculates risk scores.
- Surfaces alerts in the recruiter's dashboard.

The engine is fully autonomous in the steady state — the recruiter only intervenes when the system flags a candidate needing human attention.

### 5.3 What POFU moves

| Metric | Mechanism |
|---|---|
| **Offer-to-join conversion rate** | Active engagement keeps the candidate emotionally committed; risk detection enables early intervention |
| **Time-to-detect drop risk** | From "candidate ghosted, found out at joining" → "flagged at week 2, intervention attempted, partially recovered" |
| **Recruiter time on follow-up** | Automated touchpoints replace manual ping cycles |
| **Agency revenue per offer** | Same number of offers, more become paid placements |
| **Client trust** | Fewer last-minute drops mean clients can plan staffing with confidence |

### 5.4 What makes POFU defensible

- **The data is proprietary and gets sharper over time.** Every offer-to-join cycle (joined or dropped) trains the risk model on real outcomes for that specific agency, role type, and market.
- **Workflow-aware, not generic CRM.** POFU understands the structure of the post-offer journey (resign → BGV → joining-date confirm → join) and the signals that move within it. Generic email automation tools (Mailchimp, HubSpot) cannot replicate this without ground-up work.
- **It is the only product piece that directly affects what agencies are paid for.** Every other module improves work in progress; POFU converts work in progress into paid placements.

---

## 6. Why the Two Pillars Win Together

CoPilot and POFU are not two unrelated features. They are the **front and back ends of the same revenue protection story**:

| Stage of agency revenue cycle | Module | What it protects |
|---|---|---|
| Recruiter call → submission | **CoPilot** | Submission quality, candidate fit signal |
| Submission → offer | **Workflow + CoPilot evaluations** | Decision quality |
| Offer → join | **POFU** | The placement fee itself |

In isolation, each pillar has competitors:

- Call intelligence: Metaview, Sybill, Gong, Otter, Fireflies (sales-call origin, recruiting use case secondary).
- Candidate engagement: Sense, GoodTime, generic email-automation tooling.

**No other product packages both for the recruiting-agency workflow.** This combination is the durable wedge.

Equally important: the **two pillars share infrastructure** — the same candidate record, the same pipeline session, the same role hierarchy, the same audit trail. A candidate moves from a CoPilot-scored screening call into the pipeline, through assessments, into an offer, into POFU, and onto Day-1 join, all inside one system. Competitor products bolt on; Zeople integrates by design.

---

## 7. The Supporting System

Around the two pillars sits a complete recruiting workflow. These modules are not the pitch headline, but they are essential — the agency cannot operate on CoPilot + POFU alone. They are organized into five functional layers:

### 7.1 Workflow Spine — Pipeline Sessions (the Agentic Hiring Pipeline)

Every hiring drive runs as a **Pipeline Session** progressing through seven sequential steps. Each step unlocks the next only when sufficient data exists.

| Step | Name | What happens |
|---|---|---|
| 1 | **Select JD** | Pick the job this session is for. |
| 2 | **Enhance JD** | Run the JD through AI to generate five assets (see JD Enhancer below). |
| 3 | **Source Candidates** | Add candidates from the database; AI scores resume match and runs an AI content check on each resume. |
| 4 | **Recruiter Screening** | CoPilot-scored screening call per candidate; mark Pass / On Hold / Reject. |
| 5 | **Assessment Round** | Send shortlisted candidates a Video Interview, MCQ Test, or Coding Challenge; AI evaluates each. |
| 6 | **Decision** | Set interview level (L1/L2/L3), Proceed or Pool, schedule live interview date/time per candidate. |
| 7 | **Pipeline Tracker** | Kanban board — Selected / On Hold / Rejected; inline interview scheduler on each card; voice note recording per candidate. |

Step 5 has four sub-views for the three assessment types plus AI interview reports. Step 6 and Step 7 include interview scheduling. Candidates with accepted offers transition out of the pipeline into POFU automatically.

### 7.2 Funnel Modules — feeding the pipeline

#### Jobs (Job Management)
- Create and manage job postings with title, department, client, location, salary range, required and preferred skills, headcount.
- Jobs power the pipeline, JD Enhancer, and Market Intelligence.
- Job assignees (`job_assignees`) and hiring manager attachments (`job_hiring_managers`) drive the "My Jobs" filter and the Hiring Manager Portal.

#### JD Enhancer
Paste a rough job description; AI returns five ready-to-use assets:
- **Formatted JD** — clean, structured public-facing JD.
- **Recruiter Brief** — internal briefing notes for the recruiter.
- **Clarification Questions** — questions to ask the hiring manager before sourcing begins.
- **Reachout Material** — outreach copy for LinkedIn, email, etc.
- **Sourcing Keywords** — boolean strings and keywords for candidate search.

All five outputs are saved to the session for repeated reference. Each has a copy button.

#### Candidate Database
- Searchable database of all candidates, with contact details, experience, skills, full resume text, and work history.
- Candidates can be pulled directly into any pipeline session.
- **AI Content Check** flags AI-generated resume writing — a critical signal as AI-written resumes become mainstream.

#### Hiring Manager Portal
External hiring managers (role: `hiring_manager`) get a completely separate slim portal — they bypass the standard recruiter sidebar entirely.
- **Your Jobs** — every job they've been attached to via `job_hiring_managers`.
- **Job Detail** — the shortlist for a single job (only candidates that passed or are on hold at screening), each with match %, AI interview score, current status, and any recruiter note.
- HMs submit a structured **recommendation** per candidate (Strong Yes / Yes / Maybe / No / Strong No) with notes. The form upserts on `(job_id, candidate_id, hm_user_id)`.
- HMs never see the candidate database, the pipeline session, or any other job. Every `/hm/*` endpoint re-checks attachment before returning data.

### 7.3 Filter Modules — assessment infrastructure

#### Video Interviews
- Recruiters create asynchronous video interview templates with question sets.
- Candidates receive an email invite with a personal link, record answers on their own schedule.
- AI evaluates each response on communication, relevance, and competency.
- Results flow into Step 5 of the pipeline.

#### MCQ Assessments
- Recruiters build multiple-choice tests with configurable time limits and pass scores.
- Candidates receive a personal invite link, complete in one sitting.
- AI generates a written evaluation alongside the raw score.

#### Coding Assessments
- For technical roles. Recruiters create coding challenges with problem statements and starter code.
- Candidates write or fix code directly in the browser within a time limit.
- AI evaluates submissions and produces a structured assessment.

### 7.4 Measurement & Coaching

#### Recruiter QA
The coaching surface for CoPilot output — described in §4.2.

#### Reports & Analytics
A comprehensive analytics module covering the full hiring funnel. Eight tabs surface different cuts of the data:

| Tab | What it shows |
|---|---|
| **Pipeline Funnel** | Sourced → Shortlisted → VI Invited → Proceeded → Selected; Video Interview completion funnel; Session Breakdown table |
| **Efficiency** | Stage conversion rates with bottleneck detection; time-in-stage (sourcing → VI, VI → selected); overall selection rate and avg time-to-hire; Candidate Stage Detail table |
| **Candidates** | Screening status breakdown, decision outcomes, AI interview score distribution, skill match % distribution; All Pipeline Candidates table |
| **Assessments** | MCQ and Coding stats (invited, completed, avg score, pass rate, avg time); score distributions; invite records tables |
| **Video Interviews** | Hiring recommendation breakdown, overall score distribution, average competency scores (5 dimensions); VI Candidates table |
| **Post-Offer** | POFU state progression, risk distribution, email engagement, offer outcome; POFU Candidates table |
| **Activity** | Session-level activity log — sourced, shortlisted, proceeded, selected, avg days per session |
| **By Job** | Per-job pipeline metrics (sourced, shortlisted, pass rate, proceeded, selected, VI count, POFU count, days open); Totals row; drill-down to per-job analytics including skills coverage |

A KPI strip at the top of every report view shows Active Jobs, Avg Time-to-Hire, Selection Rate, Pipeline Sessions, Total Candidates, Assessments Done, Video Interviews, POFU Candidates, and Calls Made.

All tabs count from the same source for data consistency. The By Job tab includes sessions linked to any job a user's sessions reference, not just jobs they created — keeping totals consistent.

### 7.5 Intelligence — Market Intelligence

A 4-stage Claude research pipeline that produces a hiring-market report (salary bands, demand signals, talent pool size, competitor activity, talent reputation) for a specific role and location. Each report is created from a `JobContext` (title, location, industry, employment type, experience level, must-have skills) — either filled in by hand or extracted automatically from an uploaded JD (PDF / DOCX / TXT) or pasted text.

| Stage | Model | What it does |
|---|---|---|
| 0 | Haiku 4.5 | Parse uploaded/pasted JD into a structured `JobContext` (tool-use, enum-validated) |
| 2 | Opus 4.7 | Web research with `web_search` + `web_fetch`, adaptive thinking |
| 3 | Sonnet 4.6 | Structure the research into a JSON-schema-validated report payload |
| 4 | Haiku 4.5 | Write the executive summary |
| 5 | Sonnet 4.6 (optional) | Glassdoor reputation enrichment for top competitor companies |

Reports run asynchronously — the UI returns immediately with a pending row and polls until completed/failed. Failed reports can be **retried without re-running Stage 2** (the cached `research_doc` is reused, saving ~90s and the web-search cost). Completed reports are editable and can be refreshed for reputation data. Optionally linked to a job in the company's database.

### 7.6 Platform Layer

#### Welcome Dashboard
- First screen after login. Personalized greeting (time-of-day + recruiter first name).
- Live snapshot of recent activity across jobs, candidates, sessions, assessments, and POFU.
- Quick-action links to jump into any module.
- KPIs refresh on load.

#### Activity Feed (Owner / Team Lead only)
- Company-wide append-only log of who did what.
- Surfaces job creates/updates, assignee and HM attachments, HM feedback submissions, session creates, per-candidate pipeline updates.
- Each row shows actor, action, target, summary, and relative timestamp.
- Filter dropdown narrows by Jobs / Sessions / Pipeline updates / Candidate feedback.
- Best-effort logging — `logActivity()` calls never fail a request.

#### Settings (Owner only)
Three tabs:
- **Company Info** — name, industry, website, address, contact email.
- **Team Management** — create teammates with one of 5 internal roles (Owner / Team Lead / Sr Recruiter / Recruiter / Sourcer); invite Hiring Managers and attach them to specific jobs; activate/deactivate members.
- **My Account** — update display name and password.

---

## 8. Who Zeople Is For

### 8.1 Primary market: recruiting agencies and staffing firms

Zeople targets the global recruiting agency and staffing firm market — specifically the segment running high-volume call-based placement workflows. The industry has tiers:

| Tier | Description | Fit |
|---|---|---|
| **Enterprise staffing giants** | Multi-billion-dollar global firms (Randstad, Adecco, ManpowerGroup, Allegis, Hays, Robert Half, Kelly). Multi-year sales cycles, custom integrations, SOC2/ISO required. | Aspirational. Not the early ICP. |
| **Mid-market staffing firms** | $50M–$1B revenue, regional or vertical specialists (e.g. Insight Global, Page Group, Michael Page, Aerotek, Quess, Teamlease, ABC Consultants). | Real prospects after early reference customers. 3–6 month sales cycle. |
| **Boutique / independent agencies** | 5–100 person firms, vertical or geo-focused (IT staffing, fintech recruiting, healthcare, executive search boutiques). Tens of thousands globally. | **Primary wedge.** Fast decisions, owner-led buying, call-heavy workflows, minimal enterprise IT bureaucracy. |
| **Executive search top-tier** | C-suite/board (Korn Ferry, Spencer Stuart, Heidrick & Struggles). Low call volume, relationship-driven, white-glove. | Wrong fit. Different workflow. |

### 8.2 Buyer, champion, user

Selling into recruiting agencies involves three distinct stakeholders:

| Role | Title (typical) | What they care about | What sells to them |
|---|---|---|---|
| **Economic buyer** | Agency owner / Managing Director / Founder | Placement fee revenue. Recruiter productivity. Drop-rate. Cost per placement. | ROI math. Specifically: ₹/$ saved by reducing drop rate, and recruiter productivity lift. |
| **Champion** | Head of Delivery / Practice Lead / Operations Lead | Recruiter team performance, coaching workload, escalation volume. | Workflow visibility, coaching loop, alerts on at-risk candidates. |
| **User — primary** | Recruiter (Sr / Standard / Sourcer) | Doing their job faster, getting credit for good work, not being micromanaged. | Reduced admin (auto QA reports, automated POFU touchpoints), visible recognition (their good calls get noticed). |
| **User — supporting** | HR Ops / Joining Coordinator | Tracking offers through to joining, escalations, client communication. | POFU dashboard — at-a-glance view of every accepted offer and its status. |
| **External stakeholder** | Hiring Manager (at the client) | Quality shortlists, fast feedback loops. | Hiring Manager Portal — slim, focused, no clutter. |

### 8.3 What a good-fit customer looks like

- 10–200 recruiters on the team.
- Volume of 100+ recruiter calls per week.
- Placement-fee business (perm placement or contract-to-perm), not pure temp staffing.
- Operating in a hot talent market where drop rates run 30%+.
- Owner or delivery head actively concerned about recruiter quality variance and offer-to-join conversion.
- Currently using either no ATS, a generic CRM, or a legacy ATS (Bullhorn, Zoho Recruit, JobDiva) without modern AI capabilities.

### 8.4 What a poor-fit customer looks like

- Pure executive search (low call volume, relationship-driven).
- In-house corporate talent acquisition teams (their economics are different — they're not paid per placement; modern ATSes like Greenhouse/Lever serve them well).
- Pure temp staffing with high-volume hourly placements (workflow is too different; margins per placement are too thin to justify the toolset).
- Agencies in markets with very low call culture (some EU markets prefer email-only outreach).

---

## 9. Competitive Landscape

### 9.1 The competitive map

Zeople occupies an under-served intersection. The closest categories of competing tools each address only part of the picture:

| Category | Examples | What they do | What they miss |
|---|---|---|---|
| **Modern ATSes** | Greenhouse, Lever, Ashby | Req management, pipeline tracking, structured hiring for in-house talent teams | Not built for agency economics; no call intelligence; no offer-to-join engagement; no agency-specific workflows |
| **Legacy agency ATSes** | Bullhorn, Zoho Recruit, JobDiva, CEIPAL | Agency-aware data model (clients, submissions, placement fees) | No AI-native call evaluation; no offer protection engine; UX dated |
| **Call intelligence (sales-origin)** | Metaview, Sybill, Gong, Otter, Fireflies | Transcription, post-call summaries | Not recruiting-specific; no evaluation rubric; no candidate evaluation; standalone — doesn't integrate the rest of the workflow |
| **Video interview platforms** | HireVue, SparkHire, VidCruiter | Asynchronous video interviews + AI scoring | Single-feature; not a workflow |
| **AI-first recruiting platforms** | Paradox, Eightfold, hireEZ, Mercor | Various — chatbots, sourcing, matching | Each is feature-specific; none address the call-quality + offer-protection combination |
| **Candidate engagement / drip** | Sense, GoodTime, generic CRM | Email/SMS automation for candidates | Generic, not workflow-aware; no risk scoring; no state-tracking around post-offer milestones |

### 9.2 Where Zeople wins

- **AI-native by design**, not bolt-on. Every workflow assumes Claude is in the loop.
- **Agency-economics-aware.** Built around placements and fees, not corporate req management.
- **The only product packaging call intelligence + post-offer protection** in one system.
- **Integrated data flow.** Calls feed candidate evaluations; evaluations feed submissions; submissions feed offers; offers feed POFU; POFU outcomes feed analytics — all on shared infrastructure.
- **AI content check on resumes** — a feature that's becoming table-stakes as candidates increasingly use ChatGPT, and that no major ATS offers natively.
- **Per-call QA scorecards with coaching nudges** — recruiter coaching at scale is something no ATS offers.

### 9.3 Where competitors are stronger (and how we close)

| Gap | Status | Path |
|---|---|---|
| Source of hire tracking | Missing | Add as roadmap item; standard data model addition. |
| Cost-per-hire / fee analytics | Partial | Augment Reports tab with fee/cost data once schema captures placement amounts. |
| Multi-recruiter team leaderboards | List view exists | Build dedicated leaderboard surface (data is already in QA reports). |
| CSV / Excel export | Missing | Add across all report tabs. Trivial work, high checkbox value. |
| Scheduled email reports | Missing | Add via existing email infrastructure + node-cron. |
| BI tool integration (Looker, PowerBI) | Missing | Expose a read-only data export endpoint. |
| Enterprise compliance (SOC2, ISO) | Not yet pursued | Required for enterprise tier (Tier 1 staffing giants); not a wedge-segment blocker. |
| Source-to-hire conversion / ROI | Missing | Tied to source-of-hire above. |

These gaps matter for enterprise sales conversations but not for the wedge segment (boutique / mid-market agencies). They are explicit roadmap items as the company moves upmarket.

---

## 10. Roles, Permissions, and Data Scoping

### 10.1 Six roles

| Role | What they can do |
|---|---|
| **Owner** | Everything. Only role that can edit company info, manage billing, and invite/deactivate teammates. Sees all data across the company. |
| **Team Lead** | Full access to all recruiting features. Sees all data company-wide. Can manage job assignees and HM attachments, view team-level QA. Cannot edit company info or invite owners. |
| **Sr Recruiter** | All recruiter features plus the ability to assign teammates and HMs to jobs. Sees only their own pipeline rows. |
| **Recruiter** | Standard recruiter access — jobs, pipelines, calls, assessments, POFU. Sees only their own rows. |
| **Sourcer** | Restricted to sourcing — Jobs / Candidate Database / Pipeline Step 3. Hidden from Calling CoPilot, JD Enhancer, POFU, evaluation modules, and Market Intelligence. |
| **Hiring Manager** | External stakeholder. Bypasses the recruiter sidebar entirely; uses the slim portal in §7.2. Sees only candidates on jobs they're attached to. |

Legacy JWTs with older roles (`admin` → Owner, `superuser` → Owner, `subuser` → Recruiter) continue to work; the DB migration remaps existing rows on new-build startup.

### 10.2 Permission enforcement — two layers

**Layer 1: Capability map** (`server/middleware/permissions.js`)
- Every mutating endpoint declares a capability (`jobs.create`, `mi.write`, `pofu.write`, etc.).
- The map lists which roles hold which capability.
- `requireCapability()` and `requireRole()` middleware enforce it at the request boundary.

**Layer 2: Row-level scoping** (`server/utils/scoping.js`)
- Read endpoints call `visibleUserIds(req)` to get the set of `user_ids` whose rows the caller is allowed to see.
- **Owner / Team Lead** — every active member of their company.
- **Sr Recruiter / Recruiter / Sourcer** — only themselves.
- **Hiring Manager** — never goes through this path; HM endpoints scope by `job_hiring_managers` attachment.

**Layer 3: Company isolation** (table-level)
- `jobs.company_id`, `candidates.company_id`, `mi_reports.company_id` are populated on row creation and filtered on every read.
- A user from one company cannot see data from another — even by guessing row IDs.

**Layer 4: Assignment-awareness** (where relevant)
- `job_assignees` powers the "My Jobs" filter in Jobs Management.
- `job_hiring_managers` is the source of truth for which jobs each HM sees.

---

## 11. Technical Foundation

### 11.1 Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite. Hiring Managers get a separate slim portal at the same URL — no separate deployment. |
| **Backend** | Node.js + Express. `express-ws` for the Twilio media-stream WebSocket. Socket.io (polling transport) for live transcript broadcast to the UI. |
| **Database** | SQLite via better-sqlite3, WAL mode. Idempotent in-app migrations on every start. |
| **Auth** | JWT with bcrypt-hashed passwords. Capability map + per-row scoping enforce role permissions. |
| **AI** | Anthropic Claude — Opus 4.7 / Sonnet 4.6 / Haiku 4.5 used across reports, evaluations, JD enhancement, POFU emails, AI content check, and the 4-stage Market Intelligence research pipeline (with `web_search` + `web_fetch` tool use). |
| **Voice / call** | Twilio for outbound calls and recordings. |
| **Transcription** | Deepgram, dual-track (recruiter + candidate on separate connections). |
| **Email** | Hostinger SMTP for assessment / VI / POFU emails. |
| **Scheduling** | node-cron — POFU follow-up engine runs every 6 hours. |

### 11.2 Key architectural choices

- **AI tier-matching** — each AI task uses the smallest model that meets quality (Haiku for parsing, Sonnet for structuring, Opus for research). Keeps per-call cost low without sacrificing quality.
- **Async + polling for long-running AI pipelines** — Market Intelligence runs as background jobs; the UI polls until done. Failed runs can retry without re-burning expensive stages.
- **Dual-track audio from day one** — non-negotiable for reliable speaker attribution in call evaluation.
- **Best-effort activity logging** — never blocks a user request, even if logging fails.
- **In-app migrations** — schema evolves with every release; no separate migration tooling needed for current deployment footprint.

### 11.3 Architectural roadmap considerations

- **SQLite → Postgres** when concurrency or multi-region demands exceed single-server capacity. Required before enterprise-tier sales.
- **Object storage for recordings and resumes** when local disk becomes a bottleneck.
- **Dedicated job runner** when the cron-based engine outgrows in-process scheduling.
- **SOC 2 / ISO 27001** when moving upmarket to enterprise staffing tier.

---

## 12. Key Metrics and How We Measure Success

### 12.1 The North Star

> **Placement-to-join conversion rate** (equivalently, **inverse offer drop rate**) — the percentage of accepted offers that result in a Day-1 join, across all agencies on the platform.

This is the single metric the entire product is designed to move. Every module either directly improves it (CoPilot upgrades submission quality, POFU protects offers in flight) or supports the workflow that produces it.

### 12.2 The KPI tree

```
North Star: Placement-to-join conversion rate
│
├── Top-of-funnel quality (CoPilot)
│   ├── Avg QA score per recruiter
│   ├── Submission → interview conversion
│   ├── Submission → offer conversion
│   └── AI content check fail rate (resume signal)
│
├── Pipeline efficiency (Workflow)
│   ├── Stage conversion rates (bottleneck detection)
│   ├── Time-in-stage
│   └── Time-to-hire
│
└── Offer protection (POFU)
    ├── Offer drop rate (target: cut by 50%)
    ├── Time-to-detect drop risk
    ├── Risk-flagged candidates intervened
    └── Reasons-for-drop distribution
```

### 12.3 Per-customer outcome targets

For each agency customer, the success contract is:

- **Within 30 days:** every recruiter has at least one QA-scored call; the agency owner has at least one POFU-tracked offer.
- **Within 60 days:** average QA score is trending; offer drop rate is being measured pre/post.
- **Within 90 days:** measurable lift in offer-to-join conversion (target: +10 percentage points over baseline).

---

## 13. Product Principles

These are the design guardrails that should constrain every product decision.

1. **AI is in the loop, not in the way.** Every AI-driven feature must be either fully autonomous (the user doesn't touch it) or transparently augmentive (the user sees what AI did and can override). No half-decisions where AI proposes something the user has to accept blindly.
2. **Workflow over features.** A great isolated feature that doesn't connect to the pipeline is worse than a mediocre feature that does. Every new addition must fit somewhere in the cycle: source → screen → assess → decide → offer → join.
3. **The agency P&L is the only metric that matters.** If a feature can't be tied to placement-to-join conversion, recruiter productivity, or cost per placement, it doesn't belong.
4. **No data lock-in, no proprietary moats around customer data.** Customers own their data. Exportability is a product principle, not a feature request.
5. **The supporting system should disappear.** A recruiter's daily experience should be CoPilot in the call, POFU surfacing alerts, and a clean pipeline tracker. Everything else should be one click away — not three.
6. **Coaching over surveillance.** Recruiter QA is a tool for growth, not punishment. UI, language, and defaults all reinforce this framing.
7. **AI cost discipline.** Use Haiku where it works; reserve Opus for tasks that genuinely require it. Per-call gross margin is non-negotiable.
8. **Best-effort logging, never blocking.** Telemetry, activity feeds, and analytics writes must never fail a user-facing request.

---

## 14. Roadmap Direction

This section is intentionally directional, not a delivery commitment. Specific sequencing lives in a separate roadmap document.

### 14.1 Near-term — sharpen the wedge

- **CSV / Excel export across all report tabs.** Standard buyer checkbox; trivial work.
- **Recruiter team leaderboard.** Aggregate existing QA scores into a comparative view for delivery heads.
- **"Today's Calls" dashboard.** A recruiter-facing home with calls to make, calls completed, scores, and follow-ups due — the surface recruiters live on.
- **WhatsApp invites for assessments and POFU touchpoints.** Email open rates are low globally; WhatsApp delivery rates run 90%+. Twilio supports it natively.
- **Bulk candidate import from CSV / Excel / Bullhorn / Zoho Recruit.** Removes the top migration objection from agencies on legacy ATSes.

### 14.2 Mid-term — deepen the moat

- **POFU drop-risk model trained on outcomes per agency.** Current rules-based scoring evolves into ML-trained probabilities.
- **Recruiter coaching content auto-generated from QA patterns.** When a recruiter consistently weak on Dimension X, surface a coaching nudge specific to their case.
- **Source-of-hire and cost-per-hire analytics.** Closes the analytics-feature gap vs. major ATSes.
- **Multi-language CoPilot.** Transcription and evaluation in the candidate's preferred language.
- **Postgres migration.** Required before enterprise-tier sales.

### 14.3 Long-term — adjacent expansion

- **Agency client portal.** Clients of the agency get a slim portal to view shortlist progress (analogous to the Hiring Manager Portal, but for the client company).
- **Placement-fee CRM and invoicing.** Closes the loop from join → invoice → revenue.
- **SOC 2 / ISO 27001 certification.** Unlocks enterprise staffing tier.
- **Open API and partner integrations.** Bullhorn, LinkedIn Recruiter, Naukri, job-board syndication.

---

## Document Provenance

This is the canonical product overview for Zeople RecruiterOS. It supersedes the prior `PRODUCT_OVERVIEW.md` as the strategic reference, while that document remains available as a comprehensive feature catalog. Subsequent product, sales, and positioning artifacts (one-pagers, pitch decks, demo scripts, ROI calculators, application essays, technical architecture documents) draw from this overview.

When this document is updated, downstream artifacts should be reviewed for consistency.
