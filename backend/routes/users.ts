import express from 'express';
import bcryptjs from 'bcryptjs';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
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
       ORDER BY u.created_at DESC`
    );

    return res.json({
      success: true,
      data: {
        users: users.rows,
        total: users.rowCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
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
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { firstName, lastName, role, phone, serviceIds } = req.body;
    if (!firstName || !lastName || !role) {
      return res.status(400).json({ success: false, error: 'First name, last name, and role are required' });
    }

    const name = `${firstName} ${lastName}`;
    const pseudo = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;

    const exists = await query('SELECT id FROM users WHERE pseudo = $1', [pseudo]);
    if (exists.rowCount > 0) {
      return res.status(400).json({ success: false, error: 'User with this pseudo already exists' });
    }

    const passwordHash = await bcryptjs.hash('123456789', 10);
    const inserted = await query(
      `INSERT INTO users (name, pseudo, first_name, last_name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)
       RETURNING id, name, pseudo, first_name AS "firstName", last_name AS "lastName",
                 role, phone, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, pseudo, firstName, lastName, passwordHash, role, phone || null]
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { firstName, lastName, role, phone, serviceIds } = req.body;

    let pseudo = null;
    let name = null;
    if (firstName || lastName) {
      const f = firstName || '';
      const l = lastName || '';
      name = `${f} ${l}`.trim();
      pseudo = `${f.toLowerCase()}_${l.toLowerCase()}`;

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
      [req.params.id, name, pseudo, firstName || null, lastName || null, role, phone]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/password', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
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
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: updated.rows[0], message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/me/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    const userResult = await query(
      `SELECT id, password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (userResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isMatch = await bcryptjs.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    const passwordHash = await bcryptjs.hash(newPassword, 10);
    const updated = await query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.user.id, passwordHash]
    );

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
