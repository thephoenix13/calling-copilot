/**
 * server/utils/activity.js
 *
 * Best-effort activity logging. Call from inside route handlers to record
 * who did what. Never throws — logging failures are swallowed so they
 * cannot break the user request.
 *
 * Usage:
 *   const { logActivity } = require('../utils/activity');
 *   logActivity(req, 'job.create', 'job', jobId, { title: 'Senior React' });
 */

const { db } = require('../db');

let insertStmt = null;
function getStmt() {
  if (!insertStmt) {
    insertStmt = db.prepare(
      `INSERT INTO activity_log (company_id, user_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
  }
  return insertStmt;
}

function logActivity(req, action, entity_type, entity_id, metadata = null) {
  try {
    if (!req?.user?.id || !req?.user?.company_id) return;
    getStmt().run(
      req.user.company_id,
      req.user.id,
      action,
      entity_type,
      entity_id || null,
      metadata ? JSON.stringify(metadata) : null,
    );
  } catch (err) {
    console.error('[activity log]', err.message);
  }
}

module.exports = { logActivity };
