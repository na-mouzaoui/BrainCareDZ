import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import ActivityLog from '../models/ActivityLog.js';

const router = express.Router();

// Get all activity logs (admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, action, userId, resource } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (resource) filter.resource = resource;

    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('userId', 'name email role')
      .lean();

    const total = await ActivityLog.countDocuments(filter);

    res.json({
      success: true,
      data: {
        logs,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get activity logs for current user
router.get('/my-activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const logs = await ActivityLog.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    const total = await ActivityLog.countDocuments({ userId: req.user.id });

    res.json({
      success: true,
      data: {
        logs,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create activity log
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
      return res.status(400).json({
        success: false,
        error: 'action and resource are required',
      });
    }

    const log = new ActivityLog({
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action,
      resource,
      resourceId,
      resourceName,
      changes,
      status,
      errorMessage,
    });

    await log.save();

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get activity logs statistics (admin only)
router.get('/stats/summary', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      recentLogs,
      actionStats,
      userStats,
      resourceStats,
    ] = await Promise.all([
      ActivityLog.countDocuments(),
      ActivityLog.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      ActivityLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ActivityLog.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      ActivityLog.aggregate([
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalLogs,
        recentLogs,
        actionStats,
        userStats,
        resourceStats,
      },
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
