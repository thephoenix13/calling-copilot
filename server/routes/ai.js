const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helper: extract text from uploaded file or plain text ────────────────────
async function extractText(file, text) {
  if (text && text.trim()) return text.trim();
  if (!file) return '';
  if (file.mimetype === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    return data.text.trim();
  }
  return file.buffer.toString('utf8').trim();
}

// ── POST /ai/generate-questions ──────────────────────────────────────────────
// Body (multipart): jdFile?, jdText?, resumeFile?, resumeText?
router.post(
  '/generate-questions',
  upload.fields([{ name: 'jdFile', maxCount: 1 }, { name: 'resumeFile', maxCount: 1 }]),
  async (req, res) => {
    try {
      const jd = await extractText(req.files?.jdFile?.[0], req.body.jdText);
      const resume = await extractText(req.files?.resumeFile?.[0], req.body.resumeText);

      if (!jd && !resume) {
        return res.status(400).json({ error: 'Provide at least a JD or a resume.' });
      }

      const prompt = `You are an expert technical recruiter. Generate a structured interview guide.

${jd ? `## Job Description\n${jd}\n` : ''}
${resume ? `## Candidate Resume\n${resume}\n` : ''}

Produce a JSON object with this exact shape:
{
  "sections": [
    {
      "title": "Section name",
      "questions": ["Question 1", "Question 2", ...]
    }
  ]
}

Rules:
- 4–6 sections (e.g. Background & Motivation, Technical Skills, Problem Solving, Role-Specific, Culture & Fit, Closing)
- 3–5 questions per section
- Questions should be specific to the JD and resume provided
- Return ONLY the JSON, no markdown fences`;

      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = response.content.find(b => b.type === 'text')?.text || '{}';
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Try to extract JSON from response
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { sections: [] };
      }

      res.json(parsed);
    } catch (err) {
      console.error('generate-questions error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /ai/suggest ─────────────────────────────────────────────────────────
// Body (JSON): { transcript: [{speaker, text}], currentQuestion: string }
router.post('/suggest', express.json(), async (req, res) => {
  try {
    const { transcript = [], currentQuestion = '' } = req.body;

    // Only look at last ~6 candidate utterances for context
    const candidateLines = transcript
      .filter(e => e.speaker === 'Candidate' && e.isFinal !== false)
      .slice(-6)
      .map(e => `Candidate: ${e.text}`)
      .join('\n');

    if (!candidateLines) {
      return res.json({ suggestions: [] });
    }

    const prompt = `You are a live interview coach helping a recruiter. Based on what the candidate just said, suggest 2–3 sharp follow-up questions the recruiter should ask next.

${currentQuestion ? `Current question being discussed: "${currentQuestion}"\n` : ''}
Recent candidate responses:
${candidateLines}

Rules:
- Return ONLY a JSON array of strings, e.g. ["Question 1?", "Question 2?"]
- Keep questions concise (under 20 words each)
- Dig deeper into what the candidate said, probe for specifics or examples
- No markdown, no extra text`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content.find(b => b.type === 'text')?.text || '[]';
    let suggestions;
    try {
      suggestions = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      suggestions = match ? JSON.parse(match[0]) : [];
    }

    res.json({ suggestions: Array.isArray(suggestions) ? suggestions : [] });
  } catch (err) {
    console.error('suggest error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/sim-reply ───────────────────────────────────────────────────────
// Body (JSON): { recruiterMessage, transcript, role, candidateName, jd, resume }
// Claude plays the candidate and replies conversationally
router.post('/sim-reply', express.json(), async (req, res) => {
  try {
    const { recruiterMessage, transcript = [], role = 'the role', candidateName = 'the candidate', jd = '', resume = '' } = req.body;

    if (!recruiterMessage || !recruiterMessage.trim()) {
      return res.status(400).json({ error: 'recruiterMessage is required.' });
    }

    // Build multi-turn history from last 10 exchanges (Recruiter → user, Candidate → assistant)
    const history = transcript
      .filter(e => e.isFinal !== false)
      .slice(-10)
      .map(e => ({
        role: e.speaker === 'Recruiter' ? 'user' : 'assistant',
        content: e.text,
      }));

    // Ensure history alternates properly and starts with user; drop leading assistant turns
    const safeHistory = [];
    let expectUser = true;
    for (const turn of history) {
      if (expectUser && turn.role === 'user') { safeHistory.push(turn); expectUser = false; }
      else if (!expectUser && turn.role === 'assistant') { safeHistory.push(turn); expectUser = true; }
    }
    // Always append the new recruiter message as user
    safeHistory.push({ role: 'user', content: recruiterMessage });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are ${candidateName}, a job candidate being interviewed for the position of ${role}.
Respond naturally and conversationally — like a real person in a phone interview. Keep replies to 2–4 sentences.
Be authentic: give relevant experience, occasionally ask for clarification on vague questions, show some personality.
${jd ? `\nJob context: ${jd.slice(0, 600)}` : ''}
${resume ? `\nYour background: ${resume.slice(0, 600)}` : ''}`,
      messages: safeHistory.length > 0 ? safeHistory : [{ role: 'user', content: recruiterMessage }],
    });

    const candidateReply = response.content.find(b => b.type === 'text')?.text?.trim() || '';
    res.json({ candidateReply });
  } catch (err) {
    console.error('sim-reply error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/generate-reports ─────────────────────────────────────────────────
// Body (JSON): { transcript, role, candidateName, recruiterName, jd, resume }
// Returns { qaReport, candidateReport } generated from the real transcript
router.post('/generate-reports', express.json(), async (req, res) => {
  try {
    const {
      transcript = [],
      role = 'the role',
      candidateName = 'Candidate',
      recruiterName = 'Recruiter',
      jd = '',
      resume = '',
    } = req.body;

    if (transcript.filter(e => e.isFinal !== false).length === 0) {
      return res.status(400).json({ error: 'Transcript is empty.' });
    }

    const lines = transcript
      .filter(e => e.isFinal !== false)
      .map(e => `${e.speaker}: ${e.text}`)
      .join('\n');

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const callId = `CALL-SIM-${String(today.getFullYear()).slice(2)}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;

    const prompt = `You are a senior recruitment analyst. Analyze the following interview transcript and produce two structured JSON reports.

Role: ${role}
Candidate: ${candidateName}
Recruiter: ${recruiterName}
Date: ${dateStr}
${jd ? `\nJob Description (excerpt):\n${jd.slice(0, 800)}` : ''}
${resume ? `\nResume (excerpt):\n${resume.slice(0, 800)}` : ''}

Transcript:
${lines}

Return a single JSON object with exactly two keys: "qaReport" and "candidateReport".

"qaReport" must match this shape exactly:
{
  "meta": { "recruiter": "${recruiterName}", "recruiterInitials": "XX", "date": "${dateStr}", "time": "${timeStr}", "duration": "estimated", "candidate": "${candidateName}", "role": "${role}", "client": "Demo", "callId": "${callId}" },
  "summary": { "score": <0-100 int>, "rawScore": <int>, "maxScore": 100, "verdict": "<word>", "riskLevel": "<Low|Medium|High>", "outcome": "<phrase>" },
  "scorecard": [
    { "id": 1, "dimension": "Opening & Positioning", "weight": "10%", "score": <0-15>, "max": 15, "pct": <0-100>, "evidence": "<string>", "quote": "<actual quote from transcript or empty string>", "status": "<pass|warn|fail>" },
    { "id": 2, "dimension": "Communication & Clarity", "weight": "15%", "score": <0-20>, "max": 20, "pct": <0-100>, "evidence": "<string>", "quote": "<quote>", "status": "<pass|warn|fail>" },
    { "id": 3, "dimension": "Role Selling & Value Prop", "weight": "15%", "score": <0-15>, "max": 15, "pct": <0-100>, "evidence": "<string>", "quote": "<quote>", "status": "<pass|warn|fail>" },
    { "id": 4, "dimension": "Candidate Assessment", "weight": "20%", "score": <0-20>, "max": 20, "pct": <0-100>, "evidence": "<string>", "quote": "<quote>", "status": "<pass|warn|fail>" },
    { "id": 5, "dimension": "Active Listening", "weight": "15%", "score": <0-15>, "max": 15, "pct": <0-100>, "evidence": "<string>", "quote": "<quote>", "status": "<pass|warn|fail>" },
    { "id": 6, "dimension": "Process & Next Steps", "weight": "10%", "score": <0-10>, "max": 10, "pct": <0-100>, "evidence": "<string>", "quote": "<quote>", "status": "<pass|warn|fail>" },
    { "id": 7, "dimension": "Professionalism", "weight": "10%", "score": <0-10>, "max": 10, "pct": <0-100>, "evidence": "<string>", "quote": "<quote>", "status": "<pass|warn|fail>" },
    { "id": 8, "dimension": "Close & Candidate Experience", "weight": "5%", "score": <0-5>, "max": 5, "pct": <0-100>, "evidence": "<string>", "quote": "<quote>", "status": "<pass|warn|fail>" }
  ],
  "redFlags": [ { "severity": "<critical|high|medium>", "text": "<string>" } ],
  "nudges": [ { "label": "<short label>", "icon": "💡", "weak": "<example of weak phrasing from transcript>", "better": "<improved version>", "why": "<one sentence explanation>" } ]
}

"candidateReport" must match this shape exactly:
{
  "meta": { "candidate": "${candidateName}", "initials": "XX", "role": "${role}", "client": "Demo", "recruiter": "${recruiterName}", "date": "${dateStr}", "time": "${timeStr}", "duration": "estimated", "reportId": "CER-SIM-${callId.slice(-8)}", "experience": "unknown", "currentCompany": "unknown", "currentTitle": "unknown", "location": "unknown", "currentCTC": "unknown", "expectedCTC": "unknown", "budgetRange": "unknown", "noticePeriod": "unknown", "linkedIn": "" },
  "verdict": { "score": <0-100>, "label": "<HIRE|HOLD|NO_HIRE>", "confidence": "<Low|Medium|High>", "nextStep": "<string>", "riskLevel": "<Low|Medium|High>", "compensationFit": "<YES|NO|UNKNOWN>" },
  "technical": [
    { "id": 1, "area": "Technical Knowledge", "score": <0-20>, "max": 20, "pct": <0-100>, "status": "<pass|warn|fail>", "weight": "20%", "notes": "<string>", "quote": "<quote or empty>" },
    { "id": 2, "area": "Communication", "score": <0-20>, "max": 20, "pct": <0-100>, "status": "<pass|warn|fail>", "weight": "20%", "notes": "<string>", "quote": "<quote or empty>" },
    { "id": 3, "area": "Role Fit", "score": <0-15>, "max": 15, "pct": <0-100>, "status": "<pass|warn|fail>", "weight": "15%", "notes": "<string>", "quote": "<quote or empty>" },
    { "id": 4, "area": "Problem Solving", "score": <0-15>, "max": 15, "pct": <0-100>, "status": "<pass|warn|fail>", "weight": "15%", "notes": "<string>", "quote": "<quote or empty>" },
    { "id": 5, "area": "Experience Relevance", "score": <0-15>, "max": 15, "pct": <0-100>, "status": "<pass|warn|fail>", "weight": "15%", "notes": "<string>", "quote": "<quote or empty>" },
    { "id": 6, "area": "Culture & Attitude", "score": <0-10>, "max": 10, "pct": <0-100>, "status": "<pass|warn|fail>", "weight": "10%", "notes": "<string>", "quote": "<quote or empty>" },
    { "id": 7, "area": "Compensation & Notice", "score": <0-5>, "max": 5, "pct": <0-100>, "status": "<pass|warn|fail>", "weight": "5%", "notes": "<string>", "quote": "<quote or empty>" }
  ],
  "behavioral": [
    { "trait": "Ownership", "rating": <0-5>, "max": 5, "note": "<string>" },
    { "trait": "Communication", "rating": <0-5>, "max": 5, "note": "<string>" },
    { "trait": "Collaboration", "rating": <0-5>, "max": 5, "note": "<string>" },
    { "trait": "Learning Agility", "rating": <0-5>, "max": 5, "note": "<string>" },
    { "trait": "Culture Fit", "rating": <0-5>, "max": 5, "note": "<string>" }
  ],
  "strengths": [ "<string>", "<string>", "<string>" ],
  "concerns": [ { "level": "<high|medium|low>", "text": "<string>" } ],
  "highlights": [ { "speaker": "<Recruiter|Candidate>", "text": "<notable quote from transcript>" } ],
  "compensation": { "current": "unknown", "expected": "unknown", "budget": "unknown", "fit": "<YES|NO|UNKNOWN>", "note": "<string>" },
  "recommendation": { "action": "<string>", "detail": "<string>", "panel": [ "<name1>", "<name2>", "<name3>" ] }
}

Rules:
- Use ONLY information from the transcript. Do not invent facts not present.
- For quote fields, use actual verbatim text from the transcript (or empty string if nothing fits).
- All arrays must have at least one item.
- Return ONLY the JSON object. No markdown, no fences, no explanation.`;

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content.find(b => b.type === 'text')?.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    if (!parsed.qaReport || !parsed.candidateReport) {
      return res.status(500).json({ error: 'Report generation returned incomplete data.' });
    }

    res.json({ qaReport: parsed.qaReport, candidateReport: parsed.candidateReport });
  } catch (err) {
    console.error('generate-reports error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/check-ai-content ────────────────────────────────────────────────
// Body (JSON): { text: string }
// Returns { verdict, confidence, indicators, summary }
router.post('/check-ai-content', express.json(), async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length < 100) {
      return res.status(400).json({ error: 'text is required and must be at least 100 characters.' });
    }

    const truncated = text.trim().slice(0, 3000);

    const prompt = `Analyze the following resume or profile text and determine whether it was written by a human or generated/heavily edited by AI.

Text:
${truncated}

Evaluate based on:
- Sentence structure variety (AI tends to be uniform)
- Use of generic filler phrases (AI overuses: "proven track record", "results-driven", "passionate about", "leverage", "spearhead", "dynamic")
- Specificity vs vagueness (humans include concrete details; AI inflates with abstractions)
- Tense/voice consistency
- Presence of natural human imperfections vs polished uniformity

Return ONLY a JSON object (no markdown):
{
  "verdict": "human" | "likely_human" | "mixed" | "likely_ai" | "ai_generated",
  "confidence": <0-100 integer>,
  "indicators": ["up to 5 brief specific signals"],
  "summary": "1-2 sentence explanation of the verdict"
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content.find(b => b.type === 'text')?.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const { verdict, confidence, indicators, summary } = parsed;
    res.json({ verdict, confidence, indicators, summary });
  } catch (err) {
    console.error('check-ai-content error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
