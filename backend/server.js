// server.js (FINALIZED)
const express = require('express');
const db = require('./db'); 
const cors = require('cors'); // NEW: Import CORS middleware
const authRoutes = require('./routes/auth');
const clipboardRoutes = require('./routes/clipboard');

const app = express();
const PORT = process.env.PORT || 5000;

// --- TTL Cleanup Configuration ---
const TTL_CLEANUP_INTERVAL_MS = 20 * 1000; // 20 seconds

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

// --- CORS Configuration (Allow frontend access) ---
app.use(cors({
    // Allows requests from any origin (Good for local development)
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse incoming JSON requests
app.use(express.json());

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
        
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server due to initialization error:', err);
        process.exit(1);
    }
})();