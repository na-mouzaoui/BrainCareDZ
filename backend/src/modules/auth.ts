import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
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
