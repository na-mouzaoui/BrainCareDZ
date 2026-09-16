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

async function resolveProfessionId(label) {
  if (label === undefined || label === null || String(label).trim() === '') return null;
  const trimmed = String(label).trim();
  const found = await query('SELECT id FROM professions WHERE label = $1', [trimmed]);
  if (found.rowCount > 0) return found.rows[0].id;
  const created = await query(
    `INSERT INTO professions (label) VALUES ($1)
     ON CONFLICT (label) DO UPDATE SET is_active = TRUE, updated_at = NOW()
     RETURNING id`,
    [trimmed]
  );
  return created.rows[0].id;
}

async function resolveMotifIds(labels) {
  const ids = [];
  const arr = Array.isArray(labels) ? labels : [];
  for (const raw of arr) {
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const trimmed = String(raw).trim();
    const found = await query('SELECT id FROM motifs WHERE label = $1', [trimmed]);
    if (found.rowCount > 0) {
      ids.push(found.rows[0].id);
    } else {
      const created = await query(
        `INSERT INTO motifs (label) VALUES ($1)
         ON CONFLICT (label) DO UPDATE SET is_active = TRUE, updated_at = NOW()
         RETURNING id`,
        [trimmed]
      );
      ids.push(created.rows[0].id);
    }
  }
  return ids;
}

async function setPatientMotifs(patientId, motifIds) {
  await query('DELETE FROM patient_motifs WHERE patient_id = $1', [patientId]);
  for (const motifId of motifIds) {
    await query(
      `INSERT INTO patient_motifs (id, patient_id, motif_id) VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT DO NOTHING`,
      [patientId, motifId]
    );
  }
}

async function recordOutcome(patientId, userId, outcome) {
  const { perceivedImprovement, observedChanges, globalSatisfaction, wouldRecommend } = outcome || {};
  const hasValues =
    perceivedImprovement !== undefined || observedChanges ||
    globalSatisfaction !== undefined || wouldRecommend !== undefined;
  if (!hasValues) return;

  await query(
    `INSERT INTO patient_outcomes (
      patient_id, evaluated_at, perceived_improvement, observed_changes, global_satisfaction, would_recommend, created_by
    ) VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
    [patientId, perceivedImprovement ?? null, observedChanges || null, globalSatisfaction ?? null, wouldRecommend ?? null, userId]
  );
}

const baseSelect = `
  SELECT c.id, c.first_name AS "firstName", c.last_name AS "lastName", c.email, c.phone,
         c.date_of_birth AS "dateOfBirth", c.gender,
         c.notes, c.session_count AS "sessionCount",
         c.last_session_date AS "lastSessionDate", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
c.marital_status AS "maritalStatus", c.has_children AS "hasChildren", c.children_count AS "childrenCount",
         prof.label AS "profession", c.patient_type AS "patientType",
         COALESCE((
           SELECT json_agg(m.label ORDER BY m.label)
           FROM patient_motifs pm JOIN motifs m ON m.id = pm.motif_id
           WHERE pm.patient_id = c.id
         ), '[]'::json) AS "consultationReasons", c.difficulty_duration AS "difficultyDuration",
         c.commune,
         c.previous_consultation AS "previousConsultation", c.previous_type AS "previousType",
         c.previous_neurofeedback AS "previousNeurofeedback",
         c.current_follow_up AS "currentFollowUp",
         c.source_of_acquisition AS "sourceOfAcquisition", c.source_details AS "sourceDetails",
         c.source_sub AS "sourceSub", c.source_account AS "sourceAccount",
         c.first_contact_date AS "firstContactDate", c.first_appointment_date AS "firstAppointmentDate",
         c.abandon_reason AS "abandonReason",
         c.balance AS "balance",
         pack_next.service_name AS "packServiceName",
         pack_next.pack_total AS "packTotal",
         pack_next.pack_remaining AS "packRemaining",
         pack_next.pack_price_per_session AS "packPricePerSession",
         pack_list.pack_list AS "packList",
         cur_prac."practitionerId" AS "practitionerId",
         cur_prac."practitionerName" AS "practitionerName",
         cur_prac."practitionerEmail" AS "practitionerEmail",
         prac_list."practitioners" AS "practitioners",
         consec_nulls.consecutive_no_shows AS "consecutiveNoShows",
         NOT EXISTS(
           SELECT 1 FROM appointments a
           JOIN appointment_patients ap ON ap.appointment_id = a.id AND ap.patient_id = c.id
           WHERE a.status = 'completed'
         ) AS "isProspect"
  FROM patients c
  LEFT JOIN professions prof ON prof.id = c.profession_id
  LEFT JOIN LATERAL (
    SELECT u.id AS "practitionerId", u.name AS "practitionerName", u.email AS "practitionerEmail"
    FROM appointments a
    JOIN appointment_patients ap ON ap.appointment_id = a.id AND ap.patient_id = c.id
    JOIN users u ON u.id = a.practitioner_id
    WHERE a.status <> 'cancelled'
    ORDER BY a.start_time DESC
    LIMIT 1
  ) cur_prac ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'practitionerId', p.practitioner_id,
          'practitionerName', p.practitioner_name,
          'firstSeen', p.first_seen,
          'lastSeen', p.last_seen
        )
        ORDER BY p.last_seen DESC
      ),
      '[]'::json
    ) AS practitioners
    FROM (
      SELECT u.id AS practitioner_id, u.name AS practitioner_name,
             MIN(a.start_time) AS first_seen,
             MAX(a.start_time) AS last_seen
      FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id AND ap.patient_id = c.id
      JOIN users u ON u.id = a.practitioner_id
      WHERE a.status <> 'cancelled'
      GROUP BY u.id, u.name
    ) p
  ) prac_list ON true
  LEFT JOIN LATERAL (
    SELECT p.service_name, p.pack_total, p.pack_remaining,
           COALESCE(
             price_per_session.pack_price_per_session,
             ROUND((p.service_price / NULLIF(p.pack_total, 0))::numeric, 2)
           ) AS pack_price_per_session
    FROM (
            SELECT s.id AS service_id, s.name AS service_name, s.price AS service_price,
              COALESCE(pp.total_sessions, s.sessions, 1) AS pack_total,
              GREATEST(COALESCE(pp.remaining_sessions,
                COALESCE(s.sessions, 1) - COUNT(*) FILTER (WHERE a.status = 'completed')), 0) AS pack_remaining,
              MIN(a.start_time) FILTER (WHERE a.status = 'scheduled') AS next_scheduled
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      LEFT JOIN LATERAL (
        SELECT total_sessions, remaining_sessions
        FROM patient_packs
        WHERE patient_id = c.id AND service_id = s.id AND remaining_sessions > 0
        ORDER BY created_at DESC
        LIMIT 1
      ) pp ON true
      WHERE a.status IN ('scheduled', 'completed')
        AND EXISTS (SELECT 1 FROM appointment_patients ap WHERE ap.appointment_id = a.id AND ap.patient_id = c.id)
      GROUP BY s.id, s.name, s.sessions, s.price, pp.total_sessions, pp.remaining_sessions
    ) p
    LEFT JOIN LATERAL (
      SELECT ROUND((pp.price / NULLIF(pp.total_sessions, 0))::numeric, 2) AS pack_price_per_session
      FROM patient_packs pp
      WHERE pp.patient_id = c.id AND pp.service_id = p.service_id
      ORDER BY pp.created_at DESC
      LIMIT 1
    ) price_per_session ON true
    WHERE p.pack_remaining > 0
    ORDER BY p.next_scheduled ASC NULLS LAST
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
              COALESCE(pp.total_sessions, s.sessions, 1) AS pack_total,
              GREATEST(COALESCE(pp.remaining_sessions,
                COALESCE(s.sessions, 1) - COUNT(*) FILTER (WHERE a.status = 'completed')), 0) AS pack_remaining,
             MIN(a.start_time) FILTER (WHERE a.status = 'scheduled') AS next_scheduled
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      LEFT JOIN LATERAL (
        SELECT total_sessions, remaining_sessions
        FROM patient_packs
        WHERE patient_id = c.id AND service_id = s.id AND remaining_sessions > 0
        ORDER BY created_at DESC
        LIMIT 1
      ) pp ON true
      WHERE a.status IN ('scheduled', 'completed')
        AND EXISTS (SELECT 1 FROM appointment_patients ap WHERE ap.appointment_id = a.id AND ap.patient_id = c.id)
      GROUP BY s.id, s.name, s.sessions, pp.total_sessions, pp.remaining_sessions
    ) p
  ) pack_list ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS consecutive_no_shows
    FROM (
      SELECT a.status,
             ROW_NUMBER() OVER (ORDER BY a.start_time DESC) AS rn
      FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id AND ap.patient_id = c.id
    ) numbered
    WHERE numbered.status = 'cancelled'
      AND numbered.rn <= COALESCE(
        (SELECT numbered2.rn FROM (
          SELECT a2.status,
                 ROW_NUMBER() OVER (ORDER BY a2.start_time DESC) AS rn
          FROM appointments a2
          JOIN appointment_patients ap2 ON ap2.appointment_id = a2.id AND ap2.patient_id = c.id
        ) numbered2 WHERE numbered2.status != 'cancelled' ORDER BY numbered2.rn LIMIT 1),
        999999
      )
  ) consec_nulls ON true
`;

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(`${baseSelect} ORDER BY c.created_at DESC`);

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
    const where = `(c.first_name ILIKE $1 OR c.last_name ILIKE $1 OR COALESCE(c.email, '') ILIKE $1)`;

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

    return res.status(200).json({ success: true, patient: result.rows[0] });
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
    body('email', 'Valid email is required').optional({ values: 'falsy' }).isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    try {
      const {
        firstName, lastName, email, phone, dateOfBirth, gender,
        maritalStatus, hasChildren, childrenCount, profession,
        patientType,
        consultationReasons, difficultyDuration, commune,
        previousConsultation, previousType, previousNeurofeedback, currentFollowUp,
        sourceOfAcquisition, sourceDetails, sourceSub, sourceAccount, firstContactDate, firstAppointmentDate,
        abandonReason,
        perceivedImprovement, observedChanges, globalSatisfaction, wouldRecommend,
      } = req.body;

      if (gender !== undefined && gender !== '' && normalizeGender(gender) === null) {
        return res.status(400).json({ success: false, message: 'Gender value is invalid' });
      }

      const professionId = await resolveProfessionId(profession);
      const motifIds = await resolveMotifIds(consultationReasons);

      const inserted = await query(
        `INSERT INTO patients (
          first_name, last_name, email, phone, date_of_birth, gender,
          marital_status, has_children, children_count, profession_id,
          patient_type,
          difficulty_duration, commune,
          previous_consultation, previous_type, previous_neurofeedback, current_follow_up,
          source_of_acquisition, source_details, source_sub, source_account, first_contact_date, first_appointment_date,
          abandon_reason
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12,
          $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24
        ) RETURNING id`,
        [
          firstName, lastName, email, phone, dateOfBirth || null, normalizeGender(gender),
          maritalStatus || null, hasChildren ?? false, childrenCount || null, professionId,
          patientType || null,
          difficultyDuration || null, commune || null,
          previousConsultation ?? false, previousType || null, previousNeurofeedback ?? false,
          currentFollowUp ?? false,
          sourceOfAcquisition || null, sourceDetails || null, sourceSub || null, sourceAccount || null, firstContactDate || null, firstAppointmentDate || null,
          abandonReason || null,
        ]
      );

      await setPatientMotifs(inserted.rows[0].id, motifIds);
      await recordOutcome(inserted.rows[0].id, req.user.id, { perceivedImprovement, observedChanges, globalSatisfaction, wouldRecommend });

      const created = await query(`${baseSelect} WHERE c.id = $1`, [inserted.rows[0].id]);

      return res.status(201).json({
        success: true,
        message: 'Patient created successfully',
        patient: created.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await query('SELECT id FROM patients WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const {
      firstName, lastName, email, phone, dateOfBirth, gender,
      maritalStatus, hasChildren, childrenCount, profession,
      patientType,
      consultationReasons, difficultyDuration, commune,
        previousConsultation, previousType, previousNeurofeedback, currentFollowUp,
        sourceOfAcquisition, sourceDetails, sourceSub, sourceAccount, firstContactDate, firstAppointmentDate,
        abandonReason,
        perceivedImprovement, observedChanges, globalSatisfaction, wouldRecommend,
    } = req.body;

    if (gender !== undefined && gender !== '' && normalizeGender(gender) === null) {
      return res.status(400).json({ success: false, message: 'Gender value is invalid' });
    }

    const professionId = await resolveProfessionId(profession);
    const motifIds = await resolveMotifIds(consultationReasons);

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
        profession_id = COALESCE($11, profession_id),
        patient_type = COALESCE($12, patient_type),
        difficulty_duration = COALESCE($13, difficulty_duration),
        commune = COALESCE($14, commune),
        previous_consultation = COALESCE($15, previous_consultation),
        previous_type = COALESCE($16, previous_type),
        previous_neurofeedback = COALESCE($17, previous_neurofeedback),
        current_follow_up = COALESCE($18, current_follow_up),
        source_of_acquisition = COALESCE($19, source_of_acquisition),
        source_details = COALESCE($20, source_details),
        source_sub = COALESCE($21, source_sub),
        source_account = COALESCE($22, source_account),
        first_contact_date = COALESCE($23, first_contact_date),
        first_appointment_date = COALESCE($24, first_appointment_date),
        abandon_reason = COALESCE($25, abandon_reason),
        updated_at = NOW()
      WHERE id = $1`,
      [
        req.params.id,
        firstName, lastName, email, phone,
        dateOfBirth || null,
        gender !== undefined ? normalizeGender(gender) : undefined,
        maritalStatus, hasChildren, childrenCount, professionId,
        patientType,
        difficultyDuration, commune,
        previousConsultation, previousType, previousNeurofeedback, currentFollowUp,
        sourceOfAcquisition, sourceDetails, sourceSub, sourceAccount,
        firstContactDate || null, firstAppointmentDate || null,
        abandonReason,
      ]
    );

    await setPatientMotifs(req.params.id, motifIds);
    await recordOutcome(req.params.id, req.user.id, { perceivedImprovement, observedChanges, globalSatisfaction, wouldRecommend });

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

router.get('/:id/history', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.id, a.start_time AS "startTime", a.end_time AS "endTime", a.status,
              s.name AS "serviceName", s.type AS "serviceType"
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       WHERE a.id IN (SELECT ap.appointment_id FROM appointment_patients ap WHERE ap.patient_id = $1)
       ORDER BY a.start_time DESC`,
      [id]
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const id = req.params.id;
    
    const existing = await query('SELECT id FROM patients WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Supprimer les enregistrements liés d'abord (dans l'ordre pour éviter les contraintes)
    await query('DELETE FROM payments WHERE patient_id = $1', [id]);
    await query('DELETE FROM appointments WHERE id IN (SELECT ap.appointment_id FROM appointment_patients ap WHERE ap.patient_id = $1)', [id]);

    // Puis supprimer le patient
    await query('DELETE FROM patients WHERE id = $1', [id]);

    return res.status(200).json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
