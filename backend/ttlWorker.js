const db = require('./db');

// Configuration
const CLEANUP_INTERVAL_SECONDS = parseInt(process.env.TTL_CLEANUP_INTERVAL_SECONDS, 10) || 60;
const START_DELAY_MS = parseInt(process.env.TTL_WORKER_START_DELAY_MS, 10) || 30000;

let intervalHandle = null;
let skipDbChecks = false;
let skipDbWarned = false;

async function runClipboardCleanup() {
  try {
    if (skipDbChecks) {
      if (!skipDbWarned) {
        console.log('[TTL Worker] Skipping DB-based cleanups this run due to earlier DB auth/connection error.');
        skipDbWarned = true;
      }
      return;
    }
    // If the clipboard_data table doesn't exist yet (fresh DB), skip cleanup.
    const clipboardExists = await tableExists('clipboard_data');
    if (!clipboardExists) {
      console.log('[TTL Worker] Skipping clipboard cleanup: table clipboard_data does not exist.');
      return;
    }
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
    if (skipDbChecks) {
      if (!skipDbWarned) {
        console.log('[TTL Worker] Skipping DB-based cleanups this run due to earlier DB auth/connection error.');
        skipDbWarned = true;
      }
      return;
    }
    const outboxExists = await tableExists('signup_otp_outbox');
    if (!outboxExists) {
      console.log('[TTL Worker] Skipping outbox cleanup: table signup_otp_outbox does not exist.');
      return;
    }
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
    if (skipDbChecks) {
      if (!skipDbWarned) {
        console.log('[TTL Worker] Skipping DB-based cleanups this run due to earlier DB auth/connection error.');
        skipDbWarned = true;
      }
      return;
    }
    const pwResetExists = await tableExists('password_reset_otps');
    if (!pwResetExists) {
      console.log('[TTL Worker] Skipping password-reset cleanup: table password_reset_otps does not exist.');
      return;
    }
    const expired = await db.query(`DELETE FROM password_reset_otps WHERE expires_at < NOW()`);
    const consumedOld = await db.query(`DELETE FROM password_reset_otps WHERE used = true AND created_at < NOW() - INTERVAL '1 day'`);
    console.log(`[TTL Worker] Password reset cleanup: deleted ${expired.rowCount} expired, ${consumedOld.rowCount} old used OTP(s).`);
  } catch (err) {
    console.error('[TTL Worker] Error during password reset cleanup:', err && err.stack ? err.stack : err);
  }
}

async function runAllCleanups() {
  // Only run clipboard cleanup for now (other table cleanups will be added later).
  // Keep the Promise.allSettled pattern so the implementation is easy to extend.
  await Promise.allSettled([runClipboardCleanup()]);
}

// Utility: check whether a table exists in the public schema
async function tableExists(tableName) {
  try {
    const q = `SELECT to_regclass('public.' || $1) IS NOT NULL AS exists`;
    const r = await db.query(q, [tableName]);
    return r.rows && r.rows[0] && r.rows[0].exists === true;
  } catch (err) {
    // If the DB check fails due to an authentication/connection problem, log a single concise message and
    // set a global flag to skip further DB checks for this worker run (avoids noisy repeated errors).
    const msg = err && err.message ? String(err.message) : '';
    if (!skipDbChecks && (msg.includes('password') || msg.toLowerCase().includes('authentication') || msg.includes('SASL'))) {
      console.warn(`[TTL Worker] DB connection/auth error detected while checking for table ${tableName}: ${msg}. Further table checks will be skipped this run.`);
      skipDbChecks = true;
    } else {
      console.error(`[TTL Worker] tableExists check failed for ${tableName}:`, err && err.stack ? err.stack : err);
    }
    return false;
  }
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