/**
 * server/routes/ask-mis.js
 *
 * On-demand MIS reporting bot. Each query spins up a per-request scoped
 * readonly DB, runs the Claude agent over it, and persists the conversation
 * for replay/history.
 *
 *   POST   /ask-mis/query                  → run a question (creates conversation if new)
 *   GET    /ask-mis/conversations          → list this user's conversations
 *   GET    /ask-mis/conversations/:id      → fetch one with full messages
 *   DELETE /ask-mis/conversations/:id      → delete
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../db');
const auth    = require('../middleware/auth');
const { requireCapability } = require('../middleware/permissions');
const { logActivity } = require('../utils/activity');
const { computeScope } = require('../services/mis-scope');
const { answerQuestion } = require('../services/mis-agent');

router.use(auth);
router.use(requireCapability('mis.read'));

// ── Prepared statements ─────────────────────────────────────────────────────
let stmts;
function getStmts() {
  if (!stmts) {
    stmts = {
      insertConv: db.prepare(
        `INSERT INTO mis_conversations (user_id, company_id, title)
         VALUES (?, ?, ?)`
      ),
      getConv: db.prepare(
        `SELECT id, user_id, title, pinned, created_at, updated_at
         FROM mis_conversations WHERE id = ? AND user_id = ?`
      ),
      listConvs: db.prepare(
        `SELECT c.id, c.title, c.pinned, c.created_at, c.updated_at,
                (SELECT substr(content, 1, 240) FROM mis_messages
                   WHERE conversation_id = c.id AND role = 'user'
                   ORDER BY id ASC LIMIT 1) AS first_question,
                (SELECT substr(content, 1, 240) FROM mis_messages
                   WHERE conversation_id = c.id AND role = 'assistant'
                   ORDER BY id DESC LIMIT 1) AS last_answer,
                (SELECT created_at FROM mis_messages
                   WHERE conversation_id = c.id AND role = 'assistant'
                   ORDER BY id DESC LIMIT 1) AS last_run_at,
                (SELECT COUNT(*) FROM mis_messages WHERE conversation_id = c.id) AS message_count
           FROM mis_conversations c
          WHERE c.user_id = ?
          ORDER BY c.pinned DESC, c.updated_at DESC
          LIMIT 100`
      ),
      touchConv: db.prepare(
        `UPDATE mis_conversations SET updated_at = datetime('now') WHERE id = ?`
      ),
      deleteConv: db.prepare(
        `DELETE FROM mis_conversations WHERE id = ? AND user_id = ?`
      ),
      renameConv: db.prepare(
        `UPDATE mis_conversations SET title = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      ),
      pinConv: db.prepare(
        `UPDATE mis_conversations SET pinned = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      ),
      insertMsg: db.prepare(
        `INSERT INTO mis_messages (conversation_id, role, content, sql_used, tables_json, latency_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ),
      listMsgs: db.prepare(
        `SELECT id, role, content, sql_used, tables_json, latency_ms, error, created_at
         FROM mis_messages WHERE conversation_id = ?
         ORDER BY id ASC`
      ),
    };
  }
  return stmts;
}

function deriveTitle(question) {
  const trimmed = String(question || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Untitled query';
  return trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed;
}

// ── POST /query ─────────────────────────────────────────────────────────────
// Body: { question: string, conversationId?: number }
// Returns: { conversationId, message: { id, text, tables, latencyMs } }
router.post('/query', async (req, res) => {
  const { question, conversationId } = req.body || {};
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required.' });
  }
  const s = getStmts();

  // Resolve or create the conversation.
  let conv;
  if (conversationId) {
    conv = s.getConv.get(conversationId, req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
  } else {
    const ins = s.insertConv.run(req.user.id, req.user.company_id, deriveTitle(question));
    conv = { id: ins.lastInsertRowid };
  }

  // Reconstruct text-only history for the agent (skip table/SQL detail to keep
  // the conversation cheap — each turn re-queries fresh).
  const priorMsgs = s.listMsgs.all(conv.id);
  const history = priorMsgs.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Persist the user turn upfront so it's always there on error.
  s.insertMsg.run(conv.id, 'user', question, null, null, null, null);

  let scope;
  try {
    scope = computeScope(req);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const startedAt = Date.now();
  let agentResult;
  try {
    agentResult = await answerQuestion({ scope, question, history });
  } catch (e) {
    const latency = Date.now() - startedAt;
    const errMsg = `Sorry — the MIS agent failed: ${e.message}`;
    s.insertMsg.run(conv.id, 'assistant', errMsg, null, null, latency, e.message);
    s.touchConv.run(conv.id);
    console.error('[ask-mis] agent error:', e);
    return res.status(500).json({
      conversationId: conv.id,
      message: { text: errMsg, tables: [], latencyMs: latency, error: e.message },
    });
  }

  const latency = Date.now() - startedAt;
  const msgInsert = s.insertMsg.run(
    conv.id,
    'assistant',
    agentResult.text,
    agentResult.sqlUsed.length ? JSON.stringify(agentResult.sqlUsed) : null,
    agentResult.tables.length ? JSON.stringify(agentResult.tables) : null,
    latency,
    null,
  );
  s.touchConv.run(conv.id);

  logActivity(req, 'mis.query', 'mis_conversation', conv.id, {
    iterations: agentResult.iterations,
    tableCount: agentResult.tables.length,
    latencyMs: latency,
  });

  res.json({
    conversationId: conv.id,
    message: {
      id: msgInsert.lastInsertRowid,
      text: agentResult.text,
      tables: agentResult.tables,
      sqlUsed: agentResult.sqlUsed,
      latencyMs: latency,
    },
  });
});

// ── GET /conversations ──────────────────────────────────────────────────────
router.get('/conversations', (req, res) => {
  const rows = getStmts().listConvs.all(req.user.id);
  res.json({ conversations: rows });
});

// ── GET /conversations/:id ──────────────────────────────────────────────────
router.get('/conversations/:id', (req, res) => {
  const s = getStmts();
  const conv = s.getConv.get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
  const msgs = s.listMsgs.all(conv.id).map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    sqlUsed: m.sql_used ? JSON.parse(m.sql_used) : null,
    tables:  m.tables_json ? JSON.parse(m.tables_json) : null,
    latencyMs: m.latency_ms,
    error: m.error,
    createdAt: m.created_at,
  }));
  res.json({ conversation: conv, messages: msgs });
});

// ── PATCH /conversations/:id  — rename + pin ────────────────────────────────
// Body: { title?: string, pinned?: boolean }
router.patch('/conversations/:id', (req, res) => {
  const s = getStmts();
  const conv = s.getConv.get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  const { title, pinned } = req.body || {};
  if (title === undefined && pinned === undefined) {
    return res.status(400).json({ error: 'Provide title or pinned to update.' });
  }
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title must be a non-empty string.' });
    }
    const clean = title.trim().slice(0, 200);
    s.renameConv.run(clean, conv.id, req.user.id);
  }
  if (pinned !== undefined) {
    s.pinConv.run(pinned ? 1 : 0, conv.id, req.user.id);
  }
  const updated = s.getConv.get(conv.id, req.user.id);
  res.json({ conversation: updated });
});

// ── DELETE /conversations/:id ───────────────────────────────────────────────
router.delete('/conversations/:id', (req, res) => {
  const result = getStmts().deleteConv.run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Conversation not found.' });
  res.json({ ok: true });
});

module.exports = router;
