/**
 * setup.js  –  Run this ONCE before starting the app.
 *
 * What it does:
 *   1. Reads your existing .env (Account SID, Auth Token, Phone Number)
 *   2. Prompts you for your ngrok HTTPS URL
 *   3. Creates a Twilio API Key (needed for browser Voice SDK tokens)
 *   4. Creates a Twilio TwiML App (points Twilio to your /voice webhook)
 *   5. Writes the new values back into .env
 *
 * Usage:
 *   node setup.js
 */

require('dotenv').config();
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_PATH = path.join(__dirname, '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

function readEnv() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const map = {};
  raw.split('\n').forEach((line) => {
    const [k, ...rest] = line.split('=');
    if (k && k.trim()) map[k.trim()] = rest.join('=').trim();
  });
  return map;
}

function writeEnv(map) {
  const content = Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n';
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

async function main() {
  console.log('\n🔧  Recruiter Call App — Setup\n');

  const env = readEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error('❌  TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing from .env');
    process.exit(1);
  }

  // Warn if SID doesn't look right
  if (!accountSid.startsWith('AC')) {
    console.warn(
      `⚠️   Warning: TWILIO_ACCOUNT_SID starts with "${accountSid.slice(0, 2)}" — Twilio Account SIDs should start with "AC".\n` +
      `    If you see auth errors, log in to console.twilio.com and copy the correct Account SID.\n`
    );
  }

  // Ask for ngrok URL — accept as CLI arg or interactive prompt
  let ngrokUrl = process.argv[2] || '';
  if (!ngrokUrl) {
    console.log('Before continuing, make sure ngrok is running.');
    console.log('Open a separate terminal and run:  ngrok http 3000');
    console.log('Then copy the https:// URL it gives you (e.g. https://abc123.ngrok-free.app)\n');
    ngrokUrl = await ask('Paste your ngrok HTTPS URL here: ');
  } else {
    console.log(`Using ngrok URL from argument: ${ngrokUrl}\n`);
  }

  if (!ngrokUrl.startsWith('https://')) {
    console.error('❌  URL must start with https://');
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  // ── Create API Key ──────────────────────────────────────────────────────
  console.log('\n🔑  Creating Twilio API Key...');
  let apiKey, apiSecret;
  try {
    const key = await client.newKeys.create({ friendlyName: 'recruiter-call-app' });
    apiKey = key.sid;
    apiSecret = key.secret;
    console.log(`✅  API Key created: ${apiKey}`);
  } catch (err) {
    console.error('❌  Failed to create API Key:', err.message);
    process.exit(1);
  }

  // ── Create TwiML Application ────────────────────────────────────────────
  console.log('\n📱  Creating TwiML Application...');
  let twimlAppSid;
  try {
    const app = await client.applications.create({
      friendlyName: 'Recruiter Call App',
      voiceUrl: `${ngrokUrl}/voice`,
      voiceMethod: 'POST',
    });
    twimlAppSid = app.sid;
    console.log(`✅  TwiML App created: ${twimlAppSid}`);
  } catch (err) {
    console.error('❌  Failed to create TwiML App:', err.message);
    process.exit(1);
  }

  // ── Write back to .env ──────────────────────────────────────────────────
  env.TWILIO_API_KEY = apiKey;
  env.TWILIO_API_SECRET = apiSecret;
  env.TWILIO_TWIML_APP_SID = twimlAppSid;
  env.NGROK_URL = ngrokUrl;
  writeEnv(env);

  console.log('\n✅  .env updated with:');
  console.log(`   TWILIO_API_KEY        = ${apiKey}`);
  console.log(`   TWILIO_API_SECRET     = (hidden)`);
  console.log(`   TWILIO_TWIML_APP_SID  = ${twimlAppSid}`);
  console.log(`   NGROK_URL             = ${ngrokUrl}`);
  console.log('\n🎉  Setup complete! You can now start the app.\n');
  console.log('   IMPORTANT: Every time you restart ngrok you get a NEW URL.');
  console.log('   When that happens, run `node setup.js` again to update it.\n');

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
