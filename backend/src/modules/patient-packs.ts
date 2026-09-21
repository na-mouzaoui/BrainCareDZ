import express from 'express';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
const router = express.Router();

const packSelect = `
  SELECT pp.id, pp.patient_id AS "patientId", pp.service_id AS "serviceId",
         pp.total_sessions AS "totalSessions", pp.remaining_sessions AS "remainingSessions",
         pp.price, pp.practitioner_id AS "practitionerId",
         s.name AS "serviceName", s.sessions AS "serviceDefaultSessions",
         c.first_name AS "patientFirstName", c.last_name AS "patientLastName",
         pp.created_at AS "createdAt", pp.updated_at AS "updatedAt"
  FROM patient_packs pp
  JOIN patients c ON c.id = pp.patient_id
  JOIN services s ON s.id = pp.service_id
`;

router.get('/', protect, async (req, res) => {
  try {
    const result = await query(`${packSelect} ORDER BY pp.created_at DESC`);
    return res.json({ success: true, data: { packs: result.rows } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const patientId = req.params.patientId;
    const result = await query(
      `${packSelect} WHERE pp.patient_id = $1 ORDER BY pp.created_at DESC`,
      [patientId]
    );
    const sharedResult = await query(
      `${packSelect}
       JOIN patient_pack_shares pps ON pps.pack_id = pp.id AND pps.patient_id = $1
       WHERE pp.patient_id != $1
       ORDER BY pp.created_at DESC`,
      [patientId]
    );
    return res.json({
      success: true,
      data: { packs: result.rows, sharedPacks: sharedResult.rows },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { patientId, serviceId, totalSessions, price } = req.body;
    if (!patientId || !serviceId || !totalSessions) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants' });
    }
    const safePrice = price !== undefined && price !== null && price !== '' ? Number(price) : null;
    if (safePrice !== null && (Number.isNaN(safePrice) || safePrice <= 0)) {
      return res.status(400).json({ success: false, message: 'Le prix du pack doit être supérieur à 0' });
    }
    const fallbackPrice = await query('SELECT price FROM services WHERE id = $1', [serviceId]);
    const finalPrice = safePrice ?? (fallbackPrice.rowCount > 0 ? fallbackPrice.rows[0].price : null);
    const result = await query(
      `INSERT INTO patient_packs (patient_id, service_id, total_sessions, remaining_sessions, practitioner_id, price)
       VALUES ($1, $2, $3, $3, $4, $5) RETURNING id`,
      [patientId, serviceId, totalSessions, req.user.id, finalPrice]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/select', protect, async (req, res) => {
  try {
    const { patientId, serviceId, totalSessions, price, appointmentPatientId } = req.body;
    if (!patientId || !serviceId || !totalSessions || !appointmentPatientId) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants' });
    }
    const junction = await query(
      'SELECT id FROM appointment_patients WHERE id = $1 AND patient_id = $2',
      [appointmentPatientId, patientId]
    );
    if (junction.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Séance du patient introuvable pour ce rendez-vous' });
    }
    const existingUsage = await query(
      'SELECT id FROM patient_pack_usages WHERE appointment_patient_id = $1',
      [appointmentPatientId]
    );
    if (existingUsage.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Un pack a déjà été sélectionné pour cette séance' });
    }

    let packId: string;
    let packOwnerId: string;
    const existingPack = await query(
      `SELECT id, patient_id FROM patient_packs
       WHERE patient_id = $1 AND service_id = $2 AND remaining_sessions > 0
       ORDER BY created_at ASC LIMIT 1`,
      [patientId, serviceId]
    );
    if (existingPack.rowCount > 0) {
      packId = existingPack.rows[0].id;
      packOwnerId = existingPack.rows[0].patient_id;
    } else {
      const sharedPack = await query(
        `SELECT pp.id, pp.patient_id
         FROM patient_pack_shares pps
         JOIN patient_packs pp ON pp.id = pps.pack_id
         WHERE pps.patient_id = $1 AND pp.service_id = $2 AND pp.remaining_sessions > 0
         ORDER BY pp.created_at ASC LIMIT 1`,
        [patientId, serviceId]
      );
      if (sharedPack.rowCount > 0) {
        packId = sharedPack.rows[0].id;
        packOwnerId = sharedPack.rows[0].patient_id;
      } else {
        const safePrice = price !== undefined && price !== null && price !== '' ? Number(price) : null;
        if (safePrice !== null && (Number.isNaN(safePrice) || safePrice <= 0)) {
          return res.status(400).json({ success: false, message: 'Le prix du pack doit être supérieur à 0' });
        }
        const fallbackPrice = await query('SELECT price FROM services WHERE id = $1', [serviceId]);
        const finalPrice = safePrice ?? (fallbackPrice.rowCount > 0 ? fallbackPrice.rows[0].price : null);
        const created = await query(
          `INSERT INTO patient_packs (patient_id, service_id, total_sessions, remaining_sessions, practitioner_id, price)
           VALUES ($1, $2, $3, $3, $4, $5) RETURNING id`,
          [patientId, serviceId, totalSessions, req.user.id, finalPrice]
        );
        packId = created.rows[0].id;
        packOwnerId = patientId;
      }
    }

    await query(
      `INSERT INTO patient_pack_usages (pack_id, appointment_patient_id) VALUES ($1, $2)`,
      [packId, appointmentPatientId]
    );
    await query(
      `UPDATE patient_packs SET remaining_sessions = remaining_sessions - 1, updated_at = NOW() WHERE id = $1`,
      [packId]
    );
    await query(
      `UPDATE appointments a
       SET service_id = $1, updated_at = NOW()
       FROM appointment_patients ap
       WHERE ap.id = $2 AND ap.appointment_id = a.id AND a.service_id IS NULL`,
      [serviceId, appointmentPatientId]
    );
    if (packOwnerId !== patientId) {
      await query('SELECT recalc_patient_balance($1)', [packOwnerId]);
    }
    const updated = await query(`${packSelect} WHERE pp.id = $1`, [packId]);
    return res.status(200).json({
      success: true, message: 'Pack sélectionné et séance débitée', data: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/shares', protect, async (req, res) => {
  try {
    const pack = await query('SELECT id, patient_id FROM patient_packs WHERE id = $1', [req.params.id]);
    if (pack.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pack introuvable' });
    }
    const shares = await query(
      `SELECT pps.id, pps.patient_id AS "patientId",
              p.first_name AS "firstName", p.last_name AS "lastName", p.email
       FROM patient_pack_shares pps
       JOIN patients p ON p.id = pps.patient_id
       WHERE pps.pack_id = $1 ORDER BY pps.created_at ASC`,
      [req.params.id]
    );
    return res.json({
      success: true,
      data: { shares: shares.rows, principalPatientId: pack.rows[0].patient_id },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/shares', protect, async (req, res) => {
  try {
    const { patientId } = req.body;
    const packId = req.params.id;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId requis' });
    }
    const pack = await query('SELECT id, patient_id, total_sessions FROM patient_packs WHERE id = $1', [packId]);
    if (pack.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pack introuvable' });
    }
    if (pack.rows[0].patient_id === patientId) {
      return res.status(400).json({ success: false, message: 'Le patient principal ne peut pas être ajouté comme bénéficiaire' });
    }
    const existing = await query(
      'SELECT id FROM patient_pack_shares WHERE pack_id = $1 AND patient_id = $2',
      [packId, patientId]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Ce patient bénéficie déjà de ce pack' });
    }
    const usages = await query('SELECT COUNT(*) AS cnt FROM patient_pack_shares WHERE pack_id = $1', [packId]);
    const shareCount = parseInt(usages.rows[0].cnt, 10);
    if (shareCount >= pack.rows[0].total_sessions) {
      return res.status(400).json({
        success: false,
        message: `Nombre maximum de bénéficiaires atteint (${shareCount}/${pack.rows[0].total_sessions})`,
      });
    }
    await query(
      'INSERT INTO patient_pack_shares (pack_id, patient_id) VALUES ($1, $2)',
      [packId, patientId]
    );
    return res.status(201).json({ success: true, message: 'Bénéficiaire ajouté' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/shares/:patientId', protect, async (req, res) => {
  try {
    const { id, patientId } = req.params;
    const existing = await query(
      'SELECT id FROM patient_pack_shares WHERE pack_id = $1 AND patient_id = $2',
      [id, patientId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Bénéficiaire introuvable' });
    }
    const usages = await query(
      `SELECT u.id FROM patient_pack_usages u
       JOIN appointment_patients ap ON ap.id = u.appointment_patient_id
       WHERE u.pack_id = $1 AND ap.patient_id = $2`,
      [id, patientId]
    );
    if (usages.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de retirer ce patient : il a déjà consommé des séances de ce pack',
      });
    }
    await query('DELETE FROM patient_pack_shares WHERE pack_id = $1 AND patient_id = $2', [id, patientId]);
    return res.status(200).json({ success: true, message: 'Bénéficiaire retiré' });
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
    return res.status(200).json({ success: true, message: 'Pack deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/switch', protect, async (req, res) => {
  try {
    const { serviceId: newServiceId } = req.body;
    const packId = req.params.id;

    if (!newServiceId) {
      return res.status(400).json({ success: false, message: 'Nouveau service requis' });
    }

    const packResult = await query(
      'SELECT id, patient_id, service_id, total_sessions, remaining_sessions, price FROM patient_packs WHERE id = $1',
      [packId]
    );
    if (packResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pack introuvable' });
    }
    const pack = packResult.rows[0];

    const consumed = pack.total_sessions - pack.remaining_sessions;
    if (consumed <= 0) {
      return res.status(400).json({ success: false, message: 'Aucune séance consommée — créez un nouveau pack à la place' });
    }

    const newServiceResult = await query(
      'SELECT id, name, sessions, price FROM services WHERE id = $1',
      [newServiceId]
    );
    if (newServiceResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Nouveau service introuvable' });
    }
    const newService = newServiceResult.rows[0];

    if (newService.sessions < consumed) {
      return res.status(400).json({
        success: false,
        message: `Le nouveau pack (${newService.sessions} séances) ne peut pas accueillir ${consumed} séances déjà consommées`,
      });
    }

    if (newService.sessions <= pack.total_sessions) {
      return res.status(400).json({
        success: false,
        message: `Le nouveau pack doit avoir plus de séances que le pack actuel (${pack.total_sessions})`,
      });
    }

    const oldPricePerSession = pack.total_sessions > 0 ? Number(pack.price) / pack.total_sessions : 0;
    const newPricePerSession = newService.sessions > 0 ? Number(newService.price) / newService.sessions : 0;
    const balanceDelta = consumed * (oldPricePerSession - newPricePerSession);

    const newRemaining = newService.sessions - consumed;

    await query(
      `UPDATE patient_packs
       SET service_id = $1, total_sessions = $2, remaining_sessions = $3, price = $4, updated_at = NOW()
       WHERE id = $5`,
      [newServiceId, newService.sessions, newRemaining, newService.price, packId]
    );

    if (balanceDelta !== 0) {
      await query(
        'UPDATE patients SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
        [balanceDelta, pack.patient_id]
      );
    }

    const updated = await query(`${packSelect} WHERE pp.id = $1`, [packId]);
    return res.json({
      success: true,
      message: 'Pack changé avec succès',
      data: { ...updated.rows[0], balanceDelta },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
