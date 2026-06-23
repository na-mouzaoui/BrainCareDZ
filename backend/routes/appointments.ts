import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

const appointmentSelect = `
  SELECT a.id, a.patient_id AS "patientId", a.practitioner_id AS "practitionerId", a.service_id AS "serviceId",
         a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.notes,
         a.reminder_sent AS "reminderSent", a.session_note_id AS "sessionNoteId",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName", c.email AS "patientEmail", c.phone AS "patientPhone",
         u.name AS "practitionerName", u.email AS "practitionerEmail",
         s.name AS "serviceName", s.price AS "servicePrice", s.duration AS "serviceDuration", s.type AS "serviceType",
         COALESCE(
           (SELECT json_agg(json_build_object('patientId', p.id, 'firstName', p.first_name, 'lastName', p.last_name))
            FROM appointment_patients ap
            JOIN patients p ON p.id = ap.patient_id
            WHERE ap.appointment_id = a.id),
           '[]'::json
         ) AS "patients"
  FROM appointments a
  JOIN patients c ON c.id = a.patient_id
  JOIN users u ON u.id = a.practitioner_id
  JOIN services s ON s.id = a.service_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const params = [];
    const where = [];

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where.push(`a.practitioner_id = $${params.length}`);
    }

    if (req.query.startDate) {
      params.push(req.query.startDate);
      where.push(`a.start_time >= $${params.length}`);
    }
    if (req.query.endDate) {
      params.push(req.query.endDate);
      where.push(`a.start_time <= $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(`${appointmentSelect} ${whereClause} ORDER BY a.start_time ASC`, params);

    return res.json({
      success: true,
      data: {
        appointments: result.rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/availability/:date', protect, async (req, res) => {
  try {
    const date = req.params.date;
    const practitionerId = req.user.role === 'admin' ? req.query.practitionerId : req.user.id;

    const appointments = await query(
      `SELECT start_time AS "startTime", end_time AS "endTime"
       FROM appointments
       WHERE practitioner_id = $1 AND status IN ('scheduled') AND DATE(start_time) = $2`,
      [practitionerId, date]
    );

    return res.json({
      success: true,
      data: {
        appointments: appointments.rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(`${appointmentSelect} WHERE a.id = $1`, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    return res.json({
      success: true,
      data: {
        appointment: result.rows[0],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('patientId', 'Valid patient ID is required').notEmpty(),
    body('serviceId', 'Valid service ID is required').notEmpty(),
    body('startTime', 'Valid start time is required').isISO8601(),
    body('endTime', 'Valid end time is required').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { patientId, serviceId, startTime, endTime, notes, patientIds } = req.body;

      const patient = await query('SELECT practitioner_id AS "practitionerId" FROM patients WHERE id = $1', [patientId]);
      if (patient.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      if (req.user.role !== 'admin' && patient.rows[0].practitionerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to book for this patient' });
      }

      const service = await query('SELECT id, type FROM services WHERE id = $1 AND is_active = TRUE', [serviceId]);
      if (service.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      const serviceType = service.rows[0].type;

      // Validate multi-patient for neurofeedback
      const allPatientIds = [patientId, ...((patientIds || []).filter(id => id !== patientId))];
      if (serviceType === 'neurofeedback') {
        if (allPatientIds.length > 4) {
          return res.status(400).json({ success: false, message: 'Maximum 4 patients pour une séance de neurofeedback' });
        }
      } else if (allPatientIds.length > 1) {
        return res.status(400).json({ success: false, message: 'Un seul patient autorisé pour ce type de service' });
      }

      const practitionerId = req.user.role === 'admin' ? patient.rows[0].practitionerId : req.user.id;

      const conflict = await query(
        `SELECT id FROM appointments
         WHERE practitioner_id = $1
         AND status IN ('scheduled')
         AND start_time < $3
         AND end_time > $2
         LIMIT 1`,
        [practitionerId, startTime, endTime]
      );

      if (conflict.rowCount > 0) {
        return res.status(400).json({ success: false, message: 'Time slot conflict with existing appointment' });
      }

      const inserted = await query(
        `INSERT INTO appointments (patient_id, practitioner_id, service_id, start_time, end_time, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [patientId, practitionerId, serviceId, startTime, endTime, notes || null]
      );

      const appointmentId = inserted.rows[0].id;

      // Insert all patients into junction table
      for (const pid of allPatientIds) {
        await query(
          'INSERT INTO appointment_patients (appointment_id, patient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [appointmentId, pid]
        );
      }

      const created = await query(`${appointmentSelect} WHERE a.id = $1`, [appointmentId]);
      const aptPatient = await query('SELECT first_name AS "firstName", last_name AS "lastName" FROM patients WHERE id = $1', [patientId]);
      const aptPatientName = aptPatient.rows[0] ? `${aptPatient.rows[0].firstName} ${aptPatient.rows[0].lastName}` : 'Patient';
      await logActivity({ req, action: 'CREATE', resource: 'appointment', resourceId: appointmentId, resourceName: aptPatientName });

      return res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        appointment: created.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await query(
      'SELECT practitioner_id AS "practitionerId", patient_id AS "patientId", start_time AS "startTime", end_time AS "endTime", service_id AS "serviceId" FROM appointments WHERE id = $1',
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this appointment' });
    }

    let nextPractitionerId = current.practitionerId;
    if (req.body.patientId) {
      const patient = await query('SELECT practitioner_id AS "practitionerId" FROM patients WHERE id = $1', [req.body.patientId]);
      if (patient.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      if (req.user.role !== 'admin' && patient.rows[0].practitionerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to assign this patient' });
      }

      nextPractitionerId = req.user.role === 'admin' ? patient.rows[0].practitionerId : req.user.id;
    }

    const nextStart = req.body.startTime || current.startTime;
    const nextEnd = req.body.endTime || current.endTime;

    const conflict = await query(
      `SELECT id FROM appointments
       WHERE id <> $1
       AND practitioner_id = $2
       AND status IN ('scheduled')
       AND start_time < $4
       AND end_time > $3
       LIMIT 1`,
      [req.params.id, nextPractitionerId, nextStart, nextEnd]
    );

    if (conflict.rowCount > 0) {
      return res.status(400).json({ success: false, message: 'Time slot conflict with existing appointment' });
    }

    const { patientId, startTime, endTime, status, notes, serviceId, patientIds } = req.body;

    await query(
      `UPDATE appointments
       SET patient_id = COALESCE($2, patient_id),
           practitioner_id = COALESCE($3, practitioner_id),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           status = COALESCE($6, status),
           notes = COALESCE($7, notes),
           service_id = COALESCE($8, service_id),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, patientId, nextPractitionerId, startTime, endTime, status, notes, serviceId]
    );

    // Update appointment_patients junction table
    if (patientIds && Array.isArray(patientIds)) {
      await query('DELETE FROM appointment_patients WHERE appointment_id = $1', [req.params.id]);
      const allPatientIds = [...new Set([...(patientId ? [patientId] : []), ...patientIds])];
      for (const pid of allPatientIds) {
        await query(
          'INSERT INTO appointment_patients (appointment_id, patient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, pid]
        );
      }
    }

    const updated = await query(`${appointmentSelect} WHERE a.id = $1`, [req.params.id]);

    await logActivity({ req, action: 'UPDATE', resource: 'appointment', resourceId: req.params.id });

    return res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      appointment: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const { reason } = req.body || {};
    
    const existing = await query(
      'SELECT practitioner_id AS "practitionerId" FROM appointments WHERE id = $1', 
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
    }

    await query('UPDATE appointments SET status = $2, cancellation_reason = $3, updated_at = NOW() WHERE id = $1', [req.params.id, 'cancelled', reason || null]);

    await logActivity({ req, action: 'CANCEL', resource: 'appointment', resourceId: req.params.id, changes: { reason } });

    return res.status(200).json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/complete', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId", patient_id AS "patientId", service_id AS "serviceId", status FROM appointments WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this appointment' });
    }

    if (current.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Appointment already completed' });
    }

    await query('UPDATE appointments SET status = $2, updated_at = NOW() WHERE id = $1', [req.params.id, 'completed']);
    await query(
      `UPDATE patients
       SET session_count = session_count + 1,
           last_session_date = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [current.patientId]
    );

    const updated = await query(`${appointmentSelect} WHERE a.id = $1`, [req.params.id]);

    await logActivity({ req, action: 'COMPLETE', resource: 'appointment', resourceId: req.params.id });

    return res.status(200).json({
      success: true,
      message: 'Appointment completed successfully',
      appointment: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;