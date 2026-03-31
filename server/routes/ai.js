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
      model: 'claude-haiku-4-5',
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

module.exports = router;
