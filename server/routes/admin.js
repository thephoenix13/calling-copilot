const express = require('express');
const router = express.Router();
const { db } = require('../db');
const authMiddleware = require('../middleware/auth');

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// GET /admin/users — list all subusers with call counts
router.get('/users', authMiddleware, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.display_name, u.role, u.created_at,
           COUNT(c.id) AS call_count
    FROM users u
    LEFT JOIN calls c ON c.user_id = u.id
    WHERE u.role = 'subuser'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  res.json({ users });
});

module.exports = router;
