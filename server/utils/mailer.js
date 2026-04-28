const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html, text }) {
  return transporter.sendMail({
    from:    `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    replyTo: process.env.SMTP_REPLY_TO,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
  });
}

async function verifyConnection() {
  return transporter.verify();
}

module.exports = { sendEmail, verifyConnection };
