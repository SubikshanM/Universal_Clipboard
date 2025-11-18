// routes/auth.js
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

            // Also persist a short-lived plaintext OTP in an outbox table for integrations
            // (e.g., n8n). This record is short-lived and will be deleted by the TTL worker.
            try {
                await db.query(
                    `INSERT INTO signup_otp_outbox (email, otp_plain, expires_at) VALUES ($1, $2, $3)`,
                    [email, otp, expiresAt]
                );
            } catch (e) {
                // Outbox failure should not stop the signup OTP flow; just log
                console.error('Failed to write OTP to outbox:', e);
            }

        // Send OTP via email (or log in dev mode).
        // If OUTBOX_ONLY=true, we skip backend email sending so external systems
        // (like n8n) can be the sole sender.
        if (process.env.OUTBOX_ONLY !== 'true') {
            try {
                await sendOtpEmail(email, otp);
            } catch (err) {
                console.error('Failed to send OTP email:', err);
                // continue — we still respond 200 to avoid leaking information
            }
        } else {
            console.log('OUTBOX_ONLY=true, skipping backend email send; OTP written to outbox for integrations.');
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

        // Also persist plaintext OTP into outbox for integrations (short-lived)
        try {
            await db.query(
                `INSERT INTO signup_otp_outbox (email, otp_plain, expires_at) VALUES ($1, $2, $3)`,
                [email, otp, expiresAt]
            );
        } catch (e) {
            console.error('Failed to write OTP to outbox (send-otp):', e);
        }

        // Optionally send email from backend unless OUTBOX_ONLY is set
        if (process.env.OUTBOX_ONLY !== 'true') {
            try {
                await sendOtpEmail(email, otp);
            } catch (err) {
                console.error('Failed to send OTP email (send-otp):', err);
            }
        }

        // Generic response to avoid leaking information
        return res.status(200).json({ message: 'If the email is valid an OTP has been sent.' });
    } catch (err) {
        console.error('Error in send-otp:', err);
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

module.exports = router;

// --- Integration endpoint for secure retrieval of plaintext OTPs by internal systems ---
// POST /api/auth/outbox-fetch
// Body: { email: string }
// Header: x-internal-api-key: <key>
// This returns the latest non-consumed OTP for the given email if it exists and is not expired.
router.post('/outbox-fetch', async (req, res) => {
    const apiKey = req.header('x-internal-api-key') || '';
    if (!process.env.INTERNAL_API_KEY || apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
        const outRes = await db.query(
            `SELECT * FROM signup_otp_outbox WHERE email = $1 AND consumed = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (outRes.rows.length === 0) {
            return res.status(404).json({ error: 'No available OTP for this email.' });
        }

        const row = outRes.rows[0];

        // Mark as consumed to prevent subsequent retrievals
        await db.query('UPDATE signup_otp_outbox SET consumed = true WHERE id = $1', [row.id]);

        return res.status(200).json({ otp: row.otp_plain, expires_at: row.expires_at });
    } catch (err) {
        console.error('Error in outbox-fetch:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

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