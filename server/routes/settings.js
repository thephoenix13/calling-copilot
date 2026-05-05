const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const { db }  = require('../db');
const auth    = require('../middleware/auth');

router.use(auth);

// ── Guard: only superuser may use this router ─────────────────────────────────
function requireSuperuser(req, res, next) {
  if (req.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Superuser access required.' });
  }
  next();
}
router.use(requireSuperuser);

// ── Helper: resolve superuser's company_id ────────────────────────────────────
function getSuperuserCompany(userId) {
  const user = db.prepare('SELECT company_id FROM users WHERE id = ?').get(userId);
  return user?.company_id || null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Company
// ══════════════════════════════════════════════════════════════════════════════

// GET /settings/company
router.get('/company', (req, res) => {
  const companyId = getSuperuserCompany(req.user.id);
  if (!companyId) return res.status(404).json({ error: 'No company found.' });

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  if (!company) return res.status(404).json({ error: 'Company not found.' });

  res.json({ company });
});

// PUT /settings/company
router.put('/company', (req, res) => {
  const companyId = getSuperuserCompany(req.user.id);
  if (!companyId) return res.status(404).json({ error: 'No company found.' });

  const { name, industry, website, address, contact_email, logo_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required.' });

  db.prepare(`
    UPDATE companies
    SET name = ?, industry = ?, website = ?, address = ?, contact_email = ?, logo_url = ?
    WHERE id = ?
  `).run(
    name.trim(),
    industry  || null,
    website   || null,
    address   || null,
    contact_email || null,
    logo_url  || null,
    companyId,
  );

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  res.json({ company });
});

// ══════════════════════════════════════════════════════════════════════════════
// Team
// ══════════════════════════════════════════════════════════════════════════════

// GET /settings/team
router.get('/team', (req, res) => {
  const companyId = getSuperuserCompany(req.user.id);
  if (!companyId) return res.json({ members: [] });

  const members = db.prepare(`
    SELECT id, email, display_name, role, is_active, created_at
    FROM users
    WHERE company_id = ? AND id != ?
    ORDER BY created_at ASC
  `).all(companyId, req.user.id);

  res.json({ members });
});

// POST /settings/team — create a new recruiter account
router.post('/team', async (req, res) => {
  const { email, password, display_name, role } = req.body;

  if (!email?.trim() || !password || !display_name?.trim()) {
    return res.status(400).json({ error: 'Email, display name, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const allowedRoles = ['admin', 'subuser'];
  const memberRole = allowedRoles.includes(role) ? role : 'admin';

  const companyId = getSuperuserCompany(req.user.id);
  if (!companyId) return res.status(500).json({ error: 'Superuser has no company.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, role, display_name, company_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(email.trim(), hash, memberRole, display_name.trim(), companyId, req.user.id);

    const member = db.prepare(
      'SELECT id, email, display_name, role, is_active, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json({ member });
  } catch (err) {
    console.error('settings/team POST error:', err.message);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// PUT /settings/team/:id — update name, email, role, is_active
router.put('/team/:id', async (req, res) => {
  const companyId = getSuperuserCompany(req.user.id);
  const member = db.prepare(
    'SELECT id, company_id FROM users WHERE id = ?'
  ).get(req.params.id);

  if (!member || member.company_id !== companyId) {
    return res.status(404).json({ error: 'Team member not found.' });
  }

  const { display_name, email, role, is_active, password } = req.body;
  const allowedRoles = ['admin', 'subuser'];

  const updates = [];
  const values  = [];

  if (display_name !== undefined) { updates.push('display_name = ?'); values.push(display_name.trim()); }
  if (email         !== undefined) { updates.push('email = ?');        values.push(email.trim());        }
  if (role          !== undefined && allowedRoles.includes(role)) { updates.push('role = ?'); values.push(role); }
  if (is_active     !== undefined) { updates.push('is_active = ?');    values.push(is_active ? 1 : 0);   }

  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const hash = await bcrypt.hash(password, 10);
    updates.push('password_hash = ?');
    values.push(hash);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(
    'SELECT id, email, display_name, role, is_active, created_at FROM users WHERE id = ?'
  ).get(req.params.id);

  res.json({ member: updated });
});

// DELETE /settings/team/:id — deactivate (soft delete)
router.delete('/team/:id', (req, res) => {
  const companyId = getSuperuserCompany(req.user.id);
  const member = db.prepare('SELECT id, company_id FROM users WHERE id = ?').get(req.params.id);

  if (!member || member.company_id !== companyId) {
    return res.status(404).json({ error: 'Team member not found.' });
  }

  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// Account (superuser's own profile)
// ══════════════════════════════════════════════════════════════════════════════

// PUT /settings/account
router.put('/account', async (req, res) => {
  const { display_name, password } = req.body;

  const updates = [];
  const values  = [];

  if (display_name !== undefined) { updates.push('display_name = ?'); values.push(display_name.trim()); }

  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const hash = await bcrypt.hash(password, 10);
    updates.push('password_hash = ?');
    values.push(hash);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  res.json({ ok: true });
});

module.exports = router;
