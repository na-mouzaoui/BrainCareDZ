import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity-logger.js';
import { sendDbError } from '../utils/errors.js';

const router = express.Router();

const AUTH_COOKIE = 'token';

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // En production, front et API peuvent être sur des domaines distincts (cross-site) :
  // SameSite=None est requis pour que le navigateur conserve et renvoie le cookie.
  sameSite:
    (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') ||
    (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
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
      // Accepte l'identifiant saisi comme pseudo OU e-mail (comptes créés sans pseudo).
      // Les espaces sont ignorés dans le pseudo : « asma_abikchi » retrouve le compte
      // « asma _abikchi » créé avec des espaces dans le prénom/nom.
      const identifier = String(pseudo).trim().toLowerCase();
      const result = await query(
        `SELECT id, name, pseudo, role, email, password_hash, token_version, must_change_password
         FROM users
         WHERE LOWER(REGEXP_REPLACE(pseudo, '\\s+', '', 'g')) = REGEXP_REPLACE($1, '\\s+', '', 'g')
            OR LOWER(TRIM(email)) = $1`,
        [identifier]
      );

      if (result.rowCount === 0) {
        console.warn('[auth/login] identifiant inconnu:', identifier);
        return res.status(401).json({ success: false, message: 'Pseudo ou mot de passe invalide' });
      }

      const user = result.rows[0];

      const isMatch = await bcryptjs.compare(password, user.password_hash);
      if (!isMatch) {
        console.warn('[auth/login] mot de passe invalide pour:', identifier);
        return res.status(401).json({ success: false, message: 'Pseudo ou mot de passe invalide' });
      }

      const safeUser = {
        id: user.id,
        name: user.name,
        pseudo: user.pseudo,
        role: user.role,
        mustChangePassword: user.must_change_password === true,
      };

      const token = generateToken(user);

      res.cookie(AUTH_COOKIE, token, cookieOptions());

      // Renseigne l'utilisateur pour que la ligne de log porte son nom (sinon « Unknown »).
      req.user = safeUser;
      await logActivity({ req, action: 'LOGIN', resource: 'auth', resourceId: user.id, resourceName: user.name });

      return res.status(200).json({
        success: true,
        user: safeUser,
      });
    } catch (error) {
      console.error('[auth/login]', error);
      return sendDbError(res, error, 'Erreur interne du serveur');
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
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, pseudo, first_name AS "firstName", last_name AS "lastName", role, phone,
              must_change_password AS "mustChangePassword"
         FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('[auth/me]', error);
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

// Changement de mot de passe — accessible même lorsque `must_change_password`
// est vrai (c'est justement la seule action autorisée dans ce cas).
router.post('/change-password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Mot de passe actuel et nouveau mot de passe requis.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
  }

  try {
    const { rows } = await query('SELECT id, name, pseudo, role, password_hash, token_version FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }

    const user = rows[0];

    if (!(await bcryptjs.compare(String(currentPassword), user.password_hash))) {
      return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect.' });
    }
    if (await bcryptjs.compare(String(newPassword), user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit être différent du mot de passe actuel.' });
    }

    const hash = await bcryptjs.hash(String(newPassword), 10);
    const updated = await query(
      `UPDATE users
          SET password_hash = $2,
              must_change_password = false,
              token_version = token_version + 1,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, pseudo, role, token_version`,
      [req.user.id, hash]
    );

    const fresh = updated.rows[0];
    // Réémet le cookie : l'ancien jeton est invalidé par l'incrément de token_version.
    res.cookie(AUTH_COOKIE, generateToken(fresh), cookieOptions());

    await logActivity({ req, action: 'UPDATE', resource: 'auth', resourceId: fresh.id, resourceName: fresh.name });

    return res.status(200).json({
      success: true,
      message: 'Mot de passe modifié.',
      user: { id: fresh.id, name: fresh.name, pseudo: fresh.pseudo, role: fresh.role, mustChangePassword: false },
    });
  } catch (error) {
    console.error('[auth/change-password]', error);
    return sendDbError(res, error, 'Erreur interne du serveur');
  }
});

export default router;
