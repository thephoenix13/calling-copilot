const Anthropic = require('@anthropic-ai/sdk');
const crypto    = require('crypto');
const { db }    = require('../db');
const { sendEmail } = require('./mailer');

const anthropic = new Anthropic();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const DEFAULT_RESPONSE_OPTIONS = ['Got it, thank you!', 'I have a question'];

const RESPONSE_OPTIONS = {
  day0_welcome:        ['Got it, thank you!', 'I have a question'],
  resignation_check:   ["Yes, I've submitted my resignation", 'Not yet — will do soon', 'I need to discuss this'],
  bgv_nudge:           ['Documents submitted', 'Need help with BGV process', 'I have a question'],
  t14_checklist:       ["All noted, I'm ready!", 'I have a question'],
  t7_warmup:           ['Excited to join!', 'I have a question'],
  t1_excitement:       ['See you tomorrow!', 'I need to discuss something urgent'],
  risk_amber_checkin:  ['All good, joining as planned', 'I have some concerns'],
  risk_red_escalation: ['All good, joining as planned', "I'd like to speak with someone"],
  no_response_nudge:   ['Still joining as planned', 'I need to discuss something'],
  manual:              ['Got it, thank you!', 'I have a question'],
};

// ── Risk scoring ─────────────────────────────────────────────────────────────

function calcRisk(candidate) {
  if (candidate.state === 'joined')   return { score: 0,   level: 'low'    };
  if (candidate.state === 'dropped')  return { score: 100, level: 'high'   };

  let score = 20; // baseline

  const now     = new Date();
  const doj     = candidate.doj ? new Date(candidate.doj) : null;
  const daysToJoin = doj ? Math.ceil((doj - now) / 86400000) : null;
  const lastEmail  = candidate.last_email_at ? new Date(candidate.last_email_at) : null;
  const lastReply  = candidate.last_response_at ? new Date(candidate.last_response_at) : null;
  const daysSinceEmail = lastEmail ? Math.floor((now - lastEmail) / 86400000) : 999;
  const daysSinceReply = lastReply ? Math.floor((now - lastReply) / 86400000) : 999;

  // State-based risk
  if (candidate.state === 'offer_accepted') score += 20; // resignation not confirmed
  if (candidate.state === 'resigned')       score += 5;  // BGV pending
  if (candidate.state === 'bgv')            score += 5;  // awaiting BGV clear
  if (candidate.state === 'confirmed')      score -= 10; // confirmed, lower risk

  // DOJ proximity
  if (daysToJoin !== null) {
    if (daysToJoin < 0)  score += 40; // overdue!
    else if (daysToJoin <= 3)  score += 30;
    else if (daysToJoin <= 7)  score += 20;
    else if (daysToJoin <= 14) score += 10;
  }

  // Engagement recency
  if (daysSinceReply > 10) score += 25;
  else if (daysSinceReply > 5) score += 10;

  if (daysSinceEmail > 7 && candidate.state !== 'joined') score += 10;

  score = Math.max(0, Math.min(100, score));
  const level = score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { score, level };
}

// ── Email trigger logic ───────────────────────────────────────────────────────

function shouldSendEmail(candidate, emails) {
  if (candidate.auto_paused) return null;
  if (['joined', 'dropped'].includes(candidate.state)) return null;

  const now          = new Date();
  const doj          = candidate.doj ? new Date(candidate.doj) : null;
  const daysToJoin   = doj ? Math.ceil((doj - now) / 86400000) : null;
  const lastEmail    = candidate.last_email_at ? new Date(candidate.last_email_at) : null;
  const hoursSince   = lastEmail ? (now - lastEmail) / 3600000 : 9999;
  const sentReasons  = new Set(emails.map(e => e.trigger_reason));

  // Space emails at least 18 hrs apart
  if (hoursSince < 18) return null;

  // Day 0 welcome — always first
  if (!sentReasons.has('day0_welcome')) return 'day0_welcome';

  // Resignation check — day 2–4 if still offer_accepted
  if (candidate.state === 'offer_accepted' && !sentReasons.has('resignation_check') && hoursSince > 48)
    return 'resignation_check';

  // BGV nudge — after resigned, if BGV not started
  if (candidate.state === 'resigned' && !sentReasons.has('bgv_nudge'))
    return 'bgv_nudge';

  // T-14 checklist
  if (daysToJoin !== null && daysToJoin <= 14 && daysToJoin > 7 && !sentReasons.has('t14_checklist'))
    return 't14_checklist';

  // T-7 warmup
  if (daysToJoin !== null && daysToJoin <= 7 && daysToJoin > 1 && !sentReasons.has('t7_warmup'))
    return 't7_warmup';

  // T-1 excitement
  if (daysToJoin !== null && daysToJoin <= 1 && daysToJoin >= 0 && !sentReasons.has('t1_excitement'))
    return 't1_excitement';

  // Risk-based
  if (candidate.risk_level === 'high' && !sentReasons.has('risk_red_escalation'))
    return 'risk_red_escalation';
  if (candidate.risk_level === 'medium' && !sentReasons.has('risk_amber_checkin') && hoursSince > 72)
    return 'risk_amber_checkin';

  // No-response nudge — no reply in 6+ days and last email was 5+ days ago
  const lastReply = candidate.last_response_at ? new Date(candidate.last_response_at) : null;
  const daysSinceReply = lastReply ? Math.floor((now - lastReply) / 86400000) : 999;
  if (daysSinceReply > 6 && hoursSince > 120 && !sentReasons.has('no_response_nudge'))
    return 'no_response_nudge';

  return null;
}

// ── AI email generation ───────────────────────────────────────────────────────

const TRIGGER_CONTEXT = {
  day0_welcome:         'This is the first email right after the candidate accepted the offer. Be warm and celebratory. Confirm DOJ and set expectations for next steps.',
  resignation_check:    'Candidate has not yet confirmed resignation. Gently check in — ask if they have submitted resignation and if there are any concerns we can help with.',
  bgv_nudge:            'Candidate has resigned but BGV has not been initiated. Remind them to share documents for background verification and explain the importance.',
  t14_checklist:        'Two weeks to joining. Share a pre-joining checklist — documents needed, system setup, first day logistics. Keep it practical and helpful.',
  t7_warmup:            'One week to joining. Build excitement. Share a bit about the team culture, what to expect on Day 1, and answer any last-minute questions.',
  t1_excitement:        'Tomorrow is joining day! Short, high-energy note. Express excitement, confirm first day details (time, location/WFH link, who to report to).',
  risk_amber_checkin:   'Candidate appears disengaged. Soft, personal check-in — not pushy. Ask how things are going, if there are any concerns we can help address.',
  risk_red_escalation:  'High drop risk detected. Warm but slightly urgent tone. Mention that the hiring manager is looking forward to them joining. Offer to jump on a quick call to address any concerns.',
  no_response_nudge:    'No response to previous emails. One gentle nudge — short and friendly. Offer an easy way to respond (just reply yes/no).',
};

async function generateEmail(candidate, triggerReason) {
  const doj = candidate.doj
    ? new Date(candidate.doj).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'your joining date';

  const prompt = `You are a friendly, professional recruiter at RecruiterOS writing a post-offer follow-up email.

Candidate: ${candidate.candidate_name}
Role: ${candidate.role_title || 'the position'}
Company: ${candidate.company_name || 'the client'}
Date of Joining: ${doj}
Current State: ${candidate.state.replace(/_/g, ' ')}
Risk Level: ${candidate.risk_level}

Email purpose: ${TRIGGER_CONTEXT[triggerReason] || 'General follow-up to keep the candidate engaged.'}

Write a professional but warm email. Rules:
- Sound human, not templated
- Keep it concise (under 200 words)
- Do NOT use placeholders like [Name] — use the actual candidate name
- Sign off as "The RecruiterOS Team"
- NEVER use the words "passed", "failed", "cleared", "did not make it", or "selected after interview" — the candidate has already accepted an offer; refer to them as "joining us", "your offer", "your start date", or "the team"
- Return ONLY valid JSON: { "subject": "...", "body": "..." }
- body should be plain text with line breaks (\\n), no HTML`;

  const msg = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text;
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
    return { subject: parsed.subject, body: parsed.body };
  } catch {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s !== -1 && e !== -1) {
      try { return JSON.parse(raw.slice(s, e + 1)); } catch {}
    }
    throw new Error('Failed to parse AI email response');
  }
}

function bodyToHtml(text, interaction = null) {
  const ctaHtml = (interaction?.token && interaction?.options?.length) ? `
<div style="margin:28px 0;padding:20px;background:#f9f9f9;border-radius:8px;text-align:center">
  <p style="margin:0 0 14px;font-size:14px;color:#555;font-weight:600">Please acknowledge this email by clicking one of the options below — your response helps us support your onboarding smoothly.</p>
  <div>
    ${interaction.options.map((opt, i) => `<a href="${FRONTEND_URL}/respond?t=${interaction.token}&r=${i}" style="display:inline-block;margin:4px 6px;padding:10px 18px;background:#1a1a2e;color:#fff;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none">${opt}</a>`).join('')}
  </div>
</div>` : '';

  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto">
${text.split('\n').map(l => l.trim() ? `<p style="margin:0 0 12px">${l}</p>` : '').join('')}
${ctaHtml}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
<p style="font-size:12px;color:#999">You're receiving this from RecruiterOS as part of our candidate engagement programme. Reply to this email if you have any questions.</p>
</div>`;
}

// ── Main: process one candidate ───────────────────────────────────────────────

async function processCandidate(candidate) {
  const emails = db.prepare(
    'SELECT trigger_reason, sent_at FROM pofu_emails WHERE pofu_candidate_id = ? AND direction = ? ORDER BY sent_at ASC'
  ).all(candidate.id, 'outbound');

  // Recalculate risk
  const { score, level } = calcRisk(candidate);
  db.prepare('UPDATE pofu_candidates SET risk_score=?, risk_level=?, updated_at=datetime("now") WHERE id=?')
    .run(score, level, candidate.id);
  candidate.risk_score = score;
  candidate.risk_level = level;

  const trigger = shouldSendEmail(candidate, emails);
  if (!trigger) return { sent: false, reason: 'no trigger' };

  const { subject, body } = await generateEmail(candidate, trigger);
  const options = RESPONSE_OPTIONS[trigger] || DEFAULT_RESPONSE_OPTIONS;
  const token   = crypto.randomBytes(16).toString('hex');
  const html    = bodyToHtml(body, options ? { token, options } : null);

  await sendEmail({ to: candidate.candidate_email, subject, html, text: body });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO pofu_emails (pofu_candidate_id, direction, trigger_reason, subject, body, ai_generated, sent_at, response_token, response_options)
    VALUES (?, 'outbound', ?, ?, ?, 1, ?, ?, ?)
  `).run(candidate.id, trigger, subject, body, now, token, options ? JSON.stringify(options) : null);

  db.prepare('UPDATE pofu_candidates SET last_email_at=?, updated_at=datetime("now") WHERE id=?')
    .run(now, candidate.id);

  console.log(`[POFU] Sent ${trigger} → ${candidate.candidate_email}`);
  return { sent: true, trigger, subject };
}

// ── Run full scheduler cycle ──────────────────────────────────────────────────

async function runSchedulerCycle() {
  const active = db.prepare(
    `SELECT * FROM pofu_candidates WHERE state NOT IN ('joined','dropped') AND auto_paused = 0`
  ).all();

  console.log(`[POFU Scheduler] Processing ${active.length} active candidates`);

  for (const candidate of active) {
    try {
      await processCandidate(candidate);
    } catch (err) {
      console.error(`[POFU] Error processing candidate ${candidate.id}:`, err.message);
    }
  }
}

module.exports = { calcRisk, generateEmail, processCandidate, runSchedulerCycle, bodyToHtml, RESPONSE_OPTIONS, DEFAULT_RESPONSE_OPTIONS };
