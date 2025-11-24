const SibApiV3Sdk = require('@sendinblue/client');
require('dotenv').config();

// Configuration variables read directly from environment
const DEBUG_EMAIL_MODE = process.env.DEBUG_EMAIL_MODE === 'true';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@universalclipboard.com';
const OTP_EXPIRATION_MINUTES = process.env.OTP_EXPIRATION_MINUTES || '5';

// --- Brevo API Initialization ---

// 1. Set the API Key Globally on the default client.
// This is the correct, fixed way to configure the client instance.
if (BREVO_API_KEY) {
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = BREVO_API_KEY;
}

// 2. Initialize the Transactional API instance using the configured client.
const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi();


/**
 * Sends a transactional email containing the OTP code using the Brevo API.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} otpCode - The 6-digit one-time password.
 * @returns {Promise<boolean>} - True if email sent successfully, false otherwise.
 */
async function sendOtpEmail(toEmail, otpCode) {
    if (DEBUG_EMAIL_MODE) {
        console.log(`[DEBUG EMAIL] OTP for ${toEmail}: ${otpCode}`);
        return true; // Simulate success in debug mode
    }

    if (!BREVO_API_KEY) {
        console.error('FATAL: No BREVO_API_KEY configured. Cannot send email.');
        return false;
    }

    if (!BREVO_SENDER_EMAIL) {
        console.error('FATAL: No BREVO_SENDER_EMAIL configured. Cannot send email.');
        return false;
    }

    const subject = 'Your Universal Clipboard verification code';
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #111; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #4A90E2; border-bottom: 2px solid #eee; padding-bottom: 10px;">Universal Clipboard Verification</h2>
            <p>Your one-time verification code is:</p>
            <div style="font-family: monospace; font-size: 28px; font-weight: 700; background: #f1f5f9; color: #E91E63; padding: 15px 20px; border-radius: 4px; display: inline-block; letter-spacing: 4px;">
                ${otpCode}
            </div>
            <p style="color:#666; margin-top: 20px;">
                This code is valid for ${OTP_EXPIRATION_MINUTES} minutes. Do not share it with anyone.
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">
                If you did not request this, you can safely ignore this email.
            </p>
        </div>
    `;

    const sendSmtpEmail = {
        to: [{ email: toEmail }],
        // Using the configured sender email and a friendly name
        sender: { email: BREVO_SENDER_EMAIL, name: "Universal Clipboard" }, 
        subject: subject,
        htmlContent: htmlContent
    };

    try {
        await transactionalApi.sendTransacEmail(sendSmtpEmail);
        console.log(`OTP email sent successfully to ${toEmail} via Brevo`);
        return true;
    } catch (err) {
        console.error('Error sending OTP via Brevo:', err && err.response ? err.response.body : err);
        return false;
    }
}

module.exports = { sendOtpEmail };