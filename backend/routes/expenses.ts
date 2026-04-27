import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

const expenseSelect = `
  SELECT e.id, e.title, e.category, e.amount,
         e.expense_date AS "expenseDate", e.notes,
         e.created_by AS "createdBy", e.created_at AS "createdAt", e.updated_at AS "updatedAt",
         u.name AS "createdByName", u.email AS "createdByEmail"
  FROM expenses e
  JOIN users u ON u.id = e.created_by
`;

router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`${expenseSelect} ORDER BY e.expense_date DESC, e.created_at DESC`);
    return res.status(200).json({ success: true, count: result.rowCount, expenses: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`${expenseSelect} WHERE e.id = $1`, [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    return res.status(200).json({ success: true, expense: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('title', 'Le titre est requis').notEmpty().trim(),
    body('amount', 'Le montant doit être un nombre positif').isFloat({ min: 0.01 }),
    body('expenseDate', 'La date est requise').isISO8601(),
    body('category').optional({ checkFalsy: true }).trim(),
    body('notes').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { title, category, amount, expenseDate, notes } = req.body;

      const inserted = await query(
        `INSERT INTO expenses (title, category, amount, expense_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          title,
          category || null,
          Number(amount),
          expenseDate,
          notes || null,
          req.user.id,
        ]
      );

      const created = await query(`${expenseSelect} WHERE e.id = $1`, [inserted.rows[0].id]);

      return res.status(201).json({
        success: true,
        message: 'Expense created successfully',
        expense: created.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  [
    body('title').optional().trim(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('expenseDate').optional().isISO8601(),
    body('category').optional({ checkFalsy: true }).trim(),
    body('notes').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const existing = await query('SELECT id FROM expenses WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Expense not found' });
      }

      const { title, category, amount, expenseDate, notes } = req.body;
      await query(
        `UPDATE expenses
         SET title = COALESCE($2, title),
             category = COALESCE($3, category),
             amount = COALESCE($4, amount),
             expense_date = COALESCE($5, expense_date),
             notes = COALESCE($6, notes),
             updated_at = NOW()
         WHERE id = $1`,
        [
          req.params.id,
          title,
          category || null,
          amount !== undefined ? Number(amount) : null,
          expenseDate || null,
          notes || null,
        ]
      );

      const updated = await query(`${expenseSelect} WHERE e.id = $1`, [req.params.id]);

      return res.status(200).json({
        success: true,
        message: 'Expense updated successfully',
        expense: updated.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    return res.status(200).json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
