import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
const router = express.Router();

const noteSelect = `
  SELECT sn.id, sn.appointment_patient_id AS "appointmentPatientId", sn.practitioner_id AS "practitionerId",
         sn.progress_notes AS "progressNotes",
         sn.created_at AS "createdAt", sn.updated_at AS "updatedAt",
         ap.patient_id AS "patientId", ap.appointment_id AS "appointmentId",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName",
         u.name AS "practitionerName",
         a.start_time AS "appointmentStartTime",
         s.name AS "serviceName", s.type AS "serviceType"
  FROM session_notes sn
  JOIN appointment_patients ap ON ap.id = sn.appointment_patient_id
  JOIN patients c ON c.id = ap.patient_id
  JOIN users u ON u.id = sn.practitioner_id
  JOIN appointments a ON a.id = ap.appointment_id
  JOIN services s ON s.id = a.service_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(`${noteSelect} ORDER BY sn.created_at DESC`);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      notes: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const params = [req.params.patientId];
    let where = 'WHERE ap.patient_id = $1';
    let paramIndex = 1;

    if (req.query.appointmentId) {
      paramIndex++;
      params.push(String(req.query.appointmentId));
      where += ` AND ap.appointment_id = $${paramIndex}`;
    }

    const result = await query(`${noteSelect} ${where} ORDER BY sn.created_at DESC`, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      notes: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(`${noteSelect} WHERE sn.id = $1`, [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Session note not found' });
    }

    return res.status(200).json({ success: true, note: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('appointmentPatientId', 'Valid appointment patient ID is required').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    try {
      const { appointmentPatientId, progressNotes } = req.body;

      const junction = await query(
        `SELECT ap.appointment_id AS "appointmentId", a.practitioner_id AS "practitionerId",
                a.role AS "appointmentRole", s.type AS "serviceType"
         FROM appointment_patients ap
         JOIN appointments a ON a.id = ap.appointment_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE ap.id = $1`,
        [appointmentPatientId]
      );

      if (junction.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Appointment patient not found' });
      }

      const appointmentPractitionerId = junction.rows[0].practitionerId;
      const appointmentRole = junction.rows[0].appointmentRole;
      const appointmentId = junction.rows[0].appointmentId;

      const practitionerId = req.user.id;

      // Psy : praticien fixe (créateur du RDV) — seul lui ou admin peut rédiger.
      // Coach : n'importe quel coach (ou admin) peut rédiger → devient le praticien en charge.
      if (appointmentRole === 'psy' && appointmentPractitionerId && req.user.role !== 'admin' && appointmentPractitionerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to create notes for this appointment' });
      }

      // RDV Coach : l'utilisateur qui rédige devient le praticien en charge (même si déjà assigné à un autre).
      if (appointmentRole === 'coach' && req.user.role !== 'admin') {
        if (appointmentPractitionerId !== req.user.id) {
          await query(
            'UPDATE appointments SET practitioner_id = $2, role = $3, updated_at = NOW() WHERE id = $1',
            [appointmentId, req.user.id, req.user.role]
          );
        }
      } else if (!appointmentPractitionerId) {
        await query(
          'UPDATE appointments SET practitioner_id = $2, role = $3, updated_at = NOW() WHERE id = $1',
          [appointmentId, req.user.id, req.user.role]
        );
      }

      const existing = await query(
        'SELECT id FROM session_notes WHERE appointment_patient_id = $1',
        [appointmentPatientId]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Un compte rendu existe deja pour ce patient pour ce rendez-vous. Utilisez le bouton Modifier.',
        });
      }

      const inserted = await query(
        `INSERT INTO session_notes (appointment_patient_id, practitioner_id, progress_notes)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          appointmentPatientId,
          practitionerId,
          progressNotes || null,
        ]
      );

      // Check if this is a neurofeedback appointment (multi-patient)
      const created = await query(`${noteSelect} WHERE sn.id = $1`, [inserted.rows[0].id]);

      return res.status(201).json({
        success: true,
        message: 'Session note created successfully',
        note: created.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId" FROM session_notes WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Session note not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this note' });
    }

    const note = req.body;
    await query(
      `UPDATE session_notes SET
         progress_notes = COALESCE($2, progress_notes),
         updated_at = NOW()
       WHERE id = $1`,
      [
        req.params.id,
        note.progressNotes,
      ]
    );

    const updated = await query(`${noteSelect} WHERE sn.id = $1`, [req.params.id]);

    return res.status(200).json({
      success: true,
      message: 'Session note updated successfully',
      note: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await query(
      'SELECT sn.id, sn.practitioner_id AS "practitionerId", ap.appointment_id AS "appointmentId" FROM session_notes sn JOIN appointment_patients ap ON ap.id = sn.appointment_patient_id WHERE sn.id = $1',
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Session note not found' });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this note' });
    }

    await query('DELETE FROM session_notes WHERE id = $1', [req.params.id]);

    return res.status(200).json({ success: true, message: 'Session note deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
