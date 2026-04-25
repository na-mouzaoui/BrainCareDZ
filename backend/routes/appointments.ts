import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const appointmentSelect = `
  SELECT a.id, a.patient_id AS "patientId", a.practitioner_id AS "practitionerId", a.service_id AS "serviceId",
         a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.notes,
         a.reminder_sent AS "reminderSent", a.session_note_id AS "sessionNoteId",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName", c.email AS "patientEmail", c.phone AS "patientPhone",
         u.name AS "practitionerName", u.email AS "practitionerEmail",
         s.name AS "serviceName", s.price AS "servicePrice", s.duration AS "serviceDuration"
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

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(`${appointmentSelect} ${clause} ORDER BY a.start_time ASC`, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      appointments: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/availability/:date', protect, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const appointments = await query(
      `SELECT start_time AS "startTime", end_time AS "endTime"
       FROM appointments
       WHERE practitioner_id = $1
       AND status IN ('scheduled', 'completed')
       AND start_time >= $2
       AND start_time <= $3
       ORDER BY start_time ASC`,
      [req.user.id, dayStart.toISOString(), dayEnd.toISOString()]
    );

    const slots = [];
    const dayStartTime = new Date(date);
    dayStartTime.setHours(9, 0, 0, 0);
    const dayEndTime = new Date(date);
    dayEndTime.setHours(17, 0, 0, 0);

    for (let time = new Date(dayStartTime); time < dayEndTime; time.setMinutes(time.getMinutes() + 30)) {
      const slotEnd = new Date(time);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      const isBooked = appointments.rows.some((apt) => {
        const start = new Date(apt.startTime);
        const end = new Date(apt.endTime);
        return start < slotEnd && end > time;
      });

      slots.push({
        startTime: new Date(time),
        endTime: slotEnd,
        available: !isBooked,
      });
    }

    return res.status(200).json({ success: true, date, slots });
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

    const appointment = result.rows[0];
    if (req.user.role !== 'admin' && appointment.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this appointment' });
    }

    return res.status(200).json({ success: true, appointment });
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
      const { patientId, serviceId, startTime, endTime, notes } = req.body;

      const patient = await query('SELECT practitioner_id AS "practitionerId" FROM patients WHERE id = $1', [patientId]);
      if (patient.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      if (req.user.role !== 'admin' && patient.rows[0].practitionerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to book for this patient' });
      }

      const service = await query('SELECT id FROM services WHERE id = $1 AND is_active = TRUE', [serviceId]);
      if (service.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      const practitionerId = req.user.role === 'admin' ? patient.rows[0].practitionerId : req.user.id;

      const conflict = await query(
        `SELECT id FROM appointments
         WHERE practitioner_id = $1
         AND status IN ('scheduled', 'completed')
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

      const created = await query(`${appointmentSelect} WHERE a.id = $1`, [inserted.rows[0].id]);

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
      'SELECT practitioner_id AS "practitionerId", patient_id AS "patientId", start_time AS "startTime", end_time AS "endTime" FROM appointments WHERE id = $1',
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
       AND status IN ('scheduled', 'completed')
       AND start_time < $4
       AND end_time > $3
       LIMIT 1`,
      [req.params.id, nextPractitionerId, nextStart, nextEnd]
    );

    if (conflict.rowCount > 0) {
      return res.status(400).json({ success: false, message: 'Time slot conflict with existing appointment' });
    }

    const { patientId, startTime, endTime, status, notes, serviceId } = req.body;

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

    const updated = await query(`${appointmentSelect} WHERE a.id = $1`, [req.params.id]);

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
    
    const existing = await query('SELECT practitioner_id AS "practitionerId" FROM appointments WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
    }

    await query('UPDATE appointments SET status = $2, cancellation_reason = $3, updated_at = NOW() WHERE id = $1', [req.params.id, 'cancelled', reason || null]);

    return res.status(200).json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/complete', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId", patient_id AS "patientId" FROM appointments WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this appointment' });
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

    return res.status(200).json({
      success: true,
      message: 'Appointment marked as completed',
      appointment: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
