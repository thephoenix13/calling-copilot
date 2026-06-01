/**
 * server/services/mis-sql-guard.js
 *
 * Validate and execute LLM-generated SQL against the per-request scoped DB.
 *
 * Safety layers (defence in depth):
 *   1. Whitelist FROM/JOIN identifiers to ALLOWED_VIEWS (the v_* views).
 *      Raw table access is blocked by view-name mismatch even before the guard.
 *   2. Single SELECT statement only; ban PRAGMA, ATTACH, DML, DDL.
 *   3. Wrap with `SELECT * FROM (...) LIMIT ROW_LIMIT` to cap result size.
 *   4. Connection is opened readonly with `query_only=ON`, so even a slipped-
 *      through mutation would error from SQLite itself.
 */

const { ALLOWED_VIEWS, ROW_LIMIT } = require('./mis-scope');

const BANNED_KEYWORDS = [
  'PRAGMA', 'ATTACH', 'DETACH', 'INSERT', 'UPDATE', 'DELETE',
  'CREATE', 'DROP', 'ALTER', 'REPLACE', 'VACUUM', 'REINDEX',
];

const ALLOWED_VIEW_SET = new Set(ALLOWED_VIEWS.map(v => v.toLowerCase()));

class SqlGuardError extends Error {
  constructor(message) { super(message); this.name = 'SqlGuardError'; }
}

function stripComments(sql) {
  return sql
    .replace(/--[^\n]*/g, '')        // -- line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // /* block comments */
}

/**
 * Validate the SQL string. Throws SqlGuardError on rejection. Returns the
 * cleaned query (comments stripped, trailing `;` removed) on success.
 */
function validateSql(sql) {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new SqlGuardError('Query is empty.');
  }

  const stripped = stripComments(sql).trim().replace(/;+\s*$/, '');

  // 1. Must be a single statement (no embedded semicolons except trailing,
  //    already removed above).
  if (stripped.includes(';')) {
    throw new SqlGuardError('Only one SQL statement is allowed per query.');
  }

  // 2. Must start with SELECT (CTE WITH is disallowed in v1 for simplicity —
  //    subqueries can be used instead).
  if (!/^\s*SELECT\b/i.test(stripped)) {
    throw new SqlGuardError('Query must start with SELECT.');
  }

  // 3. No banned keywords anywhere (word-boundary check).
  for (const kw of BANNED_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(stripped)) {
      throw new SqlGuardError(`Disallowed keyword in query: ${kw}.`);
    }
  }

  // 4. Every identifier referenced after FROM or JOIN must be an allowed view.
  //    Matches: FROM tbl, FROM tbl alias, FROM tbl AS alias, JOIN tbl ... etc.
  //    Skips: FROM (subquery) — the open-paren branch is handled by ignoring
  //    identifiers that don't match \w+.
  const refRe = /\b(?:FROM|JOIN)\s+([A-Za-z_][\w]*)/gi;
  const referenced = new Set();
  let m;
  while ((m = refRe.exec(stripped)) !== null) {
    referenced.add(m[1].toLowerCase());
  }
  for (const name of referenced) {
    if (!ALLOWED_VIEW_SET.has(name)) {
      throw new SqlGuardError(
        `Table or view "${name}" is not available. Use one of: ${ALLOWED_VIEWS.join(', ')}.`
      );
    }
  }
  if (referenced.size === 0) {
    throw new SqlGuardError('Query must reference at least one v_* view.');
  }

  return stripped;
}

/**
 * Validate and run a query against the scoped readonly DB. Returns
 *   { columns: [string], rows: [object], rowCount, truncated, sql }
 *
 * On guard failure or SQLite error, throws — caller (the agent loop) packages
 * the error into a tool_result with is_error=true so the LLM can correct.
 */
function executeScopedQuery(conn, rawSql) {
  const sql = validateSql(rawSql);

  // Cap row count with an outer wrap. Add +1 to detect truncation.
  const wrapped = `SELECT * FROM (${sql}) LIMIT ${ROW_LIMIT + 1}`;

  let stmt;
  try {
    stmt = conn.prepare(wrapped);
  } catch (e) {
    throw new SqlGuardError(`SQL syntax error: ${e.message}`);
  }

  let rows;
  try {
    rows = stmt.all();
  } catch (e) {
    throw new SqlGuardError(`Query execution error: ${e.message}`);
  }

  const truncated = rows.length > ROW_LIMIT;
  if (truncated) rows.length = ROW_LIMIT;

  let columns = [];
  try {
    columns = stmt.columns().map(c => c.name);
  } catch (_) {
    // Some statements (e.g. when no rows) may not expose columns; fall back to keys.
    columns = rows[0] ? Object.keys(rows[0]) : [];
  }

  return { columns, rows, rowCount: rows.length, truncated, sql };
}

module.exports = {
  validateSql,
  executeScopedQuery,
  SqlGuardError,
};
