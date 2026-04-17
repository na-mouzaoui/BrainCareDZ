import express from 'express';
import { query } from '../config/db.js';
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
      `SELECT id, user_id AS "userId", user_name AS "userName", user_email AS "userEmail", user_role AS "userRole",
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

router.get('/my-activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const logs = await query(
      `SELECT id, user_id AS "userId", user_name AS "userName", user_email AS "userEmail", user_role AS "userRole",
              action, resource, resource_id AS "resourceId", resource_name AS "resourceName", changes,
              status, error_message AS "errorMessage", ip_address AS "ipAddress", user_agent AS "userAgent",
              created_at AS "createdAt"
       FROM activity_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, Number(limit), Number(offset)]
    );

    const total = await query('SELECT COUNT(*)::int AS count FROM activity_logs WHERE user_id = $1', [req.user.id]);

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

router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      action,
      resource,
      resourceId,
      resourceName,
      changes,
      status = 'SUCCESS',
      errorMessage,
    } = req.body;

    if (!action || !resource) {
      return res.status(400).json({ success: false, error: 'action and resource are required' });
    }

    const inserted = await query(
      `INSERT INTO activity_logs (
         user_id, user_name, user_email, user_role,
         action, resource, resource_id, resource_name,
         changes, status, error_message, ip_address, user_agent
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9::jsonb, $10, $11, $12, $13
       ) RETURNING id, created_at AS "createdAt"`,
      [
        req.user.id,
        req.user.name || null,
        req.user.email || null,
        req.user.role || null,
        action,
        resource,
        resourceId || null,
        resourceName || null,
        changes ? JSON.stringify(changes) : null,
        status,
        errorMessage || null,
        req.ip || null,
        req.get('user-agent') || null,
      ]
    );

    return res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/summary', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const [
      totalLogs,
      recentLogs,
      actionStats,
      userStats,
      resourceStats,
    ] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM activity_logs'),
      query("SELECT COUNT(*)::int AS count FROM activity_logs WHERE created_at >= NOW() - INTERVAL '30 days'"),
      query('SELECT action AS _id, COUNT(*)::int AS count FROM activity_logs GROUP BY action ORDER BY count DESC'),
      query('SELECT user_id AS _id, COUNT(*)::int AS count FROM activity_logs GROUP BY user_id ORDER BY count DESC LIMIT 10'),
      query('SELECT resource AS _id, COUNT(*)::int AS count FROM activity_logs GROUP BY resource ORDER BY count DESC'),
    ]);

    return res.json({
      success: true,
      data: {
        totalLogs: totalLogs.rows[0].count,
        recentLogs: recentLogs.rows[0].count,
        actionStats: actionStats.rows,
        userStats: userStats.rows,
        resourceStats: resourceStats.rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
