const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { db }   = require('../db');
const auth     = require('../middleware/auth');

const anthropic = new Anthropic();

// ── Resume upload — save to disk ─────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads/resumes');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['.pdf', '.docx', '.txt'].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(ok ? null : new Error('Only PDF, DOCX, or TXT files are allowed.'), ok);
  },
});

router.use(auth);

function parseCandidate(c) {
  return {
    ...c,
    skills:      JSON.parse(c.skills      || '[]'),
    work_history: JSON.parse(c.work_history || '[]'),
  };
}

// GET /candidates — shared across users
router.get('/', (req, res) => {
  const { search, status } = req.query;
  let q = 'SELECT * FROM candidates WHERE 1=1';
  const params = [];

  if (status && status !== 'all') { q += ' AND status = ?'; params.push(status); }
  else                            { q += " AND status = 'active'"; }

  if (search) {
    q += ' AND (name LIKE ? OR email LIKE ? OR current_title LIKE ? OR current_company LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  q += ' ORDER BY created_at DESC LIMIT 200';

  const candidates = db.prepare(q).all(...params);
  res.json({ candidates: candidates.map(parseCandidate) });
});

// GET /candidates/:id
router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidate not found.' });
  res.json(parseCandidate(c));
});

// POST /candidates — create (manual or from parsed resume)
router.post('/', (req, res) => {
  const {
    name, email, phone, location, current_title, current_company,
    experience_years, skills, education, work_history,
    linkedin_url, portfolio_url, resume_filename, resume_text,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });

  const result = db.prepare(`
    INSERT INTO candidates
      (user_id, name, email, phone, location, current_title, current_company,
       experience_years, skills, education, work_history, linkedin_url, portfolio_url,
       resume_filename, resume_text)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id,
    name.trim(),
    email         || null,
    phone         || null,
    location      || null,
    current_title || null,
    current_company || null,
    experience_years != null ? Number(experience_years) : null,
    JSON.stringify(Array.isArray(skills)       ? skills       : []),
    education     || null,
    JSON.stringify(Array.isArray(work_history) ? work_history : []),
    linkedin_url  || null,
    portfolio_url || null,
    resume_filename || null,
    resume_text   || null,
  );

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseCandidate(candidate));
});

// PUT /candidates/:id — full update
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM candidates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Candidate not found.' });

  const {
    name, email, phone, location, current_title, current_company,
    experience_years, skills, education, work_history,
    linkedin_url, portfolio_url, resume_filename, resume_text, status,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });

  db.prepare(`
    UPDATE candidates SET
      name=?, email=?, phone=?, location=?, current_title=?, current_company=?,
      experience_years=?, skills=?, education=?, work_history=?,
      linkedin_url=?, portfolio_url=?, resume_filename=?, resume_text=?,
      status=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    name.trim(),
    email         || null,
    phone         || null,
    location      || null,
    current_title || null,
    current_company || null,
    experience_years != null ? Number(experience_years) : null,
    JSON.stringify(Array.isArray(skills)       ? skills       : []),
    education     || null,
    JSON.stringify(Array.isArray(work_history) ? work_history : []),
    linkedin_url  || null,
    portfolio_url || null,
    resume_filename || null,
    resume_text   || null,
    status        || 'active',
    req.params.id,
  );

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  res.json(parseCandidate(candidate));
});

// DELETE /candidates/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM candidates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Candidate not found.' });
  db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /candidates/parse-resume — upload file → extract text → Claude parses fields
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const ext  = path.extname(req.file.originalname).toLowerCase();
    let   text = '';

    if (ext === '.pdf') {
      const data = await pdfParse(fs.readFileSync(req.file.path));
      text = data.text;
    } else if (ext === '.docx') {
      try {
        const mammoth = require('mammoth');
        const result  = await mammoth.extractRawText({ path: req.file.path });
        text = result.value;
      } catch {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'DOCX parsing unavailable — please upload a PDF.' });
      }
    } else {
      text = fs.readFileSync(req.file.path, 'utf-8');
    }

    if (!text || text.trim().length < 30) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Could not extract readable text from this file.' });
    }

    // Claude Haiku — fast structured extraction
    const message = await anthropic.messages.create({
      model:     'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract structured data from the resume below. Return ONLY valid JSON, no markdown.

Resume:
${text.slice(0, 4000)}

Return this exact JSON shape (null for any field not found):
{
  "name": string,
  "email": string,
  "phone": string,
  "location": string,
  "current_title": string,
  "current_company": string,
  "experience_years": number,
  "skills": string[],
  "education": string,
  "linkedin_url": string,
  "portfolio_url": string
}`,
      }],
    });

    let fields = {};
    try {
      const raw   = message.content[0].text;
      const match = raw.match(/\{[\s\S]*\}/);
      fields = JSON.parse(match ? match[0] : raw);
    } catch {
      fields = {};
    }

    res.json({
      fields,
      resumeFilename: req.file.filename,
      resumeText:     text.slice(0, 8000),
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    console.error('parse-resume error:', err.message);
    res.status(500).json({ error: 'Resume parsing failed. Please try again.' });
  }
});

module.exports = router;
