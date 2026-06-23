import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

const companySelect = `
  SELECT id, name, address, owner, rc, nif, nis,
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM companies
`;

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(`${companySelect} ORDER BY name ASC`);
    return res.status(200).json({ success: true, count: result.rowCount, companies: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(`${companySelect} WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    return res.status(200).json({ success: true, company: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('name', 'Le nom est requis').notEmpty().trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('owner').optional({ checkFalsy: true }).trim(),
    body('rc').optional({ checkFalsy: true }).trim(),
    body('nif').optional({ checkFalsy: true }).trim(),
    body('nis').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, address, owner, rc, nif, nis } = req.body;
      const inserted = await query(
        `INSERT INTO companies (name, address, owner, rc, nif, nis)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          name,
          address || null,
          owner || null,
          rc || null,
          nif || null,
          nis || null,
        ]
      );

      const created = await query(`${companySelect} WHERE id = $1`, [inserted.rows[0].id]);

      await logActivity({ req, action: 'CREATE', resource: 'company', resourceId: inserted.rows[0].id });

      return res.status(201).json({ success: true, company: created.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put(
  '/:id',
  protect,
  [
    body('name').optional().trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('owner').optional({ checkFalsy: true }).trim(),
    body('rc').optional({ checkFalsy: true }).trim(),
    body('nif').optional({ checkFalsy: true }).trim(),
    body('nis').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const existing = await query('SELECT id FROM companies WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      const { name, address, owner, rc, nif, nis } = req.body;
      await query(
        `UPDATE companies
         SET name = COALESCE($2, name),
             address = COALESCE($3, address),
             owner = COALESCE($4, owner),
             rc = COALESCE($5, rc),
             nif = COALESCE($6, nif),
             nis = COALESCE($7, nis),
             updated_at = NOW()
         WHERE id = $1`,
        [req.params.id, name, address, owner, rc, nif, nis]
      );

      const updated = await query(`${companySelect} WHERE id = $1`, [req.params.id]);

      await logActivity({ req, action: 'UPDATE', resource: 'company', resourceId: req.params.id });

      return res.status(200).json({ success: true, company: updated.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await query('DELETE FROM companies WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    await logActivity({ req, action: 'DELETE', resource: 'company', resourceId: req.params.id });

    return res.status(200).json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
