// ═══════════════════════════════════════════
// config/email.js — Nodemailer Setup
// ═══════════════════════════════════════════
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',  // or 'smtp.mailtrap.io' for testing
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,  // Gmail App Password
  },
});

transporter.verify((err) => {
  if (err) console.error('❌ Email config error:', err.message);
  else console.log('✅ Email service ready');
});

module.exports = transporter;