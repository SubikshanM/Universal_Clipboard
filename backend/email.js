// email.js - nodemailer helper for sending OTP emails
const nodemailer = require('nodemailer');
require('dotenv').config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Universal Clipboard <no-reply@localhost>';
const DEBUG_EMAIL_MODE = process.env.DEBUG_EMAIL_MODE === 'true';

let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
} else {
  if (!DEBUG_EMAIL_MODE) {
    console.warn('SMTP credentials not fully provided. Set DEBUG_EMAIL_MODE=true to log OTPs for development.');
  }
}

async function sendOtpEmail(toEmail, otpCode) {
  // Always log the OTP when DEBUG_EMAIL_MODE is enabled (useful for testing)
  if (DEBUG_EMAIL_MODE) {
    console.log(`[DEBUG EMAIL] OTP for ${toEmail}: ${otpCode}`);
  }

  // If transporter is not configured, fall back to logging-only behavior
  if (!transporter) {
    if (!DEBUG_EMAIL_MODE) {
      console.warn('No SMTP transporter configured; OTP was logged instead of sent.');
    }
    return Promise.resolve({ logged: true });
  }

  const subject = 'Your Universal Clipboard signup OTP';
  const text = `Your one-time verification code is: ${otpCode}\nIt expires in a few minutes.`;
  const html = `<p>Your one-time verification code is: <strong>${otpCode}</strong></p><p>This code expires shortly.</p>`;

  const msg = {
    from: EMAIL_FROM,
    to: toEmail,
    subject,
    text,
    html
  };

  try {
    const info = await transporter.sendMail(msg);
    console.log(`OTP email sent to ${toEmail}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('Error sending OTP email:', err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
