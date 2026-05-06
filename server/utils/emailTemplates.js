/**
 * Shared invite email template used by VI, MCQ, and Coding routes.
 *
 * All three share the same personal-follow-up tone:
 * "It was great speaking with you — here's what I promised."
 */
function buildInviteEmail({
  candidateName,
  recruiterName,
  assessmentType,   // e.g. 'MCQ assessment', 'Coding assessment', 'Video Interview'
  jobTitle,         // may be empty / null → omitted from copy
  timeLimitMin,
  passScore,        // null → omitted from info box
  link,
  ctaLabel,         // 'Start Assessment' | 'Start Interview'
  extraInfo = [],   // additional info-box lines (plain HTML strings)
  isReminder = false,
}) {
  const roleCtx = jobTitle
    ? ` for the <strong style="color:#0f172a;">${jobTitle}</strong> role`
    : '';

  const bodyText = isReminder
    ? `Just following up — I shared a ${assessmentType}${roleCtx} earlier and wanted to make sure the link reached you. It's still active whenever you're ready.`
    : `It was great speaking with you earlier. As promised, here's the ${assessmentType} I mentioned${roleCtx} — this is the next step in our process.`;

  const infoLines = [
    `⏱&nbsp; <strong>Time limit:</strong> ${timeLimitMin} minutes`,
    ...(passScore != null ? [`✅&nbsp; <strong>Passing score:</strong> ${passScore}%`] : []),
    ...extraInfo,
  ];

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;background:#f8fafc;">
  <div style="background:#ffffff;border-radius:16px;padding:36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04);">

    <div style="width:48px;height:4px;background:#F97316;border-radius:2px;margin-bottom:24px;"></div>

    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Hi ${candidateName},</h2>

    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">${bodyText}</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      ${infoLines.map((line, i) => `<div style="font-size:13px;color:#64748b;${i > 0 ? 'margin-top:7px;' : ''}">${line}</div>`).join('')}
    </div>

    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 22px;">
      I'd recommend completing this within <strong>48 hours</strong>. Use the button below whenever you're ready.
    </p>

    <a href="${link}"
       style="display:inline-block;background:#F97316;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
      ${ctaLabel} →
    </a>

    <p style="color:#94a3b8;font-size:13px;margin:22px 0 0;line-height:1.6;">
      If you have any questions, just reply to this email.
    </p>

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Best,</p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#0f172a;">${recruiterName}</p>
    </div>

  </div>
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;line-height:1.6;">
    Powered by <strong>Zeople</strong> | RecruiterOS &nbsp;·&nbsp; This link is personal to you — please do not share it.
  </p>
</div>`;
}

module.exports = { buildInviteEmail };
