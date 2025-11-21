const db = require('./db');

// Configuration
const CLEANUP_INTERVAL_SECONDS = parseInt(process.env.TTL_CLEANUP_INTERVAL_SECONDS, 10) || 60;
const START_DELAY_MS = parseInt(process.env.TTL_WORKER_START_DELAY_MS, 10) || 30000;

let intervalHandle = null;

async function runClipboardCleanup() {
  try {
    const now = new Date().toISOString();
    const query = `
      DELETE FROM clipboard_data
      WHERE expiration_time IS NOT NULL
        AND expiration_time < $1
    `;
    const result = await db.query(query, [now]);
    console.log(`[TTL Worker] Clipboard cleanup: deleted ${result.rowCount} expired clip(s).`);
  } catch (err) {
    console.error('[TTL Worker] Error during clipboard cleanup:', err && err.stack ? err.stack : err);
  }
}

async function runOutboxCleanup() {
  try {
    const expiredQuery = `DELETE FROM signup_otp_outbox WHERE expires_at < NOW()`;
    const expiredResult = await db.query(expiredQuery);

    const consumedQuery = `DELETE FROM signup_otp_outbox WHERE consumed = true AND created_at < NOW() - INTERVAL '1 hour'`;
    const consumedResult = await db.query(consumedQuery);

    console.log(`[TTL Worker] Outbox cleanup: deleted ${expiredResult.rowCount} expired, ${consumedResult.rowCount} old consumed OTP(s).`);
  } catch (err) {
    console.error('[TTL Worker] Error during outbox cleanup:', err && err.stack ? err.stack : err);
  }
}

async function runPasswordResetCleanup() {
  try {
    const expired = await db.query(`DELETE FROM password_reset_otps WHERE expires_at < NOW()`);
    const consumedOld = await db.query(`DELETE FROM password_reset_otps WHERE used = true AND created_at < NOW() - INTERVAL '1 day'`);
    console.log(`[TTL Worker] Password reset cleanup: deleted ${expired.rowCount} expired, ${consumedOld.rowCount} old used OTP(s).`);
  } catch (err) {
    console.error('[TTL Worker] Error during password reset cleanup:', err && err.stack ? err.stack : err);
  }
}

async function runAllCleanups() {
  // Run each cleanup independently so one failure doesn't stop others
  await Promise.allSettled([runClipboardCleanup(), runOutboxCleanup(), runPasswordResetCleanup()]);
}

function workerLoop() {
  // Run immediately then schedule
  runAllCleanups().catch(err => console.error('[TTL Worker] Unexpected error running cleanups:', err));

  const intervalMs = CLEANUP_INTERVAL_SECONDS * 1000;
  intervalHandle = setInterval(() => {
    runAllCleanups().catch(err => console.error('[TTL Worker] Unexpected error running cleanups:', err));
  }, intervalMs);

  console.log(`[TTL Worker] Worker loop started. Cleanup interval: ${CLEANUP_INTERVAL_SECONDS}s`);
}

async function initializeWorker() {
  try {
    const delayMs = START_DELAY_MS;
    console.log(`[TTL Worker] Initializing. Waiting ${delayMs}ms before first run to allow main server startup...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    workerLoop();
  } catch (err) {
    console.error('[TTL Worker] Failed to initialize worker:', err && err.stack ? err.stack : err);
  }
}

// Graceful shutdown
function shutdown() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[TTL Worker] Shutdown: cleared interval.');
  }
}

process.on('SIGINT', () => { shutdown(); process.exit(0); });
process.on('SIGTERM', () => { shutdown(); process.exit(0); });

// Start automatically when this module is required
initializeWorker();

module.exports = { initializeWorker, shutdown };