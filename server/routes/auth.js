const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, role: user.role, displayName: user.display_name });
});

// POST /auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    // Create user + a personal company in one transaction so the new account
    // never exists in a state where company_id is NULL.
    const newUserId = db.transaction(() => {
      const userRes = db.prepare(
        'INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
      ).run(email, hash, 'recruiter', name.trim());
      const userId = userRes.lastInsertRowid;

      const coRes = db.prepare(
        `INSERT INTO companies (owner_id, name, industry, contact_email)
         VALUES (?, ?, ?, ?)`
      ).run(userId, `${name.trim()}'s Workspace`, 'Recruitment', email);

      db.prepare('UPDATE users SET company_id = ? WHERE id = ?').run(coRes.lastInsertRowid, userId);
      return userId;
    })();

    const token = jwt.sign(
      { id: newUserId, email, role: 'recruiter' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({ token, role: 'recruiter', displayName: name.trim() });
  } catch (err) {
    console.error('signup error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ error: 'No account found with that email.' });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('reset-password error:', err.message);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

module.exports = router;
