# Market Intelligence Report — Algorithm Spec

A portable specification for the multi-agent pipeline that turns a job description into a structured recruitment market intelligence report. Extracted from the Zeople MI platform; written so it can be re-implemented in any stack (Next.js + Vercel, Python/FastAPI, etc.).

> **Sections 1–11** describe the algorithm in vendor-neutral terms.
> **Section 12** describes the concrete **Anthropic-only implementation** — recommended path for the `recruiter-call-app` integration.

---

## 1. Inputs and outputs

**Input — `JobContext`:**
```ts
{
  title: string,                  // free text
  location: string,               // enum: Bengaluru | Mumbai | Delhi NCR | Hyderabad | Pune | Chennai | Kolkata | Ahmedabad | Jaipur | Chandigarh | Kochi | Indore | Coimbatore | Remote (India) | Pan India
  clientName?: string,
  industry: string,               // enum: IT | Financial Services | Healthcare & Pharma | E-commerce & Retail | Manufacturing | Consulting | Telecom | BFSI | EdTech | Media | Automotive | Real Estate | Energy | Other
  employmentType: string,         // enum: Full-time | Contract | Part-time | Freelance | Internship
  experienceLevel: string,        // enum: Fresher (0-1) | Junior (1-3) | Mid (3-5) | Senior (5-8) | Lead (8-12) | Principal/Architect (12+) | Director/VP
  mustHaveSkills: string[],       // free-text list of required skills
  noticePeriod?: string,          // enum: Immediate | 15 days | 30 days | 45 days | 60 days | 90 days
  detailedJobDescription?: string
}
```

**Output — `ReportData`:**
```ts
{
  jobContext: JobContext,
  executiveSummary: string,       // 3-4 sentence prose
  structuredData: {
    demandAnalysis:        { jobPostingTrends, growthRate, hotLocations[], sources[], confidence },
    talentAvailability:    { totalPool, activeJobSeekers, passiveCandidates, tierCityBreakdown, sources[], confidence },
    salaryBenchmarks:      { minCTC, percentile25, medianCTC, percentile75, maxCTC, sources[], confidence },
    competitorAnalysis:    { topHiringCompanies: [{name, openPositions}], sources[], confidence },
    joiningTimelines:      { averageNoticePeriod, typicalTimeToHire, buyoutTrends, preferredNoticePeriodFit, sources[], confidence },
    keyTrends:             { trends[], sources[], confidence },
    talentReputation:      { companies: [{name, rating, recommendationRate}], ratingSource, sources[], confidence },
    positioningRecommendations: { recommendations[], sources[], confidence },
    skillAvailability:     { skills: [{ skill, skillType, experienceRange, location, availableProfiles, immediate, thirtyDays, sixtyDays, notes }], sources[], confidence }
  },
  generatedAt: ISO8601
}
```

`confidence` is one of `"high" | "medium" | "low"` for every section.

---

## 2. Pipeline overview

Four sequential stages, each surfaced to the user as a progress step:

```
[parsing] -> [researching] -> [structuring] -> [generating]
```

Optionally preceded by an **ingestion** stage (raw JD text -> JobContext) and optionally followed by **enrichment** (refresh Glassdoor data on demand).

```
JD text --[Stage 0: parse-jd]-->  JobContext
                                   |
                                   v
                            [Stage 1: parsing]
                                   |
                                   v
                          [Stage 2: research-agent] -- raw markdown + citations
                                   |
                                   v
                          [Stage 3: structure-agent] -- structured JSON
                                   |
                                   v
                          [Stage 4: generate-report] -- exec summary
                                   |
                                   v
                              ReportData (persisted)
```

Each stage runs as its own server function so failures and retries are localized.

---

## 3. Stage 0 — JD ingestion (optional)

**Goal:** Accept raw JD text + client metadata and produce a clean `JobContext`.

### 3.1 What is taken as input

The recruiter provides input through **two channels** — the JD itself (text or file) and a small client-details form. Some fields are extracted from the JD automatically, others are filled in by the recruiter manually because they are not reliably present in JD text.

**Channel A — JD content (free-form):**

The recruiter pastes JD text, types a JD into a textarea, or uploads a file (`.pdf`, `.docx`, `.txt`). The pipeline extracts the following fields from this text:

| Field | Type | How it's extracted |
|---|---|---|
| `title` | free text | Extracted verbatim — e.g. "Senior NetSuite Consultant" |
| `industry` | enum | Inferred from JD content; constrained to allowlist (IT, BFSI, Healthcare & Pharma, etc. — see §1) |
| `employmentType` | enum | Inferred from JD; constrained (Full-time / Contract / Part-time / Freelance / Internship) |
| `experienceLevel` | enum | Mapped from years-of-experience phrases (e.g. "4–6 years") to the closest band (Junior / Mid / Senior / Lead / etc.) |
| `mustHaveSkills` | string[] | Extracted as a list of technical skills explicitly required by the JD |
| `location` | enum | Extracted if present; constrained to allowlist (Bengaluru, Mumbai, Delhi NCR, etc.) — falls back to manual selection if absent |
| `noticePeriod` | enum | Extracted if the JD specifies one; otherwise left for the recruiter to fill |
| `detailedJobDescription` | free text | The full JD text is preserved verbatim and passed downstream as additional context for the research stage |

**Channel B — client metadata (recruiter form, separate from the JD):**

These fields are not reliably present in JD text and should be captured via a small form **before** generation starts:

| Field | Required? | Notes |
|---|---|---|
| `clientName` | optional | The hiring company's name (only if the recruiter wants it on the report) |
| `location` | required if not in JD | Recruiter selects from the allowlist if extraction missed it |
| `noticePeriod` | optional | The client's preferred notice period — drives the §6 `preferredNoticePeriodFit` post-processing rule |
| Override any extracted field | — | Recruiter can edit any auto-extracted field before kicking off Stage 2 |

**What's NOT taken as input:**

- Salary expectations or budget — these are *outputs* of the report (the salary benchmark research), not inputs
- Resume/CV data — this pipeline is for market research, not candidate matching
- Recruiter contact details — those belong on the report template/branding, not in `JobContext`

### 3.2 Algorithm

1. Reject if JD text is shorter than ~20 chars (insufficient signal to extract).
2. Call an LLM with a **tool-call schema** named `extract_job_fields` (see §12.8 for the concrete Claude implementation).
3. The schema's enum-typed parameters (`location`, `industry`, `employmentType`, `experienceLevel`, `noticePeriod`) constrain the model to allowed values only. `title` and `mustHaveSkills` are free-form.
4. Force the model to call this tool so output is always structured.
5. **Server-side validation:** after parsing the tool arguments, drop any enum field whose value is not in the allowlist (do not trust the model).
6. **Merge with Channel B:** overlay the recruiter's manual form fields on top of the extracted fields. Manual entries always win — the recruiter sees and confirms the merged `JobContext` before kicking off Stage 2.

This two-channel approach eliminates "garbage in" errors before research starts and keeps the recruiter in control of any field the JD didn't specify clearly.

---

## 4. Stage 1 — Parsing (orchestration)

Lightweight client-side step:
1. Insert a `reports` row with `status: 'pending'` and the full `JobContext`.
2. Capture the row id — every downstream call references it for tracing/persistence.
3. Initialize a 4-phase progress object so the UI can render a stepper.

This stage exists mainly so the user sees immediate feedback while the heavier stages run.

---

## 5. Stage 2 — Research agent (the intelligence layer)

**Goal:** Produce a markdown research document with **specific numbers** and citations.

**Model choice:** a research-grade model with native web access and citation support. See §12.2 for the concrete Claude model + tool selection.

**System prompt (the algorithmic core):**

> You are an expert recruitment market research analyst specializing in the Indian hiring market.
> Your responses MUST include SPECIFIC NUMBERS and DATA — never vague statements.
>
> **Required data:**
> 1. TALENT POOL — specific counts ("45,000 professionals with this skill set in Bangalore")
> 2. SALARY DATA — exact figures in LPA ("Min: 8 LPA, Median: 15 LPA, p75: 22 LPA, Max: 35 LPA")
> 3. COMPANIES — 8–12 named companies with approximate open positions
> 4. NOTICE PERIODS — typical ranges
> 5. TIME TO HIRE — realistic timelines (4–8 weeks)
> 6. GROWTH RATES — % YoY for demand
>
> **Mandatory source diversity:**
> - Job portals: Naukri.com, LinkedIn India, Glassdoor India, Shine, TimesJobs
> - Salary databases: AmbitionBox, PayScale India, Glassdoor Salaries, Levels.fyi
> - Industry reports: TeamLease, Michael Page India Salary Guide, Mercer, Aon Hewitt, NASSCOM, Deloitte, KPMG
>
> Do NOT over-rely on Indeed.com — limited India coverage. Prioritize Naukri and LinkedIn.
>
> **Output sections (exactly these 8):**
> 1. DEMAND ANALYSIS
> 2. TALENT AVAILABILITY
> 3. SALARY BENCHMARKS (min, p25, median, p75, max in LPA)
> 4. COMPETITOR COMPANIES (8–12 with open positions)
> 5. JOINING TIMELINES
> 6. TALENT REPUTATION (Glassdoor ratings + recommend %)
> 7. POSITIONING RECOMMENDATIONS
> 8. OVERALL ROLE AVAILABILITY (combined-skills pool)

**User prompt:** Substitute the `JobContext` fields and re-list the 8 sections, this time as questions ("Current open positions on Naukri and LinkedIn?", etc.). Always close with: *"CITATION REQUIREMENT: Cite at least 5–7 different sources."*

**Output:** `{ content: string, sources: string[], timestamp }`. Persist `sources` separately — they will be injected into the structured JSON in the next stage rather than inferred by the structurer.

---

## 6. Stage 3 — Structure agent (markdown -> JSON)

**Goal:** Convert the research markdown into the strict `structuredData` schema.

**Model choice:** A cheap, fast JSON-capable model. It does not need web access — all the facts are in the research document. See §12.2 for the concrete model selection.

**Algorithm:**
1. Truncate the research content to ~6000 chars (and JD to ~1000 chars) before sending. Keeps cost bounded and avoids context overflows.
2. Send a strict template of the target JSON in the user prompt. Example: `"medianCTC": "X LPA"`, `"hotLocations": ["city1", "city2", "city3"]`. Include "confidence" on every section.
3. System prompt: *"Return ONLY valid JSON. No markdown. No explanations. Keep string values under 200 chars to avoid truncation. Use 'Not available' only when the research truly has no data."*
4. **Robust JSON parsing** — implement a 3-pass parser because LLMs occasionally truncate or wrap output:
   - Pass A: strip ` ```json ` fences, `JSON.parse` directly.
   - Pass B: locate the first `{` and last `}`, substring, parse.
   - Pass C: balance brackets — count `{`/`}` and `[`/`]`, append missing closers; if a trailing string is unterminated, truncate at the last complete `,`, then re-balance and parse.
5. If all 3 passes fail, return a **default skeleton** populated from `JobContext` (everything marked `confidence: "low"`). The pipeline must never hard-fail.
6. **Inject citations from Stage 2** into the `sources` field of every section. Do not trust the structurer to remember sources.
7. **Apply business rules** post-parse:
   - Cap `typicalTimeToHire` at **8 weeks**. Regex-match `(\d+)\s*[-–]\s*(\d+)` for ranges and a single `\d+` for scalars; clamp both ends.
   - `skillAvailability` must contain exactly **one row** describing the *combined* skill set, not one row per skill. Classify it:
     - `Vanilla` — 10,000+ candidates with all skills
     - `Niche` — 1,000–10,000
     - `Super Niche` — <1,000
   - `notes` field on that row must explain *why* the classification was chosen.

---

## 7. Stage 4 — Generate report (executive summary)

**Goal:** Produce a 3–4 sentence prose summary for the top of the report.

**Algorithm:**
1. Take `JobContext` + a digest of `structuredData` (salary range, demand trend, top 2 trends, joining timeline).
2. Send to a cheap model with system prompt: *"You are an executive report writer. Write concise, professional summaries for business executives."*
3. User prompt: *"Write a 3–4 sentence executive summary. Output ONLY the paragraph. Mention notice-period considerations if relevant."*
4. Assemble the final `ReportData` object: `{ jobContext, structuredData, executiveSummary, generatedAt }`.
5. Persist to the `reports` row. Set `status: 'completed'`.

---

## 8. Optional Stage 5 — Reputation enrichment

On demand (button in the report view), refresh Glassdoor data:
1. Re-run a focused web-research query for "Glassdoor ratings and employee recommendation rates for {top 3-5 companies from competitorAnalysis}".
2. Merge into `structuredData.talentReputation.companies` (replace, do not append).
3. Update the row.

Keep this separate from the main pipeline — it is the most volatile data and users want fresh numbers without re-running the whole report.

---

## 9. Cross-cutting design decisions

These are the choices that make the pipeline robust. Preserve them in any re-implementation:

1. **Two-model split.** A web-grounded research model for facts + citations; a cheap JSON model for shaping. Never ask one model to do both — research models are bad at strict JSON, JSON models hallucinate facts.
2. **Citations are extracted, not generated.** The structurer never "remembers" sources; they are injected post-hoc from the research model's citation list. This makes hallucinated sources structurally impossible.
3. **Schema constraints at boundaries.** Enum allowlists at the input (`parse-jd` tool schema) and JSON repair + business-rule post-processing at the output (`structure-agent`). Free-form LLM output never reaches the database.
4. **Defensive fallbacks at every layer.**
   - Research model unavailable -> fallback chat model
   - JSON parse fails -> JSON-repair pass -> default skeleton
   - Pipeline fails -> mark report `status: 'failed'`, surface in UI with a Retry button that re-runs from Stage 1 with the same `JobContext`
5. **Combined-skill availability is the differentiated metric.** Most tools count individual skills; this one explicitly asks the LLM to estimate the *intersection* of all required skills and classify its rarity.
6. **Time-to-hire cap.** Business rule: never display >8 weeks (clients tune out). Enforced server-side via regex post-processing, not in the prompt.
7. **Sources are diversified by mandate.** The system prompt names ~15 specific Indian sources and explicitly de-prioritizes Indeed. Without this the model defaults to US-centric sources.
8. **Persist a row before research starts.** So failed/in-progress runs are visible in history and can be retried without re-typing the JD.
9. **Confidence on every section.** Lets the UI dim/flag low-confidence cells without rejecting the whole report.

---

## 10. Suggested file/function layout (framework-agnostic)

```
/api (or /functions)
  parse-jd            POST { text }                          -> JobContext (partial)
  research-agent      POST { jobContext, reportId }          -> { researchDocument: { content, sources, timestamp } }
  structure-agent     POST { jobContext, researchDocument }  -> { structuredData }
  generate-report     POST { jobContext, structuredData }    -> { reportData }
  enrich-reputation   POST { reportId }                      -> { talentReputation }

/db
  reports table:
    id, user_id, job_title, location, client_name, industry,
    employment_type, experience_level, must_have_skills (array),
    detailed_job_description, notice_period,
    status ('pending' | 'completed' | 'failed'),
    report_data (jsonb),  -- the full ReportData object
    created_at, updated_at

/client
  hooks/useReportGeneration  -- orchestrates the 4 stage calls, tracks progress
  hooks/useReportEnrichment  -- on-demand reputation refresh
  components/ReportDisplay   -- renders structuredData section by section
```

Each stage is independently retryable. If structuring fails, you can re-run it against the cached research document without burning another expensive research call.

---

## 11. Adapting to other markets / domains

The algorithm is portable. To re-target:

- **Different country** — swap the source allowlist in the research system prompt (e.g., Indeed/LinkedIn for US, StepStone/Xing for DE), change salary unit (LPA -> annual USD/EUR), update enum allowlists for `location`.
- **Non-recruitment domain** — keep the 4-stage pattern but rewrite the section schema. The research/structure/repair/inject-citations pattern works for any "open-web research -> structured report" use case (competitor pricing, regulatory landscape, vendor comparisons).
- **Voice/call interface (e.g., recruiter-call-app)** — Stage 0 (`parse-jd`) becomes a transcript-to-JobContext extractor that runs on call transcript chunks; the rest of the pipeline is unchanged. Consider streaming the executive summary back as TTS while structured data renders in a side panel.

---

## 12. Anthropic-only implementation

The full pipeline runs end-to-end on the **Claude API alone** — one vendor, one SDK, one billing surface. Sections 1–11 describe the algorithm; this section maps each stage to the specific Claude model, tool, and feature that implements it.

### 12.1 Why Anthropic-only works

Three Claude features cover the entire pipeline:

| Capability | Claude primitive |
|---|---|
| Live web search with citations | Server-side `web_search_20260209` tool (paired with `web_fetch_20260209`) |
| Schema-guaranteed JSON output | `output_config.format` with `json_schema` |
| Tool schema with strict enums (JD parsing) | `tools` with `strict: true` (or `output_config.format`) |

Two simplifications fall out of using Claude end-to-end:

1. **No JSON repair pass needed.** `output_config.format` validates the response against your schema server-side. Either it matches or you get a typed refusal — no boundary extraction, no bracket balancing, no default-skeleton fallback.
2. **Citations are first-class.** Claude's `web_search` returns citations as content blocks tied to the spans of text they support. They flow naturally into the structurer's input — no manual post-hoc injection step.

### 12.2 Per-stage mapping

| Stage | Model | Key features | Notes |
|---|---|---|---|
| **0 — JD parser** | `claude-haiku-4-5` | `output_config.format` json_schema with enum-constrained fields | Trivial extraction. Haiku is plenty. |
| **1 — Parsing** | (no model call) | Insert `reports` row, init progress | Same as before. |
| **2 — Research** | `claude-opus-4-7` | `tools: [{type: "web_search_20260209"}, {type: "web_fetch_20260209"}]` + `thinking: {type: "adaptive"}` + `output_config: {effort: "high"}` | Where intelligence pays off. Opus 4.7 with adaptive thinking and high effort produces deep, well-cited research. |
| **3 — Structurer** | `claude-sonnet-4-6` | `output_config.format` with full `structuredData` json_schema | Cheap, fast, schema-validated. Drops the JSON repair pass entirely. |
| **4 — Exec summary** | `claude-haiku-4-5` | Plain text response | 3–4 sentences. Haiku. |
| **5 — Reputation refresh** | `claude-sonnet-4-6` | `web_search_20260209` scoped to top companies + `output_config.format` | Same shape as Stage 2 but narrower scope; Sonnet is sufficient. |

> **Model defaults rationale:** Opus 4.7 only where it's load-bearing (research). Sonnet 4.6 for structured extraction. Haiku 4.5 for trivial transforms. Use **`claude-opus-4-7` everywhere** if cost is not a concern — the migration path between tiers is just swapping the model string.

### 12.3 The `web_search_20260209` tool

Server-side tool — declared in `tools`, executed on Anthropic's infrastructure, results stream back into Claude's context within the same API call. You write no fetch logic.

**Why this version specifically:**
- **Dynamic filtering** — Claude runs server-side code to prune search results (junk SEO, duplicates) before they reach context. Activates automatically; no setup.
- **Native citations** — citations are attached to specific spans of text in the response, not dumped as a separate list.
- **Pairs with `web_fetch_20260209`** — if Claude wants the full content of a Glassdoor company page or a NASSCOM PDF, it can drill in on demand.
- **Free when paired with `web_fetch`** — no metered billing for normal report volume.
- Available on Opus 4.7, Opus 4.6, Sonnet 4.6. Not on Haiku. (Stage 2 uses Opus, so this is fine.)

The system prompt from §5 (mandatory sources, 8 sections, Naukri/LinkedIn/Glassdoor/AmbitionBox/NASSCOM allowlist, Indeed de-prioritization) works essentially unchanged. Claude reads it, decides what to search for, issues queries, processes results, and returns the structured markdown + citations.

### 12.4 Replacing the JSON repair pass with `output_config.format`

The Stage 3 structurer sends Claude:
1. The research markdown from Stage 2 (pass `response.content` directly, including citation blocks)
2. The `JobContext`
3. An `output_config.format` containing the full `structuredData` json_schema

Claude returns JSON that is **guaranteed to match the schema** — or returns a typed refusal you can handle explicitly. No repair pass, no boundary extraction, no bracket-balancing fallback.

The business rules from §6 still apply post-parse:
- Cap `typicalTimeToHire` at 8 weeks (regex post-process)
- Force `skillAvailability` to a single combined-skills row classified Vanilla/Niche/Super Niche

These are deterministic transforms on validated JSON — they live in your code, not the schema.

### 12.5 Prompt caching strategy (the cost win)

Claude supports **prompt caching** — repeated prefixes are billed at ~10% of normal input cost on cache reads. This matters enormously for Zeople MI because the system prompts are large and reused.

**What to cache:**
- **Stage 2 research system prompt** (~2K tokens of "Required data, mandatory sources, 8 sections..."). Cached once, reused on every report.
- **Stage 3 structurer system prompt** + the json_schema. Identical on every report.
- **Stage 0 JD-parser tool schema** (the enum allowlist).

**What NOT to cache:**
- The `JobContext` itself (changes every report).
- The research output flowing into Stage 3 (different every time).

Render order is `tools` → `system` → `messages`, so put a `cache_control: {type: "ephemeral"}` breakpoint on the last system block. Stable prefix in front, volatile context (job title, skills, research markdown) after the breakpoint.

**Verifying it works:** check `response.usage.cache_read_input_tokens` on the second report — it should be non-zero. If it's stuck at zero, a silent invalidator is in the prompt (timestamp, UUID, non-deterministic JSON serialization). See `shared/prompt-caching.md` in the Claude API skill for the full audit checklist.

### 12.6 Stage 2 (research) — concrete shape

```ts
// Pseudocode — TypeScript SDK
const research = await client.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  output_config: { effort: "high" },
  tools: [
    { type: "web_search_20260209", name: "web_search" },
    { type: "web_fetch_20260209", name: "web_fetch" }
  ],
  system: [
    {
      type: "text",
      text: RESEARCH_SYSTEM_PROMPT,            // the §5 mandatory-sources/8-sections prompt
      cache_control: { type: "ephemeral" }     // cache the stable prefix
    }
  ],
  messages: [
    { role: "user", content: buildResearchUserPrompt(jobContext) }  // volatile per-report
  ]
});

// research.content is an array of blocks: text, server_tool_use, tool_result, citations.
// Pass it directly into Stage 3 — citations are preserved as content blocks.
```

### 12.7 Stage 3 (structure) — concrete shape

```ts
const STRUCTURED_DATA_SCHEMA = {
  type: "object",
  properties: {
    demandAnalysis:        { /* ... */ },
    talentAvailability:    { /* ... */ },
    salaryBenchmarks:      { /* ... */ },
    competitorAnalysis:    { /* ... */ },
    joiningTimelines:      { /* ... */ },
    keyTrends:             { /* ... */ },
    talentReputation:      { /* ... */ },
    positioningRecommendations: { /* ... */ },
    skillAvailability:     { /* ... */ }
  },
  required: ["demandAnalysis", "talentAvailability", /* ...all 9 */],
  additionalProperties: false
};

const structured = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 8000,
  output_config: {
    format: { type: "json_schema", schema: STRUCTURED_DATA_SCHEMA }
  },
  system: [
    {
      type: "text",
      text: STRUCTURE_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" }
    }
  ],
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: `JobContext: ${JSON.stringify(jobContext)}` },
        ...research.content                  // pass research blocks (text + citations) directly
      ]
    }
  ]
});

const data = JSON.parse(structured.content.find(b => b.type === "text").text);
// data is guaranteed to match STRUCTURED_DATA_SCHEMA — no repair pass
```

### 12.8 Stage 0 (JD parser) — concrete shape

Tool-call extraction with enum-constrained fields:

```ts
const parsed = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 1000,
  tools: [{
    name: "extract_job_fields",
    description: "Extract structured job description fields from raw text.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        location: { type: "string", enum: ALLOWED_LOCATIONS },
        industry: { type: "string", enum: ALLOWED_INDUSTRIES },
        employmentType: { type: "string", enum: ALLOWED_EMPLOYMENT_TYPES },
        experienceLevel: { type: "string", enum: ALLOWED_EXPERIENCE_LEVELS },
        noticePeriod: { type: "string", enum: ALLOWED_NOTICE_PERIODS },
        mustHaveSkills: { type: "array", items: { type: "string" } },
        clientName: { type: "string" }
      },
      required: ["title", "mustHaveSkills"],
      additionalProperties: false
    }
  }],
  tool_choice: { type: "tool", name: "extract_job_fields" },
  messages: [{ role: "user", content: rawJDText }]
});
```

Server-side validation (drop fields whose values aren't in the enum) is still recommended as defense-in-depth, even with `strict: true`.

### 12.9 Cost shape (rough)

For one report at typical depth:

| Stage | Model | Tokens (in/out) | Approx cost |
|---|---|---|---|
| 0 — JD parser | Haiku 4.5 | 2K / 0.3K | ~$0.003 |
| 2 — Research | Opus 4.7 | 5K / 8K (after web search) | ~$0.22 |
| 3 — Structurer | Sonnet 4.6 | 12K / 4K | ~$0.10 |
| 4 — Exec summary | Haiku 4.5 | 1K / 0.2K | ~$0.002 |
| **Per report** | | | **~$0.32** |

With prompt caching on the system prompts: **~$0.20–0.25 per report** after the first one.

### 12.10 Defensive fallbacks

The §9 design principle — "defensive fallbacks at every layer" — applies as follows:

| Failure | Handling |
|---|---|
| Research fails (Stage 2) | Retry once with `effort: "max"`; if it still fails, mark report `status: 'failed'` and surface a Retry button in the UI |
| Schema validation fails (Stage 3) | `output_config.format` either succeeds or returns a typed refusal. Log the refusal, mark `status: 'failed'`, allow user to retry. No skeleton fallback. |
| Rate limit / 429 | Anthropic SDK auto-retries with exponential backoff (`max_retries=2` default) |
| Schema refusal (any stage) | Capture `stop_reason: 'refusal'` + `stop_details`, surface to UI, allow user to retry |

### 12.11 Implementation checklist

For a fresh build in `recruiter-call-app`:

- [ ] Set `ANTHROPIC_API_KEY` in environment
- [ ] Install the official Anthropic SDK for your stack (`@anthropic-ai/sdk` for TypeScript, `anthropic` for Python)
- [ ] Stage 0 (JD parser): `client.messages.create()` with Haiku 4.5 + a `tools` array containing `extract_job_fields` with `strict: true`
- [ ] Stage 2 (research): `client.messages.create()` with Opus 4.7 + `web_search_20260209` and `web_fetch_20260209` server-side tools + adaptive thinking + `effort: "high"`
- [ ] Stage 3 (structure): `client.messages.create()` with Sonnet 4.6 + `output_config.format` json_schema for the full `structuredData` shape
- [ ] Stage 4 (exec summary): `client.messages.create()` with Haiku 4.5 — plain text response
- [ ] Add `cache_control: {type: "ephemeral"}` breakpoints on the last system block of stages 2, 3, and 0
- [ ] Audit system prompts for silent cache invalidators (no `Date.now()`, no UUIDs, sort any `JSON.stringify` of objects)
- [ ] Verify caching works: log `response.usage.cache_read_input_tokens` on the second report — should be non-zero
- [ ] Implement the post-processing business rules from §6: cap `typicalTimeToHire` at 8 weeks, force `skillAvailability` to a single combined-skill row classified Vanilla/Niche/Super Niche
- [ ] Pass research-stage `response.content` (text + citation blocks) directly into Stage 3's user message — citations flow through as content blocks
- [ ] Persist a `reports` row before Stage 2 starts (`status: 'pending'`); update to `'completed'` or `'failed'` based on outcome
- [ ] Build the UI per §13 — single column of cards, confidence/priority badges, charts, source footers, edit mode, PDF export

---

## 13. Report UI specification

How the rendered Market Intelligence report should look and behave. This section is for the front-end developer (or Claude Code in `recruiter-call-app`) implementing the report view.

### 13.1 Layout philosophy

A **single scrollable column of cards**, one card per `structuredData` section, in a fixed top-to-bottom order that reads like a story:

```
┌─────────────────────────────────────────┐
│ Header card                             │  job title + role/location/date chips
├─────────────────────────────────────────┤
│ Executive summary card                  │  3–4 sentence prose lead
├─────────────────────────────────────────┤
│ Demand analysis                         │  card with chart + numbers + sources
├─────────────────────────────────────────┤
│ Talent availability                     │
├─────────────────────────────────────────┤
│ Salary benchmarks                       │
├─────────────────────────────────────────┤
│ Skill availability (combined skills)    │  the differentiated metric — make it pop
├─────────────────────────────────────────┤
│ Competitor companies                    │
├─────────────────────────────────────────┤
│ Joining timelines                       │
├─────────────────────────────────────────┤
│ Talent reputation (Glassdoor)           │
├─────────────────────────────────────────┤
│ Key trends                              │
├─────────────────────────────────────────┤
│ Positioning recommendations             │  closing card — what to do next
└─────────────────────────────────────────┘
                                     [Export ▾] [Edit] [Refresh reputation]
```

**Principles:**
- One section = one card. No nested cards.
- Every card has an icon, a title, a confidence badge, a body (chart + numbers OR text), and a source-list footer.
- The combined-skill availability is the *unique* metric this report provides — give it visual emphasis (border, background, larger numbers).
- Source attribution is always visible (not hidden in a tooltip). It's the report's credibility surface.

### 13.2 Tech stack assumed

Aligns with what's already built in Zeople MI:

| Concern | Library |
|---|---|
| Component library | shadcn/ui (Card, Badge, Button, Dialog) |
| Styling | Tailwind CSS |
| Icons | `lucide-react` |
| Charts | Recharts |
| Excel/ZIP export | `xlsx`, `jszip` |
| PDF export | `jspdf` + `html2canvas` (the miv2-aa0ae301 implementation — branded, multi-page A4) |

If the recruiter-call-app uses a different stack (e.g. Mantine, Chakra, Tremor), the structure below maps cleanly — substitute equivalent primitives.

### 13.3 Header card

The first card. Sets context for everything below.

| Element | Content |
|---|---|
| Document icon | `FileText` (lucide), filled square ~48px |
| Title (h1) | `jobContext.title` |
| Subtitle | `jobContext.industry` |
| Meta row (chips) | `MapPin` location · `Briefcase` experienceLevel · `Calendar` formatted `generatedAt` (localized, e.g. "8 May 2026") |
| Skills row | `mustHaveSkills` as small Badges, comma-separated visually |
| Optional | client name (if present), notice period preference |

### 13.4 Executive summary card

A single text block. No chart. No badge.

- Prose paragraph (`structuredData.executiveSummary`)
- Generous padding, slightly larger font than body cards (~16–18px, regular weight)
- Subtle left border or accent color to mark it as the "lead"
- This is what users read first — ~3–4 sentences max, calibrated by Stage 4

### 13.5 Per-section card pattern

Every data section (demand, talent, salary, etc.) follows the same skeleton:

```
┌───────────────────────────────────────────────────────┐
│ [icon] Section Title              [Confidence badge]  │  CardHeader
├───────────────────────────────────────────────────────┤
│                                                       │
│  Primary metric (large, bold)                         │  CardContent
│  ┌─────────────────────────────────────────────────┐ │
│  │              [chart goes here]                  │ │
│  └─────────────────────────────────────────────────┘ │
│  Supporting key-value pairs (small)                   │
│                                                       │
├───────────────────────────────────────────────────────┤
│ [globe] Sources: naukri.com  linkedin.com  +3 more   │  Footer
└───────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Section icon** | One lucide icon per section (table below) |
| **Section title** | h2, ~18–20px, semibold |
| **Confidence badge** | Outlined badge, color-coded (see §13.7) — top-right corner of the header |
| **Primary metric** | The single most important number for this section, displayed prominently (e.g. salary median LPA, total talent pool count) |
| **Chart** | One chart per section (table below). Recharts. ~300px tall on desktop, scaled down on mobile. |
| **Supporting fields** | Small key-value list below the chart for everything not in the chart |
| **Source footer** | Top 4 source hostnames as small secondary Badges, "+N more" if more — separated from card body by a thin top border |

### 13.6 Per-section icons and chart recommendations

| Section | Icon (lucide) | Recommended chart | Highlight metric |
|---|---|---|---|
| Demand analysis | `TrendingUp` | `DemandPieChart` (city distribution) or `LocationDemandChart` (horizontal bar by city) | YoY growth rate % |
| Talent availability | `Users` | `TalentFunnelChart` (total pool → active seekers → immediate) | Total pool count |
| Salary benchmarks | `DollarSign` | `SalaryRangeChart` (min / p25 / median / p75 / max as a range bar) | Median CTC in LPA |
| Skill availability ⭐ | `Layers` | `SkillAvailabilityTable` (single row: skillType pill, available count, immediate / 30-day / 60-day columns) | The combined-skill rarity classification (Vanilla / Niche / Super Niche) |
| Competitor companies | `Building2` | `HorizontalBarChart` (companies x open positions) | Top company by openings |
| Joining timelines | `Clock` | `HiringTimelineChart` (notice period range + time-to-hire range as horizontal segments) | Average time-to-hire (capped at 8 weeks) |
| Talent reputation | `Star` | `TalentReputationChart` (companies x Glassdoor rating, 0–5 scale) | Top-rated company |
| Key trends | `TrendingUp` (or `Activity`) | None — bullet list with subtle icons | (no single metric) |
| Positioning recommendations | `Target` | None — categorized cards or numbered list | Priority badges |

⭐ **Skill availability is the differentiated metric.** Visually distinguish the classification with color: `Vanilla` (blue/neutral), `Niche` (amber), `Super Niche` (red/critical). Make the available-profile count the largest number on the card.

### 13.7 Visual language

**Confidence badges** (outlined, rounded, small):
- `high` — emerald-50 bg, emerald-700 text, emerald-200 border
- `medium` — amber-50 bg, amber-700 text, amber-200 border
- `low` — gray-50 bg, gray-600 text, gray-200 border

**Priority badges** (filled pill with leading dot icon, used in positioning recommendations):
- `high` — red-50 bg, red-700 text, red-500 dot
- `medium` — amber-50 bg, amber-700 text, amber-500 dot
- `low` — emerald-50 bg, emerald-700 text, emerald-500 dot

**Skill type badges** (the differentiated metric):
- `Vanilla` — neutral tone, "10,000+ candidates"
- `Niche` — amber tone, "1,000–10,000 candidates"
- `Super Niche` — red tone, "<1,000 candidates" — make it impossible to miss

**Number formatting:**
- LPA values: `"15 LPA"`, `"22.5 LPA"` (one decimal max)
- Counts: `"45K+"`, `"1.5M+"`, `"125"` — use `formatLargeNumber` style abbreviation when ≥ 1000
- Indian number parsing: accept `"1 lakh"`, `"5K"`, `"2M"`, `"1cr"` → normalize to integers
- Percentages: `"18%"` (no decimal needed for trends)

**Typography:**
- Card title: 18–20px semibold
- Primary metric: 28–32px bold
- Body text: 14px regular
- Helper / source text: 12px regular, muted color

**Spacing:** 24px between cards (`space-y-6` in Tailwind). Generous internal card padding (24px on desktop).

### 13.8 Edit mode (post-generation human edits)

The original Zeople MI lets users edit the generated report before exporting. This is important for recruitment: AI-generated numbers may need correction by the recruiter who knows the local market.

**Edit toggle** (top-right of report): switches every editable field into an inline-editable input.

| Field type | Editor |
|---|---|
| Text (title, industry, location, exec summary) | `EditableText` — inline contenteditable |
| Multi-line text (notes) | `EditableTextarea` |
| Lists (trends, recommendations) | `EditableList` — add/remove rows |
| Company rows (competitor analysis) | `EditableCompanyRows` — table with name + openPositions |
| Reputation rows (Glassdoor companies) | `EditableReputationRows` — name + rating + recommend % |
| Skill availability row | `EditableSkillRows` — single combined-skill row |

Edits update the report in-place and are persisted to the `reports.report_data` JSON column on save. Changes are not re-validated against the json_schema — once the report is edited, it's a human artifact.

### 13.9 Export options

A dropdown menu in the report header with three options:

| Format | Implementation | Use case |
|---|---|---|
| **PDF** (recommended) | `html2canvas` snapshot + `jspdf` paginated A4 with branded header/footer (the miv2-aa0ae301 pattern) | Sharing with hiring managers / clients |
| **Excel (.xlsx)** | `xlsx` library — one sheet per section, plus a summary sheet | Recruiters who want to manipulate numbers |
| **ZIP** | `jszip` — bundles PDF + XLSX + raw `report_data.json` | Internal archive |

**PDF specifics** (from miv2-aa0ae301 implementation):
- Branded header band: "ZEO" in dark + "PLE" in orange (or your brand) on every page
- Optional client logo in top-right
- Footer with page number + "Generated on {date}"
- Multi-page slicing — capture `#report-content` as a tall canvas, slice into A4 page-height chunks
- Hide modal overlays during snapshot via `data-print-hide` attribute on dialog/alert components

### 13.10 Generation progress UI

While the pipeline runs (Stages 0–4), show a 4-step progress stepper above the report area:

```
[✓ Parsing] ──── [● Researching] ──── [○ Structuring] ──── [○ Generating]
                  active                pending             pending
```

| State | Visual |
|---|---|
| `pending` | Empty circle, gray |
| `active` | Filled circle with subtle pulse, primary color, optional spinner |
| `completed` | Check icon, emerald |
| `failed` | X icon, red — show error message and a "Retry" button that re-runs the stage |

States map to the `progress.phases` array in `useReportGeneration`. Each phase takes seconds to ~1 minute (research is the longest); the stepper is the user's reassurance that work is happening.

### 13.11 Reputation refresh (on-demand enrichment)

A "Refresh Glassdoor data" button on the talent-reputation card. Triggers Stage 5 (`enrich-reputation`). Shows a small inline spinner while the call runs (usually 5–15 seconds). On success, the card data updates in place; on failure, show a toast with retry.

### 13.12 Responsive behavior

| Breakpoint | Layout |
|---|---|
| ≥1024px (desktop) | Single column, max-width ~960px, centered |
| 768–1023px (tablet) | Single column, full width with margins |
| <768px (mobile) | Single column, charts stack vertically, source badges wrap, edit mode disabled (read-only) |

Charts must shrink gracefully — Recharts handles this natively if wrapped in `ResponsiveContainer`.

### 13.13 Print / PDF rendering

The entire report scroll area should be wrapped in `<div id="report-content">` — both the PDF export and the browser print path snapshot this element.

| Concern | Handling |
|---|---|
| Hide UI chrome | `print:hidden` on Edit/Export buttons, header nav, sidebar |
| Force backgrounds | `print:bg-slate-200` on icon containers (some printers strip backgrounds) |
| Avoid page breaks mid-card | `break-inside: avoid` (Tailwind: `break-inside-avoid`) on each Card |
| Keep charts visible | Recharts SVG renders fine; html2canvas captures it; ensure no `overflow: hidden` on parent |

### 13.14 Accessibility

- All charts must have a text-alternative — render the underlying numbers below the chart in a small "Data" disclosure block (also helps when charts fail to render).
- Confidence and priority badges: don't rely on color alone — include the text label.
- Edit mode: all inline editors must be keyboard-navigable (Tab/Shift+Tab) with visible focus rings.
- Source links should have `aria-label` describing the source publication, not just the bare hostname.
- Sufficient contrast on confidence/priority badges (the colors above all clear WCAG AA on white backgrounds).

### 13.15 Loading and empty states

| State | Display |
|---|---|
| No report generated yet | Empty hero with CTA: "Generate your first market intelligence report" |
| Report generating | Progress stepper (§13.10) + skeleton placeholders for each card |
| Section has `confidence: "low"` and minimal data | Render the card with low-confidence styling and a subtle "Limited data available" message — don't hide it |
| Report failed | Show the partial data that did make it through, plus a banner: "Report generation failed at {stage}. [Retry]" |
| Empty source list | Hide the source footer entirely (don't render an empty "Sources:" label) |

### 13.16 Suggested component file layout

```
src/components/report/
  ReportDisplay.tsx          # main container, orchestrates all sections
  ReportHeader.tsx           # job context + meta chips
  ExecutiveSummary.tsx       # the lead paragraph
  sections/
    DemandAnalysis.tsx
    TalentAvailability.tsx
    SalaryBenchmarks.tsx
    SkillAvailability.tsx    # the differentiated card
    CompetitorAnalysis.tsx
    JoiningTimelines.tsx
    TalentReputation.tsx
    KeyTrends.tsx
    PositioningRecommendations.tsx
  charts/
    DemandPieChart.tsx
    SalaryRangeChart.tsx
    TalentFunnelChart.tsx
    HiringTimelineChart.tsx
    SkillAvailabilityTable.tsx
    LocationDemandChart.tsx
    TalentReputationChart.tsx
    HorizontalBarChart.tsx
  shared/
    ConfidenceBadge.tsx
    PriorityBadge.tsx
    SourceLinks.tsx
    SectionCard.tsx          # the wrapper that gives every section the §13.5 skeleton
  edit/
    EditableText.tsx
    EditableTextarea.tsx
    EditableList.tsx
    EditableCompanyRows.tsx
    EditableReputationRows.tsx
    EditableSkillRows.tsx
  export/
    ExportButtons.tsx
    PdfExporter.tsx          # html2canvas + jsPDF, branded
    XlsxExporter.tsx
    ZipBundler.tsx
  progress/
    AgentProgressStepper.tsx
```

This mirrors the Zeople MI / miv2 codebase structure and keeps each section independently testable and replaceable.

---

## 14. Verbatim assets

Drop-in artifacts that the implementer (Claude Code or a human) should use as-is rather than re-derive from the algorithm description. These are battle-tested in the reference implementation.

### 14.1 Target stack declaration

> **Action item for the implementer:** Replace the placeholder below with the actual stack used by `recruiter-call-app` before generating code. The choice affects file paths, deployment targets, and SDK syntax.

```yaml
# Recruiter-call-app stack — fill in before handing off
language: <TypeScript | Python>
framework: <Next.js 15 | Vite + Express | FastAPI | Hono | other>
database: <Postgres | Supabase | SQLite | other>
deployment: <Vercel | Railway | self-hosted | other>
auth: <Clerk | Supabase Auth | NextAuth | none/custom>
ui_framework: <shadcn/ui + Tailwind | Mantine | Chakra | custom>
```

The algorithm in §1–§13 is stack-agnostic. The Anthropic SDK code in §12 is shown in TypeScript syntax but the official Python SDK has identical method names — translate by SDK convention.

### 14.2 Reference implementation

There is a working reference implementation that the implementer can read for any detail not covered here:

```
Location: C:/Users/Admin/zeople-mi
Variant:  C:/Users/Admin/miv2-aa0ae301  (adds branded PDF export — recommended)
```

The two codebases are byte-for-byte identical except for the PDF export. Files of particular interest:

| File | What's there |
|---|---|
| `supabase/functions/research-agent/index.ts` | Stage 2 — original research prompts (verbatim text in §14.3 / §14.4 below) |
| `supabase/functions/structure-agent/index.ts` | Stage 3 — structurer prompts and the JSON schema this skill is based on |
| `supabase/functions/parse-jd/index.ts` | Stage 0 — JD parser with enum allowlists |
| `supabase/functions/generate-report/index.ts` | Stage 4 — exec summary |
| `supabase/functions/enrich-reputation/index.ts` | Stage 5 — Glassdoor refresh |
| `src/components/ReportDisplay.tsx` | UI shell — section ordering, edit mode wiring |
| `src/components/charts/` | Recharts wrappers per chart type |
| `miv2-aa0ae301/src/components/ExportButtons.tsx` | The branded PDF exporter |

> **Note for the implementer:** The reference implementation calls Perplexity + Gemini via Supabase Edge Functions. This spec replaces those vendors with Claude (§12). Read the reference for **prompt content, JSON shape, UI layout, and post-processing rules** — not for SDK call sites or vendor wiring.

### 14.3 Stage 2 — research system prompt (verbatim)

Use this as `system` in the Stage 2 Claude API call. Paired with `cache_control: {type: "ephemeral"}` so it's cached across reports.

```
You are an expert recruitment market research analyst specializing in the Indian hiring market.
Your responses MUST include SPECIFIC NUMBERS and DATA - never vague statements.

CRITICAL DATA REQUIREMENTS - You MUST provide:
1. TALENT POOL: Specific numbers (e.g., "45,000 professionals with this skill set in Bangalore")
2. SALARY DATA: Exact figures in LPA format (e.g., "Min: 8 LPA, Median: 15 LPA, 75th percentile: 22 LPA, Max: 35 LPA")
3. COMPANIES: Name 8-12 specific companies actively hiring with approximate open positions
4. NOTICE PERIODS: Typical ranges (e.g., "60-90 days for senior roles, 30 days for mid-level")
5. TIME TO HIRE: Realistic timelines (4-8 weeks typical)
6. GROWTH RATES: Percentage figures for demand growth

MANDATORY SOURCE DIVERSITY - Use data from ALL these categories:
PRIMARY JOB PORTALS (cite specific data from each):
- Naukri.com (largest Indian job portal - cite job posting counts, trends)
- LinkedIn India (professional network - cite talent pool sizes)
- Glassdoor India (salary data and company reviews)
- Shine.com (job trends)
- TimesJobs (market insights)

SALARY DATABASES (cite specific salary ranges):
- AmbitionBox (Indian salary benchmarks)
- PayScale India (compensation data)
- Glassdoor Salaries (company-specific data)
- Levels.fyi (for tech roles)

INDUSTRY REPORTS (cite for trends and forecasts):
- TeamLease Employment Reports
- Michael Page India Salary Guide
- Mercer India Compensation Survey
- Aon Hewitt Salary Increase Survey
- NASSCOM reports (for IT/Tech)
- Deloitte India HR Trends
- KPMG India Workforce Reports

CRITICAL: Do NOT over-rely on Indeed.com. It has limited India coverage. Prioritize Naukri and LinkedIn.

Structure your response with these EXACT sections:
1. DEMAND ANALYSIS - Include job posting counts, YoY growth %, hot locations with numbers
2. TALENT AVAILABILITY - Total pool size, active vs passive split, city-wise breakdown with numbers
3. SALARY BENCHMARKS - Min, 25th percentile, Median, 75th percentile, Max (all in LPA)
4. COMPETITOR COMPANIES - List 8-12 companies with approximate open positions
5. JOINING TIMELINES - Notice periods, time-to-hire estimates, buyout trends
6. TALENT REPUTATION - Glassdoor ratings (out of 5) for top 3-5 companies hiring this role, include employee recommendation percentages
7. POSITIONING RECOMMENDATIONS - Strategic advice based on market data
8. OVERALL ROLE AVAILABILITY - Combined talent availability for candidates with ALL required skills together
```

### 14.4 Stage 2 — research user prompt template (verbatim)

Interpolate `JobContext` fields into this template. Do **not** add timestamps, UUIDs, or per-request IDs above the cache breakpoint.

```
Conduct comprehensive Indian recruitment market research for this position:

JOB DETAILS:
- Job Title: {{title}}
- Location: {{location}}
- Industry: {{industry}}
- Experience Level: {{experienceLevel}}
- Employment Type: {{employmentType}}
- Required Skills (ALL must be present): {{mustHaveSkills.join(", ")}}
- Preferred Notice Period: {{noticePeriod || "Standard (60-90 days)"}}
{{detailedJobDescription ? `- Detailed Job Description:\n${detailedJobDescription}\n` : ""}}
RESEARCH REQUIREMENTS - Provide SPECIFIC DATA for each:

1. DEMAND ANALYSIS:
   - Current number of open positions on Naukri.com and LinkedIn
   - Year-over-year growth percentage in job postings
   - Top 5 cities by demand with job counts

2. TALENT AVAILABILITY:
   - Total estimated talent pool with this skill combination
   - Percentage actively looking vs passive candidates
   - Breakdown by Tier 1, Tier 2, Tier 3 cities

3. SALARY BENCHMARKS (in LPA - Lakhs Per Annum):
   - Minimum CTC
   - 25th Percentile
   - Median CTC
   - 75th Percentile
   - Maximum CTC
   Cite sources: AmbitionBox, Glassdoor, PayScale

4. COMPETITOR COMPANIES:
   - List 8-12 companies actively hiring for this role
   - Include approximate number of open positions per company
   - Note any major hiring drives or freezes

5. JOINING TIMELINES:
   - Typical notice period range (30/60/90 days)
   - Expected time-to-hire (aim for 4-8 weeks maximum)
   - Buyout/early release trends
   - Consider that the client prefers candidates with notice period: {{noticePeriod || "Flexible"}}

6. TALENT REPUTATION (CRITICAL - from Glassdoor India):
   - Get Glassdoor ratings (out of 5.0) for the top 3-5 companies actively hiring for this role
   - Include employee recommendation percentages (e.g., "80% would recommend to a friend")
   - Focus on companies mentioned in the competitor analysis section
   - Source: Glassdoor India ratings and reviews

7. POSITIONING RECOMMENDATIONS:
   - How to attract top talent
   - Competitive advantages to highlight
   - Urgency factors

8. OVERALL ROLE AVAILABILITY (CRITICAL):
   - Estimate how many candidates have ALL the required skills combined: {{mustHaveSkills.join(" + ")}}
   - This is typically MUCH smaller than individual skill pools
   - Classify the combined skill set: Vanilla (10,000+), Niche (1,000-10,000), or Super Niche (<1,000)
   - Estimate immediate availability (candidates in notice period or looking)
   - Estimate 30-day and 60-day availability

CITATION REQUIREMENT: Cite at least 5-7 different sources from Naukri, LinkedIn, Glassdoor, AmbitionBox, industry reports. Do NOT rely heavily on Indeed.
```

### 14.5 Stage 3 — structurer system prompt (verbatim)

```
You are a data extraction agent. Extract structured data from research documents.
CRITICAL: Return ONLY valid JSON with no markdown formatting, no explanations, no extra text.
Keep all string values concise (under 200 characters each) to avoid truncation.

IMPORTANT: Extract ACTUAL DATA from the research. If specific numbers are mentioned, use them.
Only use "Not available" if the research truly has no relevant data for that field.
Prefer approximate estimates over "Not available" when the research provides context.
```

### 14.6 Stage 3 — `output_config.format` json_schema (literal, drop-in)

This is the schema to pass to `output_config.format` in the Stage 3 Claude API call. Claude will guarantee the response matches this shape, so no JSON repair pass is needed.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "demandAnalysis",
    "talentAvailability",
    "salaryBenchmarks",
    "competitorAnalysis",
    "joiningTimelines",
    "keyTrends",
    "talentReputation",
    "positioningRecommendations",
    "skillAvailability"
  ],
  "properties": {
    "demandAnalysis": {
      "type": "object",
      "additionalProperties": false,
      "required": ["jobPostingTrends", "growthRate", "hotLocations", "confidence"],
      "properties": {
        "jobPostingTrends": { "type": "string", "description": "Specific trend description with numbers when available" },
        "growthRate": { "type": "string", "description": "Year-over-year percentage, e.g. '15% YoY'" },
        "hotLocations": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "talentAvailability": {
      "type": "object",
      "additionalProperties": false,
      "required": ["totalPool", "activeJobSeekers", "passiveCandidates", "tierCityBreakdown", "confidence"],
      "properties": {
        "totalPool": { "type": "string", "description": "Number estimate, e.g. '25,000 professionals'" },
        "activeJobSeekers": { "type": "string", "description": "Percentage, e.g. '18%'" },
        "passiveCandidates": { "type": "string", "description": "Percentage, e.g. '82%'" },
        "tierCityBreakdown": {
          "type": "object",
          "additionalProperties": { "type": "string" },
          "description": "Map of tier label to percentage, e.g. {\"Tier 1\": \"70%\", \"Tier 2\": \"25%\"}"
        },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "salaryBenchmarks": {
      "type": "object",
      "additionalProperties": false,
      "required": ["minCTC", "percentile25", "medianCTC", "percentile75", "maxCTC", "confidence"],
      "properties": {
        "minCTC": { "type": "string", "description": "Minimum CTC in LPA, e.g. '8 LPA'" },
        "percentile25": { "type": "string" },
        "medianCTC": { "type": "string" },
        "percentile75": { "type": "string" },
        "maxCTC": { "type": "string" },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "competitorAnalysis": {
      "type": "object",
      "additionalProperties": false,
      "required": ["topHiringCompanies", "confidence"],
      "properties": {
        "topHiringCompanies": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name", "openPositions"],
            "properties": {
              "name": { "type": "string" },
              "openPositions": { "type": "string", "description": "Number or estimate, e.g. '45 positions'" }
            }
          }
        },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "joiningTimelines": {
      "type": "object",
      "additionalProperties": false,
      "required": ["averageNoticePeriod", "typicalTimeToHire", "buyoutTrends", "preferredNoticePeriodFit", "confidence"],
      "properties": {
        "averageNoticePeriod": { "type": "string", "description": "e.g. '60-90 days'" },
        "typicalTimeToHire": { "type": "string", "description": "MAXIMUM 8 weeks — enforced post-parse" },
        "buyoutTrends": { "type": "string" },
        "preferredNoticePeriodFit": { "type": "string", "description": "How well the talent pool matches the client's preferred notice period" },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "keyTrends": {
      "type": "object",
      "additionalProperties": false,
      "required": ["trends", "confidence"],
      "properties": {
        "trends": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "talentReputation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["companies", "ratingSource", "confidence"],
      "properties": {
        "companies": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name", "rating"],
            "properties": {
              "name": { "type": "string" },
              "rating": { "type": "number", "description": "0–5 Glassdoor rating" },
              "recommendationRate": { "type": "string", "description": "e.g. '80% recommend'" }
            }
          }
        },
        "ratingSource": { "type": "string", "description": "e.g. 'Glassdoor Rating - India'" },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "positioningRecommendations": {
      "type": "object",
      "additionalProperties": false,
      "required": ["recommendations", "confidence"],
      "properties": {
        "recommendations": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "skillAvailability": {
      "type": "object",
      "additionalProperties": false,
      "required": ["skills", "confidence"],
      "properties": {
        "skills": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1,
          "description": "EXACTLY ONE row representing the combined-skill pool — not per-skill rows",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["skill", "skillType", "experienceRange", "location", "availableProfiles", "immediate", "thirtyDays", "sixtyDays", "notes"],
            "properties": {
              "skill": { "type": "string", "description": "e.g. 'Overall: Senior NetSuite Consultant'" },
              "skillType": { "type": "string", "enum": ["Vanilla", "Niche", "Super Niche"] },
              "experienceRange": { "type": "string" },
              "location": { "type": "string" },
              "availableProfiles": { "type": "string", "description": "Total candidates with ALL required skills combined" },
              "immediate": { "type": "string", "description": "Candidates in notice period or actively looking" },
              "thirtyDays": { "type": "string" },
              "sixtyDays": { "type": "string" },
              "notes": { "type": "string", "description": "Why this classification was chosen" }
            }
          }
        },
        "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    }
  }
}
```

**Field that is NOT in the schema but is added post-parse:** `sources: string[]` on every section. The implementer extracts citation URLs from the Stage 2 research response (`web_search` citation blocks) and injects them into each section's `sources` field after Claude returns the structured data. See §6 step 6.

### 14.7 Stage 3 — structurer user prompt template (verbatim)

```
Extract structured data from this research about "{{title}}" in {{location}}.
Required Skills: {{mustHaveSkills.join(", ") || "Not specified"}}
Experience Level: {{experienceLevel || "Not specified"}}
Preferred Notice Period: {{noticePeriod || "Flexible"}}
{{detailedJobDescription ? `Detailed Job Description:\n${detailedJobDescription.substring(0, 1000)}\n` : ""}}
Research content:
{{researchDocument.content.substring(0, 6000)}}

CRITICAL INSTRUCTIONS for skillAvailability:
- Create ONLY ONE ROW for the overall role, NOT separate rows per skill
- The "skill" field should be "Overall: {{title}}"
- Classify based on candidates who have ALL these skills TOGETHER: {{mustHaveSkills.join(" + ")}}
- This combined pool is typically MUCH SMALLER than individual skill pools
- Classification guide:
  * Vanilla (10,000+): Common skill combinations, easy to find
  * Niche (1,000-10,000): Specialized but available, moderate search effort
  * Super Niche (<1,000): Rare combination, difficult to find, premium compensation needed
- The notes should explain why the classification was chosen

CRITICAL: typicalTimeToHire MUST be 8 weeks maximum. Cap any longer estimate at 8 weeks.
```

> When using `output_config.format` with Claude, you do **not** need to include the literal JSON shape in the user prompt — the schema enforces it. The original Gemini-based implementation embedded the shape inline because Gemini lacked schema-validated output. With Claude, the prompt only needs to instruct on content (the rules above), not structure.

### 14.8 Stage 0 — JD parser enum allowlists (verbatim)

These are the enum values for `extract_job_fields` in §12.8. Server-side validation drops any value not in this list.

```ts
const ALLOWED_VALUES = {
  industries: [
    "Information Technology", "Financial Services", "Healthcare & Pharma",
    "E-commerce & Retail", "Manufacturing", "Consulting", "Telecommunications",
    "BFSI", "Education & EdTech", "Media & Entertainment", "Automotive",
    "Real Estate", "Energy & Utilities", "Other",
  ],
  employmentTypes: ["Full-time", "Contract", "Part-time", "Freelance", "Internship"],
  experienceLevels: [
    "Fresher (0-1 years)", "Junior (1-3 years)", "Mid-level (3-5 years)",
    "Senior (5-8 years)", "Lead (8-12 years)", "Principal/Architect (12+ years)",
    "Director/VP Level",
  ],
  noticePeriods: ["Immediate", "15 days", "30 days", "45 days", "60 days", "90 days"],
  locations: [
    "Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Pune", "Chennai",
    "Kolkata", "Ahmedabad", "Jaipur", "Chandigarh", "Kochi", "Indore",
    "Coimbatore", "Remote (India)", "Pan India",
  ],
};
```

### 14.9 Stage 4 — exec summary prompt (verbatim)

System:
```
You are an executive report writer. Write concise, professional summaries for business executives.
```

User:
```
Write a 3-4 sentence executive summary for this recruitment market intelligence report:

Job: {{title}}
Location: {{location}}
Industry: {{industry}}
Experience: {{experienceLevel}}
Preferred Notice Period: {{noticePeriod || "Flexible"}}
{{detailedJobDescription ? `\nRole Overview: ${detailedJobDescription.substring(0, 300)}...` : ""}}

Key findings:
- Salary range: {{salaryBenchmarks.minCTC}} to {{salaryBenchmarks.maxCTC}}
- Demand: {{demandAnalysis.jobPostingTrends}}
- Top trends: {{keyTrends.trends.slice(0, 2).join(", ")}}
- Joining timeline: {{joiningTimelines.typicalTimeToHire}}

Write ONLY the summary paragraph, no headers or formatting. Include a reference to the notice period considerations if relevant.
```

### 14.10 Database schema (PostgreSQL DDL)

Minimum table for the `reports` row referenced throughout the spec. The `report_data` JSONB column stores the full `ReportData` object after generation completes.

```sql
CREATE TABLE reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL,           -- FK to your auth users table
  job_title                   TEXT NOT NULL,
  location                    TEXT NOT NULL,
  client_name                 TEXT,
  industry                    TEXT NOT NULL,
  employment_type             TEXT NOT NULL,
  experience_level            TEXT NOT NULL,
  must_have_skills            TEXT[] NOT NULL,
  detailed_job_description    TEXT,
  notice_period               TEXT,
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'completed', 'failed')),
  report_data                 JSONB,                   -- full ReportData after generation
  failure_reason              TEXT,                    -- populated when status='failed'
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reports_user_id_created_at_idx ON reports (user_id, created_at DESC);
CREATE INDEX reports_status_idx ON reports (status) WHERE status != 'completed';
```

For SQLite or other engines, translate types accordingly (`UUID` → `TEXT`, `JSONB` → `TEXT`/`BLOB`, `TEXT[]` → `TEXT` with JSON encoding).

### 14.11 What's intentionally left to the implementer

These are choices that depend on `recruiter-call-app`'s existing patterns and should not be prescribed by this spec:

- Auth wiring (Clerk middleware, Supabase RLS policies, NextAuth callbacks, etc.)
- API route paths and HTTP method conventions
- Error response envelope (shape of error JSON returned to the UI)
- Rate limiting strategy
- Logging / observability backend (console, Sentry, Datadog, Vercel logs)
- Testing framework and test data fixtures
- CI/CD pipeline
- Specific Tailwind theme tokens (colors, fonts) — §13 describes the visual language using semantic Tailwind colors; map them to the project's existing design tokens.
