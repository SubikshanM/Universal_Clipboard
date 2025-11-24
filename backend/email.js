const SibApiV3Sdk = require('@sendinblue/client');
require('dotenv').config();

// Configuration variables read directly from environment
const DEBUG_EMAIL_MODE = process.env.DEBUG_EMAIL_MODE === 'true';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@universalclipboard.com';
const OTP_EXPIRATION_MINUTES = process.env.OTP_EXPIRATION_MINUTES || '5';


// --- Brevo API Initialization: No global initialization ---
// Client creation is now inside the function (sendOtpEmail) 
// to avoid the "is not a constructor" TypeError during module loading.

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

    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
        console.error('FATAL: Brevo not fully configured (API Key or Sender Email missing). Cannot send email.');
        return false;
    }

    try {
        // 1. Initialize the client configuration inside the function.
        // This is the key fix to resolve the deployment issue.
        const apiConfig = new SibApiV3Sdk.ApiClient();

        // 2. Set the API key directly on the client configuration object.
        apiConfig.authentications['api-key'].apiKey = BREVO_API_KEY;

        // 3. Initialize the Transactional API instance.
        const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi(apiConfig);
    
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

        // 4. Create the email payload object.
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: toEmail }];
        sendSmtpEmail.sender = { email: BREVO_SENDER_EMAIL, name: "Universal Clipboard" }; 
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = htmlContent;

        await transactionalApi.sendTransacEmail(sendSmtpEmail);
        console.log(`OTP email sent successfully to ${toEmail} via Brevo`);
        return true;

    } catch (err) {
        // Catch any error during setup or the actual API call
        console.error('Error during Brevo setup or sending:', err.message);
        return false;
    }
}

module.exports = { sendOtpEmail };