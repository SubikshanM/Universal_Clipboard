// server.js (FINALIZED)
const express = require('express');
const db = require('./db'); 
const cors = require('cors'); // NEW: Import CORS middleware
const authRoutes = require('./routes/auth');
const clipboardRoutes = require('./routes/clipboard');

const app = express();
const PORT = process.env.PORT || 5000;

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
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server due to initialization error:', err);
        process.exit(1);
    }
})();