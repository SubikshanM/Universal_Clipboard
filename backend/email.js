const SibApiV3Sdk = require('@sendinblue/client');
require('dotenv').config();

// Safely access the SDK classes at the module level.
// We check if the classes are available directly on the export, or if they are 
// nested under a common ".default" property (a common Node.js pattern).
const BrevoClasses = SibApiV3Sdk.ApiClient ? SibApiV3Sdk : (SibApiV3Sdk.default || SibApiV3Sdk);

const ApiClient = BrevoClasses.ApiClient;
const TransactionalEmailsApi = BrevoClasses.TransactionalEmailsApi;
const SendSmtpEmail = BrevoClasses.SendSmtpEmail;

// Configuration variables read directly from environment
const DEBUG_EMAIL_MODE = process.env.DEBUG_EMAIL_MODE === 'true';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@universalclipboard.com';
const OTP_EXPIRATION_MINUTES = process.env.OTP_EXPIRATION_MINUTES || '5';


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
        // --- Client Setup using the safely extracted classes ---
        
        // This check confirms the classes were successfully extracted at module load time
        if (!ApiClient || !TransactionalEmailsApi || !SendSmtpEmail) {
            console.error("FATAL: Brevo SDK classes failed to load dynamically. Cannot proceed.");
            return false;
        }

        // Initialize the client using the globally available, extracted classes
        const apiConfig = new ApiClient();
        apiConfig.authentications['api-key'].apiKey = BREVO_API_KEY;
        const transactionalApi = new TransactionalEmailsApi(apiConfig);
    
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

        // Create the email payload object using the globally available, extracted class
        const sendSmtpEmail = new SendSmtpEmail();
        sendSmtpEmail.to = [{ email: toEmail }];
        sendSmtpEmail.sender = { email: BREVO_SENDER_EMAIL, name: "Universal Clipboard" }; 
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = htmlContent;

        await transactionalApi.sendTransacEmail(sendSmtpEmail);
        console.log(`OTP email sent successfully to ${toEmail} via Brevo`);
        return true;

    } catch (err) {
        // Log the detailed error from Brevo API response if available
        console.error('CRITICAL: Error during Brevo API call or setup:', err && err.response ? err.response.body : err.message);
        return false;
    }
}

module.exports = { sendOtpEmail };