const jwt    = require('jsonwebtoken');
const { db } = require('../db');

// Cached prepared statement (lazy — db is required above so it exists)
let getUser;

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  // Look up the user fresh on every request so role / company_id reflects
  // the current DB state (handles role changes, company assignment, etc.).
  if (!getUser) {
    getUser = db.prepare(
      'SELECT id, email, role, display_name, company_id, is_active FROM users WHERE id = ?'
    );
  }
  const row = getUser.get(payload.id);

  if (!row || row.is_active === 0) {
    return res.status(401).json({ error: 'Account not found or deactivated.' });
  }

  req.user = {
    id:           row.id,
    email:        row.email,
    role:         row.role,
    display_name: row.display_name,
    company_id:   row.company_id,
  };
  next();
}

module.exports = authMiddleware;
