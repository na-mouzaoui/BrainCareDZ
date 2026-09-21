import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

const entrySelect = `
  SELECT wl.id, wl.practitioner_id AS "practitionerId",
         u.name AS "practitionerName", u.role AS "practitionerRole",
         wl.patient_id AS "patientId",
         p.first_name AS "patientFirstName", p.last_name AS "patientLastName",
         wl.position, wl.created_at AS "createdAt"
  FROM waiting_list wl
  JOIN users u ON u.id = wl.practitioner_id
  JOIN patients p ON p.id = wl.patient_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const practitionerId = req.query.practitionerId || null;
    const params = [];
    let where = '';
    if (practitionerId) {
      params.push(practitionerId);
      where = `WHERE wl.practitioner_id = $1`;
    }
    const result = await query(
      `${entrySelect} ${where} ORDER BY wl.practitioner_id, wl.position ASC, wl.created_at ASC`,
      params
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      entries: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('practitionerId', 'Valid practitioner ID is required').notEmpty().isUUID(),
    body('patientId', 'Valid patient ID is required').notEmpty().isUUID(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    const { practitionerId, patientId } = req.body;

    try {
      const practitioner = await query('SELECT name FROM users WHERE id = $1', [practitionerId]);
      if (practitioner.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Praticien introuvable' });
      }

      const patient = await query('SELECT first_name AS "firstName", last_name AS "lastName" FROM patients WHERE id = $1', [patientId]);
      if (patient.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Patient introuvable' });
      }

      const existing = await query(
        'SELECT id FROM waiting_list WHERE practitioner_id = $1 AND patient_id = $2',
        [practitionerId, patientId]
      );
      if (existing.rowCount > 0) {
        return res.status(400).json({ success: false, message: 'Ce patient est déjà dans la liste d\'attente de ce praticien' });
      }

      const maxPos = await query(
        'SELECT COALESCE(MAX(position), 0)::int AS max_pos FROM waiting_list WHERE practitioner_id = $1',
        [practitionerId]
      );
      const position = maxPos.rows[0].max_pos + 1;

      const inserted = await query(
        `INSERT INTO waiting_list (practitioner_id, patient_id, position)
         VALUES ($1, $2, $3) RETURNING id`,
        [practitionerId, patientId, position]
      );

      await logActivity({
        req,
        action: 'CREATE',
        resource: 'waiting_list',
        resourceId: inserted.rows[0].id,
        resourceName: `${patient.rows[0].firstName} ${patient.rows[0].lastName}`,
      });

      const created = await query(`${entrySelect} WHERE wl.id = $1`, [inserted.rows[0].id]);

      return res.status(201).json({
        success: true,
        message: 'Patient ajouté à la liste d\'attente',
        entry: created.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await query(
      `SELECT wl.id, wl.practitioner_id AS "practitionerId", wl.position
       FROM waiting_list wl WHERE wl.id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Entrée introuvable dans la liste d\'attente' });
    }

    const entry = existing.rows[0];

    await query('DELETE FROM waiting_list WHERE id = $1', [req.params.id]);

    // Renumber remaining entries to keep positions contiguous
    await query(
      `UPDATE waiting_list
       SET position = position - 1,
           updated_at = NOW()
       WHERE practitioner_id = $1 AND position > $2`,
      [entry.practitionerId, entry.position]
    );

    await logActivity({
      req,
      action: 'DELETE',
      resource: 'waiting_list',
      resourceId: req.params.id,
    });

    return res.status(200).json({ success: true, message: 'Entrée retirée de la liste d\'attente' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Move an entry up or down in the practitioner's waiting list
router.put(
  '/:id/move',
  protect,
  [body('direction', 'direction must be up or down').isIn(['up', 'down'])],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    const { direction } = req.body;

    try {
      const current = await query(
        `SELECT id, practitioner_id AS "practitionerId", position
         FROM waiting_list WHERE id = $1`,
        [req.params.id]
      );
      if (current.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Entrée introuvable dans la liste d\'attente' });
      }

      const entry = current.rows[0];
      const neighborOrder = direction === 'up' ? 'DESC' : 'ASC';
      const neighborOp = direction === 'up' ? '<' : '>';

      const neighbor = await query(
        `SELECT id, position FROM waiting_list
         WHERE practitioner_id = $1 AND position ${neighborOp} $2
         ORDER BY position ${neighborOrder} LIMIT 1`,
        [entry.practitionerId, entry.position]
      );

      if (neighbor.rowCount === 0) {
        return res.status(400).json({ success: false, message: direction === 'up' ? 'Déjà en première position' : 'Déjà en dernière position' });
      }

      const target = neighbor.rows[0];

      const tempPosition = -1;
      await query('UPDATE waiting_list SET position = $2, updated_at = NOW() WHERE id = $1', [entry.id, tempPosition]);
      await query('UPDATE waiting_list SET position = $2, updated_at = NOW() WHERE id = $1', [target.id, entry.position]);
      await query('UPDATE waiting_list SET position = $2, updated_at = NOW() WHERE id = $1', [entry.id, target.position]);

      const result = await query(`${entrySelect} WHERE wl.practitioner_id = $1 ORDER BY wl.position ASC`, [entry.practitionerId]);

      return res.status(200).json({
        success: true,
        message: 'Position mise à jour',
        entries: result.rows,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default router;