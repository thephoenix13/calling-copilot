# Zeople RecruiterOS — Product Overview

Zeople RecruiterOS is an AI-powered recruiting platform that helps recruiters manage the full hiring lifecycle — from sourcing and screening candidates to making final decisions — in one place.

---

## What's Been Built

### 1. Calling CoPilot
The original core feature. When a recruiter calls a candidate, the system transcribes the conversation in real time and surfaces live AI suggestions — helping the recruiter ask the right questions and stay on track. After the call, two AI-generated reports are available:
- **Per-Call QA Report** — scores the recruiter's performance (coverage, tone, structure)
- **Candidate Evaluation Report** — assesses the candidate based on what was said

An **Auto Demo** mode simulates a full recruiter–candidate conversation with AI-generated responses, so you can see the tool in action without making a real call.

---

### 2. Job Management
Recruiters can create and manage job postings — with details like title, department, client name, location, salary range, required skills, and headcount. Jobs feed into the pipeline and JD Enhancer.

---

### 3. Candidate Database
A searchable database of all candidates. Each profile stores contact details, experience, skills, resume text, and work history. Candidates from the database can be pulled directly into any pipeline session.

---

### 4. JD Enhancer
Paste a raw or rough job description and the AI produces five ready-to-use assets:
- **Formatted JD** — clean, structured job description
- **Recruiter Brief** — internal briefing notes for the recruiter
- **Clarification Questions** — questions to ask the hiring manager
- **Reachout Material** — outreach copy for LinkedIn, email, etc.
- **Sourcing Keywords** — boolean strings and keywords for candidate search

---

### 5. Pipeline Sessions (Agentic Hiring Pipeline)
The heart of the platform. Each session tracks a hiring drive for a specific role through eight steps:

| Step | Name | What happens |
|------|------|-------------|
| 1 | Select JD | Pick the job this session is for |
| 2 | Enhance JD | Run the JD through AI to generate all assets |
| 3 | Source Candidates | Add candidates from the database; AI scores their resume match |
| 4 | Recruiter Screening | Mark each candidate as Pass / On Hold / Reject; optionally launch a live screening call |
| 5 | Assessment Round | Send shortlisted candidates a Video Interview, MCQ Test, or Coding Challenge |
| 6 | AI Reports | View AI-generated scores and evaluation reports for each candidate |
| 7 | Decision | Proceed or pool each candidate based on their scores |
| 8 | Pipeline Tracker | Track final status (Selected / On Hold / Rejected) with notes |

Steps unlock progressively — you can't jump ahead until the previous step has enough data.

---

### 6. Video Interviews
Recruiters create asynchronous video interview templates with a set of questions. Shortlisted candidates receive an email invite, record their answers on their own time, and the AI evaluates each response — scoring communication, relevance, and competency. Results appear in Step 6 of the pipeline.

---

### 7. MCQ Assessments
Recruiters build multiple-choice question tests with configurable time limits and pass scores. Candidates receive a personal invite link, complete the test in one sitting, and the AI provides a written evaluation alongside the raw score.

---

### 8. Coding Assessments
Similar to MCQ but for technical roles. Recruiters create coding challenges with problem statements and starter code. Candidates write or fix code directly in the browser within a time limit. The AI evaluates their submissions.

---

### 9. Post Offer Follow-Up (POFU)
Once a candidate accepts an offer, POFU takes over. It automatically sends personalised check-in emails at the right intervals — checking if they've resigned, cleared background verification, confirmed their joining date, and actually joined. The system tracks risk level for each candidate and flags anyone who might drop out before Day 1.

---

### 10. Reports & Analytics
A unified view of all hiring activity across sessions, video interviews, and assessments — including completion rates, scores, and pipeline stage counts.

---

### 11. Settings *(Superuser only)*
Available to account owners (superuser role). Three tabs:
- **Company Info** — name, industry, website, address, contact email
- **Team Management** — create recruiter accounts, set roles, activate or deactivate members
- **My Account** — update display name and password

---

## How the Invite Emails Work

When candidates are invited to any assessment or video interview, they receive a personalised email that references the recent call:

> *"It was great speaking with you earlier. As promised, here's the MCQ assessment I mentioned for the **Software Engineer** role — this is the next step in our process."*

The email is signed with the recruiter's name, includes the time limit and passing score, and has a single call-to-action button. All invite links are unique and personal to the candidate.

---

## User Roles

| Role | Access |
|------|--------|
| **Superuser** | Full access + Settings (team management, company info) |
| **Admin** | Full access to all recruiting features |
| **Sub-user** | Standard recruiter access |

---

## Tech Stack (brief)
- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3)
- **AI:** Anthropic Claude (reports, evaluations, JD enhancement, POFU emails)
- **Communication:** Twilio (calls), Hostinger SMTP (emails), Deepgram (live transcription)
