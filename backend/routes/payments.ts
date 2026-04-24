import express from 'express';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const paymentSelect = `
  SELECT p.id, p.invoice_id AS "invoiceId", p.patient_id AS "patientId", p.amount,
         p.payment_method AS "paymentMethod", p.status,
         p.stripe_payment_intent_id AS "stripePaymentIntentId", p.transaction_id AS "transactionId",
         p.receipt_url AS "receiptUrl", p.notes,
         p.processed_date AS "processedDate", p.created_at AS "createdAt", p.updated_at AS "updatedAt",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName",
         i.invoice_number AS "invoiceNumber", i.total AS "invoiceTotal"
  FROM payments p
  JOIN patients c ON c.id = p.patient_id
  LEFT JOIN invoices i ON i.id = p.invoice_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const params = [];
    let where = '';

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where = `WHERE c.practitioner_id = $${params.length}`;
    }

    const payments = await query(`${paymentSelect} ${where} ORDER BY p.created_at DESC LIMIT 100`, params);
    const total = await query(`SELECT COUNT(*)::int AS count FROM payments p JOIN patients c ON c.id = p.patient_id ${where}`, params);

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
    const { patientId, invoiceId, amount, paymentMethod, notes } = req.body;

    if (!patientId || !amount) {
      return res.status(400).json({ success: false, error: 'Patient ID and amount are required' });
    }

    const patient = await query('SELECT id, practitioner_id AS "practitionerId" FROM patients WHERE id = $1', [patientId]);
    if (patient.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    if (req.user.role !== 'admin' && patient.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (invoiceId) {
      const invoice = await query('SELECT id FROM invoices WHERE id = $1', [invoiceId]);
      if (invoice.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
      }
    }

    const inserted = await query(
      `INSERT INTO payments (patient_id, invoice_id, amount, payment_method, status, notes, processed_date)
       VALUES ($1, $2, $3, $4, 'completed', $5, NOW())
       RETURNING id`,
      [patientId, invoiceId || null, amount, paymentMethod || 'cash', notes || null]
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

    const existing = await query('SELECT id FROM payments WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    await query(
      `UPDATE payments
       SET amount = COALESCE($2, amount),
           payment_method = COALESCE($3, payment_method),
           status = COALESCE($4, status),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, amount, paymentMethod, status, notes]
    );

    const updated = await query(`${paymentSelect} WHERE p.id = $1`, [req.params.id]);

    return res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
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
