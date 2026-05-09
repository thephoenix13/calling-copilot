/**
 * server/utils/scoping.js
 *
 * Returns the set of user_ids whose pipeline data the caller is allowed to
 * read. Owners and Team Leads see every member of their company; everyone
 * else (Sr Recruiter / Recruiter / Sourcer / Hiring Manager) sees only
 * their own rows.
 *
 * Use in route handlers like:
 *   const ids = visibleUserIds(req);
 *   const placeholders = ids.map(() => '?').join(',');
 *   db.prepare(`SELECT * FROM x WHERE user_id IN (${placeholders})`).all(...ids);
 */

const { db } = require('../db');

function visibleUserIds(req) {
  const role = req?.user?.role;
  if (role === 'owner' || role === 'team_lead' ||
      role === 'admin' || role === 'superuser' /* legacy */) {
    if (!req.user.company_id) return [req.user.id];
    const rows = db.prepare(
      'SELECT id FROM users WHERE company_id = ? AND is_active = 1'
    ).all(req.user.company_id);
    return rows.map(r => r.id);
  }
  // Self-only for everyone else.
  return req?.user?.id ? [req.user.id] : [];
}

module.exports = { visibleUserIds };
