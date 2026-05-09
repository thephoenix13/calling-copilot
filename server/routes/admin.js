const express = require('express');
const router = express.Router();
const { db } = require('../db');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/permissions');

// GET /admin/users — list non-owner users in the caller's company with call counts.
// Restricted to Owners (and Team Leads — they need this for coaching context).
router.get('/users', authMiddleware, requireRole('owner', 'team_lead'), (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.display_name, u.role, u.created_at,
           COUNT(c.id) AS call_count
    FROM users u
    LEFT JOIN calls c ON c.user_id = u.id
    WHERE u.company_id = ?
      AND u.role != 'owner'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all(req.user.company_id);

  res.json({ users });
});

// GET /admin/team-pool — list every active member in the caller's company.
// Used by the Job Detail "Add Assignee" picker.
router.get('/team-pool', authMiddleware, requireRole('owner', 'team_lead'), (req, res) => {
  const members = db.prepare(`
    SELECT id, email, display_name, role
    FROM users
    WHERE company_id = ? AND is_active = 1
    ORDER BY display_name ASC
  `).all(req.user.company_id);
  res.json({ members });
});

// GET /admin/activity — recent activity log for the caller's company.
// Owner / Team Lead only. Supports ?limit (default 50, max 200) and
// ?entity_type filter.
router.get('/activity', authMiddleware, requireRole('owner', 'team_lead'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const entity = req.query.entity_type;

  let q = `
    SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata, al.created_at,
           u.id   AS user_id,
           u.display_name,
           u.email,
           u.role AS user_role
    FROM activity_log al
    JOIN users u ON u.id = al.user_id
    WHERE al.company_id = ?
  `;
  const params = [req.user.company_id];
  if (entity) { q += ' AND al.entity_type = ?'; params.push(entity); }
  q += ' ORDER BY al.created_at DESC, al.id DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(q).all(...params).map(r => ({
    ...r,
    metadata: r.metadata ? (() => { try { return JSON.parse(r.metadata); } catch { return r.metadata; } })() : null,
  }));

  res.json({ events: rows });
});

module.exports = router;
