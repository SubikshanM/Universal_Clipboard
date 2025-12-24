const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/devices - Get all devices for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.query(
            `SELECT id, device_name, device_type, browser, os, ip_address, 
                    last_seen, is_online, created_at 
             FROM devices 
             WHERE user_id = $1 
             ORDER BY last_seen DESC`,
            [userId]
        );

        res.json({ devices: result.rows });
    } catch (err) {
        console.error('Error fetching devices:', err);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// GET /api/devices/online - Get only online devices for the authenticated user
router.get('/online', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.query(
            `SELECT id, device_name, device_type, browser, os, last_seen 
             FROM devices 
             WHERE user_id = $1 AND is_online = true 
             ORDER BY last_seen DESC`,
            [userId]
        );

        res.json({ 
            devices: result.rows,
            count: result.rows.length 
        });
    } catch (err) {
        console.error('Error fetching online devices:', err);
        res.status(500).json({ error: 'Failed to fetch online devices' });
    }
});

// POST /api/devices/register - Register or update a device
router.post('/register', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { deviceName, deviceType, browser, os, ipAddress } = req.body;

    if (!deviceName) {
        return res.status(400).json({ error: 'Device name is required' });
    }

    try {
        // Check if device already exists for this user
        const existing = await db.query(
            `SELECT id FROM devices 
             WHERE user_id = $1 AND device_name = $2`,
            [userId, deviceName]
        );

        let deviceId;

        if (existing.rows.length > 0) {
            // Update existing device
            const updateResult = await db.query(
                `UPDATE devices 
                 SET device_type = $1, browser = $2, os = $3, 
                     ip_address = $4, last_seen = NOW(), is_online = true
                 WHERE user_id = $5 AND device_name = $6
                 RETURNING id`,
                [deviceType, browser, os, ipAddress, userId, deviceName]
            );
            deviceId = updateResult.rows[0].id;
        } else {
            // Insert new device
            const insertResult = await db.query(
                `INSERT INTO devices 
                 (user_id, device_name, device_type, browser, os, ip_address, is_online)
                 VALUES ($1, $2, $3, $4, $5, $6, true)
                 RETURNING id`,
                [userId, deviceName, deviceType, browser, os, ipAddress]
            );
            deviceId = insertResult.rows[0].id;
        }

        res.json({ 
            message: 'Device registered successfully',
            deviceId 
        });
    } catch (err) {
        console.error('Error registering device:', err);
        res.status(500).json({ error: 'Failed to register device' });
    }
});

// DELETE /api/devices/:id - Delete a specific device
router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const deviceId = req.params.id;

    try {
        const result = await db.query(
            `DELETE FROM devices 
             WHERE id = $1 AND user_id = $2 
             RETURNING id`,
            [deviceId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({ message: 'Device deleted successfully' });
    } catch (err) {
        console.error('Error deleting device:', err);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

// PUT /api/devices/:id/rename - Rename a device
router.put('/:id/rename', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const deviceId = req.params.id;
    const { deviceName } = req.body;

    if (!deviceName) {
        return res.status(400).json({ error: 'Device name is required' });
    }

    try {
        const result = await db.query(
            `UPDATE devices 
             SET device_name = $1 
             WHERE id = $2 AND user_id = $3 
             RETURNING id`,
            [deviceName, deviceId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({ message: 'Device renamed successfully' });
    } catch (err) {
        console.error('Error renaming device:', err);
        res.status(500).json({ error: 'Failed to rename device' });
    }
});

// POST /api/devices/disconnect - Mark device offline when user logs out
router.post('/disconnect', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { deviceName } = req.body;

    try {
        await db.query(
            `UPDATE devices 
             SET is_online = false, socket_id = NULL, last_seen = NOW()
             WHERE user_id = $1 AND device_name = $2`,
            [userId, deviceName]
        );

        res.json({ message: 'Device disconnected successfully' });
    } catch (err) {
        console.error('Error disconnecting device:', err);
        res.status(500).json({ error: 'Failed to disconnect device' });
    }
});

module.exports = router;
