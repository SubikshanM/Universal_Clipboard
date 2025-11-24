require('dotenv').config();

// Use the environment / feature flags
const DEBUG_EMAIL_MODE = process.env.DEBUG_EMAIL_MODE === 'true';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@universalclipboard.com';
const OTP_EXPIRATION_MINUTES = process.env.OTP_EXPIRATION_MINUTES || '5';

/**
 * Minimal, dependency-free Brevo (Sendinblue) transactional email sender.
 * Uses Node's global fetch (available in Node 18+) to call Brevo's HTTP API directly.
 * This avoids coupling to the SDK shape which can vary between versions/environments.
 *
 * @param {string} toEmail
 * @param {string} otpCode
 * @returns {Promise<boolean>} true when request was accepted by Brevo
 */
async function sendOtpEmail(toEmail, otpCode) {
    if (DEBUG_EMAIL_MODE) {
        console.log(`[DEBUG EMAIL] OTP for ${toEmail}: ${otpCode}`);
        return true;
    }

    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
        console.error('FATAL: Brevo not fully configured (API Key or Sender Email missing). Cannot send email.');
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

    try {
        const payload = {
            sender: { email: BREVO_SENDER_EMAIL, name: 'Universal Clipboard' },
            to: [{ email: toEmail }],
            subject,
            htmlContent
        };

        const res = await fetch('https://api.sendinblue.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const body = await res.text();
            console.error('CRITICAL: Brevo API returned non-OK status', res.status, body);
            return false;
        }

        console.log(`OTP email sent successfully to ${toEmail} via Brevo (HTTP)`);
        return true;
    } catch (err) {
        console.error('CRITICAL: Error during Brevo HTTP send:', err && err.stack ? err.stack : err);
        return false;
    }
}

module.exports = { sendOtpEmail };