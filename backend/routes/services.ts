import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, price, sessions, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM services
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
      `SELECT id, name, price, sessions, created_at AS "createdAt", updated_at AS "updatedAt"
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
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, price, sessions } = req.body;
      console.log('Creating service with:', { name, price, sessions });
      const result = await query(
        `INSERT INTO services (name, price, sessions)
         VALUES ($1, $2, $3)
         RETURNING id, name, price, sessions, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [name, price || 0, sessions || 1]
      );

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
    const { name, price, sessions } = req.body;
    const result = await query(
      `UPDATE services
       SET name = COALESCE($2, name),
           price = COALESCE($3, price),
           sessions = COALESCE($4, sessions),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, price, sessions, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, name, price, sessions]
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

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
