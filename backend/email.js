// email.js - nodemailer helper for sending OTP emails
const nodemailer = require('nodemailer');
// Prefer SendGrid Web API when possible to avoid SMTP port/connectivity issues on some hosts
let sgMail = null;
require('dotenv').config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
let EMAIL_FROM = process.env.EMAIL_FROM || 'Universal Clipboard <no-reply@localhost>';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY; // optional (preferred)
const SENDGRID_SENDER_EMAIL = process.env.SENDGRID_SENDER_EMAIL; // optional override for from address
if (SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
  } catch (e) {
    console.warn('SendGrid package not installed; falling back to SMTP. To use SendGrid API install @sendgrid/mail.');
    sgMail = null;
  }
}
const DEBUG_EMAIL_MODE = process.env.DEBUG_EMAIL_MODE === 'true';

let transporter = null;

// If SendGrid Web API is available prefer it (uses HTTPS/443, more reliable on hosted platforms)
if (sgMail) {
  if (SENDGRID_SENDER_EMAIL) {
    EMAIL_FROM = SENDGRID_SENDER_EMAIL;
  }
} else if (SENDGRID_API_KEY) {
  // If @sendgrid/mail not installed, fall back to SMTP bridge
  if (SENDGRID_SENDER_EMAIL) {
    EMAIL_FROM = SENDGRID_SENDER_EMAIL;
  }
  transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: 'apikey',
      pass: SENDGRID_API_KEY
    }
  });

} else if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
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
    console.warn('No SMTP provider configured. Set DEBUG_EMAIL_MODE=true to log OTPs for development.');
  }
}

async function sendOtpEmail(toEmail, otpCode) {
  // Always log the OTP when DEBUG_EMAIL_MODE is enabled (useful for testing)
  if (DEBUG_EMAIL_MODE) {
    console.log(`[DEBUG EMAIL] OTP for ${toEmail}: ${otpCode}`);
  }

  // If SendGrid Web API is available, use it (HTTPS)
  if (sgMail) {
    const msg = {
      to: toEmail,
      from: EMAIL_FROM,
      subject,
      text,
      html
    };
    try {
      const response = await sgMail.send(msg);
      console.log(`OTP email sent to ${toEmail} via SendGrid Web API`);
      return response;
    } catch (err) {
      console.error('Error sending OTP email via SendGrid Web API:', err);
      // fall through to try SMTP transporter if available
    }
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
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your OTP Code</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #333333; font-size: 28px; font-weight: 600;">Universal Clipboard</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 0 40px 20px 40px;">
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                    Your one-time verification code is:
                  </p>
                  
                  <!-- OTP Code Box -->
                  <div style="background-color: #e9ecef; border-radius: 8px; padding: 24px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${otpCode}
                    </span>
                  </div>
                  
                  <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                    This code expires in <strong>${process.env.OTP_EXPIRATION_MINUTES || '10'} minutes</strong>. 
                    Please do not share this code with anyone.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px 40px 40px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                    If you didn't request this code, please ignore this email.
                  </p>
                  <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} Universal Clipboard. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

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
