import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
const router = express.Router();

const outcomeSelect = `
  SELECT o.id, o.patient_id AS "patientId",
         o.evaluated_at AS "evaluatedAt",
         o.perceived_improvement AS "perceivedImprovement",
         o.observed_changes AS "observedChanges",
         o.global_satisfaction AS "globalSatisfaction",
         o.would_recommend AS "wouldRecommend",
         o.created_at AS "createdAt",
         u.name AS "createdByName"
  FROM patient_outcomes o
  LEFT JOIN users u ON u.id = o.created_by
`;

router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const where = 'WHERE o.patient_id = $1';

    const result = await query(`${outcomeSelect} ${where} ORDER BY o.evaluated_at DESC`, [req.params.patientId]);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      outcomes: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  '/',
  protect,
  [
    body('patientId', 'Valid patient ID is required').notEmpty().isUUID(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    try {
      const { patientId, evaluatedAt, perceivedImprovement, observedChanges, globalSatisfaction, wouldRecommend } = req.body;

      const patient = await query('SELECT first_name AS "firstName", last_name AS "lastName" FROM patients WHERE id = $1', [patientId]);
      if (patient.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const inserted = await query(
        `INSERT INTO patient_outcomes (
          patient_id, evaluated_at, perceived_improvement, observed_changes, global_satisfaction, would_recommend, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          patientId,
          evaluatedAt || new Date().toISOString(),
          perceivedImprovement ?? null,
          observedChanges || null,
          globalSatisfaction ?? null,
          wouldRecommend ?? null,
          req.user.id,
        ]
      );

      const created = await query(`${outcomeSelect} WHERE o.id = $1`, [inserted.rows[0].id]);

      return res.status(201).json({
        success: true,
        message: 'Evaluation recorded successfully',
        outcome: created.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await query(
      `SELECT o.id FROM patient_outcomes o
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    await query('DELETE FROM patient_outcomes WHERE id = $1', [req.params.id]);

    return res.status(200).json({ success: true, message: 'Evaluation deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;