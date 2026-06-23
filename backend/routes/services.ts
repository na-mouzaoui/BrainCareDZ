import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect, authorize } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, price, sessions, type, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM services
       WHERE is_active = TRUE
       ORDER BY created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      services: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/category/:category', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, description, category, duration, price, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM services
       WHERE category = $1 AND is_active = TRUE
       ORDER BY created_at DESC`,
      [req.params.category]
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      services: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, price, sessions, type, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM services WHERE id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    return res.status(200).json({ success: true, service: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  authorize('admin', 'practitioner'),
  [
    body('name', 'Le nom du service est requis').notEmpty().trim(),
    body('price', 'Le prix doit être un nombre positif').isFloat({ min: 0 }),
    body('sessions', 'Le nombre de séances doit être un entier >= 1').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, price, sessions, type } = req.body;
      const safePrice = Number(price);
      const safeSessions = sessions ? Number(sessions) : 1;

      if (Number.isNaN(safePrice) || safePrice < 0) {
        return res.status(400).json({ success: false, message: 'Prix invalide' });
      }

      if (!Number.isInteger(safeSessions) || safeSessions < 1) {
        return res.status(400).json({ success: false, message: 'Nombre de séances invalide' });
      }

      const result = await query(
        `INSERT INTO services (name, price, sessions, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, price, sessions, type, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [name, safePrice, safeSessions, type || 'consultation']
      );

      await logActivity({ req, action: 'CREATE', resource: 'service', resourceId: result.rows[0].id, resourceName: name });

      return res.status(201).json({
        success: true,
        message: 'Service créé avec succès',
        service: result.rows[0],
      });
    } catch (error) {
      console.error('Create service error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put('/:id', protect, authorize('admin', 'practitioner'), async (req, res) => {
  try {
    const { name, price, sessions, type } = req.body;

    if (price !== undefined) {
      const safePrice = Number(price);
      if (Number.isNaN(safePrice) || safePrice < 0) {
        return res.status(400).json({ success: false, message: 'Prix invalide' });
      }
    }

    if (sessions !== undefined) {
      const safeSessions = Number(sessions);
      if (!Number.isInteger(safeSessions) || safeSessions < 1) {
        return res.status(400).json({ success: false, message: 'Nombre de séances invalide' });
      }
    }

    const result = await query(
      `UPDATE services
       SET name = COALESCE($2, name),
           price = COALESCE($3, price),
           sessions = COALESCE($4, sessions),
           type = COALESCE($5, type),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, price, sessions, type, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, name, price !== undefined ? Number(price) : undefined, sessions !== undefined ? Number(sessions) : undefined, type || null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await logActivity({ req, action: 'UPDATE', resource: 'service', resourceId: req.params.id, resourceName: name || 'Service' });

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      service: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'practitioner'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await logActivity({ req, action: 'DELETE', resource: 'service', resourceId: req.params.id });

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
