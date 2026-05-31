# ZEOPLE – POFU AGENTIC AI
## Business Requirements Document (BRD) + Functional Requirements Document (FRD)

---

# PART 1: BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1.1 Objective

Design and build an AI-powered, multi-agent Post Offer Follow-Up (POFU) system that:

- Maximizes candidate joining ratio
- Minimizes offer drop-offs
- Automates candidate engagement
- Provides predictive intelligence
- Reduces manual recruiter dependency

---

## 1.2 Problem Statement

Current POFU processes are:

- Manual and recruiter-dependent
- Timeline-based (not intelligence-based)
- Reactive (detect issues late)
- Poorly tracked across systems
- Inefficient at scale

> **Result:** High drop-off rates, poor candidate experience, revenue leakage

---

## 1.3 Business Goals

| Goal | KPI |
|------|-----|
| Improve joining ratio | +15–25% |
| Reduce drop-offs | -30% |
| Reduce recruiter effort | -40% |
| Improve candidate experience | NPS ↑ |
| Improve predictability | >80% accuracy |

---

## 1.4 Stakeholders

- Recruitment Team (TA)
- POFU Team
- Hiring Managers
- Onboarding Team
- Leadership
- Candidates

---

## 1.5 Scope

### ✅ In Scope
- AI-led candidate engagement (calls, messages)
- Risk prediction (joining probability)
- Automated intervention
- Candidate lifecycle tracking
- ATS integration
- Analytics dashboards

### ❌ Out of Scope (Phase 1)
- Offer generation
- Pre-offer sourcing
- Compensation negotiation automation (manual assist only)

---

## 1.6 Success Criteria

- 90%+ candidates tracked end-to-end
- Real-time confidence score available
- Intervention triggered within < 24 hrs of risk detection
- Reduction in manual follow-ups by > 50%

---

# PART 2: FUNCTIONAL REQUIREMENTS DOCUMENT (FRD)

## 2.1 System Overview

The system consists of multiple AI agents working collaboratively:

| Agent | Function |
|-------|----------|
| Candidate State Agent | Tracks lifecycle |
| Engagement Agent | Communicates with candidates |
| Risk Agent | Predicts joining probability |
| Decision Agent | Determines actions |
| Intervention Agent | Executes escalation |
| Issue Agent | Classifies candidate concerns |
| Analytics Agent | Generates insights |

---

## 2.2 End-to-End Workflow

### Step 1: Offer Accepted

**Input:** Candidate details from ATS

**System Action:** Create Candidate Lifecycle Object

```json
{
  "candidate_id": "",
  "doj": "",
  "notice_period": "",
  "confidence_score": 0.7,
  "risk_score": 0.3,
  "state": "offer_accepted"
}
```

---

### Step 2: Engagement Initiation

**Logic:** Triggered dynamically (not fixed 3 days)

**Rules:**
- High risk → immediate contact
- Low risk → delayed engagement

---

### Step 3: AI Interaction

**Channels:**
- Voice call
- WhatsApp
- Email

**Data Captured:**
- Resignation status
- Last Working Day (LWD)
- Candidate sentiment
- Risk signals

---

### Step 4: Signal Extraction

**Extract:**
- Commitment level
- Hesitation indicators
- Response delay
- Emotional tone

---

### Step 5: Risk Scoring

**Output:**

```json
{
  "joining_probability": 68,
  "risk_level": "Medium",
  "confidence_trend": "declining"
}
```

---

### Step 6: Decision Engine

| Condition | Action |
|-----------|--------|
| Risk > 70% | Immediate escalation |
| Risk 40–70% | Increased engagement |
| Risk < 40% | Maintain |

---

### Step 7: Intervention

**Types:**
- Recruiter connect
- Hiring Manager connect
- Compensation discussion
- Backup sourcing

---

### Step 8: Continuous Loop

```
Engage → Analyze → Score → Act → Learn
```

System repeats this cycle continuously.

---

### Step 9: Pre-Onboarding

- Document readiness
- BGV tracking
- Joining confirmation

---

## 2.3 Functional Modules

### Module 1: Candidate State Engine
- Maintain candidate state
- Update confidence score
- Track lifecycle transitions

### Module 2: Engagement Module
- AI conversations
- Multi-channel communication
- Context-aware messaging

### Module 3: Risk Prediction Engine

**Inputs:**
- Interaction history
- Behavioral signals
- Timeline adherence

**Outputs:**
- Joining probability
- Risk level

### Module 4: Decision Engine
- Evaluate risk
- Trigger actions
- Prioritize interventions

### Module 5: Intervention Module
- Trigger human interaction
- Schedule calls
- Escalate issues

### Module 6: Issue Classification Module

| Level | Category |
|-------|----------|
| Level 1 | Basic queries |
| Level 2 | Concerns |
| Level 3 | Drop risk |

### Module 7: Analytics Module

**Metrics:**
- Drop-off rate
- Joining ratio
- Prediction accuracy
- Engagement effectiveness

---

## 2.4 Data Model

### Table: Candidate Lifecycle
| Field | Type |
|-------|------|
| candidate_id | string |
| doj | date |
| state | enum |
| confidence_score | float |
| risk_score | float |

### Table: Engagement Logs
| Field | Type |
|-------|------|
| interaction_id | string |
| candidate_id | string |
| type | enum |
| transcript | text |
| sentiment | string |

### Table: Risk Events
| Field | Type |
|-------|------|
| candidate_id | string |
| risk_type | string |
| severity | enum |

### Table: Interventions
| Field | Type |
|-------|------|
| candidate_id | string |
| action | string |
| outcome | string |

---

## 2.5 API Specifications

### `POST /engage`
Initiates interaction with a candidate.

### `GET /score`
Returns risk score and confidence score for a candidate.

### `POST /decide`
Returns the next recommended action based on current risk.

### `POST /intervene`
Executes a specified intervention action.

### `POST /update_state`
Updates the candidate lifecycle state.

---

## 2.6 AI Prompts (Core)

### Engagement Agent
```
Engage candidate post-offer.

Goal:
- Build trust
- Assess intent
- Detect risks

Be natural and conversational.
```

### Risk Agent
```
Evaluate candidate joining probability.

Output:
- risk level
- confidence score
- key risks
```

### Decision Agent
```
Based on risk, decide next action.

Return:
- action
- urgency
- reason
```

### Issue Agent
```
Classify candidate issue into:
Level 1 / Level 2 / Level 3
```

---

## 2.7 Dashboard Requirements

### Recruiter View
- Candidate risk score
- Action recommendations
- Engagement history

### Leadership View
- Joining ratio
- Drop-off prediction
- Intervention success rate

---

## 2.8 Non-Functional Requirements

### Performance
- Real-time scoring (< 2 seconds)
- Async processing for batch operations

### Scalability
- Handle 10,000+ candidates simultaneously

### Security
- Data encryption
- PII compliance (GDPR / India DPDP)

### Reliability
- 99.9% uptime SLA

---

## 2.9 Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Wrong prediction | Continuous learning |
| Candidate discomfort | Human-like tone |
| Data inconsistency | Strong validation |
| ATS mismatch | Sync layer |

---

# PART 3: MVP DELIVERY PLAN

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| Phase 1 | Weeks 1–3 | Engagement Agent, Basic scoring |
| Phase 2 | Weeks 4–6 | Decision engine, Risk model |
| Phase 3 | Weeks 7–10 | Intervention engine, Dashboard |

---

# Final Summary

> This system is **not** a follow-up tool.  
> This system is **not** a CRM workflow.  
> This system **is** an AI-powered conversion engine for hiring.
