const SibApiV3Sdk = require('@sendinblue/client');
require('dotenv').config();

const DEBUG_EMAIL_MODE = process.env.DEBUG_EMAIL_MODE === 'true';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || '';

if (!BREVO_API_KEY && !DEBUG_EMAIL_MODE) {
  console.warn('BREVO_API_KEY not set and DEBUG_EMAIL_MODE is not enabled. Emails will not be sent.');
}

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
if (BREVO_API_KEY) apiKey.apiKey = BREVO_API_KEY;

const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendOtpEmail(toEmail, otpCode) {
  if (DEBUG_EMAIL_MODE) {
    console.log(`[DEBUG EMAIL] OTP for ${toEmail}: ${otpCode}`);
    return Promise.resolve({ debug: true });
  }

  if (!BREVO_API_KEY) {
    console.warn('No BREVO_API_KEY configured; skipping sending email.');
    return Promise.resolve({ skipped: true });
  }

  const subject = 'Your Universal Clipboard verification code';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2 style="color: #0b63a8;">Universal Clipboard</h2>
      <p>Your one-time verification code is:</p>
      <div style="font-family: monospace; font-size: 28px; font-weight: 700; background:#f1f5f9; padding:12px 16px; display:inline-block; letter-spacing:6px;">${otpCode}</div>
      <p style="color:#666;">This code expires in ${process.env.OTP_EXPIRATION_MINUTES || '10'} minutes. Do not share it with anyone.</p>
    </div>
  `;

  const sendSmtpEmail = {
    to: [{ email: toEmail }],
    sender: { email: BREVO_SENDER_EMAIL },
    subject: subject,
    htmlContent: htmlContent
  };

  try {
    const resp = await transactionalApi.sendTransacEmail(sendSmtpEmail);
    console.log(`OTP email sent to ${toEmail} via Brevo`);
    return resp;
  } catch (err) {
    console.error('Error sending OTP via Brevo:', err && err.response ? err.response.body : err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
