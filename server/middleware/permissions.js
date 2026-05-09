/**
 * Permission helpers for the 6-role hierarchy.
 *
 *   owner > team_lead > sr_recruiter > recruiter > sourcer
 *                                                  hiring_manager (external)
 *
 * Use:
 *   const { requireRole, requireCapability } = require('../middleware/permissions');
 *   router.post('/some-route', auth, requireRole('owner','team_lead'), handler);
 *   router.post('/another',     auth, requireCapability('jobs.create'),  handler);
 *
 * `requireRole(...allowed)` is the simplest: allow if user.role is in the set.
 * `requireCapability(cap)` is a level higher — looks up which roles have the
 * capability. Use it when you'd otherwise repeat the same role list across
 * multiple endpoints, or when you expect to tune permissions later.
 *
 * Capability map intentionally lives in code (not DB) for now — fast and
 * easy to evolve. If the role model ever needs to be tenant-customised,
 * this becomes a DB-backed lookup.
 */

const ROLES = ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer', 'hiring_manager'];

// Capability → list of roles allowed to perform it.
// Conservative defaults; adjust as we wire each module.
const CAPABILITIES = {
  // Settings & company management — Owner only.
  'company.read':   ['owner'],
  'company.write':  ['owner'],
  'team.read':      ['owner', 'team_lead'],
  'team.write':     ['owner'],
  'billing.write':  ['owner'],

  // Jobs — recruiters & up can create; team leads can reassign; sourcers read-only.
  'jobs.read':      ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer', 'hiring_manager'],
  'jobs.create':    ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],
  'jobs.update':    ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],
  'jobs.delete':    ['owner', 'team_lead'],
  // Sr Recruiters can manage assignees and Hiring Managers on company jobs —
  // it's the main mid-level differentiator vs. plain Recruiter.
  'jobs.assign':    ['owner', 'team_lead', 'sr_recruiter'],

  // Candidates — sourcers can add; HMs can't access the DB at all.
  'candidates.read':   ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer'],
  'candidates.create': ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer'],
  'candidates.update': ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer'],
  'candidates.delete': ['owner', 'team_lead'],

  // Pipeline sessions — sourcers limited to Step 3 (enforced inline).
  'sessions.read':     ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer', 'hiring_manager'],
  'sessions.create':   ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],
  'sessions.update':   ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],

  // Calling CoPilot
  'calls.start':       ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],
  'calls.read':        ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],

  // Assessments
  'assessments.read':   ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'hiring_manager'],
  'assessments.write':  ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],

  // Video Interviews
  'video.read':         ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'hiring_manager'],
  'video.write':        ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],

  // POFU
  'pofu.read':          ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],
  'pofu.write':         ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],

  // Reports & Recruiter QA
  'reports.read':       ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer'],
  'qa.read.own':        ['owner', 'team_lead', 'sr_recruiter', 'recruiter', 'sourcer'],
  'qa.read.team':       ['owner', 'team_lead'],

  // Hiring Manager candidate feedback (Phase 4)
  'hm.feedback.write':  ['hiring_manager'],

  // Market Intelligence (4-stage pipeline)
  'mi.read.own':        ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],
  'mi.read.team':       ['owner', 'team_lead'],
  'mi.write':           ['owner', 'team_lead', 'sr_recruiter', 'recruiter'],
};

function rolesForCapability(cap) {
  const allowed = CAPABILITIES[cap];
  if (!allowed) {
    throw new Error(`Unknown capability: "${cap}". Add it to permissions.js.`);
  }
  return allowed;
}

/**
 * Middleware factory: allow only the listed role(s).
 *   router.use(requireRole('owner'))
 *   router.post('/x', requireRole('owner','team_lead'), handler)
 */
function requireRole(...allowed) {
  if (!allowed.length) throw new Error('requireRole() called with no roles');
  for (const r of allowed) {
    if (!ROLES.includes(r)) throw new Error(`Unknown role: "${r}"`);
  }
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `This action requires role: ${allowed.join(' or ')}.`,
      });
    }
    next();
  };
}

/**
 * Middleware factory: allow only roles that have the capability.
 *   router.post('/jobs', requireCapability('jobs.create'), handler)
 */
function requireCapability(cap) {
  const allowed = rolesForCapability(cap);
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Your role does not allow: ${cap}.`,
      });
    }
    next();
  };
}

/**
 * Plain function (not middleware) — useful inside handlers for conditional logic.
 */
function userHasCapability(user, cap) {
  return user && rolesForCapability(cap).includes(user.role);
}

/**
 * Middleware: gate ONLY mutations (POST/PUT/PATCH/DELETE) on a router.
 * Reads (GET/HEAD/OPTIONS) pass through. Useful as a router.use(...) so a
 * single line covers all write endpoints in a route file.
 */
function requireWrite(cap) {
  const allowed = rolesForCapability(cap);
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Your role does not allow modifications here.`,
      });
    }
    next();
  };
}

/**
 * Middleware: gate every authed request by a read capability. Pair with
 * requireWrite() to also enforce write caps. OPTIONS (CORS preflight) is
 * always allowed through.
 */
function requireRead(cap) {
  const allowed = rolesForCapability(cap);
  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Your role does not allow access to this resource.`,
      });
    }
    next();
  };
}

module.exports = {
  ROLES,
  CAPABILITIES,
  requireRole,
  requireCapability,
  requireWrite,
  requireRead,
  userHasCapability,
  rolesForCapability,
};
