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

// Start the worker loop
const startWorker = (intervalSeconds = CLEANUP_INTERVAL_SECONDS) => {
    // Run the cleanup immediately when the worker starts
    runCleanup(); 
    
    // Set up the cleanup function to run every 'intervalSeconds'
    const intervalMs = intervalSeconds * 1000;
    
    console.log(`[TTL Worker] Started. Running cleanup every ${intervalSeconds} seconds...`);
    setInterval(runCleanup, intervalMs);
};

// Start the worker
startWorker();