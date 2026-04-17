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
      `SELECT id, name, email, role, phone, specializations, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users
       ORDER BY created_at DESC`
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

router.get('/:id', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const user = await query(
      `SELECT id, name, email, role, phone, specializations, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users
       WHERE id = $1`,
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

    const { name, email, password, role, phone, specializations } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, password, and role are required' });
    }

    const exists = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rowCount > 0) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    const inserted = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, specializations, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, name, email, role, phone, specializations, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, email.toLowerCase(), passwordHash, role, phone || null, specializations || []]
    );

    return res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { name, email, role, phone, specializations, isActive } = req.body;

    if (email) {
      const dup = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email.toLowerCase(), req.params.id]);
      if (dup.rowCount > 0) {
        return res.status(400).json({ success: false, error: 'Email already in use' });
      }
    }

    const updated = await query(
      `UPDATE users
       SET name = COALESCE($2, name),
           email = COALESCE($3, email),
           role = COALESCE($4, role),
           phone = COALESCE($5, phone),
           specializations = COALESCE($6, specializations),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, role, phone, specializations, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, name, email?.toLowerCase(), role, phone, specializations, isActive]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
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
       RETURNING id, name, email, role, phone, specializations, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
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

export default router;
