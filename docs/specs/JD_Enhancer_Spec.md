# JD Enhancer — Implementation Spec

A recruiter-facing module that takes a raw job description and generates 5 AI-powered recruitment assets using Claude (Anthropic). Supports save/load, per-asset regeneration with manual instructions, inline editing, and Word/PDF export.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Backend — Edge Function](#3-backend--edge-function-enhance-job)
4. [Frontend — UI Flow](#4-frontend--ui-flow)
5. [The 5 Output Assets](#5-the-5-output-assets)
6. [Claude Prompts](#6-claude-prompts)
7. [Client Notes Highlighting](#7-client-notes-highlighting)
8. [Per-Tab Actions](#8-per-tab-actions)
9. [Save / Load System](#9-save--load-system)
10. [Download System (Word + PDF)](#10-download-system-word--pdf)
11. [Database Schema](#11-database-schema)
12. [Key Design Decisions](#12-key-design-decisions)
13. [Dependencies](#13-dependencies)

---

## 1. Feature Overview

The JD Enhancer takes a job description (pasted text or uploaded file) plus optional recruiter inputs, and generates 5 assets:

| Asset | Purpose |
|---|---|
| **Formatted JD** | Professional, markdown-formatted rewrite of the raw JD |
| **Recruiter Brief** | Layman-friendly breakdown for non-technical recruiters (≤250 words) |
| **Clarification Questions** | 7-category Q&A for recruiters to ask the client |
| **Reachout Material** | WhatsApp/LinkedIn/call pitch scripts + phone screening questions |
| **Sourcing Keywords** | Primary/secondary keyword lists + Boolean search strings |

After generation, the recruiter can:
- Regenerate any single asset (with or without custom instructions)
- Inline-edit any asset
- Download any asset individually or all together (Word or PDF, with company logo)
- Save the full set to a named record and reload it later

---

## 2. Architecture Overview

```
Browser
  │
  ├─ StandaloneJDEnhancer.tsx        (main UI component)
  │     ├─ Input form (JD text / file upload / client notes / company script)
  │     ├─ 5-tab results view
  │     ├─ Save/Load panel (jd_enhancements table)
  │     └─ Download dialog (DownloadDialog.tsx)
  │
  └─ supabase.functions.invoke("enhance-job", { body })
        │
        └─ enhance-job/index.ts        (Deno edge function)
              └─ Anthropic API — claude-sonnet-4-6
                    ├─ formattedJD call
                    ├─ recruiterBrief call
                    ├─ clarificationQuestions call
                    ├─ reachoutMaterial call
                    └─ sourcingKeywords call
```

The module also exists as **Step 2 inside an Agentic Mode workflow** (`StepEnhanceJD.tsx`), where it receives `jobId` from a session and pulls the job object from the database. Both surfaces call the same edge function.

---

## 3. Backend — Edge Function (`enhance-job`)

**Runtime:** Deno (Supabase Edge Functions)  
**Model:** `claude-sonnet-4-6` via direct Anthropic API (`https://api.anthropic.com/v1/messages`)  
**Auth:** `ANTHROPIC_API_KEY` environment variable

### 3.1 Request Schema

```typescript
// Normal asset generation mode
{
  job: {
    title: string;
    department: string;
    location: string;
    employment_type: string;       // "Full-time" | "Contract" | etc.
    description?: string;          // raw JD text
    salary_min?: number;           // in local currency units (e.g. INR)
    salary_max?: number;
    experience_min?: number;       // years
    experience_max?: number;
    required_skills?: string[];
    preferred_skills?: string[];
    client_name?: string;
    openings_count?: number;
  };
  clientNotes?: string;            // extra requirements to highlight
  companyScript?: string;          // recruiter company intro for reachout msgs
  fields?: string[];               // if set, only generate these assets
  manualInput?: string;            // extra instructions appended to all selected prompts
}

// Parse-fields mode (extract structured data from raw JD text)
{
  mode: "parse_fields";
  description: string;             // raw JD text to parse
}
```

### 3.2 Response Schema

```typescript
// Normal mode
{
  formattedJD?: string;            // markdown string
  recruiterBrief?: string;         // markdown string
  clarificationQuestions?: {
    domainAndIndustry: Question[];
    primarySkills: Question[];
    secondarySkills: Question[];
    projectsAndExperience: Question[];
    processAndTimeline: Question[];
    compensationAndBenefits: Question[];
    otherClarifications: Question[];
  };
  reachoutMaterial?: {
    companyScript?: string;
    whatsapp: string;
    linkedin: string;
    pitch: string;
    questions: {
      phoneScreening: ScreeningQuestion[];
      sourcingFocus: string[];
    };
  };
  sourcingKeywords?: {
    primaryKeywords: string[];
    secondaryKeywords: string[];
    booleanStrings: string[];
    skillOnlyBooleanStrings: string[];  // exactly 2 strings, skills/tech only
    exclusions: string[];
  };
}

// parse_fields mode
{
  fields: {
    title: string | null;
    department: string | null;
    location: string | null;
    employment_type: string | null;
    experience_min: number | null;
    experience_max: number | null;
    salary_min: number | null;
    salary_max: number | null;
    client_name: string | null;
    end_client_name: string | null;
    openings_count: number | null;
    required_skills: string[];
    preferred_skills: string[];
    description: string;
  }
}

// Shared types
interface Question {
  question: string;
  rationale: string;   // 1-2 sentences why this matters
  response: string;    // always "" — filled in by recruiter later
}

interface ScreeningQuestion {
  question: string;
  idealAnswer: string;
  explanation: string;
  validationCues: string[];
}
```

### 3.3 Selective Regeneration

When `fields` is set (e.g. `fields: ["formattedJD"]`), only that asset's Claude call runs. This is how per-tab regeneration works without re-running all 5 calls.

### 3.4 Manual Input Injection

When `manualInput` is set, this string is appended to the user prompt of every selected asset call:

```
\n\nAdditional User Instructions (incorporate these into your output):\n{manualInput}
```

### 3.5 Error Handling

| HTTP Status | Condition | Response body |
|---|---|---|
| 429 | Anthropic rate limit | `{ error: "Rate limit exceeded. Please try again in a moment." }` |
| 402 | Anthropic payment required | `{ error: "AI credits exhausted. Please add funds to continue." }` |
| 500 | Any other error | `{ error: error.message }` |

### 3.6 JSON Parsing Strategy

Claude sometimes wraps JSON in markdown fences. The edge function tries three strategies:

```typescript
function parseJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch {} }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
  return text;  // fallback: return raw string
}
```

---

## 4. Frontend — UI Flow

### 4.1 Input Form State

```typescript
const [jdText, setJdText] = useState("");
const [clientNotes, setClientNotes] = useState("");
const [companyScript, setCompanyScript] = useState("");   // persisted to localStorage
const [results, setResults] = useState<AgentResults | null>(null);
const [loading, setLoading] = useState(false);
const [step, setStep] = useState(0);                      // cosmetic progress 0–4
```

### 4.2 File Upload

Supports `.txt`, `.pdf`, `.docx`:
- `.txt` — `file.text()` directly into `jdText`
- `.pdf` / `.docx` — call `extract-text` edge function (FormData) → get plain text back

### 4.3 Generation Flow

```typescript
const handleGenerate = async () => {
  // 1. Validate jdText not empty
  // 2. Build a "virtual job" object with description = jdText
  //    (title: "Position", department: "General", location: "Not specified", etc.)
  // 3. Start cosmetic progress: setInterval advancing step every 4000ms
  // 4. Call enhance-job edge fn
  // 5. clearInterval, setResults(data)
};
```

The progress bar cycles through 5 label strings:
```
"Generating Formatted JD..."
"Creating Recruiter Brief..."
"Preparing Clarification Questions..."
"Building Reachout Material..."
"Extracting Sourcing Keywords..."
```

### 4.4 View States

The component has three views:

1. **Input form** — shown when `!results && !loading`
2. **Loading** — shown when `loading === true`; spinner + step label + 5-dot progress bar
3. **Results** — shown when `results !== null`; tabbed interface with action bar

### 4.5 Results Action Bar

Top of results view:
- **← New Enhancement** — clears `results`, returns to input form
- **Save / Re-save** — inline title input + save button (inserts or updates DB record)
- **Download All** — opens `DownloadDialog`, then generates Word/PDF/both with all 5 assets

---

## 5. The 5 Output Assets

### Formatted JD
- Rendered as Markdown using `react-markdown`
- Client-note-derived sections highlighted in yellow via `[[NOTES_HIGHLIGHT]]` markers
- Edit mode: raw textarea
- Download: Word or PDF

### Recruiter Brief
- Same as Formatted JD (Markdown + highlighting)
- Hard cap: 250 words total
- 7 mandatory sections: Responsibilities, Must-Have Skills, Nice-to-Have Skills, Domain, Company Type, Contract Type, Experience Range

### Clarification Questions
- 7 category groups rendered as card lists
- Each question shows: question text + rationale
- `response` field left blank for recruiter to fill
- Download: Word or PDF (no inline edit mode, regenerate only)

Categories: Domain & Industry, Primary Skills, Secondary Skills, Projects & Experience, Process & Timeline, Compensation & Benefits, Other Clarifications

### Reachout Material
- Rendered as structured cards: Company Script, WhatsApp, LinkedIn, Call Pitch
- Phone Screening Questions: each card shows question, ideal answer, example, validation cue badges
- Sourcing Focus: bulleted list
- Edit mode: separate textareas for whatsapp/linkedin/pitch fields only
- Download: Word or PDF

### Sourcing Keywords
- Primary keywords: secondary badge chips
- Secondary keywords: outline badge chips
- Boolean strings: `<code>` blocks with copy buttons
- Skill-only boolean strings: same as above (exactly 2)
- Exclusions: destructive red badge chips
- Download: Word or PDF (no inline edit)

---

## 6. Claude Prompts

All calls share the same `callAI` function:

```typescript
async function callAI(apiKey, systemPrompt, userPrompt, maxTokens, temperature): Promise<string>
// POST to https://api.anthropic.com/v1/messages
// model: "claude-sonnet-4-6"
// single user message
```

### Job Context Builder

All prompts receive the same structured context block:

```
Title: {title}
Department: {department}
Location: {location}
Employment Type: {employment_type}
Client Name: {client_name}
Openings: {openings_count}
Experience Range: {min} - {max} years
Salary Range: ₹{salary_min} - ₹{salary_max}
Required Skills: {required_skills.join(", ")}
Preferred Skills: {preferred_skills.join(", ")}
Description: {description}

[if clientNotes present:]
Additional Client Notes/Inputs:
{clientNotes}
```

### formattedJD
- **System:** JD rewriting specialist. Rewrite using a template format as structural reference.
- **User:** Template structure: Header (role + location), About the role (250 words), Responsibilities, Must-have skills, Nice-to-have skills, Domain, Company type, Contract/Permanent, Experience range, Interview process.
- Key rules: expand all abbreviations, Indian recruitment context (notice period, CTC in LPA), clean markdown output.
- `maxTokens: 1500`, `temperature: 0.7`

### recruiterBrief
- **System:** Recruitment assistant helping non-technical recruiters understand technical JDs.
- **User:** 7 mandatory sections, hard cap 250 words. Break down all technical jargon. Indian context.
- `maxTokens: 800`, `temperature: 0.7`

### clarificationQuestions
- **System:** Recruitment clarification specialist for Indian staffing companies.
- **User:** Return JSON with 7 arrays. Each item: `{ question, rationale, response: "" }`. Category counts: domainAndIndustry (2-3), primarySkills (4-6), secondarySkills (2-3), projectsAndExperience (2-3), processAndTimeline (2-3), compensationAndBenefits (2-3), otherClarifications (2-3). Return ONLY valid JSON, no markdown fences.
- `maxTokens: 1500`, `temperature: 0.7`

### reachoutMaterial
- **System:** Candidate reachout and briefing agent for Indian recruitment.
- **User:** Return JSON with `whatsapp` (3-4 lines, conversational, emojis), `linkedin` (3-4 lines, professional), `pitch` (structured call script: company intro → opportunity → client info → role details), `questions.phoneScreening` (7-8 items with question/idealAnswer/explanation/validationCues[]), `questions.sourcingFocus` (4-6 bullet strings). MANDATORY: use company script verbatim as company intro in all messages. Return ONLY valid JSON.
- `maxTokens: 6000`, `temperature: 0.8`

### sourcingKeywords
- **System:** Specialized Sourcing Keyword Agent for Indian recruitment.
- **User:** Return JSON: `primaryKeywords` (10-15), `secondaryKeywords` (10-15), `booleanStrings` (5-8 full strings for Naukri/LinkedIn), `skillOnlyBooleanStrings` (EXACTLY 2, skills/tech/frameworks only), `exclusions` (5-8). Return ONLY valid JSON.
- `maxTokens: 800`, `temperature: 0.5`

### parse_fields
- **System:** Job description parser. Extract structured fields. Return ONLY valid JSON.
- **User:** Extract 14 fields (title, department, location, employment_type, experience_min/max, salary_min/max, client_name, end_client_name, openings_count, required_skills[], preferred_skills[], description).
- `maxTokens: 1500`, `temperature: 0.3`

---

## 7. Client Notes Highlighting

When `clientNotes` is non-empty, every prompt gets two injections:

**System prompt suffix (`HIGHLIGHT_SYSTEM`):**
```
CRITICAL RULE: The client has provided additional notes/inputs in the job details. You MUST:
1. Incorporate all client notes into your output
2. Wrap ANY content derived from or addressing the client notes with [[NOTES_HIGHLIGHT]] and [[/NOTES_HIGHLIGHT]] markers
Example: If client notes say "Must know WordPress", your output should include: [[NOTES_HIGHLIGHT]]WordPress experience is required[[/NOTES_HIGHLIGHT]]
This is mandatory — every piece of content influenced by client notes MUST be wrapped with these markers.
```

**User prompt suffix (`highlightUserRule`):**
```
MANDATORY HIGHLIGHTING RULE: The client provided these additional notes: "{clientNotes}"
You MUST wrap all content derived from these notes with [[NOTES_HIGHLIGHT]] and [[/NOTES_HIGHLIGHT]] markers.
Example: [[NOTES_HIGHLIGHT]]derived content here[[/NOTES_HIGHLIGHT]]
Do NOT skip this — every single piece of content influenced by the client notes must be highlighted.
```

**Frontend rendering:**

```typescript
function renderHighlightedMarkdown(text: string) {
  return text.replace(
    /\[\[NOTES_HIGHLIGHT\]\]([\s\S]*?)\[\[\/NOTES_HIGHLIGHT\]\]/g,
    '<mark style="background-color: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>'
  );
}
```

If the rendered string contains `<mark`, render via `dangerouslySetInnerHTML` with `\n` → `<br/>`. Otherwise use `ReactMarkdown`.

**Strip markers before downloads/copy:**
```typescript
function stripMarkers(text: string): string {
  return text.replace(/\[\[NOTES_HIGHLIGHT\]\]|\[\[\/NOTES_HIGHLIGHT\]\]/g, "");
}
```

---

## 8. Per-Tab Actions

Each results tab has a toolbar. All actions except Download are disabled during active regeneration.

### Regenerate (all tabs)

Calls edge fn with `fields: [fieldName]` only — other assets unchanged.

```typescript
const handleRegenerate = async (tab: string, manualInput?: string) => {
  const field = TAB_TO_FIELD[tab];  // e.g. "jd" → "formattedJD"
  setRegenerating({ ...regenerating, [tab]: true });
  const { data } = await supabase.functions.invoke("enhance-job", {
    body: { job: virtualJob, clientNotes, companyScript, fields: [field], manualInput }
  });
  const updated = { ...results, [field]: data[field] };
  setResults(updated);
  // auto-save to DB if record exists
  if (savedId) await supabase.from("jd_enhancements").update({ results: updated }).eq("id", savedId);
};
```

Tab-to-field mapping:
```typescript
const TAB_TO_FIELD = {
  jd: "formattedJD",
  brief: "recruiterBrief",
  questions: "clarificationQuestions",
  reachout: "reachoutMaterial",
  keywords: "sourcingKeywords",
};
```

### Manual Input (all tabs)

Opens a modal with a `<Textarea>` pre-populated with a placeholder specific to that tab. On confirm, calls `handleRegenerate(tab, manualInput)`. Each tab has a tailored placeholder:

- **Formatted JD:** "e.g. Add a remote work flexibility note, expand responsibilities..."
- **Recruiter Brief:** "e.g. Shorten to 3 bullet points per section, emphasise startup culture..."
- **Clarifications:** "e.g. Add more questions about notice period flexibility..."
- **Reachout:** "e.g. Make the WhatsApp message more conversational with emojis..."
- **Keywords:** "e.g. Add React Native variants, include AWS certification terms..."

### Edit (Formatted JD, Recruiter Brief, Reachout)

Switches the tab content to a monospace `<Textarea>` pre-filled with current content. On "Save Changes":
1. Merges `editDraft` into `results`
2. Clears `editingTab`
3. If `savedId` exists, immediately `UPDATE jd_enhancements SET results = ...`

Clarifications and Keywords tabs do not support inline editing (regenerate + manual input only).

### Download (all tabs)

Opens `DownloadDialog` which asks:
1. Optional logo upload (base64 data URL)
2. Format: Word, PDF, or Both

Then calls the appropriate client-side generator function (see Section 10).

---

## 9. Save / Load System

### Database table: `jd_enhancements`

```sql
CREATE TABLE jd_enhancements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  company_id  uuid,
  title       text NOT NULL DEFAULT 'Untitled Enhancement',
  jd_input    text NOT NULL,
  client_notes text,
  results     jsonb NOT NULL,
  created_at  timestamptz DEFAULT now()
);
```

### Save flow

On first save: `INSERT` → store returned `id` as `savedId`.  
On subsequent saves (or after inline edits): `UPDATE WHERE id = savedId`.

```typescript
const handleSave = async () => {
  if (savedId) {
    await supabase.from("jd_enhancements")
      .update({ title, jd_input: jdText, client_notes: clientNotes, results })
      .eq("id", savedId);
  } else {
    const { data } = await supabase.from("jd_enhancements")
      .insert({ user_id, company_id, title, jd_input: jdText, client_notes: clientNotes, results })
      .select("id").single();
    setSavedId(data.id);
  }
};
```

### Load flow

Selecting a saved record from the list:
1. Sets `results`, `jdText`, `clientNotes`, `savedId`, `saveTitle`
2. Switches view back to `"form"` (which shows the results since `results !== null`)

### React Query usage

```typescript
const { data: savedList } = useQuery({
  queryKey: ["jd_enhancements", user?.id],
  queryFn: () => supabase.from("jd_enhancements")
    .select("id, title, jd_input, client_notes, results, created_at")
    .order("created_at", { ascending: false }),
});
```

After any mutation (save/delete), call `queryClient.invalidateQueries(["jd_enhancements", user?.id])`.

### Company Script persistence

`companyScript` is saved to `localStorage` on generate and on explicit "Save Script" click. Read from localStorage on mount:

```typescript
useEffect(() => {
  const saved = localStorage.getItem("companyScript");
  setCompanyScript(saved || DEFAULT_COMPANY_SCRIPT);
}, []);
```

---

## 10. Download System (Word + PDF)

Both formats are generated **entirely client-side**. No server involvement.

### Word (`.docx`) — `docx` library

**Markdown-to-paragraphs conversion:**
```typescript
function mdLinesToParagraphs(content: string): Paragraph[] {
  // "# " → HEADING_1, "## " → HEADING_2, "### " → HEADING_3
  // "- " or "* " → bullet with "• " prefix
  // inline **bold** → bold TextRun
  // all other lines → normal paragraph
}
```

**Logo as section header:**
```typescript
async function buildWordSection(title, paragraphs, logoDataUrl) {
  // fetch logoDataUrl as ArrayBuffer
  // create Header with ImageRun({ data, transformation: { width: 120, height: 38 } })
  // attach to section as headers.default
}
```

**Per-asset generators:**
- `generateWordDoc(title, content, logo)` — for formattedJD, recruiterBrief
- `generateClarificationsDoc(data, logo)` — iterates CATEGORY_LABELS
- `generateReachoutDoc(data, logo)` — sections for companyScript, whatsapp, linkedin, pitch, phoneScreening, sourcingFocus
- `generateKeywordsDoc(data, logo)` — sections for primaryKeywords, secondaryKeywords, booleanStrings, skillOnlyBooleanStrings, exclusions

**Download all assets as single Word doc:**
Concatenates all 5 assets' paragraphs under H1 section headers into one `Document` with a single section.

### PDF — `jsPDF`

**Helper functions:**
```typescript
const PDF_MARGIN = 15;   // mm
const PDF_WIDTH = 210 - PDF_MARGIN * 2;  // A4 width minus margins

function pdfH1(ctx, text, y): number     // fontSize 14, bold, returns new y
function pdfH2(ctx, text, y): number     // fontSize 11, bold
function pdfBody(ctx, text, y, indent?): number  // fontSize 10, normal, word-wrap
function pdfBlank(y): number             // y + 4 (blank line)
function pdfNewPage(ctx): number         // addPage(), stampLogo(), return logoBottomY
```

**Logo stamped on every page:**
```typescript
function stampLogo(ctx: PdfCtx) {
  ctx.doc.addImage(ctx.logo.dataUrl, "PNG", PDF_MARGIN, PDF_MARGIN, logo.w, logo.h);
}
// Called on first page in createPdfCtx(), and on every pdfNewPage()
```

**Auto page break:**  
`pdfBody` checks `if (y + lines.length * 5 > 282) y = pdfNewPage(ctx)` before writing.  
`pdfH1`/`pdfH2` check `if (y > 270) y = pdfNewPage(ctx)`.

**Markdown-to-PDF:**
```typescript
function mdToPdf(ctx, content, startY): number {
  // same heading/bullet logic as mdLinesToParagraphs but using pdf helpers
  // stripMarkers() called first
}
```

**Per-asset PDF generators** mirror the Word versions exactly but use jsPDF helpers instead.

### DownloadDialog component

Prompts the user for:
1. Optional logo (file input → `FileReader` → base64 data URL)
2. Format radio: "Word (.docx)" | "PDF (.pdf)" | "Both"

Calls `onConfirm(logoDataUrl | null, format)`.

---

## 11. Database Schema

### `jd_enhancements`

```sql
CREATE TABLE jd_enhancements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  company_id   uuid REFERENCES companies(id),
  title        text NOT NULL DEFAULT 'Untitled Enhancement',
  jd_input     text NOT NULL,       -- raw JD text the user submitted
  client_notes text,                -- optional client requirements
  results      jsonb NOT NULL,      -- full AgentResults object
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON jd_enhancements (user_id);
CREATE INDEX ON jd_enhancements (company_id);

-- RLS (example)
ALTER TABLE jd_enhancements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own company" ON jd_enhancements
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
```

---

## 12. Key Design Decisions

### Claude calls are sequential, not parallel
All 5 asset calls run one after another in the edge function. This avoids Anthropic rate limits but means total latency is ~15–25 seconds. The UI hides this with a cosmetic progress bar that advances every 4s — the bar is time-based, not tied to actual API progress.

**Alternative if speed is priority:** run all 5 with `Promise.all()` but risk hitting rate limits on burst usage.

### Single edge function, `fields` param for partial runs
Rather than 5 separate endpoints, one function handles everything. The `fields: string[]` parameter restricts which Claude calls run. This keeps the API surface simple and makes regeneration trivial to implement.

### `manualInput` is appended to user prompt
Additional instructions go at the end of the existing user prompt as a clearly labeled block. This is simpler than injecting into the system prompt and tends to work well with Claude's instruction-following.

### Client notes are double-enforced
The highlighting rule appears in both the system prompt AND the user prompt. LLMs are significantly more likely to follow a constraint when it appears in both roles.

### Company script stored in localStorage
The company intro used in reachout messages doesn't change between JDs. Persisting it in localStorage means the recruiter sets it once and never sees it again. It can be overridden per-session via a collapsible "Company Script" section.

### `savedId` tracks insert vs update
After the first save, `savedId` is set to the record's UUID. All subsequent saves — including auto-saves triggered by inline edit or regenerate — check `savedId` and do `UPDATE` instead of `INSERT`. This prevents duplicate records.

### Auto-save after regenerate/edit
When a record is already saved (`savedId` is set), any regeneration or inline edit immediately writes back to the DB. The user doesn't need to manually re-save. If no record exists yet, changes only live in React state until the user explicitly saves.

---

## 13. Dependencies

### Frontend

| Package | Purpose |
|---|---|
| `react-markdown` | Render Markdown output from Claude |
| `docx` | Generate `.docx` files client-side |
| `jspdf` | Generate PDF files client-side |
| `file-saver` | Trigger file downloads (`saveAs`) |
| `@tanstack/react-query` | Fetch and cache saved enhancements list |
| `sonner` | Toast notifications |

### Backend (Deno edge function)

| Import | Purpose |
|---|---|
| `https://deno.land/std@0.168.0/http/server.ts` | `serve()` for Deno HTTP |
| Anthropic REST API (native `fetch`) | Claude API calls — no SDK needed in Deno |

### Optional (file upload support)

| Package | Purpose |
|---|---|
| `extract-text` edge fn | Extract text from PDF/DOCX uploads |
| JSZip (in edge fn) | DOCX text extraction |

---

## Implementation Checklist

- [ ] Create `enhance-job` Deno edge function with all 5 prompt functions
- [ ] Implement `callAI` helper with error handling (429, 402, 500)
- [ ] Implement `parseJSON` with 3-strategy fallback
- [ ] Add `parse_fields` mode for JD import
- [ ] Build input form (textarea + file upload + client notes + company script collapsible)
- [ ] Build loading state with cosmetic progress bar
- [ ] Build 5-tab results view
- [ ] Implement `HighlightedMarkdown` component with marker rendering
- [ ] Implement `stripMarkers` for copy/download
- [ ] Add per-tab Regenerate button with `fields` param
- [ ] Add Manual Input dialog with tab-specific placeholders
- [ ] Add inline Edit mode for text-based tabs
- [ ] Create `DownloadDialog` (logo upload + format selector)
- [ ] Implement Word doc generators (per-asset + download-all)
- [ ] Implement PDF generators with logo-on-every-page support
- [ ] Create `jd_enhancements` table with RLS
- [ ] Implement save (insert/update), load, and delete flows
- [ ] Persist company script to localStorage
- [ ] Wire up React Query for saved list
- [ ] Auto-save on regenerate/edit when record exists
