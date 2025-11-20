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
        // Log stack trace only if connection is confirmed established, otherwise just log message
        console.error('[TTL Worker] Fatal error during clipboard cleanup:', err.message); 
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
        // Log stack trace only if connection is confirmed established, otherwise just log message
        console.error('[TTL Worker] Error during outbox cleanup:', err.message);

    } catch (err) {

// Cleanup for password_reset_otps table
const runPasswordResetCleanup = async () => {
    try {
        const expired = await db.query(`DELETE FROM password_reset_otps WHERE expires_at < NOW()`);
        const consumedOld = await db.query(`DELETE FROM password_reset_otps WHERE used = true AND created_at < NOW() - INTERVAL '1 day'`);
        console.log(`[TTL Worker] Password reset cleanup complete. Deleted ${expired.rowCount} expired, ${consumedOld.rowCount} old used OTP(s).`);
    } catch (err) {
        console.error('[TTL Worker] Error during password reset cleanup:', err.message);
    }
};
        // Log stack trace only if connection is confirmed established, otherwise just log message
        console.error('[TTL Worker] Error during outbox cleanup:', err.message);
    }
};

// --- NEW CODE: Initialization and Delay Wrapper ---

// The worker loop function, separated from initialization
const workerLoop = () => {
    // Run the cleanup immediately when the worker starts
    runCleanup();
    runOutboxCleanup();
    runPasswordResetCleanup();
    
    // Set up the cleanup function to run every 'intervalSeconds'
    const intervalMs = CLEANUP_INTERVAL_SECONDS * 1000;
    
    setInterval(() => {
        runCleanup();
        runOutboxCleanup();
        runPasswordResetCleanup();
    }, intervalMs);
};


const initializeWorker = async () => {
    console.log('[TTL Worker] Initializing with a 30-second delay to allow main web service to create relations...');
    
    // Wait for 30 seconds (30000 milliseconds)
    await new Promise(resolve => setTimeout(resolve, 30000)); 
    
    console.log(`[TTL Worker] Delay complete. Starting worker loop. Running cleanup every ${CLEANUP_INTERVAL_SECONDS} seconds...`);

    // Start the actual cleanup loop now that the delay is over
    workerLoop();
};

// Start the initialization process instead of running the cleanup immediately
initializeWorker();