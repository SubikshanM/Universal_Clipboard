const express = require('express');
const router = express.Router();
const db = require('../db'); // Database connection module
const bcrypt = require('bcryptjs'); // Secure hashing library (use bcryptjs for easier installs)
const jwt = require('jsonwebtoken'); // JWT library for token generation
const { sendOtpEmail } = require('../email');

// Configuration
const saltRounds = 10; // Standard for bcrypt hashing
const tokenExpiration = '2h'; // JWT expires in 2 hours

// OTP defaults
const OTP_EXPIRATION_MINUTES = parseInt(process.env.OTP_EXPIRATION_MINUTES || '10', 10);
const OTP_RATE_LIMIT_PER_HOUR = parseInt(process.env.OTP_RATE_LIMIT_PER_HOUR || '5', 10);

// Helper: common rate-limit check for OTPs (uses password_reset_otps and signup_otps)
async function recentOtpCount(email) {
    try {
        const r = await db.query(
            `SELECT (COALESCE((SELECT COUNT(*)::int FROM signup_otps WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'),0) + 
                     COALESCE((SELECT COUNT(*)::int FROM password_reset_otps WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'),0))::int AS cnt`,
            [email]
        );
        return parseInt(r.rows[0].cnt, 10) || 0;
    } catch (e) {
        console.error('Error checking recent OTP count:', e);
        return 0;
    }
}

// --- POST /api/auth/signup ---
// Handles new user registration, securely hashing the password.
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // 1. Check if user already exists
        const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists.' });
        }

        // 2. Securely hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Save the new user to the database
        const result = await db.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
            [email, hashedPassword]
        );

        res.status(201).json({ 
            message: 'User registered successfully.',
            userId: result.rows[0].id 
        });

    } catch (err) {
        console.error('Error during signup:', err.stack);
        res.status(500).json({ error: 'Internal server error during registration.' });
    }
});

// POST /api/auth/request-signup-otp
// Request an OTP to be sent to the provided email for signup verification.
router.post('/request-signup-otp', async (req, res) => {
    const { email, password, username } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // First, do a quick user-existence check. If a user already exists, don't send an OTP.
        const userExist = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExist.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        // Rate-limit: count recent OTPs for this email in the last hour
        const rateRes = await db.query(
            `SELECT COUNT(*)::int AS cnt FROM signup_otps WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
            [email]
        );
        const recentCount = parseInt(rateRes.rows[0].cnt, 10) || 0;
        if (recentCount >= OTP_RATE_LIMIT_PER_HOUR) {
            return res.status(429).json({ error: 'Too many OTP requests for this email. Please try again later.' });
        }

        // Generate a 6-digit numeric OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));

        // Hash OTP and password
        const otpHash = await bcrypt.hash(otp, saltRounds);
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

        // Persist the OTP entry
        await db.query(
            `INSERT INTO signup_otps (email, otp_hash, password_hash, username, expires_at) VALUES ($1,$2,$3,$4,$5)`,
            [email, otpHash, passwordHash, username || null, expiresAt]
        );

        // Also write plaintext OTP to the outbox table so internal tools (or debugging) can fetch it
        try {
            await db.query(
                `INSERT INTO signup_otp_outbox (email, otp_plain, expires_at) VALUES ($1,$2,$3)`,
                [email, otp, expiresAt]
            );
        } catch (e) {
            console.error('Failed to write to signup_otp_outbox:', e);
            // not fatal; we continue — outbox is a convenience for internal debugging
        }

        // Send OTP via email directly from backend
        try {
            await sendOtpEmail(email, otp);
        } catch (err) {
            console.error('Failed to send OTP email:', err);
            // continue — we still respond 200 to avoid leaking information
        }

        // Generic response to avoid user enumeration
        return res.status(200).json({ message: 'If the email is valid an OTP has been sent.' });
    } catch (err) {
        console.error('Error in request-signup-otp:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/send-otp
// A lightweight endpoint that generates and issues an OTP for an email only (no password required).
// Useful for external systems (like n8n) or flows that want to request an OTP without submitting
// a password yet. This preserves the same outbox behavior and rate-limiting as the signup OTP flow.
router.post('/send-otp', async (req, res) => {
    const { email, username } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
        // Rate-limit: count recent OTPs for this email in the last hour
        const rateRes = await db.query(
            `SELECT COUNT(*)::int AS cnt FROM signup_otps WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
            [email]
        );
        const recentCount = parseInt(rateRes.rows[0].cnt, 10) || 0;
        if (recentCount >= OTP_RATE_LIMIT_PER_HOUR) {
            return res.status(429).json({ error: 'Too many OTP requests for this email. Please try again later.' });
        }

        // Generate a 6-digit numeric OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));

        // Hash OTP; we don't have a password here so store password_hash as null
        const otpHash = await bcrypt.hash(otp, saltRounds);

        const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

        // Persist the OTP entry (password_hash left null for now)
        await db.query(
            `INSERT INTO signup_otps (email, otp_hash, password_hash, username, expires_at) VALUES ($1,$2,$3,$4,$5)`,
            [email, otpHash, null, username || null, expiresAt]
        );

        // Write plaintext OTP to outbox for internal retrieval/debugging
        try {
            await db.query(
                `INSERT INTO signup_otp_outbox (email, otp_plain, expires_at) VALUES ($1,$2,$3)`,
                [email, otp, expiresAt]
            );
        } catch (e) {
            console.error('Failed to write to signup_otp_outbox (send-otp):', e);
        }
        // Send email from backend directly
        try {
            await sendOtpEmail(email, otp);
        } catch (err) {
            console.error('Failed to send OTP email (send-otp):', err);
        }

        // Generic response to avoid leaking information
        return res.status(200).json({ message: 'If the email is valid an OTP has been sent.' });
    } catch (err) {
        console.error('Error in send-otp:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/request-password-reset
// Starts the password reset flow by sending an OTP to the user's email.
router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
        // Ensure the email belongs to an existing user. Return generic response if not.
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            // Generic response to avoid user enumeration
            return res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
        }

        // Rate-limit using both OTP tables
        const recentCount = await recentOtpCount(email);
        if (recentCount >= OTP_RATE_LIMIT_PER_HOUR) {
            return res.status(429).json({ error: 'Too many OTP requests for this email. Please try again later.' });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = await bcrypt.hash(otp, saltRounds);
        const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

        await db.query(
            `INSERT INTO password_reset_otps (email, otp_hash, expires_at) VALUES ($1,$2,$3)`,
            [email, otpHash, expiresAt]
        );

        // also write to outbox for internal testing/debugging
        try {
            await db.query(
                `INSERT INTO signup_otp_outbox (email, otp_plain, expires_at) VALUES ($1,$2,$3)`,
                [email, otp, expiresAt]
            );
        } catch (e) {
            console.error('Failed to write password reset OTP to outbox:', e);
        }

        try {
            await sendOtpEmail(email, otp);
        } catch (err) {
            console.error('Failed to send password reset OTP email:', err);
        }

        return res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
    } catch (err) {
        console.error('Error in request-password-reset:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/reset-password
// Finalize password reset by verifying OTP and updating the user's password.
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, OTP and new password are required.' });

    try {
        // Find the most recent non-used, unexpired password reset OTP
        const otpRes = await db.query(
            `SELECT * FROM password_reset_otps WHERE email = $1 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (otpRes.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        const otpRow = otpRes.rows[0];
        const match = await bcrypt.compare(otp, otpRow.otp_hash);
        if (!match) return res.status(400).json({ error: 'Invalid OTP.' });

        // Hash new password and update user record
        const newHash = await bcrypt.hash(newPassword, saltRounds);
        const updateRes = await db.query('UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id', [newHash, email]);
        if (updateRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Mark OTP used
        await db.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [otpRow.id]);

        return res.status(200).json({ message: 'Password reset successful. Please login with your new password.' });
    } catch (err) {
        console.error('Error in reset-password:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/verify-password-reset-otp
// Verify a password-reset OTP without changing the password. This allows the frontend to
// confirm the OTP before showing new-password inputs. Does NOT mark the OTP used.
router.post('/verify-password-reset-otp', async (req, res) => {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    try {
        const otpRes = await db.query(
            `SELECT * FROM password_reset_otps WHERE email = $1 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (otpRes.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        const otpRow = otpRes.rows[0];
        const match = await bcrypt.compare(otp, otpRow.otp_hash);
        if (!match) return res.status(400).json({ error: 'Invalid OTP.' });

        // OTP is valid; return success without consuming it
        return res.status(200).json({ message: 'OTP valid.' });
    } catch (err) {
        console.error('Error in verify-password-reset-otp:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/signup-otp
// Generate an OTP for signup and write to outbox table for internal backend retrieval.
// Also sends the OTP email directly via backend email.js
router.post('/signup-otp', async (req, res) => {
    const { email, password, username } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // Rate-limit: count recent OTPs for this email in the last hour
        const rateRes = await db.query(
            `SELECT COUNT(*)::int AS cnt FROM signup_otps WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
            [email]
        );
        const recentCount = parseInt(rateRes.rows[0].cnt, 10) || 0;
        if (recentCount >= OTP_RATE_LIMIT_PER_HOUR) {
            return res.status(429).json({ error: 'Too many OTP requests for this email. Please try again later.' });
        }

        // Generate a 6-digit numeric OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));

        // Hash OTP and password
        const otpHash = await bcrypt.hash(otp, saltRounds);
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

        // Persist the OTP entry in signup_otps table
        await db.query(
            `INSERT INTO signup_otps (email, otp_hash, password_hash, username, expires_at) VALUES ($1,$2,$3,$4,$5)`,
            [email, otpHash, passwordHash, username || null, expiresAt]
        );

        // Write plaintext OTP to outbox table for internal retrieval
        await db.query(
            `INSERT INTO signup_otp_outbox (email, otp_plain, expires_at) VALUES ($1,$2,$3)`,
            [email, otp, expiresAt]
        );

        // Send OTP via email directly from backend
        try {
            await sendOtpEmail(email, otp);
        } catch (err) {
            console.error('Failed to send OTP email:', err);
            // continue — we still respond 200 to avoid leaking information
        }

        // Generic response to avoid user enumeration
        return res.status(200).json({ message: 'If the email is valid an OTP has been sent.' });
    } catch (err) {
        console.error('Error in signup-otp:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/outbox-fetch
// Internal endpoint for retrieving plaintext OTPs from outbox table.
// Returns the latest non-consumed unexpired OTP for the given email and marks it consumed.
router.post('/outbox-fetch', async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        // Fetch the most recent non-consumed, unexpired OTP for this email
        const outboxRes = await db.query(
            `SELECT id, otp_plain, expires_at FROM signup_otp_outbox 
             WHERE email = $1 AND consumed = false AND expires_at > NOW() 
             ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (outboxRes.rows.length === 0) {
            return res.status(404).json({ error: 'No OTP found for this email.' });
        }

        const outboxRow = outboxRes.rows[0];

        // Mark the OTP as consumed
        await db.query(
            `UPDATE signup_otp_outbox SET consumed = true WHERE id = $1`,
            [outboxRow.id]
        );

        return res.status(200).json({ 
            otp: outboxRow.otp_plain, 
            expiresAt: outboxRow.expires_at 
        });

    } catch (err) {
        console.error('Error in outbox-fetch:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/verify-signup-otp
// Verify the OTP for an email and complete signup (create user). Does NOT auto-login.
router.post('/verify-signup-otp', async (req, res) => {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    try {
        // Find the most recent, unused, unexpired OTP record for this email
        const otpRes = await db.query(
            `SELECT * FROM signup_otps WHERE email = $1 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (otpRes.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        const otpRow = otpRes.rows[0];

        const match = await bcrypt.compare(otp, otpRow.otp_hash);
        if (!match) {
            return res.status(400).json({ error: 'Invalid OTP.' });
        }

        // Ensure user does not already exist
        const existRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existRes.rows.length > 0) {
            // Mark OTP used to prevent replays and return generic message
            await db.query('UPDATE signup_otps SET used = true WHERE id = $1', [otpRow.id]);
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        // Create the user with the previously-stored password_hash and optional username
        const insertRes = await db.query(
            'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id',
            [email, otpRow.password_hash, otpRow.username || null]
        );

        // Mark the OTP record used
        await db.query('UPDATE signup_otps SET used = true WHERE id = $1', [otpRow.id]);

        return res.status(201).json({ message: 'Signup verified. Please login using your credentials.' });

    } catch (err) {
        console.error('Error in verify-signup-otp:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// --- POST /api/auth/login ---
// Handles user login, verifies the password, and issues a JWT.
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // 1. Find the user by email and retrieve their stored password hash
        const userResult = await db.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
        
        // Check if user exists
        if (userResult.rows.length === 0) {
            // Use generic error message for security (don't reveal if email or password was wrong)
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        
        const user = userResult.rows[0];

        // 2. Compare the submitted plain password with the stored hash
        // This is where bcrypt does its magic 
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // 3. Password is correct - Generate the JWT!
        // The token payload contains the user's id and email so downstream code can use req.user.id and req.user.email
        const token = jwt.sign(
            { id: user.id, email },
            process.env.JWT_SECRET, // Uses the strong key from your .env file
            { expiresIn: tokenExpiration }
        );

        res.status(200).json({ 
            message: 'Login successful.',
            token: token,
            userId: user.id
        });

    } catch (err) {
        console.error('Error during login:', err.stack);
        res.status(500).json({ error: 'Internal server error during login.' });
    }
});

// Export the router immediately to make other endpoints available
// NOTE: We move the module.exports to the top, right after the last synchronous route definition
// This prevents the router object from being overridden.

// -----------------------
// Development helper: decode/verify a Bearer token
// Enable by setting DEBUG_TOKEN=true in the environment (do NOT enable permanently in public apps)
if (process.env.DEBUG_TOKEN === 'true') {
    router.get('/debug-token', (req, res) => {
        const authHeader = req.header('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        if (!token) return res.status(400).json({ error: 'No token provided in Authorization header' });

        try {
            // Don't rely solely on decode — show both decode and verification attempt
            const decoded = jwt.decode(token, { complete: true });
            let verifyResult = null;
            try {
                verifyResult = jwt.verify(token, process.env.JWT_SECRET || '');
            } catch (e) {
                verifyResult = { verifyError: e.message };
            }

            return res.status(200).json({ decoded, verifyResult });
        } catch (err) {
            return res.status(400).json({ error: 'Invalid token format', detail: err.message });
        }
    });
}

module.exports = router;