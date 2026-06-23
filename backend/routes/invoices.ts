import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${random}`;
}

const invoiceSelect = `
  SELECT i.id, i.invoice_number AS "invoiceNumber", i.patient_id AS "patientId", i.practitioner_id AS "practitionerId",
         i.line_items AS "lineItems", i.subtotal, i.tax, i.total, i.status,
         i.invoice_date AS "invoiceDate", i.due_date AS "dueDate", i.paid_date AS "paidDate",
         i.payment_method AS "paymentMethod", i.notes,
         i.created_at AS "createdAt", i.updated_at AS "updatedAt",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName", c.email AS "patientEmail",
         u.name AS "practitionerName", u.email AS "practitionerEmail"
  FROM invoices i
  JOIN patients c ON c.id = i.patient_id
  JOIN users u ON u.id = i.practitioner_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const params = [];
    const where = [];

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where.push(`i.practitioner_id = $${params.length}`);
    }

    if (req.query.status) {
      params.push(req.query.status);
      where.push(`i.status = $${params.length}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(`${invoiceSelect} ${clause} ORDER BY i.created_at DESC`, params);

    return res.status(200).json({ success: true, count: result.rowCount, expenses: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const params = [req.params.patientId];
    let where = 'WHERE i.patient_id = $1';

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where += ` AND i.practitioner_id = $${params.length}`;
    }

    const result = await query(`${invoiceSelect} ${where} ORDER BY i.created_at DESC`, params);

    return res.status(200).json({ success: true, count: result.rowCount, expenses: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(`${invoiceSelect} WHERE i.id = $1`, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = result.rows[0];
    if (req.user.role !== 'admin' && invoice.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this invoice' });
    }

    const links = await query('SELECT appointment_id AS "appointmentId" FROM invoice_appointments WHERE invoice_id = $1', [req.params.id]);
    invoice.appointments = links.rows.map((row) => row.appointmentId);

    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('patientId', 'Valid patient ID is required').notEmpty(),
    body('appointmentIds', 'At least one appointment is required').isArray({ min: 1 }),
    body('dueDate', 'Due date is required').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { patientId, appointmentIds, dueDate, notes } = req.body;

      const patient = await query('SELECT practitioner_id AS "practitionerId" FROM patients WHERE id = $1', [patientId]);
      if (patient.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const practitionerId = req.user.role === 'admin' ? patient.rows[0].practitionerId : req.user.id;

      const appointments = await query(
        `SELECT a.id,
                a.patient_id AS "patientId",
                a.practitioner_id AS "practitionerId",
                a.status,
                s.name,
                s.price
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         WHERE a.id = ANY($1::uuid[])`,
        [appointmentIds]
      );

      if (appointments.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'No appointments found' });
      }

      const invalidAppointment = appointments.rows.find(
        (apt) => apt.patientId !== patientId || apt.practitionerId !== practitionerId
      );

      if (invalidAppointment) {
        return res.status(400).json({
          success: false,
          message: 'All appointments must belong to the same patient and practitioner as the invoice',
        });
      }

      const nonBillableStatus = appointments.rows.find(
        (apt) => !['completed', 'scheduled'].includes(String(apt.status))
      );

      if (nonBillableStatus) {
        return res.status(400).json({
          success: false,
          message: 'Appointments with cancelled or invalid status cannot be invoiced',
        });
      }

      const lineItems = appointments.rows.map((apt) => ({
        description: apt.name,
        quantity: 1,
        unitPrice: Number(apt.price),
        totalPrice: Number(apt.price),
        appointmentId: apt.id,
      }));

      const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = Math.round(subtotal * 0.1 * 100) / 100;
      const total = subtotal + tax;

      const inserted = await query(
        `INSERT INTO invoices (
          invoice_number, patient_id, practitioner_id, line_items, subtotal, tax, total, due_date, notes, status
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, 'draft')
        RETURNING id`,
        [
          generateInvoiceNumber(),
          patientId,
          practitionerId,
          JSON.stringify(lineItems),
          subtotal,
          tax,
          total,
          dueDate,
          notes || null,
        ]
      );

      for (const appointmentId of appointmentIds) {
        await query(
          'INSERT INTO invoice_appointments (invoice_id, appointment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [inserted.rows[0].id, appointmentId]
        );
      }

      const created = await query(`${invoiceSelect} WHERE i.id = $1`, [inserted.rows[0].id]);

      await logActivity({ req, action: 'CREATE', resource: 'invoice', resourceId: inserted.rows[0].id });

      return res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice: created.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId" FROM invoices WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this invoice' });
    }

    const { status, dueDate, paidDate, paymentMethod, notes } = req.body;
    await query(
        `UPDATE invoices
       SET status = COALESCE($2, status),
           due_date = COALESCE($3, due_date),
           paid_date = COALESCE($4, paid_date),
           payment_method = COALESCE($5, payment_method),
           notes = COALESCE($6, notes),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, status, dueDate, paidDate, paymentMethod, notes]
    );

          const updated = await query(`${invoiceSelect} WHERE i.id = $1`, [req.params.id]);

      await logActivity({ req, action: 'UPDATE', resource: 'invoice', resourceId: req.params.id });

    return res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/send', protect, async (req, res) => {
  try {
    const existing = await query(
      `SELECT id, practitioner_id AS "practitionerId"
       FROM invoices
       WHERE id = $1`,
      [req.params.id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to send this invoice' });
    }

    await query(
      `UPDATE invoices
       SET status = 'sent', updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    const updated = await query(`${invoiceSelect} WHERE i.id = $1`, [req.params.id]);

    return res.status(200).json({
      success: true,
      message: 'Invoice sent successfully',
      invoice: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/mark-paid', protect, async (req, res) => {
  try {
    const existing = await query(
      `SELECT id, practitioner_id AS "practitionerId"
       FROM invoices
       WHERE id = $1`,
      [req.params.id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this invoice' });
    }

    await query(
      `UPDATE invoices
       SET status = 'paid', paid_date = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    const updated = await query(`${invoiceSelect} WHERE i.id = $1`, [req.params.id]);

    return res.status(200).json({
      success: true,
      message: 'Invoice marked as paid',
      invoice: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId", status FROM invoices WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this invoice' });
    }

    if (current.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft invoices can be deleted' });
    }

    await query('DELETE FROM invoices WHERE id = $1', [req.params.id]);

    await logActivity({ req, action: 'DELETE', resource: 'invoice', resourceId: req.params.id });

    return res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
