# Agentic Mode — Workflow Spec

A guided 7-step recruitment pipeline that takes a job opening from description to final candidate selection. Each step gates the next — a step must be completed before the recruiter can proceed.

---

## Table of Contents

1. [Concept](#1-concept)
2. [Session Model](#2-session-model)
3. [Step 1 — Select JD](#3-step-1--select-jd)
4. [Step 2 — Enhance JD](#4-step-2--enhance-jd)
5. [Step 3 — Source Candidates](#5-step-3--source-candidates)
6. [Step 4 — Recruiter Screening](#6-step-4--recruiter-screening)
7. [Step 5 — AI Interview Reports](#7-step-5--ai-interview-reports)
8. [Step 6 — Decision](#8-step-6--decision)
9. [Step 7 — Pipeline Tracker](#9-step-7--pipeline-tracker)
10. [Candidate State Machine](#10-candidate-state-machine)
11. [Data Accumulated Per Step](#11-data-accumulated-per-step)

---

## 1. Concept

The recruiter creates a **session** for a single job opening and walks through 7 sequential steps. Progress is persisted — the recruiter can leave and resume at any point. Backward navigation to completed steps is allowed; forward navigation is locked until the current step's completion condition is met.

A session has a current step (1–7). Every action in a step writes to persistent storage. The UI reads from storage on load, so refreshing the page never loses progress.

---

## 2. Session Model

A session ties together:
- One **job** (the opening being filled)
- One set of **enhancement outputs** (from Step 2)
- A list of **session candidates** (added in Step 3, enriched in subsequent steps)

Sessions are listed on the Agentic Mode home screen. The recruiter can have multiple sessions open simultaneously (for different jobs). Each session is independent.

**Session states that drive UI gating:**

| Field | Set in Step | Controls |
|---|---|---|
| `job_id` | 1 | Step 2 unlock |
| `enhancement_saved` | 2 | Step 3 unlock |
| At least 1 session candidate | 3 | Step 4 unlock |
| At least 1 candidate with `screening_status = pass` | 4 | Step 5 unlock |
| All shown candidates have an `ai_interview_score` | 5 | Step 6 unlock |
| At least 1 candidate with `decision = proceed` | 6 | Step 7 unlock |

---

## 3. Step 1 — Select JD

**Purpose:** Choose which job opening this session is for.

**UI:**
- Dropdown list of active job openings
- Each option shows job title (and optionally client name, location)

**Completion condition:** A job is selected.

**What is saved:** The selected job is linked to the session.

**What unlocks next:** Step 2.

---

## 4. Step 2 — Enhance JD

**Purpose:** Generate AI-powered recruitment assets from the job description, and optionally fetch market intelligence.

### 4.1 Enhancement Assets

Five assets are generated from the job data:

| Asset | Description |
|---|---|
| **Formatted JD** | Professional rewrite of the job description |
| **Recruiter Brief** | Layman-friendly breakdown of technical requirements (≤250 words) |
| **Clarification Questions** | Questions for the recruiter to ask the client, grouped into 7 categories |
| **Reachout Material** | WhatsApp/LinkedIn/call scripts + phone screening questions |
| **Sourcing Keywords** | Primary/secondary keyword lists + Boolean search strings |

These run in parallel with:

### 4.2 Market Intelligence (optional, best-effort)

A separate background process runs a 3-stage research pipeline on the job title, location, and skills:

1. **Research** — generates raw analysis: demand trends, talent pool size, salary benchmarks, competitor companies hiring for the role, notice period norms, Glassdoor ratings
2. **Structure** — parses the raw research into a typed JSON object with confidence levels per section
3. **Summary** — writes a 3–4 sentence executive summary

If market intelligence fails, the enhancement assets still proceed normally. Market intel is displayed as an additional tab; it does not block the workflow.

### 4.3 UI

- A loading state shows while assets are being generated
- Results appear in tabs: Formatted JD, Recruiter Brief, Clarifications, Reachout, Keywords, Market Intel
- Each tab has: copy, regenerate, manual-input-regenerate, inline edit, download (Word/PDF)
- Client notes entered by the recruiter are highlighted in the output wherever they influenced the AI response

**Completion condition:** The recruiter reviews the assets and clicks "Save & Continue".

**What is saved:** All 5 enhancement assets stored as a single JSON blob on the session.

**What unlocks next:** Step 3.

---

## 5. Step 3 — Source Candidates

**Purpose:** Build the candidate shortlist for this session. Supports two input methods.

### 5.1 Method A — Select from Existing Candidates

- Displays all active candidates in the system
- Each candidate is scored against the job's required and preferred skills:
  - **Score formula:** (matched required skills / total required skills) × 80 + (matched preferred skills / total preferred skills) × 20
  - Skills comparison is case-insensitive
- Candidates are ranked by score, top 50 shown
- Each row shows: name, current title, match %, matched skill badges (green), unmatched skill badges (grey)
- Recruiter selects via checkboxes; clicking "Add Selected" creates session candidate records

After adding, each candidate gets an **AI resume evaluation** (async, best-effort):
- Content quality score (0–100)
- AI-writing detection score (0–100; higher = more likely AI-generated)
- Overall score (0–100)
- These scores display as color-coded badges on the candidate row once available

### 5.2 Method B — Bulk Upload Resumes

Recruiter uploads PDF/DOCX files (up to 10 at once). For each file:

1. File is stored in cloud storage
2. **Resume Parser** extracts structured data: name, email, phone, location, current title, current company, years of experience, skills, education, work history, LinkedIn/portfolio URLs
3. Match score is calculated against the job (same formula as Method A)
4. **Resume Evaluator** scores the resume on 8 dimensions: overall, AI-writing detection, ATS compatibility, content quality, career progression, skills balance, formatting consistency, grammar/tone — also outputs experience level, a summary verdict, and a list of strengths
5. A new candidate record is created (or an existing one matched by email)
6. A session candidate record is created with the match score and resume scores

If parsing or evaluation fails for a file, that file is skipped and the rest continue. The upload does not fail as a whole.

### 5.3 UI

- Two tabs: "Existing Candidates" and "Upload Resumes"
- Progress indicator during bulk upload showing file-by-file status
- Final list shows all added candidates with their scores

**Completion condition:** At least 1 candidate has been added to the session.

**What is saved:** Session candidate records with match percentage and resume scores.

**What unlocks next:** Step 4.

---

## 6. Step 4 — Recruiter Screening

**Purpose:** Human review gate. The recruiter screens each candidate before AI interviewing.

**UI:**
- List of all candidates added in Step 3
- For each candidate:
  - Button to upload a screening report (PDF/DOCX) — optional
  - Status dropdown: **Pending** (default) | **Pass** | **Fail**

**Completion condition:** At least 1 candidate is marked **Pass**.

**What is saved:** Per-candidate: screening report file reference, screening status.

**What unlocks next:** Step 5.

---

## 7. Step 5 — AI Interview Reports

**Purpose:** Upload results from an external AI interview platform and record scores.

**UI:**
- Shows only candidates with `screening_status = pass` (failed/pending candidates are hidden)
- For each candidate:
  - Button to upload the AI interview report (PDF/DOCX)
  - Number input for AI Interview Score (0–100)

**Completion condition:** Every displayed candidate has an interview score entered.

**What is saved:** Per-candidate: interview report file reference, AI interview score.

**What unlocks next:** Step 6.

---

## 8. Step 6 — Decision

**Purpose:** The recruiter decides which candidates to move forward and notifies them.

**UI:**
- Shows candidates who have an AI interview score (same set as Step 5)
- For each candidate:
  - **Decision** selector: **Proceed** | **Move to Pool**
  - If **Proceed**: **Interview Level** selector: **L1** | **L2** | **L3**
  - Optional **Notify** button: opens an email dialog with a pre-filled interview invitation template; recruiter can edit the body before sending; on send, an email is dispatched to the candidate and the record is marked as notified

**Completion condition:** At least 1 candidate is marked **Proceed**.

**What is saved:** Per-candidate: decision, interview level, email-sent flag.

**What unlocks next:** Step 7.

---

## 9. Step 7 — Pipeline Tracker

**Purpose:** Track candidates through interview rounds until final selection.

**UI:**
- Kanban board with 4 columns: **L1** | **L2** | **L3** | **Selected**
- Only candidates with `decision = proceed` appear
- Each candidate card shows: name, current title, match %, AI interview score
- Candidates start in whichever column matches their assigned interview level (from Step 6)

**Per-card actions:**
- **Feedback** textarea — recruiter notes about the candidate after the interview
- **Hold** — marks the candidate on hold (stays in current column)
- **Reject** — removes the candidate from active consideration
- **Next** — advances the candidate:
  - L1 → L2
  - L2 → L3
  - L3 → **Selected** (marked as final hire)

**What is saved:** Per-candidate: pipeline status (pending / hold / reject / selected), interview level progression, feedback text.

**End state:** No formal "complete" button. The session is considered done when the recruiter has worked through all candidates in the pipeline.

---

## 10. Candidate State Machine

Each session candidate moves through the following states across steps:

```
                      Step 3                Step 4
Added to session ──► [screening_status: pending]
                              │
                    ┌─────────┴─────────┐
                  Pass               Fail
                    │                  │
                    ▼                  ▼
              Step 5 visible     Hidden from Step 5+
                    │
              ai_interview_score entered
                    │
                    ▼
              Step 6 visible
                    │
              ┌─────┴──────┐
           Proceed        Pool
              │              │
    interview_level set   Hidden from Step 7
    email optionally sent
              │
              ▼
        Step 7 — Kanban
              │
    ┌─────────┼──────────┐
  Hold     Reject      Next
    │          │          │
  stays    removed    L1 → L2 → L3 → Selected
```

**Summary of per-candidate fields by step:**

| Field | Set In | Values |
|---|---|---|
| `match_percentage` | Step 3 | 0–100 |
| `resume_score` | Step 3 | JSON (8 dimension scores) |
| `screening_status` | Step 4 | pending / pass / fail |
| `screening_report_url` | Step 4 | file reference |
| `ai_interview_score` | Step 5 | 0–100 |
| `ai_interview_report_url` | Step 5 | file reference |
| `decision` | Step 6 | proceed / pool |
| `interview_level` | Step 6 | L1 / L2 / L3 |
| `email_sent` | Step 6 | true / false |
| `pipeline_status` | Step 7 | pending / hold / reject / selected |
| `pipeline_feedback` | Step 7 | free text |

---

## 11. Data Accumulated Per Step

```
Session created
  └─ job_id: null (placeholder)

After Step 1:
  └─ job_id: set

After Step 2:
  ├─ enhancement_data: { formattedJD, recruiterBrief, clarificationQuestions,
  │                       reachoutMaterial, sourcingKeywords }
  └─ enhancement_saved: true

After Step 3 (per candidate added):
  ├─ candidate_id
  ├─ match_percentage
  └─ resume_score: { overall, aiWritingDetection, contentQuality, ... }

After Step 4 (per candidate):
  ├─ screening_status: pass | fail | pending
  └─ screening_report_url

After Step 5 (per passing candidate):
  ├─ ai_interview_score: 0–100
  └─ ai_interview_report_url

After Step 6 (per scored candidate):
  ├─ decision: proceed | pool
  ├─ interview_level: L1 | L2 | L3
  └─ email_sent: true | false

After Step 7 (per proceeding candidate):
  ├─ pipeline_status: pending | hold | reject | selected
  ├─ interview_level: may be updated as candidate advances rounds
  └─ pipeline_feedback: recruiter notes
```
