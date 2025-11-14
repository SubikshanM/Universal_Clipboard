// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Database connection module
const bcrypt = require('bcryptjs'); // Secure hashing library (use bcryptjs for easier installs)
const jwt = require('jsonwebtoken'); // JWT library for token generation

// Configuration
const saltRounds = 10; // Standard for bcrypt hashing
const tokenExpiration = '2h'; // JWT expires in 2 hours

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