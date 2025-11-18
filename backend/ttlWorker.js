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

// Periodically clean up OTP outbox entries (expired or old consumed)
const runOutboxCleanup = async () => {
    const now = new Date().toISOString();
    try {
        // Delete expired outbox entries
        const delExpired = `DELETE FROM signup_otp_outbox WHERE expires_at < $1`;
        const res1 = await db.query(delExpired, [now]);

        // Also delete consumed outbox entries older than 1 day (safety)
        const delOldConsumed = `DELETE FROM signup_otp_outbox WHERE consumed = true AND created_at < NOW() - INTERVAL '1 day'`;
        const res2 = await db.query(delOldConsumed);

        if (res1.rowCount || res2.rowCount) {
            console.log(`[TTL Worker] Outbox cleanup: deleted ${res1.rowCount} expired, ${res2.rowCount} old consumed entries.`);
        }
    } catch (err) {
        console.error('[TTL Worker] Error cleaning OTP outbox:', err.stack);
    }
};

// Start the worker loop
const startWorker = (intervalSeconds = CLEANUP_INTERVAL_SECONDS) => {
    // Run the cleanup immediately when the worker starts
    runCleanup(); 
    // Run outbox cleanup as well
    runOutboxCleanup();
    
    // Set up the cleanup function to run every 'intervalSeconds'
    const intervalMs = intervalSeconds * 1000;
    
    console.log(`[TTL Worker] Started. Running cleanup every ${intervalSeconds} seconds...`);
    setInterval(runCleanup, intervalMs);
    setInterval(runOutboxCleanup, intervalMs);
};

// Start the worker
startWorker();