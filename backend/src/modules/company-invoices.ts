import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
const router = express.Router();

router.get('/next-reference', protect, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const result = await query(
      `SELECT reference FROM invoices WHERE reference LIKE $1 ORDER BY CAST(SPLIT_PART(reference, '/', 1) AS INTEGER) DESC LIMIT 1`,
      [`%/${year}`]
    );
    let nextNum = 1;
    if (result.rowCount > 0) {
      const lastRef = result.rows[0].reference;
      const num = parseInt(lastRef.split('/')[0], 10);
      if (!isNaN(num)) nextNum = num + 1;
    }
    return res.json({ success: true, data: `${nextNum}/${year}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const invoiceSelect = `
  SELECT i.id, i.company_id AS "companyId", i.reference, i.invoice_date AS "invoiceDate",
         i.subtotal AS "subtotal", i.discount, i.discounted_total AS "discountedTotal",
         i.vat_amount AS "vatAmount", i.grand_total AS "grandTotal", i.payment_method AS "paymentMethod",
         i.created_by AS "createdBy", i.created_at AS "createdAt", i.updated_at AS "updatedAt",
         c.name AS "companyName", c.address AS "companyAddress", c.owner AS "companyOwner",
         c.rc AS "companyRC", c.nif AS "companyNIF",          c.art AS "companyArt",
         u.name AS "createdByName"
  FROM invoices i
  JOIN companies c ON c.id = i.company_id
  JOIN users u ON u.id = i.created_by
`;

async function loadItems(invoiceId) {
  const items = await query(
    `SELECT id, description, session_count AS "sessionCount", learner_count AS "learnerCount",
            unit_price AS "unitPrice", subtotal
     FROM invoice_items
     WHERE invoice_id = $1
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
    body('vatAmount').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    try {
      await query('BEGIN');
      const { companyId, reference, invoiceDate, items, discount, vatAmount, paymentMethod } = req.body;

      const company = await query('SELECT id FROM companies WHERE id = $1', [companyId]);
      if (company.rowCount === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      const safeItems = items.map((item) => {
        const sessionCount = Number(item.sessionCount || 0);
        const learnerCount = Number(item.learnerCount || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const subtotal = Number((sessionCount || 0) * (learnerCount || 0) * (unitPrice || 0));
        return {
          description: String(item.description || '').trim(),
          sessionCount,
          learnerCount,
          unitPrice,
          subtotal,
        };
      });

      if (safeItems.some((item) => !item.description)) {
        await query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Designation requise pour chaque ligne.' });
      }

      const subtotal = safeItems.reduce((sum, item) => sum + item.subtotal, 0);
      const discountValue = Number(discount || 0);
      const discountedTotal = Math.max(subtotal - discountValue, 0);
      const vatValue = Number(vatAmount || 0);
      const grandTotal = discountedTotal + vatValue;

      const inserted = await query(
        `INSERT INTO invoices (
          company_id, reference, invoice_date,
          subtotal, discount, discounted_total, vat_amount, grand_total, payment_method, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          companyId,
          reference,
          invoiceDate,
          subtotal,
          discountValue,
          discountedTotal,
          vatValue,
          grandTotal,
          paymentMethod || 'Par cheque ou virement bancaire',
          req.user.id,
        ]
      );

      for (const item of safeItems) {
        await query(
          `INSERT INTO invoice_items (
            invoice_id, description, session_count, learner_count, unit_price, subtotal
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            inserted.rows[0].id,
            item.description,
            item.sessionCount,
            item.learnerCount,
            item.unitPrice,
            item.subtotal,
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
    body('vatAmount').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    try {
      await query('BEGIN');
      const existing = await query(
        'SELECT id, subtotal, discount, vat_amount AS "vatAmount" FROM invoices WHERE id = $1',
        [req.params.id]
      );
      if (existing.rowCount === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Company invoice not found' });
      }

      const { reference, invoiceDate, items, discount, vatAmount, paymentMethod } = req.body;

      let subtotal = null;
      let discountedTotal = null;
      let grandTotal = null;
      let nextDiscount = discount;
      let nextVat = vatAmount;

      if (items) {
        const safeItems = items.map((item) => {
          const sessionCount = Number(item.sessionCount || 0);
          const learnerCount = Number(item.learnerCount || 0);
          const unitPrice = Number(item.unitPrice || 0);
          const subtotalItem = Number((sessionCount || 0) * (learnerCount || 0) * (unitPrice || 0));
          return {
            description: String(item.description || '').trim(),
            sessionCount,
            learnerCount,
            unitPrice,
            subtotal: subtotalItem,
          };
        });

        if (safeItems.some((item) => !item.description)) {
          await query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Designation requise pour chaque ligne.' });
        }

        subtotal = safeItems.reduce((sum, item) => sum + item.subtotal, 0);
        const discountValue = Number(discount ?? existing.rows[0].discount ?? 0);
        discountedTotal = Math.max(subtotal - discountValue, 0);
        const vatValue = Number(vatAmount ?? existing.rows[0].vatAmount ?? 0);
        grandTotal = discountedTotal + vatValue;
        nextDiscount = discountValue;
        nextVat = vatValue;

        await query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
        for (const item of safeItems) {
          await query(
            `INSERT INTO invoice_items (
              invoice_id, description, session_count, learner_count, unit_price, subtotal
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              req.params.id,
              item.description,
              item.sessionCount,
              item.learnerCount,
              item.unitPrice,
              item.subtotal,
            ]
          );
        }
      } else if (discount !== undefined || vatAmount !== undefined) {
        const currentSubtotal = Number(existing.rows[0].subtotal || 0);
        const discountValue = Number(discount ?? existing.rows[0].discount ?? 0);
        const vatValue = Number(vatAmount ?? existing.rows[0].vatAmount ?? 0);
        subtotal = currentSubtotal;
        discountedTotal = Math.max(currentSubtotal - discountValue, 0);
        grandTotal = discountedTotal + vatValue;
        nextDiscount = discountValue;
        nextVat = vatValue;
      }

      await query(
        `UPDATE invoices SET
           reference = COALESCE($2, reference),
           invoice_date = COALESCE($3, invoice_date),
           subtotal = COALESCE($4, subtotal),
           discount = COALESCE($5, discount),
           discounted_total = COALESCE($6, discounted_total),
           vat_amount = COALESCE($7, vat_amount),
           grand_total = COALESCE($8, grand_total),
           payment_method = COALESCE($9, payment_method),
           updated_at = NOW()
         WHERE id = $1`,
        [
          req.params.id,
          reference,
          invoiceDate,
          subtotal,
          nextDiscount,
          discountedTotal,
          nextVat,
          grandTotal,
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
    const result = await query('DELETE FROM invoices WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Company invoice not found' });
    }

    return res.status(200).json({ success: true, message: 'Company invoice deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
