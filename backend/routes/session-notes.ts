import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const noteSelect = `
  SELECT sn.id, sn.appointment_id AS "appointmentId", sn.patient_id AS "patientId", sn.practitioner_id AS "practitionerId",
         sn.presenting_concerns AS "presentingConcerns", sn.session_goals AS "sessionGoals", sn.observations,
         sn.interventions, sn.client_response AS "patientResponse", sn.homework,
         sn.treatment_plan AS "treatmentPlan", sn.progress_notes AS "progressNotes",
         sn.neurofeedback_baseline AS "neuroFeedbackBaseline", sn.neurofeedback_results AS "neuroFeedbackResults",
         sn.neurofeedback_improvements AS "neuroFeedbackImprovements",
         sn.follow_up_notes AS "followUpNotes", sn.next_session_date AS "nextSessionDate", sn.billable,
         sn.created_at AS "createdAt", sn.updated_at AS "updatedAt",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName",
         u.name AS "practitionerName",
         a.start_time AS "appointmentStartTime",
         s.name AS "serviceName"
  FROM session_notes sn
  JOIN patients c ON c.id = sn.patient_id
  JOIN users u ON u.id = sn.practitioner_id
  JOIN appointments a ON a.id = sn.appointment_id
  JOIN services s ON s.id = a.service_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const params = [];
    let where = '';

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where = `WHERE sn.practitioner_id = $${params.length}`;
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

router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const params = [req.params.patientId];
    let where = 'WHERE sn.patient_id = $1';

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where += ` AND sn.practitioner_id = $${params.length}`;
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

    const note = result.rows[0];
    if (req.user.role !== 'admin' && note.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this note' });
    }

    return res.status(200).json({ success: true, note });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('patientId', 'Valid patient ID is required').notEmpty(),
    body('appointmentId', 'Valid appointment ID is required').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { patientId, appointmentId, ...noteData } = req.body;

      const appointment = await query(
        'SELECT practitioner_id AS "practitionerId" FROM appointments WHERE id = $1',
        [appointmentId]
      );

      if (appointment.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Appointment not found' });
      }

      if (req.user.role !== 'admin' && appointment.rows[0].practitionerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to create notes for this appointment' });
      }

      const practitionerId = req.user.role === 'admin' ? appointment.rows[0].practitionerId : req.user.id;

      const existing = await query(
        'SELECT id FROM session_notes WHERE appointment_id = $1',
        [appointmentId]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Un compte rendu existe deja pour ce rendez-vous. Utilisez le bouton Modifier.',
        });
      }

      const inserted = await query(
        `INSERT INTO session_notes (
          appointment_id, patient_id, practitioner_id,
          presenting_concerns, session_goals, observations,
          interventions, client_response, homework,
          treatment_plan, progress_notes,
          neurofeedback_baseline, neurofeedback_results, neurofeedback_improvements,
          follow_up_notes, next_session_date, billable
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11,
          $12::jsonb, $13::jsonb, $14,
          $15, $16, COALESCE($17, TRUE)
        ) RETURNING id`,
        [
          appointmentId,
          patientId,
          practitionerId,
          noteData.presentingConcerns || null,
          noteData.sessionGoals || null,
          noteData.observations || null,
          noteData.interventions || null,
          noteData.patientResponse || null,
          noteData.homework || null,
          noteData.treatmentPlan || null,
          noteData.progressNotes || null,
          noteData.neuroFeedbackBaseline ? JSON.stringify(noteData.neuroFeedbackBaseline) : null,
          noteData.neuroFeedbackResults ? JSON.stringify(noteData.neuroFeedbackResults) : null,
          noteData.neuroFeedbackImprovements || null,
          noteData.followUpNotes || null,
          noteData.nextSessionDate || null,
          noteData.billable,
        ]
      );

      await query('UPDATE appointments SET session_note_id = $2, updated_at = NOW() WHERE id = $1', [appointmentId, inserted.rows[0].id]);
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
         presenting_concerns = COALESCE($2, presenting_concerns),
         session_goals = COALESCE($3, session_goals),
         observations = COALESCE($4, observations),
         interventions = COALESCE($5, interventions),
         client_response = COALESCE($6, client_response),
         homework = COALESCE($7, homework),
         treatment_plan = COALESCE($8, treatment_plan),
         progress_notes = COALESCE($9, progress_notes),
         neurofeedback_baseline = COALESCE($10::jsonb, neurofeedback_baseline),
         neurofeedback_results = COALESCE($11::jsonb, neurofeedback_results),
         neurofeedback_improvements = COALESCE($12, neurofeedback_improvements),
         follow_up_notes = COALESCE($13, follow_up_notes),
         next_session_date = COALESCE($14, next_session_date),
         billable = COALESCE($15, billable),
         updated_at = NOW()
       WHERE id = $1`,
      [
        req.params.id,
        note.presentingConcerns,
        note.sessionGoals,
        note.observations,
        note.interventions,
        note.patientResponse,
        note.homework,
        note.treatmentPlan,
        note.progressNotes,
        note.neuroFeedbackBaseline ? JSON.stringify(note.neuroFeedbackBaseline) : null,
        note.neuroFeedbackResults ? JSON.stringify(note.neuroFeedbackResults) : null,
        note.neuroFeedbackImprovements,
        note.followUpNotes,
        note.nextSessionDate,
        note.billable,
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
    const existing = await query('SELECT appointment_id AS "appointmentId", practitioner_id AS "practitionerId" FROM session_notes WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Session note not found' });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this note' });
    }

    await query('DELETE FROM session_notes WHERE id = $1', [req.params.id]);
    await query('UPDATE appointments SET session_note_id = NULL, updated_at = NOW() WHERE id = $1', [current.appointmentId]);

    return res.status(200).json({ success: true, message: 'Session note deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
