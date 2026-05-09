/**
 * scripts/mi-preflight.js
 *
 * Probes the live Anthropic API to confirm the features the MI spec depends
 * on are usable on this account/key. Run from project root:
 *
 *   node scripts/mi-preflight.js
 *
 * Each probe is independent — failures in one don't block the others. The
 * final report tells us exactly which features to lean on and which need
 * fallbacks.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Anthropic = require(require('path').join(__dirname, '..', 'server', 'node_modules', '@anthropic-ai/sdk'));

const client = new Anthropic.default();

const results = [];
const ok   = (name, info = '') => { results.push({ name, passed: true,  info }); console.log(`  ✅ ${name}${info ? ' — ' + info : ''}`); };
const fail = (name, info = '') => { results.push({ name, passed: false, info }); console.log(`  ❌ ${name}${info ? ' — ' + info : ''}`); };

async function safe(label, fn, { retries = 0, retryStatuses = [529, 503] } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { await fn(); return; }
    catch (err) {
      const status = err.status || err.statusCode || 0;
      const msg = err.error?.error?.message || err.message || String(err);
      const willRetry = attempt < retries && retryStatuses.includes(status);
      if (willRetry) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
      fail(label, `(${status || '?'}) ${msg.slice(0, 200)}`);
      return;
    }
  }
}

(async () => {
  console.log('🔍 MI Pre-flight — probing Anthropic API capabilities\n');

  // ── 1. Opus 4.7 model availability ────────────────────────────────────────
  await safe('Opus 4.7 model accessible', async () => {
    const r = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with: ok' }],
    });
    const text = r.content.find(b => b.type === 'text')?.text?.trim() || '';
    ok('Opus 4.7 model accessible', `model=${r.model} usage_in=${r.usage.input_tokens} reply="${text.slice(0,40)}"`);
  });

  // ── 2. Opus 4.6 fallback — confirm it works (already used elsewhere) ──────
  await safe('Opus 4.6 fallback works', async () => {
    const r = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with: ok' }],
    });
    ok('Opus 4.6 fallback works', `model=${r.model}`);
  });

  // ── 3. Sonnet 4.6 (used by structurer) — retry transient overloads ────────
  await safe('Sonnet 4.6 accessible', async () => {
    const r = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with: ok' }],
    });
    ok('Sonnet 4.6 accessible', `model=${r.model}`);
  }, { retries: 2 });

  // ── 4. Haiku 4.5 (used by JD parser + exec summary) ───────────────────────
  await safe('Haiku 4.5 accessible', async () => {
    const r = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with: ok' }],
    });
    ok('Haiku 4.5 accessible', `model=${r.model}`);
  });

  // ── 5. output_config.format with json_schema (Stage 3 enabler) ────────────
  await safe('output_config.format json_schema works', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['city', 'population'],
      properties: {
        city: { type: 'string' },
        population: { type: 'string' },
      },
    };
    const r = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: 'Return a city and its approximate population. Just one.' }],
    });
    const text = r.content.find(b => b.type === 'text')?.text || '';
    const parsed = JSON.parse(text);
    if (typeof parsed.city !== 'string' || typeof parsed.population !== 'string') {
      throw new Error('schema mismatch: ' + text);
    }
    ok('output_config.format json_schema works', `parsed={${parsed.city}, ${parsed.population}}`);
  });

  // ── 6. tool with strict:true + tool_choice (Stage 0 enabler) ──────────────
  await safe('Tool with strict:true works (Stage 0 path)', async () => {
    const r = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      tools: [{
        name: 'extract_fact',
        description: 'Pull a structured fact out of text.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'verdict'],
          properties: {
            title: { type: 'string' },
            verdict: { type: 'string', enum: ['yes', 'no', 'maybe'] },
          },
        },
      }],
      tool_choice: { type: 'tool', name: 'extract_fact' },
      messages: [{ role: 'user', content: 'Is the sky blue? Use the tool. Title="sky color".' }],
    });
    const tool = r.content.find(b => b.type === 'tool_use');
    if (!tool) throw new Error('no tool_use block returned');
    if (!['yes','no','maybe'].includes(tool.input.verdict)) throw new Error('enum violation: ' + JSON.stringify(tool.input));
    ok('Tool with strict:true works (Stage 0 path)', `input=${JSON.stringify(tool.input)}`);
  });

  // ── 7. web_search_20260209 server-side tool (Stage 2 enabler) ─────────────
  await safe('web_search_20260209 server tool authorized', async () => {
    const r = await client.messages.create({
      model: 'claude-opus-4-6',  // try 4-6 first; 4-7 also valid per spec
      max_tokens: 1500,
      tools: [
        { type: 'web_search_20260209', name: 'web_search' },
      ],
      messages: [{
        role: 'user',
        content: 'Search the web for the current population of Bengaluru. Cite your source.',
      }],
    });
    const used = r.content.filter(b => b.type === 'server_tool_use').length;
    const text = r.content.find(b => b.type === 'text')?.text || '';
    ok('web_search_20260209 server tool authorized',
       `tool_invocations=${used} reply_chars=${text.length} stop=${r.stop_reason}`);
  });

  // ── 8. web_fetch_20260209 paired with web_search ──────────────────────────
  await safe('web_fetch_20260209 server tool authorized', async () => {
    const r = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      tools: [
        { type: 'web_search_20260209', name: 'web_search' },
        { type: 'web_fetch_20260209',  name: 'web_fetch'  },
      ],
      messages: [{
        role: 'user',
        content: 'Search for "naukri.com about page" and fetch the top result. Summarize in one line.',
      }],
    });
    ok('web_fetch_20260209 server tool authorized', `stop=${r.stop_reason}`);
  });

  // ── 9. Prompt caching with cache_control: ephemeral on system block ───────
  await safe('Prompt caching (cache_control ephemeral) works', async () => {
    // Anthropic requires the cached prefix be at least ~1024 tokens (Haiku) /
    // ~2048 (other models). Make the system prompt bigger than the worst case.
    const FILLER = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';
    const SYSTEM = 'You are a friendly assistant for testing prompt caching. ' + FILLER.repeat(200);  // ~3500 tokens
    const baseOpts = {
      model: 'claude-haiku-4-5',
      max_tokens: 32,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    };
    const a = await client.messages.create({ ...baseOpts, messages: [{ role: 'user', content: 'Say "first"' }] });
    const b = await client.messages.create({ ...baseOpts, messages: [{ role: 'user', content: 'Say "second"' }] });
    const aw = a.usage.cache_creation_input_tokens || 0;
    const ar = a.usage.cache_read_input_tokens     || 0;
    const bw = b.usage.cache_creation_input_tokens || 0;
    const br = b.usage.cache_read_input_tokens     || 0;
    // Either the first call wrote-to-cache and the second read it, OR both saw
    // a warm cache from earlier runs. Any non-zero read on the second is success.
    if (br === 0 && ar === 0) {
      throw new Error(`no cache reads — first(write=${aw} read=${ar}) second(write=${bw} read=${br})`);
    }
    ok('Prompt caching (cache_control ephemeral) works',
       `1st_write=${aw} 2nd_read=${br}`);
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n──── Summary ────');
  const passed = results.filter(r => r.passed).length;
  console.log(`${passed}/${results.length} probes passed.`);

  // Decisions surfaced for the build plan
  console.log('\n──── Decisions ────');
  const opus47 = results.find(r => r.name.includes('Opus 4.7')).passed;
  const opus46 = results.find(r => r.name.includes('Opus 4.6')).passed;
  const websearch = results.find(r => r.name.includes('web_search_20260209')).passed;
  const webfetch  = results.find(r => r.name.includes('web_fetch_20260209')).passed;
  const jsonschema = results.find(r => r.name.includes('json_schema')).passed;
  const strictTool = results.find(r => r.name.includes('strict:true')).passed;
  const cacheing  = results.find(r => r.name.includes('cache_control')).passed;

  console.log('  Stage 2 model       :', opus47 ? 'claude-opus-4-7' : (opus46 ? 'claude-opus-4-6 (FALLBACK)' : '❌ NEITHER OPUS AVAILABLE'));
  console.log('  Stage 2 web tools   :', (websearch && webfetch) ? 'web_search + web_fetch' : websearch ? 'web_search ONLY' : '❌ NO WEB ACCESS — pipeline cannot do real research');
  console.log('  Stage 3 strict JSON :', jsonschema ? 'output_config.format json_schema (no repair pass needed)' : '❌ MUST add JSON repair pass');
  console.log('  Stage 0 enum tool   :', strictTool ? 'tools[strict:true] + tool_choice (drops bad enums)' : '❌ MUST validate enums server-side');
  console.log('  Cost shape          :', cacheing ? 'prompt caching available — ~$0.20/report' : '⚠ no caching — ~$0.32/report');

  process.exit(passed === results.length ? 0 : 1);
})().catch(err => {
  console.error('💥 preflight crashed:', err);
  process.exit(2);
});
