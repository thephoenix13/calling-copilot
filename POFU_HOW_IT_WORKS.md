# Post Offer Follow-Up (POFU) — How It Works

## Overview

Losing a candidate after they've accepted an offer is one of the most frustrating things in recruiting. POFU exists to prevent that. Once a candidate is in the system, it tracks where they are in the pre-joining journey, scores their drop risk in real time, and automatically sends them personalised emails at exactly the right moments — so no one slips through the cracks, even when you're juggling a hundred other things.

Every email includes a set of response buttons so the candidate can acknowledge it, update their status, or flag a concern — directly from their inbox, without needing to log in anywhere.

---

## Step 1 — Adding a Candidate

The moment a candidate accepts an offer, you add them to POFU. All you need is their name, email address, role title, company name, and date of joining. Once they're in, the system takes it from there.

You can add candidates manually from the POFU section in the sidebar by clicking **Add Candidate**.

---

## Step 2 — The Welcome Email

As soon as a candidate is added, the system sends them a warm welcome email. This email is written by AI using the candidate's actual name, role, and joining date — it doesn't read like a generic template. The tone is celebratory and reassuring, confirming the DOJ and setting expectations for what comes next.

The email includes response buttons: **"Got it, thank you!"** and **"I have a question"** — so the candidate can acknowledge it with a single click.

No action is needed from you for this — it goes out automatically.

---

## Step 3 — Notice Period Follow-up

One of the biggest early drop risks is a candidate who hasn't yet resigned from their current company. If the system sees that a candidate has been in the **Offer Accepted** stage for more than 2 days without progressing, it automatically sends a gentle check-in email asking whether they've submitted their resignation and if there's anything they need help with.

Response buttons on this email: **"Yes, I've submitted my resignation"** / **"Not yet — will do soon"** / **"I need to discuss this"**

When the candidate clicks a response, it's automatically logged and their engagement timestamp is updated.

---

## Step 4 — BGV Document Reminder

Once a candidate has moved to the **Notice Period** stage, the next milestone is background verification. If BGV hasn't been initiated, the system sends them an email explaining what's needed and asking them to submit their documents.

Response buttons: **"Documents submitted"** / **"Need help with BGV process"** / **"I have a question"**

---

## Step 5 — Pre-Joining Checklist (2 Weeks Out)

When there are two weeks left before the joining date, the system sends a practical checklist email — what documents to carry, any system setup required, first day logistics, and who to contact. This is designed to reduce last-minute confusion and make the candidate feel prepared and looked after.

Response buttons: **"All noted, I'm ready!"** / **"I have a question"**

---

## Step 6 — One Week to Joining (1 Week Out)

A week before joining, the candidate gets a warmer, more cultural email. This one focuses less on logistics and more on excitement — what the team is like, what to expect on their first day, and an open invitation to ask any last-minute questions.

Response buttons: **"Excited to join!"** / **"I have a question"**

---

## Step 7 — Joining Tomorrow

The day before they join, a short high-energy email goes out confirming the first day details — time, location or WFH link, and who they'll be meeting. This is deliberately brief and energetic.

Response buttons: **"See you tomorrow!"** / **"I need to discuss something urgent"**

---

## Step 8 — Updating the Stage

While the system handles the emails automatically, you're responsible for updating the candidate's stage as real-world milestones happen. The stages are:

- **Offer Accepted** — starting point
- **Notice Period** — candidate has submitted their resignation and is serving their notice
- **BGV In Progress** — background verification is underway
- **Joining Confirmed** — BGV is cleared, all set to join
- **Joined** — candidate showed up on Day 1
- **Offer Dropped** — candidate withdrew or didn't join

You update this from the candidate's detail page. Each update triggers a risk recalculation, so keeping stages current is important for the system to work accurately.

---

## Step 9 — Risk Scoring

Every candidate has a risk score between 0 and 100, and a risk level — **Low**, **Medium**, or **High**. This score updates automatically throughout the journey based on three things:

- **Stage** — earlier stages carry more inherent risk since there are more opportunities to drop
- **DOJ proximity** — the closer the joining date, the higher the urgency
- **Engagement** — if a candidate stops responding to emails, their risk goes up

When a candidate responds to an email via the response buttons, their engagement timestamp is updated and their risk score adjusts accordingly at the next scheduler cycle.

The POFU dashboard lists candidates sorted by risk, so you always know at a glance who needs your attention most.

---

## Step 10 — Risk-Based Emails

If a candidate's risk level rises, the system doesn't just sit on it — it triggers additional emails automatically:

- **Engagement Check-in** (Medium risk) — a soft, personal check-in asking how things are going and whether there are any concerns. Response buttons: **"All good, joining as planned"** / **"I have some concerns"**
- **At-Risk Follow-up** (High risk) — a warmer but slightly more urgent message, mentioning that the hiring manager is looking forward to them joining and offering to jump on a quick call. Response buttons: **"All good, joining as planned"** / **"I'd like to speak with someone"**
- **Gentle Nudge** (No response in 6+ days) — a short friendly nudge asking for a simple reply. Response buttons: **"Still joining as planned"** / **"I need to discuss something"**

These emails are on top of the scheduled sequence and only fire when needed.

---

## Step 11 — Candidate Interactions

Every email sent through POFU includes:

1. **A prompt line** — *"Please acknowledge this email by clicking one of the options below — your response helps us support your onboarding smoothly."*
2. **Response buttons** — tailored to the email type, with options appropriate to the situation
3. **A free-text option** — candidates can also type a custom message if none of the buttons fit

When a candidate clicks a response button, they land on a simple, mobile-friendly page at `/respond`. No login is required. They can confirm their selection or type a message, then submit. The response is logged instantly.

On the recruiter side, the email history timeline shows:
- **"Awaiting response"** badge — on emails that have been sent but not yet acknowledged
- **"✓ Responded"** badge — once the candidate has replied, with their response shown inline

This gives you a clear picture of which candidates are engaged and which need a manual follow-up.

---

## Step 12 — Logging Replies

If a candidate replies directly to an email (rather than using the response buttons), you can log their response manually. This updates their engagement timestamp and lowers their risk score. Use the **Log Reply** button on the candidate's detail page.

---

## Step 13 — Manual Emails

If you want to send a one-off email outside the automated sequence — maybe you just got off a call with the candidate and want to follow up in writing — you can do that too. Open the candidate's page, click **Send / Preview Email**, pick the email type, and the AI will draft it for you. You can review before sending.

Manual emails also include response buttons so the candidate can acknowledge them the same way.

---

## Step 14 — End of the Journey

Once a candidate joins, you mark them as **Joined** and they move out of the active tracking list. The email sequence stops and their risk score is set to zero.

If a candidate drops out at any point, you mark them as **Offer Dropped**. Tracking stops immediately and their risk score is set to 100, which is reflected in your analytics.

---

## How It Plays Out by Joining Date

The behaviour of POFU changes depending on how far away the joining date is. Here's what the system does in each scenario.

---

### Joining in 2 Months (60+ days)

- Day 0 — Welcome Email sent
- Day 2+ — Notice Period Follow-up (if still at Offer Accepted)
- After notice period — BGV Document Reminder sent
- Day 46 (14 days out) — Pre-Joining Checklist sent
- Day 53 (7 days out) — One Week to Joining sent
- Day 59 (1 day out) — Joining Tomorrow sent
- Risk stays Low throughout as long as candidate is responsive and progressing

---

### Joining in 1 Month (30 days)

- Day 0 — Welcome Email sent
- Day 2+ — Notice Period Follow-up (if still at Offer Accepted)
- After notice period — BGV Document Reminder sent
- Day 16 (14 days out) — Pre-Joining Checklist sent
- Day 23 (7 days out) — One Week to Joining sent
- Day 29 (1 day out) — Joining Tomorrow sent
- Risk score picks up a small bump at the 14-day mark but stays manageable if candidate is engaged

---

### Joining in 14 Days

- Day 0 — Welcome Email sent
- Day 0 — Pre-Joining Checklist sent immediately (already within the 14-day window)
- Day 2+ — Notice Period Follow-up if still at Offer Accepted
- After notice period — BGV Document Reminder sent
- Day 7 (7 days out) — One Week to Joining sent
- Day 13 (1 day out) — Joining Tomorrow sent
- Risk gets a +10 bump right away — candidate may tip into Medium if engagement gaps exist

---

### Joining in 7 Days

- Day 0 — Welcome Email sent
- Day 0 — One Week to Joining sent immediately (already within the 7-day window, checklist window missed)
- Day 2+ — Notice Period Follow-up if still at Offer Accepted
- After notice period — BGV Document Reminder sent
- Day 6 (1 day out) — Joining Tomorrow sent
- Risk gets a +20 bump from the start — even a confirmed, responsive candidate sits at Low-Medium

---

### Joining in 3 Days

- Day 0 — Welcome Email sent
- Day 0 — One Week to Joining sent immediately (within 7-day window)
- Day 2 (1 day out) — Joining Tomorrow sent
- No checklist sent — 14-day window already passed
- Risk gets a +30 bump immediately — most candidates will sit at Medium or High from day one
- Any engagement gap or high risk triggers an At-Risk Follow-up on top of the above

---

### Joining Tomorrow (1 Day)

- Day 0 — Welcome Email sent
- Day 0 — Joining Tomorrow sent immediately
- No checklist or One Week to Joining — all windows have passed
- Risk is elevated from the start given how imminent the date is
- System monitors closely; At-Risk Follow-up fires if any risk signals are detected

---

## A Note on Email Quality

All emails in POFU are generated by AI (Claude Haiku) at the moment of sending. They use the candidate's real name, role, company, and joining date, and the tone is calibrated to the situation — warm and celebratory early on, practical in the middle, and high-energy closer to joining. They're designed to feel like they came from a thoughtful recruiter, not an automated system.

The AI is explicitly instructed never to use language like "passed", "failed", or "cleared the interview" — since these candidates have already accepted offers. All copy uses language appropriate to the onboarding journey: "joining us", "your start date", "your offer".

Emails are spaced at least 18 hours apart so candidates never feel bombarded. Auto-emails can also be paused per candidate if you're handling that relationship more directly.
