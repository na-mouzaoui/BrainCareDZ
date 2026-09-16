import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

const appointmentSelect = `
  SELECT a.id, a.practitioner_id AS "practitionerId", a.role AS "calendarRole", a.service_id AS "serviceId",
         a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.pack_deferred AS "packDeferred",
         a.title,
         COALESCE(u.name, 'Non assigné') AS "practitionerName", u.email AS "practitionerEmail",
         COALESCE(u.role, a.role, 'coach') AS "practitionerRole",
         s.name AS "serviceName", s.price AS "servicePrice", s.duration AS "serviceDuration", s.type AS "serviceType",
         COALESCE(
           (SELECT u2.name FROM session_notes sn
            JOIN appointment_patients ap2 ON ap2.id = sn.appointment_patient_id
            JOIN users u2 ON u2.id = sn.practitioner_id
            WHERE ap2.appointment_id = a.id
            ORDER BY sn.created_at ASC LIMIT 1),
           COALESCE(u.name, 'Non assigné')
         ) AS "noteAuthorName",
         COALESCE(
           (SELECT json_agg(json_build_object(
                    'appointmentPatientId', ap.id, 'patientId', p.id,
                    'firstName', p.first_name, 'lastName', p.last_name,
                    'packSelected', EXISTS (SELECT 1 FROM patient_pack_usages u WHERE u.appointment_patient_id = ap.id)))
            FROM appointment_patients ap
            JOIN patients p ON p.id = ap.patient_id
            WHERE ap.appointment_id = a.id),
           '[]'::json
         ) AS "patients"
FROM appointments a
   LEFT JOIN users u ON u.id = a.practitioner_id
   LEFT JOIN services s ON s.id = a.service_id
 `;

router.get('/', protect, async (req, res) => {
  try {
    const params = [];
    const where = [];

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

    const practitionerRoleRes = await query('SELECT role FROM users WHERE id = $1', [practitionerId]);
    const practitionerRole = practitionerRoleRes.rows[0]?.role;

    const appointments = await query(
      `SELECT a.start_time AS "startTime", a.end_time AS "endTime"
       FROM appointments a
       LEFT JOIN users u ON u.id = a.practitioner_id
       WHERE COALESCE(u.role, a.role) = $1 AND a.status IN ('scheduled') AND DATE(a.start_time) = $2`,
      [practitionerRole, date]
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
    body('patientIds').custom((value, { req }) => {
      if (req.body.title) return true;
      if (!Array.isArray(value) || value.length < 1) throw new Error('Au moins un patient est requis');
      return true;
    }),
    body('patientIds.*', 'Identifiant patient invalide').custom((value, { req }) => {
      if (req.body.title) return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
    }),
    body('serviceId', 'Valid service ID is required').custom((value, { req }) => {
      if (req.body.title || req.body.packDeferred) return true;
      return value && String(value).trim() !== '';
    }),
    body('startTime', 'Valid start time is required').isISO8601(),
    body('endTime', 'Valid end time is required').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      console.error('Appointments validation:', errors.array());
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    try {
      const { patientIds, serviceId, startTime, endTime, practitionerId, role, packDeferred, title } = req.body;

      const isPersonal = !!title;

      if (isPersonal && role && role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Les RDV personnels ne sont autorisés que sur le calendrier Admin' });
      }

      const allPatientIds = patientIds ? [...new Set(patientIds)] : [];

      if (!isPersonal && allPatientIds.length > 0) {
        const patients = await query(
          'SELECT id FROM patients WHERE id = ANY($1::uuid[])',
          [allPatientIds]
        );
        if (patients.rowCount !== allPatientIds.length) {
          return res.status(404).json({ success: false, message: 'Un ou plusieurs patients introuvables' });
        }
      }

      const service = (req.body.title || req.body.packDeferred)
        ? null
        : await query('SELECT id, type FROM services WHERE id = $1 AND is_active = TRUE', [serviceId]);
      if (!req.body.title && !req.body.packDeferred && (service === null || service.rowCount === 0)) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      // Calendrier cible : fourni explicitement (rôle du calendrier sélectionné) sinon dérivé du praticien choisi.
      const isCoach = role === 'coach';
      let selectedPractitionerId: string | null;
      let practitionerRole: string | undefined;

      if (isCoach) {
        selectedPractitionerId = null;
        practitionerRole = 'coach';
      } else {
        selectedPractitionerId = req.user.role === 'admin'
          ? practitionerId || req.user.id
          : req.user.id;
        const practitionerRoleRes = await query(
          'SELECT role FROM users WHERE id = $1',
          [selectedPractitionerId]
        );
        practitionerRole = practitionerRoleRes.rows[0]?.role;
      }

      const maxPatients = practitionerRole === 'coach' ? 4 : 1;
      if (!isPersonal && allPatientIds.length > maxPatients) {
        return res.status(400).json({ success: false, message: `Maximum ${maxPatients} patient(s) pour ce rendez-vous` });
      }

      const maxPerSlot = practitionerRole === 'coach' ? 4 : 1;

      if (!isPersonal) {
        const conflict = await query(
          `SELECT COUNT(DISTINCT a.id)::int AS cnt
           FROM appointments a
           LEFT JOIN users u ON u.id = a.practitioner_id
           WHERE COALESCE(u.role, a.role) = $1
           AND a.status IN ('scheduled')
           AND a.start_time < $3
           AND a.end_time > $2`,
          [practitionerRole, startTime, endTime]
        );

        if ((conflict.rows[0]?.cnt || 0) >= maxPerSlot) {
          return res.status(400).json({ success: false, message: `Créneau complet : maximum ${maxPerSlot} RDV pour ce rôle à cet horaire` });
        }

        // Vérifier qu'aucun patient n'a déjà un RDV qui chevauche ce créneau
        if (allPatientIds.length > 0) {
          const patientOverlap = await query(
            `SELECT p.first_name, p.last_name
             FROM appointment_patients ap
             JOIN patients p ON p.id = ap.patient_id
             JOIN appointments a ON a.id = ap.appointment_id
             WHERE ap.patient_id = ANY($1)
             AND a.status IN ('scheduled')
             AND a.start_time < $3
             AND a.end_time > $2`,
            [allPatientIds, startTime, endTime]
          );
          if (patientOverlap.rows.length > 0) {
            const names = patientOverlap.rows.map((r: any) => `${r.first_name} ${r.last_name}`).join(', ');
            return res.status(400).json({ success: false, message: `Le(s) patient(s) ${names} a(ont) déjà un RDV sur ce créneau horaire` });
          }
        }
      }

      const inserted = await query(
        `INSERT INTO appointments (practitioner_id, role, service_id, start_time, end_time, pack_deferred, title)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [selectedPractitionerId, practitionerRole || null, serviceId || null, startTime, endTime, !!packDeferred, title || null]
      );

      const appointmentId = inserted.rows[0].id;

      // Insert all patients into junction table + auto-link pack
      for (const pid of allPatientIds) {
        const apResult = await query(
          'INSERT INTO appointment_patients (appointment_id, patient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
          [appointmentId, pid]
        );
        const apId = apResult.rows[0]?.id;

        // Auto-link pack if service is set and not deferred
        if (apId && serviceId && !packDeferred) {
          // Find existing pack with remaining sessions
          const existingPack = await query(
            `SELECT id, remaining_sessions FROM patient_packs
             WHERE patient_id = $1 AND service_id = $2 AND remaining_sessions > 0
             ORDER BY created_at DESC LIMIT 1`,
            [pid, serviceId]
          );

          let packId: string;
          if (existingPack.rowCount > 0) {
            packId = existingPack.rows[0].id;
          } else {
            // Create a new pack
            const svc = await query('SELECT sessions, price FROM services WHERE id = $1', [serviceId]);
            const totalSessions = svc.rows[0]?.sessions || 1;
            const price = svc.rows[0]?.price || 0;
            const newPack = await query(
              `INSERT INTO patient_packs (patient_id, service_id, total_sessions, remaining_sessions, practitioner_id, price)
               VALUES ($1, $2, $3, $3, $4, $5) RETURNING id`,
              [pid, serviceId, totalSessions, selectedPractitionerId, price]
            );
            packId = newPack.rows[0].id;
          }

          // Link pack to appointment_patient
          await query(
            `INSERT INTO patient_pack_usages (pack_id, appointment_patient_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [packId, apId]
          );
        }
      }

      const created = await query(`${appointmentSelect} WHERE a.id = $1`, [appointmentId]);

      return res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        appointment: created.rows[0],
      });
    } catch (error) {
      console.error('Appointments error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erreur interne du serveur' });
    }
  }
);

router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await query(
      'SELECT practitioner_id AS "practitionerId", start_time AS "startTime", end_time AS "endTime", service_id AS "serviceId", role, status FROM appointments WHERE id = $1',
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const current = existing.rows[0];

    if (current.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot modify a completed appointment' });
    }

    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this appointment' });
    }

    let nextPractitionerId = current.practitionerId;
    if (req.user.role === 'admin' && req.body.practitionerId) {
      nextPractitionerId = req.body.practitionerId;
    }

    if (Array.isArray(req.body.patientIds) && req.body.patientIds.length > 0) {
      const patientIds = [...new Set(req.body.patientIds)];
      const patients = await query(
        'SELECT id FROM patients WHERE id = ANY($1::uuid[])',
        [patientIds]
      );
      if (patients.rowCount !== patientIds.length) {
        return res.status(404).json({ success: false, message: 'Un ou plusieurs patients introuvables' });
      }
    }

    const { startTime, endTime, status, serviceId, patientIds, packDeferred } = req.body;

    const nextStart = startTime || current.startTime;
    const nextEnd = endTime || current.endTime;

    const isCoach = req.body.role === 'coach';
    let nextPractitionerRole: string | undefined;
    if (isCoach) {
      nextPractitionerId = null;
      nextPractitionerRole = 'coach';
    } else if (nextPractitionerId) {
      const nextPractitionerRoleRes = await query(
        'SELECT role FROM users WHERE id = $1',
        [nextPractitionerId]
      );
      nextPractitionerRole = nextPractitionerRoleRes.rows[0]?.role;
    } else {
      nextPractitionerRole = current.role || 'coach';
    }

    const maxPerSlot = nextPractitionerRole === 'coach' ? 4 : 1;

    const conflict = await query(
      `SELECT COUNT(DISTINCT a.id)::int AS cnt
       FROM appointments a
       LEFT JOIN users u ON u.id = a.practitioner_id
       WHERE a.id <> $1
       AND COALESCE(u.role, a.role) = $2
       AND a.status IN ('scheduled')
       AND a.start_time < $4
       AND a.end_time > $3`,
      [req.params.id, nextPractitionerRole, nextStart, nextEnd]
    );

    if ((conflict.rows[0]?.cnt || 0) >= maxPerSlot) {
      return res.status(400).json({ success: false, message: `Créneau complet : maximum ${maxPerSlot} RDV pour ce rôle à cet horaire` });
    }

    // Vérifier qu'aucun patient n'a déjà un RDV qui chevauche ce créneau
    const patientOverlap = await query(
      `SELECT p.first_name, p.last_name
       FROM appointment_patients ap
       JOIN patients p ON p.id = ap.patient_id
       JOIN appointments a ON a.id = ap.appointment_id
       WHERE ap.patient_id = ANY($1)
       AND a.id <> $2
       AND a.status IN ('scheduled')
       AND a.start_time < $4
       AND a.end_time > $3`,
      [patientIds, req.params.id, nextStart, nextEnd]
    );
    if (patientOverlap.rows.length > 0) {
      const names = patientOverlap.rows.map((r: any) => `${r.first_name} ${r.last_name}`).join(', ');
      return res.status(400).json({ success: false, message: `Le(s) patient(s) ${names} a(ont) déjà un RDV sur ce créneau horaire` });
    }

    const nextServiceId = packDeferred ? null : serviceId ?? current.serviceId;

    await query(
      `UPDATE appointments
       SET practitioner_id = $2,
           role = COALESCE($3, role),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           status = COALESCE($6, status),
           service_id = $7,
           pack_deferred = COALESCE($8, pack_deferred),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, nextPractitionerId, nextPractitionerRole || null, startTime, endTime, status, nextServiceId, packDeferred]
    );

    // Update appointment_patients junction table
    if (Array.isArray(patientIds)) {
      const allPatientIds = [...new Set(patientIds)];
      await query('DELETE FROM appointment_patients WHERE appointment_id = $1', [req.params.id]);
      for (const pid of allPatientIds) {
        await query(
          'INSERT INTO appointment_patients (appointment_id, patient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, pid]
        );
      }
    }

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
    
    const existing = await query(
      'SELECT practitioner_id AS "practitionerId", status FROM appointments WHERE id = $1', 
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (existing.rows[0].status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed appointment' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
    }

    // Get patient label for logging
    const aptPatients = await query(
      `SELECT p.first_name || ' ' || p.last_name AS name
       FROM appointment_patients ap JOIN patients p ON p.id = ap.patient_id
       WHERE ap.appointment_id = $1`, [req.params.id]
    );
    const aptLabel = aptPatients.rows.map((r: any) => r.name).join(', ') || 'RDV';

    await query('UPDATE appointments SET status = $2, cancellation_reason = $3, updated_at = NOW() WHERE id = $1', [req.params.id, 'cancelled', reason || null]);

    // Reverse pack sessions: increment back for each linked pack
    const usages = await query(
      `SELECT pu.pack_id, pu.id AS usage_id, pp.remaining_sessions, pp.total_sessions
       FROM patient_pack_usages pu
       JOIN patient_packs pp ON pp.id = pu.pack_id
       JOIN appointment_patients ap ON ap.id = pu.appointment_patient_id
       WHERE ap.appointment_id = $1`,
      [req.params.id]
    );

    for (const usage of usages.rows) {
      // Check if this pack was used by other active appointments
      const otherUsages = await query(
        `SELECT 1 FROM patient_pack_usages pu2
         JOIN appointment_patients ap2 ON ap2.id = pu2.appointment_patient_id
         JOIN appointments a2 ON a2.id = ap2.appointment_id
         WHERE pu2.pack_id = $1 AND pu2.id != $2 AND a2.status != 'cancelled'`,
        [usage.pack_id, usage.usage_id]
      );

      if (otherUsages.rowCount === 0 && usage.remaining_sessions === usage.total_sessions) {
        // Pack was created for this RDV and no sessions were used — delete it
        await query('DELETE FROM patient_pack_usages WHERE pack_id = $1', [usage.pack_id]);
        await query('DELETE FROM patient_packs WHERE id = $1', [usage.pack_id]);
      } else {
        // Sessions were already used — increment remaining back
        await query(
          'UPDATE patient_packs SET remaining_sessions = LEAST(remaining_sessions + 1, total_sessions), updated_at = NOW() WHERE id = $1',
          [usage.pack_id]
        );
        await query('DELETE FROM patient_pack_usages WHERE id = $1', [usage.usage_id]);
      }
    }

    await logActivity({ req, action: 'CANCEL', resource: 'appointment', resourceId: req.params.id, resourceName: aptLabel, changes: { reason } });

    return res.status(200).json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/start', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId", status FROM appointments WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const current = existing.rows[0];
    if (req.user.role !== 'admin' && current.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (current.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Appointment is not scheduled' });
    }

    // Decrement remaining_sessions for each linked pack
    const usages = await query(
      `SELECT pu.pack_id, pp.remaining_sessions
       FROM patient_pack_usages pu
       JOIN patient_packs pp ON pp.id = pu.pack_id
       JOIN appointment_patients ap ON ap.id = pu.appointment_patient_id
       WHERE ap.appointment_id = $1 AND pp.remaining_sessions > 0`,
      [req.params.id]
    );

    for (const usage of usages.rows) {
      await query(
        'UPDATE patient_packs SET remaining_sessions = remaining_sessions - 1, updated_at = NOW() WHERE id = $1',
        [usage.pack_id]
      );
    }

    return res.status(200).json({ success: true, message: 'Pack sessions decremented' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/complete', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId", service_id AS "serviceId", status FROM appointments WHERE id = $1', [req.params.id]);
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

    // Get patient label for logging
    const aptPatients = await query(
      `SELECT p.first_name || ' ' || p.last_name AS name
       FROM appointment_patients ap JOIN patients p ON p.id = ap.patient_id
       WHERE ap.appointment_id = $1`, [req.params.id]
    );
    const aptLabel = aptPatients.rows.map((r: any) => r.name).join(', ') || 'RDV';

    const updated = await query(`${appointmentSelect} WHERE a.id = $1`, [req.params.id]);

    await logActivity({ req, action: 'COMPLETE', resource: 'appointment', resourceId: req.params.id, resourceName: aptLabel });

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