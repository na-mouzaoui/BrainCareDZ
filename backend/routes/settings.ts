import express from 'express';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

export const DEFAULT_PROFESSIONS = [
  'Salarié(e)',
  'Fonctionnaire',
  'Indépendant(e)',
  'Commerçant(e)',
  'Artisan(e)',
  'Profession libérale',
  'Étudiant(e)',
  'Sans emploi',
  'Retraité(e)',
];

export const DEFAULT_MOTIFS = [
  'Anxiété',
  'Stress / burn-out',
  'Troubles du sommeil',
  "Troubles de l'attention (TDAH)",
  'Difficultés émotionnelles',
  'Problèmes scolaires',
  'Troubles du comportement',
  'TSA / Autisme',
  'Troubles psychosomatiques',
];

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
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/calendar-settings', protect, async (req, res) => {
  try {
    const result = await query('SELECT * FROM calendar_settings ORDER BY calendar_role');
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;