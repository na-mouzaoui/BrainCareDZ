import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const invoiceSelect = `
  SELECT i.id, i.company_id AS "companyId", i.reference, i.invoice_date AS "invoiceDate",
         i.total_ht AS "totalHT", i.discount, i.total_discount_ht AS "totalDiscountHT",
         i.vat AS "vat", i.total_ttc AS "totalTTC", i.payment_method AS "paymentMethod",
         i.created_by AS "createdBy", i.created_at AS "createdAt", i.updated_at AS "updatedAt",
         c.name AS "companyName", c.address AS "companyAddress", c.owner AS "companyOwner",
         c.rc AS "companyRC", c.nif AS "companyNIF", c.nis AS "companyNIS",
         u.name AS "createdByName"
  FROM company_invoices i
  JOIN companies c ON c.id = i.company_id
  JOIN users u ON u.id = i.created_by
`;

async function loadItems(invoiceId) {
  const items = await query(
    `SELECT id, designation, session_count AS "sessionCount", learner_count AS "learnerCount",
            unit_price AS "unitPrice", total_ht AS "totalHT"
     FROM company_invoice_items
     WHERE company_invoice_id = $1
     ORDER BY id ASC`,
    [invoiceId]
  );
  return items.rows;
}

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(`${invoiceSelect} ORDER BY i.invoice_date DESC, i.created_at DESC`);
    return res.status(200).json({ success: true, count: result.rowCount, invoices: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(`${invoiceSelect} WHERE i.id = $1`, [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Company invoice not found' });
    }

    const invoice = result.rows[0];
    invoice.items = await loadItems(req.params.id);

    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('companyId', 'Entreprise requise').notEmpty(),
    body('reference', 'Reference requise').notEmpty().trim(),
    body('invoiceDate', 'Date requise').isISO8601(),
    body('items', 'Liste des articles requise').isArray({ min: 1 }),
    body('discount').optional().isFloat({ min: 0 }),
    body('vat').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      await query('BEGIN');
      const { companyId, reference, invoiceDate, items, discount, vat, paymentMethod } = req.body;

      const company = await query('SELECT id FROM companies WHERE id = $1', [companyId]);
      if (company.rowCount === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      const safeItems = items.map((item) => {
        const sessionCount = Number(item.sessionCount || 0);
        const learnerCount = Number(item.learnerCount || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const totalHT = Number((sessionCount || 0) * (learnerCount || 0) * (unitPrice || 0));
        return {
          designation: String(item.designation || '').trim(),
          sessionCount,
          learnerCount,
          unitPrice,
          totalHT,
        };
      });

      if (safeItems.some((item) => !item.designation)) {
        await query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Designation requise pour chaque ligne.' });
      }

      const totalHT = safeItems.reduce((sum, item) => sum + item.totalHT, 0);
      const discountValue = Number(discount || 0);
      const totalDiscountHT = Math.max(totalHT - discountValue, 0);
      const vatValue = Number(vat || 0);
      const totalTTC = totalDiscountHT + vatValue;

      const inserted = await query(
        `INSERT INTO company_invoices (
          company_id, reference, invoice_date,
          total_ht, discount, total_discount_ht, vat, total_ttc, payment_method, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          companyId,
          reference,
          invoiceDate,
          totalHT,
          discountValue,
          totalDiscountHT,
          vatValue,
          totalTTC,
          paymentMethod || 'Par cheque ou virement bancaire',
          req.user.id,
        ]
      );

      for (const item of safeItems) {
        await query(
          `INSERT INTO company_invoice_items (
            company_invoice_id, designation, session_count, learner_count, unit_price, total_ht
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            inserted.rows[0].id,
            item.designation,
            item.sessionCount,
            item.learnerCount,
            item.unitPrice,
            item.totalHT,
          ]
        );
      }

      const created = await query(`${invoiceSelect} WHERE i.id = $1`, [inserted.rows[0].id]);
      const invoice = created.rows[0];
      invoice.items = await loadItems(inserted.rows[0].id);

      await query('COMMIT');

      return res.status(201).json({ success: true, invoice });
    } catch (error) {
      await query('ROLLBACK');
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put(
  '/:id',
  protect,
  [
    body('reference').optional().trim(),
    body('invoiceDate').optional().isISO8601(),
    body('items').optional().isArray({ min: 1 }),
    body('discount').optional().isFloat({ min: 0 }),
    body('vat').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      await query('BEGIN');
      const existing = await query(
        'SELECT id, total_ht AS "totalHT", discount, vat FROM company_invoices WHERE id = $1',
        [req.params.id]
      );
      if (existing.rowCount === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Company invoice not found' });
      }

      const { reference, invoiceDate, items, discount, vat, paymentMethod } = req.body;

      let totalHT = null;
      let totalDiscountHT = null;
      let totalTTC = null;
      let nextDiscount = discount;
      let nextVat = vat;

      if (items) {
        const safeItems = items.map((item) => {
          const sessionCount = Number(item.sessionCount || 0);
          const learnerCount = Number(item.learnerCount || 0);
          const unitPrice = Number(item.unitPrice || 0);
          const totalHTItem = Number((sessionCount || 0) * (learnerCount || 0) * (unitPrice || 0));
          return {
            designation: String(item.designation || '').trim(),
            sessionCount,
            learnerCount,
            unitPrice,
            totalHT: totalHTItem,
          };
        });

        if (safeItems.some((item) => !item.designation)) {
          await query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Designation requise pour chaque ligne.' });
        }

        totalHT = safeItems.reduce((sum, item) => sum + item.totalHT, 0);
        const discountValue = Number(discount ?? existing.rows[0].discount ?? 0);
        totalDiscountHT = Math.max(totalHT - discountValue, 0);
        const vatValue = Number(vat ?? existing.rows[0].vat ?? 0);
        totalTTC = totalDiscountHT + vatValue;
        nextDiscount = discountValue;
        nextVat = vatValue;

        await query('DELETE FROM company_invoice_items WHERE company_invoice_id = $1', [req.params.id]);
        for (const item of safeItems) {
          await query(
            `INSERT INTO company_invoice_items (
              company_invoice_id, designation, session_count, learner_count, unit_price, total_ht
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              req.params.id,
              item.designation,
              item.sessionCount,
              item.learnerCount,
              item.unitPrice,
              item.totalHT,
            ]
          );
        }
      } else if (discount !== undefined || vat !== undefined) {
        const currentTotalHT = Number(existing.rows[0].totalHT || 0);
        const discountValue = Number(discount ?? existing.rows[0].discount ?? 0);
        const vatValue = Number(vat ?? existing.rows[0].vat ?? 0);
        totalHT = currentTotalHT;
        totalDiscountHT = Math.max(currentTotalHT - discountValue, 0);
        totalTTC = totalDiscountHT + vatValue;
        nextDiscount = discountValue;
        nextVat = vatValue;
      }

      await query(
        `UPDATE company_invoices SET
           reference = COALESCE($2, reference),
           invoice_date = COALESCE($3, invoice_date),
           total_ht = COALESCE($4, total_ht),
           discount = COALESCE($5, discount),
           total_discount_ht = COALESCE($6, total_discount_ht),
           vat = COALESCE($7, vat),
           total_ttc = COALESCE($8, total_ttc),
           payment_method = COALESCE($9, payment_method),
           updated_at = NOW()
         WHERE id = $1`,
        [
          req.params.id,
          reference,
          invoiceDate,
          totalHT,
          nextDiscount,
          totalDiscountHT,
          nextVat,
          totalTTC,
          paymentMethod,
        ]
      );

      const updated = await query(`${invoiceSelect} WHERE i.id = $1`, [req.params.id]);
      const invoice = updated.rows[0];
      invoice.items = await loadItems(req.params.id);

      await query('COMMIT');

      return res.status(200).json({ success: true, invoice });
    } catch (error) {
      await query('ROLLBACK');
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await query('DELETE FROM company_invoices WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Company invoice not found' });
    }

    return res.status(200).json({ success: true, message: 'Company invoice deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
