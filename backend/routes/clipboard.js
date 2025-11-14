// routes/clipboard.js

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth'); 
// TTL configuration
const DEFAULT_TTL_SECONDS = parseInt(process.env.DEFAULT_TTL_SECONDS, 10) || 3600; // 1 hour default
const MIN_TTL_SECONDS = 60; // 1 minute
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// 1. Save Clip Route (PUSH Operation)
router.post('/save', auth, async (req, res) => {
    const userId = req.user.id;
    const { encrypted_content, expiration_time, ttl_seconds } = req.body;

    // Frontend dropdown values (seconds) we expect from the UI (recommended)
    const ALLOWED_TTLS = [3600, 86400, 604800, 2592000, 31536000];

    // ttl_seconds is optional for backward-compatibility. If missing, use server default.
    let ttl;
    if (ttl_seconds === undefined || ttl_seconds === null || ttl_seconds === '') {
        ttl = DEFAULT_TTL_SECONDS;
    } else {
        const parsed = parseInt(ttl_seconds, 10);
        if (Number.isNaN(parsed)) {
            return res.status(400).json({ error: 'ttl_seconds must be an integer number of seconds.' });
        }

        // If frontend supplies dropdown values, prefer strict matching; otherwise allow any value within min/max
        if (ALLOWED_TTLS.includes(parsed)) {
            ttl = parsed;
        } else if (parsed >= MIN_TTL_SECONDS && parsed <= MAX_TTL_SECONDS) {
            // allow arbitrary valid TTL within bounds
            ttl = parsed;
        } else {
            return res.status(400).json({ error: `ttl_seconds must be one of: ${ALLOWED_TTLS.join(', ')} or between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}.` });
        }
    }
    
    if (!encrypted_content || !userId) {
        console.error(`Save attempt failed: Missing encrypted_content or user ID (ID: ${userId})`);
        return res.status(400).json({ error: 'Encrypted content or user authentication failed.' });
    }

    try {
        // COALESCE ensures expiration_time is NULL if not sent, preventing a NOT NULL violation
        // If the DB enforces NOT NULL on expiration_time, provide a sensible default far in the future
        // when the client omits expiration_time. Prefer explicit timestamp insertion to avoid casting issues.
        // Compute expiration in the DB using NOW() + ttl * interval '1 second' to ensure canonical timing
        const result = await pool.query(
            `INSERT INTO clipboard_data (user_id, encrypted_content, expiration_time)
             VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))
             RETURNING id, created_at, expiration_time`,
            [userId, encrypted_content, ttl]
        );

        const row = result.rows[0];
        const expiresAtIso = row.expiration_time ? new Date(row.expiration_time).toISOString() : null;

        // Return backward-compatible response fields so existing frontend code continues to work
        res.status(201).json({
            message: 'Clip saved successfully.',
            clipId: row.id,
            id: row.id,
            created_at: row.created_at,
            expires_at: expiresAtIso
        });
    } catch (error) {
        console.error('CRITICAL DATABASE ERROR in /save:', error.message || error); 
        res.status(500).json({ error: 'Internal server error while saving clip. Check backend console for details.' });
    }
});


// 2. Fetch Latest Clip Route (PULL Operation - single item)
router.get('/latest', auth, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            'SELECT encrypted_content, created_at, expiration_time FROM clipboard_data WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No clip saved yet.' });
        }

    // normalize response: rename expiration_time -> expires_at
    const row = result.rows[0];
    row.expires_at = row.expiration_time ? new Date(row.expiration_time).toISOString() : null;
    delete row.expiration_time;
    res.status(200).json(row);
    } catch (error) {
        console.error('Error fetching latest clip:', error);
        res.status(500).json({ error: 'Internal server error while fetching clip' });
    }
});

// 3. Fetch History Route (PULL Operation - ALL items)
router.get('/history', auth, async (req, res) => {
    const userId = req.user.id;
    
    if (!userId) {
         console.error('History attempt failed: User ID is missing.');
         return res.status(401).json({ message: 'User not authenticated or ID missing.' });
    }
    
    try {
        // Fetch ALL clips for the user, ordered by creation time
        const result = await pool.query(
            'SELECT id, encrypted_content, created_at, expiration_time FROM clipboard_data WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        // Map rows to include expires_at ISO string
        const mapped = result.rows.map(r => ({
            id: r.id,
            encrypted_content: r.encrypted_content,
            created_at: r.created_at,
            expires_at: r.expiration_time ? new Date(r.expiration_time).toISOString() : null
        }));

        res.status(200).json(mapped);
    } catch (error) {
        console.error('CRITICAL DATABASE ERROR in /history:', error.message || error);
        res.status(500).json({ error: 'Internal server error while fetching history. Check backend console for details.' });
    }
});


module.exports = router;

// DELETE /delete/:id
// Delete a clip by id. Requires authentication and ownership.
// Success: 200 { success: true, id: "<deleted-id>" }
// Errors: 401 (handled by auth), 403 Forbidden (not owner), 404 Not Found, 500 Internal Server Error
router.delete('/delete/:id', auth, async (req, res) => {
    const userId = req.user && req.user.id;
    const clipId = req.params.id;

    if (!clipId) {
        return res.status(400).json({ message: 'Clip id is required in URL.' });
    }

    try {
        // 1) Check clip exists and owner
        const found = await pool.query('SELECT id, user_id FROM clipboard_data WHERE id = $1', [clipId]);
        if (found.rows.length === 0) {
            return res.status(404).json({ message: 'Clip not found.' });
        }

        const ownerId = found.rows[0].user_id;
        if (String(ownerId) !== String(userId)) {
            return res.status(403).json({ message: 'Forbidden: you do not own this clip.' });
        }

        // 2) Delete the clip
        const deleted = await pool.query('DELETE FROM clipboard_data WHERE id = $1 RETURNING id', [clipId]);
        if (deleted.rows.length === 0) {
            // Unexpected: row existed a moment ago but not now
            return res.status(404).json({ message: 'Clip not found.' });
        }

        return res.status(200).json({ success: true, id: String(deleted.rows[0].id) });

    } catch (err) {
        console.error('Error deleting clip:', err);
        return res.status(500).json({ message: 'Internal server error while deleting clip.' });
    }
});