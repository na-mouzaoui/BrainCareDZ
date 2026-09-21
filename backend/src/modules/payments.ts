import express from 'express';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
const router = express.Router();

const paymentSelect = `
  SELECT p.id, p.patient_id AS "patientId", p.amount,
         p.payment_method AS "paymentMethod", p.status,
         p.notes,
         p.processed_date AS "processedDate", p.created_at AS "createdAt", p.updated_at AS "updatedAt",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName",
         u.name AS "createdByName"
  FROM payments p
  JOIN patients c ON c.id = p.patient_id
  LEFT JOIN users u ON u.id = p.created_by
`;

router.get('/', protect, async (req, res) => {
  try {
    const payments = await query(`${paymentSelect} ORDER BY p.created_at DESC LIMIT 100`);
    const total = await query(`SELECT COUNT(*)::int AS count FROM payments`);

    return res.json({
      success: true,
      data: {
        payments: payments.rows,
        total: total.rows[0].count,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(`${paymentSelect} WHERE p.id = $1`, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { patientId, amount, paymentMethod, notes, paymentDate } = req.body;

    if (!patientId || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, error: 'Patient ID and amount are required' });
    }

    const safeAmount = Number(amount);
    if (Number.isNaN(safeAmount) || safeAmount < 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be 0 or greater' });
    }
    if (safeAmount <= 0 && !notes) {
      return res.status(400).json({ success: false, error: 'A mount of 0 requires notes' });
    }

    const patient = await query('SELECT id FROM patients WHERE id = $1', [patientId]);
    if (patient.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    if (safeAmount === 0) {
      const packCheck = await query(
        `SELECT pp.total_sessions, pp.remaining_sessions
         FROM patient_packs pp
         WHERE pp.patient_id = $1 AND pp.remaining_sessions > 0
         ORDER BY pp.created_at DESC LIMIT 1`,
        [patientId]
      );
      if (packCheck.rowCount > 0) {
        const pack = packCheck.rows[0];
        if (pack.remaining_sessions === pack.total_sessions - 1) {
          return res.status(400).json({
            success: false,
            error: 'Un montant de 0 est interdit pour la première séance d\'un pack. Veuillez saisir un montant supérieur à 0.',
          });
        }
      }
    }

    const processedDate = paymentDate || new Date().toISOString();

    const inserted = await query(
      `INSERT INTO payments (patient_id, amount, payment_method, status, notes, processed_date, created_by)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6)
       RETURNING id`,
      [patientId, safeAmount, paymentMethod || 'cash', notes || null, processedDate, req.user.id]
    );

    const created = await query(`${paymentSelect} WHERE p.id = $1`, [inserted.rows[0].id]);

    return res.status(201).json({ success: true, data: created.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { amount, paymentMethod, status, notes } = req.body;

    const existing = await query(
      `SELECT p.id FROM payments p
       JOIN patients c ON c.id = p.patient_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (amount !== undefined) {
      const safeAmount = Number(amount);
      if (Number.isNaN(safeAmount) || safeAmount < 0) {
        return res.status(400).json({ success: false, error: 'Payment amount must be 0 or greater' });
      }
    }

    await query(
      `UPDATE payments
       SET amount = COALESCE($2, amount),
           payment_method = COALESCE($3, payment_method),
           status = COALESCE($4, status),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, amount !== undefined ? Number(amount) : undefined, paymentMethod, status, notes]
    );

    const updated = await query(`${paymentSelect} WHERE p.id = $1`, [req.params.id]);

    return res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await query(
      `SELECT p.id FROM payments p
       JOIN patients c ON c.id = p.patient_id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const result = await query('DELETE FROM payments WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    return res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
