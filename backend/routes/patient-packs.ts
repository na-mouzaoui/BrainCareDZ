import express from 'express';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

const packSelect = `
  SELECT pp.id, pp.patient_id AS "patientId", pp.service_id AS "serviceId",
         pp.total_sessions AS "totalSessions", pp.remaining_sessions AS "remainingSessions",
         pp.practitioner_id AS "practitionerId",
         s.name AS "serviceName", s.sessions AS "serviceDefaultSessions",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName",
         pp.created_at AS "createdAt", pp.updated_at AS "updatedAt"
  FROM patient_packs pp
  JOIN patients c ON c.id = pp.patient_id
  JOIN services s ON s.id = pp.service_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const params = [];
    let where = '';

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where = `WHERE pp.practitioner_id = $${params.length}`;
    }

    const result = await query(`${packSelect} ${where} ORDER BY pp.created_at DESC`, params);

    return res.json({
      success: true,
      data: {
        packs: result.rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const result = await query(
      `${packSelect} WHERE pp.patient_id = $1 AND pp.remaining_sessions > 0 ORDER BY pp.created_at DESC`,
      [req.params.patientId]
    );

    return res.json({
      success: true,
      data: {
        packs: result.rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { patientId, serviceId, totalSessions } = req.body;

    if (!patientId || !serviceId || !totalSessions) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants' });
    }

    const result = await query(
      `INSERT INTO patient_packs (patient_id, service_id, total_sessions, remaining_sessions, practitioner_id)
       VALUES ($1, $2, $3, $3, $4)
       RETURNING id`,
      [patientId, serviceId, totalSessions, req.user.id]
    );

    await logActivity({ req, action: 'CREATE', resource: 'patient-pack', resourceId: result.rows[0].id });

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/use', protect, async (req, res) => {
  try {
    const result = await query(
      `UPDATE patient_packs 
       SET remaining_sessions = remaining_sessions - 1, updated_at = NOW()
       WHERE id = $1 AND remaining_sessions > 0
       RETURNING id, remaining_sessions`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pack non trouvé ou déjà épuisé' });
    }

    await logActivity({ req, action: 'USE_SESSION', resource: 'patient-pack', resourceId: req.params.id, changes: { remainingSessions: result.rows[0].remaining_sessions } });

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await query('SELECT id FROM patient_packs WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pack not found' });
    }

    await query('DELETE FROM patient_packs WHERE id = $1', [req.params.id]);

    await logActivity({ req, action: 'DELETE', resource: 'patient-pack', resourceId: req.params.id });

    return res.status(200).json({ success: true, message: 'Pack deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;