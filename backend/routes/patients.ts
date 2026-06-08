import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';

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
    body('email', 'Valid email is required').optional({ checkFalsy: true }).isEmail(),
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
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        gender,
        addressStreet,
        addressCity,
        addressState,
        addressZipCode,
        addressCountry,
        emergencyContactName,
        emergencyContactRelationship,
        emergencyContactPhone,
        insuranceProvider,
        insurancePolicyNumber,
        medicalHistory,
        allergies,
        currentMedications,
        referralSource,
        status,
        notes,
      } = req.body;

      if (gender !== undefined && normalizeGender(gender) === null) {
        return res.status(400).json({ success: false, message: 'Gender value is invalid' });
      }

      const inserted = await query(
        `INSERT INTO patients (
          practitioner_id, first_name, last_name, email, phone, date_of_birth, gender,
          address_street, address_city, address_state, address_zip_code, address_country,
          emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
          insurance_provider, insurance_policy_number, medical_history, allergies,
          current_medications, referral_source, status, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21, COALESCE($22, 'active'), $23
        ) RETURNING id`,
        [
          req.user.id,
          firstName,
          lastName,
          email || null,
          phone,
          dateOfBirth || null,
          normalizeGender(gender),
          addressStreet || null,
          addressCity || null,
          addressState || null,
          addressZipCode || null,
          addressCountry || null,
          emergencyContactName || null,
          emergencyContactRelationship || null,
          emergencyContactPhone || null,
          insuranceProvider || null,
          insurancePolicyNumber || null,
          medicalHistory || null,
          allergies || null,
          currentMedications || null,
          referralSource || null,
          status || null,
          notes || null,
        ]
      );

      const created = await query(`${baseSelect} WHERE c.id = $1`, [inserted.rows[0].id]);

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
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      addressStreet,
      addressCity,
      addressState,
      addressZipCode,
      addressCountry,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      insuranceProvider,
      insurancePolicyNumber,
      medicalHistory,
      allergies,
      currentMedications,
      referralSource,
      status,
      notes,
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
        address_street = COALESCE($8, address_street),
        address_city = COALESCE($9, address_city),
        address_state = COALESCE($10, address_state),
        address_zip_code = COALESCE($11, address_zip_code),
        address_country = COALESCE($12, address_country),
        emergency_contact_name = COALESCE($13, emergency_contact_name),
        emergency_contact_relationship = COALESCE($14, emergency_contact_relationship),
        emergency_contact_phone = COALESCE($15, emergency_contact_phone),
        insurance_provider = COALESCE($16, insurance_provider),
        insurance_policy_number = COALESCE($17, insurance_policy_number),
        medical_history = COALESCE($18, medical_history),
        allergies = COALESCE($19, allergies),
        current_medications = COALESCE($20, current_medications),
        referral_source = COALESCE($21, referral_source),
        status = COALESCE($22, status),
        notes = COALESCE($23, notes),
        updated_at = NOW()
      WHERE id = $1`,
      [
        req.params.id,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        gender !== undefined ? normalizeGender(gender) : undefined,
        addressStreet,
        addressCity,
        addressState,
        addressZipCode,
        addressCountry,
        emergencyContactName,
        emergencyContactRelationship,
        emergencyContactPhone,
        insuranceProvider,
        insurancePolicyNumber,
        medicalHistory,
        allergies,
        currentMedications,
        referralSource,
        status,
        notes,
      ]
    );

    const updated = await query(`${baseSelect} WHERE c.id = $1`, [req.params.id]);

    return res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      patient: updated.rows[0],
    });
  } catch (error) {
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
