// server.js (FINALIZED)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db'); 
const cors = require('cors'); // NEW: Import CORS middleware
const authRoutes = require('./routes/auth');
const clipboardRoutes = require('./routes/clipboard');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// --- TTL Cleanup Configuration ---
const TTL_CLEANUP_INTERVAL_MS = 20 * 1000; // 20 seconds
const OTP_CLEANUP_INTERVAL_MS = 20 * 1000; // 20 seconds

// TTL Cleanup Function - Deletes expired clipboard entries
async function runTTLCleanup() {
    try {
        const now = new Date().toISOString();
        const query = `
            DELETE FROM clipboard_data
            WHERE expiration_time IS NOT NULL
              AND expiration_time < $1
        `;
        const result = await db.query(query, [now]);
        if (result.rowCount > 0) {
            console.log(`[TTL Cleanup] Deleted ${result.rowCount} expired clip(s) at ${new Date().toISOString()}`);
        }
    } catch (err) {
        console.error('[TTL Cleanup] Error during cleanup:', err.message);
    }
}

// OTP Cleanup Function - Deletes expired OTPs from all OTP tables
async function runOTPCleanup() {
    try {
        const now = new Date().toISOString();
        let totalDeleted = 0;

        // Clean up signup_otps
        const signupOtpQuery = `
            DELETE FROM signup_otps
            WHERE expires_at < $1
        `;
        const signupResult = await db.query(signupOtpQuery, [now]);
        totalDeleted += signupResult.rowCount;

        // Clean up signup_otp_outbox
        const outboxQuery = `
            DELETE FROM signup_otp_outbox
            WHERE expires_at < $1
        `;
        const outboxResult = await db.query(outboxQuery, [now]);
        totalDeleted += outboxResult.rowCount;

        // Clean up password_reset_otps
        const passwordResetQuery = `
            DELETE FROM password_reset_otps
            WHERE expires_at < $1
        `;
        const passwordResetResult = await db.query(passwordResetQuery, [now]);
        totalDeleted += passwordResetResult.rowCount;

        if (totalDeleted > 0) {
            console.log(`[OTP Cleanup] Deleted ${totalDeleted} expired OTP(s) at ${new Date().toISOString()} (Signup: ${signupResult.rowCount}, Outbox: ${outboxResult.rowCount}, Password Reset: ${passwordResetResult.rowCount})`);
        }
    } catch (err) {
        console.error('[OTP Cleanup] Error during cleanup:', err.message);
    }
}

// --- CORS Configuration (Allow frontend access) ---
app.use(cors({
    // Allows requests from any origin (Good for local development)
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse incoming JSON requests
app.use(express.json());

// --- Socket.IO Authentication & Room Management ---
io.on('connection', (socket) => {
    console.log('[Socket.IO] Client attempting to connect:', socket.id);

    // Authenticate socket connection using JWT
    const token = socket.handshake.auth.token;
    
    if (!token) {
        console.log('[Socket.IO] Connection rejected: No token provided');
        socket.disconnect();
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        
        // Join user-specific room
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        
        console.log(`[Socket.IO] User ${userId} connected and joined room: ${userRoom}`);
        
        socket.on('disconnect', () => {
            console.log(`[Socket.IO] User ${userId} disconnected`);
        });
        
    } catch (error) {
        console.log('[Socket.IO] Connection rejected: Invalid token', error.message);
        socket.disconnect();
    }
});

// Make io available to routes
app.set('io', io);

// --- API Routes ---

// 1. Authentication Routes
app.use('/api/auth', authRoutes); 

// 2. Clipboard Routes
app.use('/api/clipboard', clipboardRoutes); 

// 3. Basic test route
app.get('/', (req, res) => {
    res.send('Universal Clipboard API is running...');
});

// 4. Test route to verify profile endpoints are loaded
app.get('/api/test/endpoints', (req, res) => {
    res.json({
        message: 'Profile endpoints are available',
        endpoints: [
            'GET /api/auth/profile',
            'POST /api/auth/update-username', 
            'POST /api/auth/change-password'
        ]
    });
});

// Start the server but ensure DB tables exist first
(async function start() {
    try {
        if (typeof db.createTables === 'function') {
            console.log('Ensuring database tables exist...');
            await db.createTables();
        }
        
        // Run initial TTL cleanup on startup (catches up after suspension)
        console.log('[TTL Cleanup] Running initial cleanup on startup...');
        await runTTLCleanup();
        
        // Schedule TTL cleanup every 20 seconds
        setInterval(async () => {
            await runTTLCleanup();
        }, TTL_CLEANUP_INTERVAL_MS);
        console.log(`[TTL Cleanup] Scheduled to run every ${TTL_CLEANUP_INTERVAL_MS / 1000} seconds`);

        // Run initial OTP cleanup on startup (catches up after suspension)
        console.log('[OTP Cleanup] Running initial cleanup on startup...');
        await runOTPCleanup();
        
        // Schedule OTP cleanup every 20 seconds
        setInterval(async () => {
            await runOTPCleanup();
        }, OTP_CLEANUP_INTERVAL_MS);
        console.log(`[OTP Cleanup] Scheduled to run every ${OTP_CLEANUP_INTERVAL_MS / 1000} seconds`);
        
        server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
            console.log('[Socket.IO] WebSocket server ready');
        });
    } catch (err) {
        console.error('Failed to start server due to initialization error:', err);
        process.exit(1);
    }
})();