/**
 * server/services/mis-agent.js
 *
 * Ask MIS agent loop. Claude Sonnet 4.6 with tool use over a per-request
 * scoped readonly DB. The agent's only data access is through:
 *   - list_schema(domain)   → returns curated descriptor for jobs_pipeline
 *                              or assessments_interviews.
 *   - query_database(sql, title?)
 *                            → validate + execute against the scoped views.
 *                              Successful queries are collected as result
 *                              tables presented to the user.
 *
 * Returns { text, tables[], sqlUsed[], iterations } — the route handler
 * persists these on the conversation.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { openScopedDb } = require('./mis-scope');
const { executeScopedQuery, SqlGuardError } = require('./mis-sql-guard');
const { buildDomainBlock, listDomains } = require('./mis-schema');

const anthropic = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;
const MAX_ITERATIONS = 8;

// Rows we feed back to the LLM per query. Larger result sets are still kept
// in full for the final table, but the LLM only sees a preview to keep tokens
// manageable.
const PREVIEW_ROWS = 50;

const TOOLS = [
  {
    name: 'list_schema',
    description:
      'Get the curated table/column descriptor for a data domain. Call this BEFORE writing any SQL so you know which columns exist and what the enum values mean. The schema describes pre-scoped v_* views — those are the ONLY tables you may reference.',
    input_schema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          enum: ['jobs_pipeline', 'assessments_interviews'],
          description: 'Which data domain to describe.',
        },
      },
      required: ['domain'],
    },
  },
  {
    name: 'query_database',
    description:
      'Run a read-only SQLite SELECT against the scoped v_* views. ' +
      'You MUST reference only v_* views (e.g. v_jobs, v_candidates). ' +
      'Provide a short title — it will appear above the result table in the UI.',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'A single SQLite SELECT statement. CTEs are not supported in v1; use subqueries instead.',
        },
        title: {
          type: 'string',
          description: 'Short descriptive title (max 80 chars) shown above the result table.',
        },
      },
      required: ['sql', 'title'],
    },
  },
  {
    name: 'present_chart',
    description:
      'Attach a chart to a query result you have already run. The chart renders above the table in the UI. ' +
      'Use this when the data is best understood visually — e.g. trends over time, distributions, group comparisons. ' +
      'Reference a query by its 0-based index (the order in which you called query_database). ' +
      'Pick chart_type sensibly: "bar" for category counts, "line" for time series, "pie" for proportions of a whole (cap at ~7 slices), "area" for cumulative trends.',
    input_schema: {
      type: 'object',
      properties: {
        query_index: {
          type: 'integer',
          description: '0-based index of the query_database result this chart visualises.',
          minimum: 0,
        },
        chart_type: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'area'],
        },
        title: {
          type: 'string',
          description: 'Short chart title (max 80 chars).',
        },
        x_column: {
          type: 'string',
          description: 'Column name to use as the x-axis (categories or dates).',
        },
        y_columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'One or more numeric columns to plot. Multiple columns become multiple series.',
        },
        stacked: {
          type: 'boolean',
          description: 'For bar/area charts: whether multiple y-series should stack. Default false.',
        },
      },
      required: ['query_index', 'chart_type', 'title', 'x_column', 'y_columns'],
    },
  },
];

function buildSystemPrompt(scope) {
  const today = new Date().toISOString().slice(0, 10);
  const domains = listDomains().map(d => `  - ${d.name}: ${d.purpose}`).join('\n');

  const scopeLine = (() => {
    switch (scope.scopeKind) {
      case 'company':
        return `You are answering as ${scope.role} — you see ALL data for the company (company_id=${scope.companyId}).`;
      case 'hm':
        return `You are answering as a Hiring Manager (user_id=${scope.userId}). You see ONLY data tied to the ${scope.hmJobIds?.length || 0} job(s) you are attached to.`;
      default:
        return `You are answering as ${scope.role} (user_id=${scope.userId}). You see ONLY your own data.`;
    }
  })();

  return [
    'You are the "Ask MIS" reporting agent for a recruitment platform.',
    'You answer questions by querying a SQLite database via the query_database tool, then writing a plain-language summary.',
    '',
    `Today's date: ${today}`,
    scopeLine,
    '',
    'Available data domains (call list_schema to see columns):',
    domains,
    '',
    'Rules:',
    '  1. ALWAYS call list_schema for the relevant domain(s) before your first query so you know the real column names.',
    '  2. Query only v_* views. Raw table names (jobs, candidates, etc.) are blocked and will error.',
    '  3. Scope is already enforced by the views — do NOT add user_id or company_id filters of your own; you would just duplicate the view filter.',
    '  4. Prefer one well-aggregated query over many small ones. Each query you run becomes a table in the user\'s answer, so give each a clear title.',
    '  5. Dates in SQLite: use date(), datetime(), julianday(). For "this week" use date(\'now\',\'weekday 0\',\'-6 days\'). For "last 30 days" use date(\'now\',\'-30 days\').',
    '  6. When the answer is one number (e.g. a count), still run a query and then state the number in your final text.',
    '  7. If a query errors with "table not available" or "syntax error", read the message, fix the SQL, try again. After 2 failed attempts on the same approach, switch strategy.',
    '  8. Add a chart with present_chart whenever the data is naturally visual — time series, group comparisons, distributions. Skip charts for single-number answers or wide pivot tables. Reference queries by their 0-based index in the order you called query_database.',
    '  9. Finish with a concise plain-language summary of what the tables/charts show. Don\'t restate the SQL.',
  ].join('\n');
}

function extractText(content) {
  return content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

async function handleTool(tu, dbRO, scope, collectedTables) {
  if (tu.name === 'list_schema') {
    const domain = tu.input?.domain;
    try {
      const block = buildDomainBlock(domain);
      return { type: 'tool_result', tool_use_id: tu.id, content: block };
    } catch (e) {
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: `Error: ${e.message}. Valid domains: ${listDomains().map(d => d.name).join(', ')}`,
        is_error: true,
      };
    }
  }

  if (tu.name === 'query_database') {
    const { sql, title } = tu.input || {};
    try {
      const result = executeScopedQuery(dbRO, sql || '');
      collectedTables.push({
        title: (title || 'Result').slice(0, 80),
        sql: result.sql,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        truncated: result.truncated,
      });

      // Compact preview to feed back to the LLM
      const preview = {
        columns: result.columns,
        rows: result.rows.slice(0, PREVIEW_ROWS),
        rowCount: result.rowCount,
        truncated: result.truncated,
        ...(result.rowCount > PREVIEW_ROWS
          ? { note: `Result has ${result.rowCount} rows; showing first ${PREVIEW_ROWS}.` }
          : {}),
      };
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(preview),
      };
    } catch (e) {
      const msg = e instanceof SqlGuardError ? e.message : `Unexpected error: ${e.message}`;
      return { type: 'tool_result', tool_use_id: tu.id, content: msg, is_error: true };
    }
  }

  if (tu.name === 'present_chart') {
    const { query_index, chart_type, title, x_column, y_columns, stacked } = tu.input || {};
    if (!Number.isInteger(query_index) || query_index < 0 || query_index >= collectedTables.length) {
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: `Error: query_index ${query_index} is out of range. You have run ${collectedTables.length} query/queries so far (valid indices 0..${collectedTables.length - 1}).`,
        is_error: true,
      };
    }
    const target = collectedTables[query_index];
    if (!Array.isArray(y_columns) || y_columns.length === 0) {
      return { type: 'tool_result', tool_use_id: tu.id, content: 'Error: y_columns must include at least one column name.', is_error: true };
    }
    const cols = new Set(target.columns);
    const missing = [x_column, ...y_columns].filter(c => !cols.has(c));
    if (missing.length) {
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: `Error: column(s) not found in query ${query_index}: ${missing.join(', ')}. Available columns: ${target.columns.join(', ')}.`,
        is_error: true,
      };
    }

    target.chart = {
      type: chart_type,
      title: (title || target.title).slice(0, 80),
      x: x_column,
      y: y_columns,
      stacked: !!stacked,
    };

    return {
      type: 'tool_result',
      tool_use_id: tu.id,
      content: `Chart attached to query ${query_index} (${chart_type}, ${y_columns.length} series).`,
    };
  }

  return {
    type: 'tool_result',
    tool_use_id: tu.id,
    content: `Unknown tool: ${tu.name}`,
    is_error: true,
  };
}

/**
 * Run one MIS question through the agent.
 *
 *   answerQuestion({ scope, question, history }) → { text, tables, sqlUsed, iterations }
 *
 *   scope:    object from computeScope(req)
 *   question: latest user question (string)
 *   history:  prior turns as Anthropic-shaped messages
 *             [{ role: 'user'|'assistant', content: string | content blocks }]
 */
async function answerQuestion({ scope, question, history = [] }) {
  const dbRO = openScopedDb(scope);
  try {
    const tables = [];
    const system = buildSystemPrompt(scope);

    const messages = [
      ...history,
      { role: 'user', content: question },
    ];

    let finalText = '';
    let iter = 0;

    for (; iter < MAX_ITERATIONS; iter++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: resp.content });

      if (resp.stop_reason === 'tool_use') {
        const toolUses = resp.content.filter(b => b.type === 'tool_use');
        const toolResults = [];
        for (const tu of toolUses) {
          toolResults.push(await handleTool(tu, dbRO, scope, tables));
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // end_turn, stop_sequence, max_tokens, etc. — agent has nothing more to do.
      finalText = extractText(resp.content);
      break;
    }

    if (!finalText && tables.length > 0) {
      finalText = `I ran ${tables.length} ${tables.length === 1 ? 'query' : 'queries'} but didn't produce a written summary — the table${tables.length === 1 ? '' : 's'} above contains the data.`;
    }
    if (!finalText) {
      finalText = "I couldn't answer that with the data available. Try rephrasing — for example, 'how many active jobs do we have?' or 'pass rate by assessment'.";
    }

    return {
      text: finalText,
      tables,
      sqlUsed: tables.map(t => t.sql),
      iterations: iter + 1,
    };
  } finally {
    try { dbRO.close(); } catch (_) {}
  }
}

module.exports = { answerQuestion };
