import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, action, userId, resource } = req.query;

    const params = [];
    const where = [];

    if (action) {
      params.push(action);
      where.push(`action = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      where.push(`user_id = $${params.length}`);
    }
    if (resource) {
      params.push(resource);
      where.push(`resource = $${params.length}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    params.push(offset);

    const logs = await query(
      `SELECT id, user_id AS "userId", user_name AS "userName", user_pseudo AS "userPseudo", user_email AS "userEmail", user_role AS "userRole",
              action, resource, resource_id AS "resourceId", resource_name AS "resourceName", changes,
              status, error_message AS "errorMessage", ip_address AS "ipAddress", user_agent AS "userAgent",
              created_at AS "createdAt"
       FROM activity_logs
       ${clause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const total = await query(`SELECT COUNT(*)::int AS count FROM activity_logs ${clause}`, countParams);

    return res.json({
      success: true,
      data: {
        logs: logs.rows,
        total: total.rows[0].count,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
