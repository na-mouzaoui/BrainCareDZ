import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendDbError } from '../utils/errors.js';
const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, price, sessions, type, duration, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM services
       WHERE is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 500`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      services: result.rows,
    });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, price, sessions, type, duration, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM services WHERE id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    return res.status(200).json({ success: true, service: result.rows[0] });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.post(
  '/',
  protect,
  authorize('admin', 'psy'),
  [
    body('name', 'Le nom du service est requis').notEmpty().trim(),
    body('price', 'Le prix doit être un nombre positif').isFloat({ min: 0 }),
    body('sessions', 'Le nombre de séances doit être un entier >= 1').optional().isInt({ min: 1 }),
    body('duration', 'La durée doit être un entier entre 1 et 480 minutes').optional().isInt({ min: 1, max: 480 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    try {
      const { name, price, sessions, type, duration } = req.body;
      const safePrice = Number(price);
      const safeSessions = sessions ? Number(sessions) : 1;

      if (Number.isNaN(safePrice) || safePrice < 0) {
        return res.status(400).json({ success: false, message: 'Prix invalide' });
      }

      if (!Number.isInteger(safeSessions) || safeSessions < 1) {
        return res.status(400).json({ success: false, message: 'Nombre de séances invalide' });
      }

      const safeDuration = duration === undefined || duration === null || duration === ''
        ? 60
        : Number(duration);
      if (!Number.isInteger(safeDuration) || safeDuration < 1 || safeDuration > 480) {
        return res.status(400).json({ success: false, message: 'Durée invalide (1 à 480 minutes).' });
      }

      const result = await query(
        `INSERT INTO services (name, price, sessions, type, duration)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, price, sessions, type, duration, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [name, safePrice, safeSessions, type || 'consultation', safeDuration]
      );

      return res.status(201).json({
        success: true,
        message: 'Service créé avec succès',
        service: result.rows[0],
      });
    } catch (error) {
      return sendDbError(res, error, 'Erreur interne du serveur');
    }
  }
);

router.put('/:id', protect, authorize('admin', 'psy'), async (req, res) => {
  try {
    const { name, price, sessions, type, duration } = req.body;

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

    if (duration !== undefined && duration !== null && duration !== '') {
      const safeDuration = Number(duration);
      if (!Number.isInteger(safeDuration) || safeDuration < 1 || safeDuration > 480) {
        return res.status(400).json({ success: false, message: 'Durée invalide (1 à 480 minutes).' });
      }
    }

    const result = await query(
      `UPDATE services
       SET name = COALESCE($2, name),
           price = COALESCE($3, price),
           sessions = COALESCE($4, sessions),
           type = COALESCE($5, type),
           duration = COALESCE($6, duration),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, price, sessions, type, duration, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        req.params.id,
        name,
        price !== undefined ? Number(price) : undefined,
        sessions !== undefined ? Number(sessions) : undefined,
        type || null,
        duration !== undefined && duration !== null && duration !== '' ? Number(duration) : undefined,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      service: result.rows[0],
    });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.delete('/:id', protect, authorize('admin', 'psy'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

export default router;
