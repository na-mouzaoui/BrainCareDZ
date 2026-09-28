import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';

const router = express.Router();

const AUTH_COOKIE = 'token';

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      pseudo: user.pseudo,
      name: user.name,
      tv: user.token_version ?? 0,
    },
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
        `SELECT id, name, pseudo, role, password_hash, token_version
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

      const token = generateToken(user);

      res.cookie(AUTH_COOKIE, token, cookieOptions());

      await logActivity({ req, action: 'LOGIN', resource: 'auth', resourceId: user.id, resourceName: user.name });

      return res.status(200).json({
        success: true,
        user: safeUser,
      });
    } catch (error) {
      console.error('[auth/login]', error);
      return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

router.post('/logout', async (req, res) => {
  try {
    let token: string | undefined = req.cookies?.[AUTH_COOKIE];
    if (!token && req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) {
          await query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [decoded.id]);
        }
      } catch {
        // Token invalide/expiré : on nettoie simplement le cookie.
      }
    }

    res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    return res.status(200).json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('[auth/logout]', error);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

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
    console.error('[auth/me]', error);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
