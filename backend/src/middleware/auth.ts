import jwt from 'jsonwebtoken';
import { userContextStore, getPool } from '../db/index.js';

const AUTH_COOKIE = 'token';

export const protect = async (req, res, next) => {
  let token: string | undefined;

  if (req.cookies?.[AUTH_COOKIE]) {
    token = req.cookies[AUTH_COOKIE];
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Acquire a dedicated client for this request and set user context
    const client = await getPool().connect();
    try {
      // Token revocation: reject tokens issued before the last logout/password reset.
      const check = await client.query('SELECT token_version FROM users WHERE id = $1', [decoded.id]);
      if (check.rowCount === 0 || Number(check.rows[0].token_version) !== Number(decoded.tv ?? 0)) {
        client.release();
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
      }

      await client.query(
        `SELECT set_config('app.user_id', $1, true),
                set_config('app.user_name', $2, true),
                set_config('app.user_email', $3, true),
                set_config('app.user_role', $4, true),
                set_config('app.user_pseudo', $5, true)`,
        [
          req.user.id || '',
          req.user.name || '',
          req.user.email || '',
          req.user.role || '',
          req.user.pseudo || '',
        ]
      );

      const ctx = {
        userId: req.user.id || '',
        userName: req.user.name || '',
        userEmail: req.user.email || '',
        userRole: req.user.role || '',
        userPseudo: req.user.pseudo || '',
        client,
      };

      // Release client when response finishes
      res.on('finish', () => {
        try { client.release(); } catch { /* already released */ }
      });

      userContextStore.run(ctx, () => next());
    } catch (err) {
      client.release();
      throw err;
    }
  } catch (error) {
    console.error('[auth middleware]', error);
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this route' });
    }
    next();
  };
};

export const authenticateToken = protect;
export const authorizeRole = (...roles) => authorize(...roles);

export default protect;
