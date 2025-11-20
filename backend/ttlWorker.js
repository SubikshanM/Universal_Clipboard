// ttlWorker.js
const db = require('./db');

// Make cleanup interval configurable via env var, default 60 seconds
const CLEANUP_INTERVAL_SECONDS = parseInt(process.env.TTL_CLEANUP_INTERVAL_SECONDS, 10) || 60;

// The function that performs the cleanup
const runCleanup = async () => {
    // Current timestamp to compare against expiration_time
    const now = new Date().toISOString();

    try {
        // Query to delete all rows where expiration_time is in the past (and not null)
        const query = `
            DELETE FROM clipboard_data
            WHERE expiration_time IS NOT NULL
              AND expiration_time < $1
        `;
        
        const result = await db.query(query, [now]);
        
        console.log(`[TTL Worker] Cleanup complete. Deleted ${result.rowCount} expired clip(s).`);

    } catch (err) {
        console.error('[TTL Worker] Fatal error during cleanup:', err.stack);
    }
};

// Cleanup function for signup_otp_outbox table
const runOutboxCleanup = async () => {
    try {
        // Delete expired entries
        const expiredQuery = `
            DELETE FROM signup_otp_outbox
            WHERE expires_at < NOW()
        `;
        const expiredResult = await db.query(expiredQuery);
        
        // Delete old consumed entries (older than 1 hour)
        const consumedQuery = `
            DELETE FROM signup_otp_outbox
            WHERE consumed = true AND created_at < NOW() - INTERVAL '1 hour'
        `;
        const consumedResult = await db.query(consumedQuery);
        
        console.log(`[TTL Worker] Outbox cleanup complete. Deleted ${expiredResult.rowCount} expired, ${consumedResult.rowCount} old consumed OTP(s).`);

    } catch (err) {
        console.error('[TTL Worker] Error during outbox cleanup:', err.stack);
    }
};

// Start the worker loop
const startWorker = (intervalSeconds = CLEANUP_INTERVAL_SECONDS) => {
    // Run the cleanup immediately when the worker starts
    runCleanup();
    runOutboxCleanup();
    
    // Set up the cleanup function to run every 'intervalSeconds'
    const intervalMs = intervalSeconds * 1000;
    
    console.log(`[TTL Worker] Started. Running cleanup every ${intervalSeconds} seconds...`);
    setInterval(() => {
        runCleanup();
        runOutboxCleanup();
    }, intervalMs);
};

// Start the worker
startWorker();