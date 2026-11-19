import express from 'express';
import bcryptjs from 'bcryptjs';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
import { sendDbError } from '../utils/errors.js';
const router = express.Router();

const ensureAdmin = (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    return false;
  }
  return true;
};

router.get('/', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const users = await query(
      `SELECT u.id, u.name, u.pseudo, u.first_name AS "firstName", u.last_name AS "lastName",
        u.role, u.phone, u.created_at AS "createdAt", u.updated_at AS "updatedAt",
        COALESCE(
          (SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL)
           FROM practitioner_services ps
           JOIN services s ON s.id = ps.service_id
           WHERE ps.practitioner_id = u.id),
          '[]'::json
        ) AS services,
        (SELECT COUNT(DISTINCT ap.patient_id)
         FROM appointments a
         JOIN appointment_patients ap ON ap.appointment_id = a.id
         WHERE a.practitioner_id = u.id AND a.status <> 'cancelled') AS "patientCount"
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT 500`
    );

    return res.json({
      success: true,
      data: {
        users: users.rows,
        total: users.rowCount,
      },
    });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.get('/practitioners', protect, async (req, res) => {
  try {
    const users = await query(
      `SELECT u.id, u.name, u.pseudo, u.phone, u.role
       FROM users u
       ORDER BY u.role, u.name`
    );

    return res.json({
      success: true,
      data: {
        practitioners: users.rows,
      },
    });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const user = await query(
      `SELECT u.id, u.name, u.pseudo, u.first_name AS "firstName", u.last_name AS "lastName",
        u.role, u.phone, u.created_at AS "createdAt", u.updated_at AS "updatedAt",
        COALESCE(
          (SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL)
           FROM practitioner_services ps
           JOIN services s ON s.id = ps.service_id
           WHERE ps.practitioner_id = u.id),
          '[]'::json
        ) AS services
       FROM users u
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (user.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    }

    return res.json({ success: true, data: user.rows[0] });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.post('/', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { firstName, lastName, role, phone, serviceIds } = req.body;
    if (!firstName || !lastName || !role) {
      return res.status(400).json({ success: false, error: 'Le prénom, le nom et le rôle sont requis.' });
    }

    // Nettoie les espaces saisis (espaces en trop, collage « Prénom Nom ») : sans
    // cela le pseudo généré contient des espaces et devient difficile à saisir.
    const cleanPart = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const first = cleanPart(firstName);
    const last = cleanPart(lastName);
    if (!first || !last) {
      return res.status(400).json({ success: false, error: 'Le prénom et le nom sont requis.' });
    }

    const name = `${first} ${last}`;
    const pseudo = `${first}_${last}`.toLowerCase().replace(/\s+/g, '_');

    const exists = await query('SELECT id FROM users WHERE pseudo = $1', [pseudo]);
    if (exists.rowCount > 0) {
      return res.status(400).json({ success: false, error: 'Un utilisateur avec ce pseudo existe déjà.' });
    }

    const passwordHash = await bcryptjs.hash('123456789', 10);
    const inserted = await query(
      `INSERT INTO users (name, pseudo, first_name, last_name, email, password_hash, role, phone, must_change_password)
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, true)
       RETURNING id, name, pseudo, first_name AS "firstName", last_name AS "lastName",
                 role, phone, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, pseudo, first, last, passwordHash, role, phone || null]
    );

    if (serviceIds && Array.isArray(serviceIds) && serviceIds.length > 0) {
      const values = serviceIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO practitioner_services (practitioner_id, service_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [inserted.rows[0].id, ...serviceIds]
      );
    }

    return res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { firstName, lastName, role, phone, serviceIds } = req.body;

    let pseudo = null;
    let name = null;
    let first = null;
    let last = null;
    if (firstName || lastName) {
      const cleanPart = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
      first = cleanPart(firstName);
      last = cleanPart(lastName);
      name = `${first} ${last}`.trim();
      pseudo = `${first}_${last}`.toLowerCase().replace(/\s+/g, '_');

      const dup = await query('SELECT id FROM users WHERE pseudo = $1 AND id <> $2', [pseudo, req.params.id]);
      if (dup.rowCount > 0) {
        return res.status(400).json({ success: false, error: 'Pseudo already in use' });
      }
    }

    const updated = await query(
      `UPDATE users
       SET name = COALESCE($2, name),
           pseudo = COALESCE($3, pseudo),
           first_name = COALESCE($4, first_name),
           last_name = COALESCE($5, last_name),
           role = COALESCE($6, role),
           phone = COALESCE($7, phone),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, pseudo, first_name AS "firstName", last_name AS "lastName",
                 role, phone, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, name, pseudo, first, last, role, phone]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    }

    if (serviceIds && Array.isArray(serviceIds)) {
      await query('DELETE FROM practitioner_services WHERE practitioner_id = $1', [req.params.id]);
      if (serviceIds.length > 0) {
        const values = serviceIds.map((_, i) => `($1, $${i + 2})`).join(', ');
        await query(
          `INSERT INTO practitioner_services (practitioner_id, service_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          [req.params.id, ...serviceIds]
        );
      }
    }

    return res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    }

    return res.json({ success: true, message: 'Utilisateur supprimé.' });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.put('/me/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Le mot de passe actuel et le nouveau mot de passe sont requis.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }

    const userResult = await query(
      `SELECT id, password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (userResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    }

    const isMatch = await bcryptjs.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    const passwordHash = await bcryptjs.hash(newPassword, 10);
    await query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.user.id, passwordHash]
    );

    return res.json({ success: true, message: 'Mot de passe mis à jour.' });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.put('/:id/password', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    const updated = await query(
      `UPDATE users SET password_hash = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, pseudo, first_name AS "firstName", last_name AS "lastName",
                 role, phone, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, passwordHash]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    }

    return res.json({ success: true, data: updated.rows[0], message: 'Mot de passe mis à jour.' });
  } catch (error) {
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

export default router;
