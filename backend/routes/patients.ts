import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

function normalizeGender(value) {
  if (value === undefined || value === null || value === '') return null;

  const normalized = String(value).trim().toLowerCase();
  const map = {
    male: 'male',
    homme: 'male',
    m: 'male',
    female: 'female',
    femme: 'female',
    f: 'female',
    other: 'other',
    autre: 'other',
  };

  return map[normalized] || null;
}

const baseSelect = `
  SELECT c.id, c.first_name AS "firstName", c.last_name AS "lastName", c.email, c.phone,
         c.date_of_birth AS "dateOfBirth", c.gender,
         c.address_street AS "addressStreet", c.address_city AS "addressCity", c.address_state AS "addressState",
         c.address_zip_code AS "addressZipCode", c.address_country AS "addressCountry",
         c.emergency_contact_name AS "emergencyContactName", c.emergency_contact_relationship AS "emergencyContactRelationship",
         c.emergency_contact_phone AS "emergencyContactPhone",
         c.insurance_provider AS "insuranceProvider", c.insurance_policy_number AS "insurancePolicyNumber",
         c.medical_history AS "medicalHistory", c.allergies, c.current_medications AS "currentMedications",
         c.referral_source AS "referralSource", c.status, c.notes, c.session_count AS "sessionCount",
         c.last_session_date AS "lastSessionDate", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
         c.marital_status AS "maritalStatus", c.has_children AS "hasChildren", c.children_count AS "childrenCount",
         c.profession, c.education_level AS "educationLevel", c.socio_category AS "socioCategory",
         c.patient_type AS "patientType", c.show_parent_info AS "showParentInfo",
         c.parent_name AS "parentName", c.parent_relationship AS "parentRelationship",
         c.consultation_reasons AS "consultationReasons", c.difficulty_duration AS "difficultyDuration",
         c.commune,
         c.previous_consultation AS "previousConsultation", c.previous_type AS "previousType",
         c.previous_neurofeedback AS "previousNeurofeedback",
         c.current_follow_up AS "currentFollowUp", c.follow_up_details AS "followUpDetails",
         c.source_of_acquisition AS "sourceOfAcquisition", c.source_details AS "sourceDetails",
         c.source_sub AS "sourceSub", c.source_account AS "sourceAccount",
         c.first_contact_date AS "firstContactDate", c.first_appointment_date AS "firstAppointmentDate",
         c.appointment_frequency AS "appointmentFrequency", c.planned_sessions AS "plannedSessions",
         c.completed_sessions AS "completedSessions", c.abandon_reason AS "abandonReason",
         c.perceived_improvement AS "perceivedImprovement", c.observed_changes AS "observedChanges",
         c.improvement_start_month AS "improvementStartMonth", c.global_satisfaction AS "globalSatisfaction",
         c.would_recommend AS "wouldRecommend",
         (
           COALESCE((
             SELECT SUM(p.amount)
             FROM payments p
             WHERE p.patient_id = c.id AND p.status = 'completed'
           ), 0)
           -
           COALESCE((
             SELECT SUM(s.price)
             FROM appointments a
             JOIN services s ON s.id = a.service_id
             WHERE a.patient_id = c.id AND a.status = 'completed'
           ), 0)
         ) AS "balance",
         pack_next.service_name AS "packServiceName",
         pack_next.pack_total AS "packTotal",
         pack_next.pack_remaining AS "packRemaining",
         pack_list.pack_list AS "packList",
         c.practitioner_id AS "practitionerId", u.name AS "practitionerName", u.email AS "practitionerEmail"
  FROM patients c
  JOIN users u ON c.practitioner_id = u.id
  LEFT JOIN LATERAL (
    SELECT p.service_name, p.pack_total, p.pack_remaining
    FROM (
            SELECT s.name AS service_name,
              COALESCE(s.sessions, 1) AS pack_total,
              GREATEST(COALESCE(s.sessions, 1) - COUNT(*) FILTER (WHERE a.status = 'completed'), 0) AS pack_remaining,
             MIN(a.start_time) FILTER (WHERE a.status = 'scheduled') AS next_scheduled
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      WHERE a.patient_id = c.id AND a.status IN ('scheduled', 'completed')
      GROUP BY s.id, s.name, s.sessions
    ) p
    WHERE p.next_scheduled IS NOT NULL AND p.pack_remaining > 0
    ORDER BY p.next_scheduled ASC
    LIMIT 1
  ) pack_next ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'serviceName', p.service_name,
          'packTotal', p.pack_total,
          'packRemaining', p.pack_remaining,
          'nextAppointment', p.next_scheduled
        )
        ORDER BY p.next_scheduled NULLS LAST, p.service_name
      ) FILTER (WHERE p.pack_remaining > 0),
      '[]'::json
    ) AS pack_list
    FROM (
            SELECT s.name AS service_name,
              COALESCE(s.sessions, 1) AS pack_total,
              GREATEST(COALESCE(s.sessions, 1) - COUNT(*) FILTER (WHERE a.status = 'completed'), 0) AS pack_remaining,
             MIN(a.start_time) FILTER (WHERE a.status = 'scheduled') AS next_scheduled
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      WHERE a.patient_id = c.id AND a.status IN ('scheduled', 'completed')
      GROUP BY s.id, s.name, s.sessions
    ) p
  ) pack_list ON true
`;

router.get('/', protect, async (req, res) => {
  try {
    const params = [];
    let where = '';

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where = `WHERE c.practitioner_id = $${params.length}`;
    }

    const result = await query(`${baseSelect} ${where} ORDER BY c.created_at DESC`, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      patients: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search/:query', protect, async (req, res) => {
  try {
    const params = [`%${req.params.query}%`];
    let where = `(c.first_name ILIKE $1 OR c.last_name ILIKE $1 OR COALESCE(c.email, '') ILIKE $1)`;

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where = `${where} AND c.practitioner_id = $2`;
    }

    const result = await query(`${baseSelect} WHERE ${where} ORDER BY c.created_at DESC LIMIT 10`, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      patients: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const result = await query(`${baseSelect} WHERE c.id = $1`, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const patient = result.rows[0];
    if (req.user.role !== 'admin' && patient.practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this patient' });
    }

    return res.status(200).json({ success: true, patient });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('firstName', 'First name is required').notEmpty().trim(),
    body('lastName', 'Last name is required').notEmpty().trim(),
    body('phone', 'Valid phone number is required').notEmpty().trim(),
    body('email', 'Valid email is required').notEmpty().isEmail(),
    body('maritalStatus', 'Marital status is required').notEmpty(),
    body('profession', 'Profession is required').notEmpty(),
    body('educationLevel', 'Education level is required').notEmpty(),
    body('socioCategory', 'Socio category is required').notEmpty(),
    body('consultationReasons', 'Consultation reasons are required').isArray({ min: 1 }),
    body('sourceOfAcquisition', 'Source of acquisition is required').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      console.log('Creating patient with data:', req.body);
      const {
        firstName, lastName, email, phone, dateOfBirth, gender,
        maritalStatus, hasChildren, childrenCount, profession, educationLevel, socioCategory,
        patientType, showParentInfo, parentName, parentRelationship,
        consultationReasons, difficultyDuration, commune,
        previousConsultation, previousType, previousNeurofeedback, currentFollowUp, followUpDetails,
        sourceOfAcquisition, sourceDetails, sourceSub, sourceAccount, firstContactDate, firstAppointmentDate, appointmentFrequency,
        plannedSessions, completedSessions, status, abandonReason,
        perceivedImprovement, observedChanges, improvementStartMonth, globalSatisfaction, wouldRecommend,
      } = req.body;

      if (gender !== undefined && normalizeGender(gender) === null) {
        return res.status(400).json({ success: false, message: 'Gender value is invalid' });
      }

      const inserted = await query(
        `INSERT INTO patients (
          practitioner_id, first_name, last_name, email, phone, date_of_birth, gender,
          marital_status, has_children, children_count, profession, education_level, socio_category,
          patient_type, show_parent_info, parent_name, parent_relationship,
          consultation_reasons, difficulty_duration, commune,
          previous_consultation, previous_type, previous_neurofeedback, current_follow_up, follow_up_details,
          source_of_acquisition, source_details, source_sub, source_account, first_contact_date, first_appointment_date, appointment_frequency,
          planned_sessions, completed_sessions, status, abandon_reason,
          perceived_improvement, observed_changes, improvement_start_month, global_satisfaction, would_recommend
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, $31, $32,
          $33, $34, COALESCE($35, 'active'), $36,
          $37, $38, $39, $40, $41
        ) RETURNING id`,
        [
          req.user.id,
          firstName, lastName, email, phone, dateOfBirth || null, normalizeGender(gender),
          maritalStatus || null, hasChildren ?? false, childrenCount || null, profession || null,
          educationLevel || null, socioCategory || null,
          patientType || null, showParentInfo ?? false, parentName || null, parentRelationship || null,
          consultationReasons ? JSON.stringify(consultationReasons) : '[]',
          difficultyDuration || null, commune || null,
          previousConsultation ?? false, previousType || null, previousNeurofeedback ?? false,
          currentFollowUp ?? false, followUpDetails || null,
          sourceOfAcquisition || null, sourceDetails || null, sourceSub || null, sourceAccount || null, firstContactDate || null, firstAppointmentDate || null,
          appointmentFrequency || null,
          plannedSessions || null, completedSessions || null, status || null, abandonReason || null,
          perceivedImprovement || null, observedChanges || null, improvementStartMonth || null,
          globalSatisfaction || null, wouldRecommend ?? false,
        ]
      );

      const created = await query(`${baseSelect} WHERE c.id = $1`, [inserted.rows[0].id]);
      const patientName = `${firstName} ${lastName}`;
      await logActivity({ req, action: 'CREATE', resource: 'patient', resourceId: inserted.rows[0].id, resourceName: patientName });

      return res.status(201).json({
        success: true,
        message: 'Patient created successfully',
        patient: created.rows[0],
      });
    } catch (error) {
      console.error('Create patient error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await query('SELECT practitioner_id AS "practitionerId" FROM patients WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this patient' });
    }

    const {
      firstName, lastName, email, phone, dateOfBirth, gender,
      maritalStatus, hasChildren, childrenCount, profession, educationLevel, socioCategory,
      patientType, showParentInfo, parentName, parentRelationship,
      consultationReasons, difficultyDuration, commune,
        previousConsultation, previousType, previousNeurofeedback, currentFollowUp, followUpDetails,
        sourceOfAcquisition, sourceDetails, sourceSub, sourceAccount, firstContactDate, firstAppointmentDate, appointmentFrequency,
        plannedSessions, completedSessions, status, abandonReason,
        perceivedImprovement, observedChanges, improvementStartMonth, globalSatisfaction, wouldRecommend,
    } = req.body;

    if (gender !== undefined && normalizeGender(gender) === null) {
      return res.status(400).json({ success: false, message: 'Gender value is invalid' });
    }

    await query(
      `UPDATE patients SET
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        date_of_birth = COALESCE($6, date_of_birth),
        gender = COALESCE($7, gender),
        marital_status = COALESCE($8, marital_status),
        has_children = COALESCE($9, has_children),
        children_count = COALESCE($10, children_count),
        profession = COALESCE($11, profession),
        education_level = COALESCE($12, education_level),
        socio_category = COALESCE($13, socio_category),
        patient_type = COALESCE($14, patient_type),
        show_parent_info = COALESCE($15, show_parent_info),
        parent_name = COALESCE($16, parent_name),
        parent_relationship = COALESCE($17, parent_relationship),
        consultation_reasons = COALESCE($18, consultation_reasons),
        difficulty_duration = COALESCE($19, difficulty_duration),
        commune = COALESCE($20, commune),
        previous_consultation = COALESCE($21, previous_consultation),
        previous_type = COALESCE($22, previous_type),
        previous_neurofeedback = COALESCE($23, previous_neurofeedback),
        current_follow_up = COALESCE($24, current_follow_up),
        follow_up_details = COALESCE($25, follow_up_details),
        source_of_acquisition = COALESCE($26, source_of_acquisition),
        source_details = COALESCE($27, source_details),
        source_sub = COALESCE($28, source_sub),
        source_account = COALESCE($29, source_account),
        first_contact_date = COALESCE($30, first_contact_date),
        first_appointment_date = COALESCE($31, first_appointment_date),
        appointment_frequency = COALESCE($32, appointment_frequency),
        planned_sessions = COALESCE($33, planned_sessions),
        completed_sessions = COALESCE($34, completed_sessions),
        status = COALESCE($35, status),
        abandon_reason = COALESCE($36, abandon_reason),
        perceived_improvement = COALESCE($37, perceived_improvement),
        observed_changes = COALESCE($38, observed_changes),
        improvement_start_month = COALESCE($39, improvement_start_month),
        global_satisfaction = COALESCE($40, global_satisfaction),
        would_recommend = COALESCE($41, would_recommend),
        updated_at = NOW()
      WHERE id = $1`,
      [
        req.params.id,
        firstName, lastName, email, phone, dateOfBirth,
        gender !== undefined ? normalizeGender(gender) : undefined,
        maritalStatus, hasChildren, childrenCount, profession, educationLevel, socioCategory,
        patientType, showParentInfo, parentName, parentRelationship,
        consultationReasons ? JSON.stringify(consultationReasons) : null,
        difficultyDuration, commune,
        previousConsultation, previousType, previousNeurofeedback, currentFollowUp, followUpDetails,
        sourceOfAcquisition, sourceDetails, sourceSub, sourceAccount, firstContactDate, firstAppointmentDate, appointmentFrequency,
        plannedSessions, completedSessions, status, abandonReason,
        perceivedImprovement, observedChanges, improvementStartMonth, globalSatisfaction, wouldRecommend,
      ]
    );

    const updated = await query(`${baseSelect} WHERE c.id = $1`, [req.params.id]);

    const patRes = await query('SELECT first_name AS "firstName", last_name AS "lastName" FROM patients WHERE id = $1', [req.params.id]);
    const patName = patRes.rows[0] ? `${patRes.rows[0].firstName} ${patRes.rows[0].lastName}` : 'Patient';
    await logActivity({ req, action: 'UPDATE', resource: 'patient', resourceId: req.params.id, resourceName: patName });

    return res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      patient: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/history', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.id, a.start_time AS "startTime", a.end_time AS "endTime", a.status,
              s.name AS "serviceName", s.type AS "serviceType",
              pp.total_sessions AS "packTotal", pp.remaining_sessions AS "packRemaining"
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       LEFT JOIN patient_packs pp ON pp.id = a.patient_pack_id
       WHERE a.patient_id = $1
          OR a.id IN (SELECT ap.appointment_id FROM appointment_patients ap WHERE ap.patient_id = $1)
       ORDER BY a.start_time DESC`,
      [id]
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const id = req.params.id;
    
    const existing = await query('SELECT practitioner_id AS "practitionerId" FROM patients WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].practitionerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this patient' });
    }

    // Supprimer les enregistrements liés d'abord (dans l'ordre pour éviter les contraintes)
    await query('DELETE FROM invoice_appointments WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id = $1)', [id]);
    await query('DELETE FROM payments WHERE patient_id = $1', [id]);
    await query('DELETE FROM session_notes WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id = $1)', [id]);
    await query('DELETE FROM appointments WHERE patient_id = $1', [id]);
    await query('DELETE FROM invoices WHERE patient_id = $1', [id]);
    await query('DELETE FROM session_notes WHERE patient_id = $1', [id]);

    // Puis supprimer le patient
    await query('DELETE FROM patients WHERE id = $1', [id]);

    await logActivity({ req, action: 'DELETE', resource: 'patient', resourceId: id });

    return res.status(200).json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
