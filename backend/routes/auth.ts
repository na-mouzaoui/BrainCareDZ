import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, pseudo: user.pseudo, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

router.post(
  '/register',
  [
    body('firstName', 'First name is required').not().isEmpty(),
    body('lastName', 'Last name is required').not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    const { firstName, lastName, password, role } = req.body;
    const name = `${firstName} ${lastName}`;
    const pseudo = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
    const passwordHash = await bcryptjs.hash(password || '123456789', 10);

    try {
      const existing = await query('SELECT id FROM users WHERE pseudo = $1', [pseudo]);
      if (existing.rowCount > 0) {
        return res.status(400).json({ success: false, message: 'User with this pseudo already exists' });
      }

      const inserted = await query(
        `INSERT INTO users (name, pseudo, first_name, last_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, NULL, $5, $6)
         RETURNING id, name, pseudo, first_name AS "firstName", last_name AS "lastName", role`,
        [name, pseudo, firstName, lastName, passwordHash, role || 'psy']
      );

      const user = inserted.rows[0];
      const token = generateToken(user);

      await logActivity({ req, action: 'REGISTER', resource: 'user', resourceId: user.id, resourceName: user.name });

      return res.status(201).json({
        success: true,
        token,
        user,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.post(
  '/login',
  [
    body('pseudo', 'Pseudo is required').not().isEmpty(),
    body('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e: any) => e.msg).join(', ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }

    const { pseudo, password } = req.body;

    try {
      const result = await query(
        `SELECT id, name, pseudo, role, password_hash
         FROM users
         WHERE pseudo = $1`,
        [pseudo.toLowerCase()]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({ success: false, message: 'Invalid pseudo or password' });
      }

      const user = result.rows[0];
      const isMatch = await bcryptjs.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid pseudo or password' });
      }

      const safeUser = {
        id: user.id,
        name: user.name,
        pseudo: user.pseudo,
        role: user.role,
      };

      const token = generateToken(safeUser);

      await logActivity({ req, action: 'LOGIN', resource: 'auth', resourceId: user.id, resourceName: user.name });

      return res.status(200).json({
        success: true,
        token,
        user: safeUser,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.get('/me', protect, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, pseudo, first_name AS "firstName", last_name AS "lastName", role, phone FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
