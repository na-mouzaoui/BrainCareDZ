import express from 'express';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';
import { DEFAULT_PROFESSIONS, DEFAULT_MOTIFS } from '../db/patient-lists.js';

const router = express.Router();

async function getStoredLists(): Promise<{ professions: string[]; motifs: string[] }> {
  const [profResult, motifResult] = await Promise.all([
    query('SELECT label FROM professions WHERE is_active = TRUE ORDER BY created_at ASC, label ASC'),
    query('SELECT label FROM motifs WHERE is_active = TRUE ORDER BY created_at ASC, label ASC'),
  ]);

  const professions = profResult.rows.map((r) => r.label).filter((l: string) => l && l.trim());
  const motifs = motifResult.rows.map((r) => r.label).filter((l: string) => l && l.trim());

  return {
    professions: professions.length > 0 ? professions : DEFAULT_PROFESSIONS,
    motifs: motifs.length > 0 ? motifs : DEFAULT_MOTIFS,
  };
}

router.get('/patient-lists', protect, async (req, res) => {
  try {
    const lists = await getStoredLists();
    return res.json({ success: true, data: lists });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

router.put('/patient-lists', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }

    const professions: string[] = Array.isArray(req.body.professions)
      ? req.body.professions.map((p: any) => String(p).trim()).filter((p: string) => p)
      : [];
    const motifs: string[] = Array.isArray(req.body.motifs)
      ? req.body.motifs.map((m: any) => String(m).trim()).filter((m: string) => m)
      : [];

    // Upsert provided professions (re-activate if previously deactivated)
    for (const label of professions) {
      await query(
        `INSERT INTO professions (label) VALUES ($1)
         ON CONFLICT (label) DO UPDATE SET is_active = TRUE, updated_at = NOW()`,
        [label]
      );
    }
    // Deactivate (soft delete) professions no longer in the list
    await query(
      `UPDATE professions SET is_active = FALSE, updated_at = NOW()
       WHERE NOT (label = ANY($1::text[]))`,
      [professions]
    );

    // Upsert provided motifs
    for (const label of motifs) {
      await query(
        `INSERT INTO motifs (label) VALUES ($1)
         ON CONFLICT (label) DO UPDATE SET is_active = TRUE, updated_at = NOW()`,
        [label]
      );
    }
    // Deactivate (soft delete) motifs no longer in the list
    await query(
      `UPDATE motifs SET is_active = FALSE, updated_at = NOW()
       WHERE NOT (label = ANY($1::text[]))`,
      [motifs]
    );

    await logActivity({
      req,
      action: 'UPDATE',
      resource: 'settings',
      resourceName: 'Listes patient (professions & motifs)',
      changes: { professions, motifs },
    });

    return res.json({ success: true, data: { professions, motifs } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

router.get('/calendar-settings', protect, async (req, res) => {
  try {
    const result = await query('SELECT * FROM calendar_settings ORDER BY calendar_role');
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

router.get('/calendar-settings/:role', protect, async (req, res) => {
  try {
    const result = await query('SELECT * FROM calendar_settings WHERE calendar_role = $1', [req.params.role]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Settings not found for this role' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

router.put('/calendar-settings/:role', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }

    const { role } = req.params;
    const {
      workStartTime, workEndTime, consultationDuration,
      weekendDays, hasBreakfastBreak, breakfastBreakStart, breakfastBreakEnd,
    } = req.body;

    // Validation des paramètres du calendrier
    const normalizeTime = (t: any) => {
      if (t === undefined || t === null || t === '') return null;
      const s = String(t);
      return s.length === 5 ? `${s}:00` : s;
    };
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

    if (consultationDuration !== undefined && consultationDuration !== null && consultationDuration !== '') {
      const duration = Number(consultationDuration);
      if (!Number.isInteger(duration) || duration < 15) {
        return res.status(400).json({ success: false, error: 'La durée de consultation doit être un entier supérieur ou égal à 15 minutes.' });
      }
    }
    for (const t of [workStartTime, workEndTime, breakfastBreakStart, breakfastBreakEnd]) {
      if (t !== undefined && t !== null && t !== '' && !timeRe.test(String(t))) {
        return res.status(400).json({ success: false, error: 'Heure invalide (format attendu HH:MM).' });
      }
    }
    if (weekendDays !== undefined && weekendDays !== null && !Array.isArray(weekendDays)) {
      return res.status(400).json({ success: false, error: 'weekendDays doit être une liste de jours.' });
    }

    const existing = await query('SELECT * FROM calendar_settings WHERE calendar_role = $1', [role]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Settings not found for this role' });
    }
    const current = existing.rows[0];

    const effStart = normalizeTime(workStartTime) ?? normalizeTime(current.work_start_time);
    const effEnd = normalizeTime(workEndTime) ?? normalizeTime(current.work_end_time);
    if (effStart && effEnd && effEnd <= effStart) {
      return res.status(400).json({ success: false, error: "L'heure de fin doit être postérieure à l'heure de début." });
    }
    const effBreakStart = breakfastBreakStart !== undefined ? normalizeTime(breakfastBreakStart) : normalizeTime(current.breakfast_break_start);
    const effBreakEnd = breakfastBreakEnd !== undefined ? normalizeTime(breakfastBreakEnd) : normalizeTime(current.breakfast_break_end);
    if (effBreakStart && effBreakEnd && effBreakEnd <= effBreakStart) {
      return res.status(400).json({ success: false, error: 'La pause doit se terminer après son début.' });
    }

    const result = await query(
      `UPDATE calendar_settings SET
        work_start_time = COALESCE($2, work_start_time),
        work_end_time = COALESCE($3, work_end_time),
        consultation_duration = COALESCE($4, consultation_duration),
        weekend_days = COALESCE($5, weekend_days),
        has_breakfast_break = COALESCE($6, has_breakfast_break),
        breakfast_break_start = $7,
        breakfast_break_end = $8,
        updated_at = NOW()
       WHERE calendar_role = $1
       RETURNING *`,
      [role, workStartTime, workEndTime, consultationDuration, weekendDays, hasBreakfastBreak, breakfastBreakStart, breakfastBreakEnd]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Settings not found for this role' });
    }

    await logActivity({
      req,
      action: 'UPDATE',
      resource: 'settings',
      resourceName: `Paramètres calendrier ${role}`,
      changes: req.body,
    });

    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

export default router;