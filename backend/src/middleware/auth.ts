import jwt from 'jsonwebtoken';
import { userContextStore, getPool, runOnClient } from '../db/index.js';

const AUTH_COOKIE = 'token';

// Message unique quel que soit l'échec (cookie absent, jeton expiré ou révoqué) :
// le client n'a pas besoin de distinguer les cas, seulement de se reconnecter.
const SESSION_EXPIRED_MESSAGE = 'Session expirée, veuillez vous reconnecter';

const rejectSession = (res, code) =>
  res.status(401).json({ success: false, code, message: SESSION_EXPIRED_MESSAGE });

const RESET_CONTEXT_SQL = `SELECT set_config('app.user_id', '', false),
        set_config('app.user_name', '', false),
        set_config('app.user_email', '', false),
        set_config('app.user_role', '', false),
        set_config('app.user_pseudo', '', false)`;

export const protect = async (req, res, next) => {
  let token: string | undefined;

  if (req.cookies?.[AUTH_COOKIE]) {
    token = req.cookies[AUTH_COOKIE];
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return rejectSession(res, 'NO_TOKEN');
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error: any) {
    // Signature invalide ou jeton expiré.
    console.warn('[auth] jeton invalide ou expiré:', error?.message);
    return rejectSession(res, 'INVALID_TOKEN');
  }

  if (!decoded?.id) {
    console.warn('[auth] jeton sans identifiant utilisateur');
    return rejectSession(res, 'INVALID_TOKEN');
  }

  req.user = decoded;

  // Connexion dédiée à la requête : elle porte le contexte app.user_* lu par les
  // déclencheurs d'audit. Une panne d'infrastructure (pool épuisé, base coupée)
  // ne doit jamais être rapportée au client comme un défaut d'authentification.
  let client;
  try {
    client = await getPool().connect();
  } catch (error) {
    console.error('[auth] connexion à la base impossible:', error);
    return next(error);
  }

  const ctx = {
    userId: decoded.id || '',
    userName: decoded.name || '',
    userEmail: decoded.email || '',
    userRole: decoded.role || '',
    userPseudo: decoded.pseudo || '',
    client,
  };

  let settled = false;

  // Libération immédiate (chemins de refus ou d'erreur) : la connexion n'a pas
  // servi à écrire, le contexte d'audit n'a donc rien à nettoyer.
  const releaseNow = () => {
    if (settled) return;
    settled = true;
    try { client.release(); } catch { /* déjà libérée */ }
  };

  // Fin normale de requête : on efface le contexte de session (évite toute fuite
  // vers une requête non authentifiée réutilisant la même connexion) puis on rend
  // la connexion. « close » couvre l'abandon de la requête par le client, cas où
  // « finish » n'est jamais émis — sans lui la connexion fuit du pool.
  const finalize = () => {
    if (settled) return;
    settled = true;
    runOnClient(ctx, RESET_CONTEXT_SQL)
      .catch(() => undefined)
      .finally(() => {
        try { client.release(); } catch { /* déjà libérée */ }
      });
  };

  try {
    // Révocation : un jeton émis avant le dernier logout est rejeté.
    const check = await runOnClient(ctx, 'SELECT token_version FROM users WHERE id = $1', [decoded.id]);

    if (check.rowCount === 0) {
      console.warn('[auth] compte inconnu:', decoded.pseudo || decoded.id);
      releaseNow();
      return rejectSession(res, 'UNKNOWN_USER');
    }

    if (Number(check.rows[0].token_version) !== Number(decoded.tv ?? 0)) {
      console.warn('[auth] session révoquée:', decoded.pseudo || decoded.id);
      releaseNow();
      return rejectSession(res, 'SESSION_REVOKED');
    }

    // Portée session (false) et non transaction : les déclencheurs d'audit lisent
    // ces valeurs lors des requêtes suivantes de la même connexion.
    await runOnClient(
      ctx,
      `SELECT set_config('app.user_id', $1, false),
              set_config('app.user_name', $2, false),
              set_config('app.user_email', $3, false),
              set_config('app.user_role', $4, false),
              set_config('app.user_pseudo', $5, false)`,
      [
        req.user.id || '',
        req.user.name || '',
        req.user.email || '',
        req.user.role || '',
        req.user.pseudo || '',
      ]
    );

    res.on('finish', finalize);
    res.on('close', finalize);

    userContextStore.run(ctx, () => next());
  } catch (error) {
    releaseNow();
    console.error('[auth] erreur inattendue:', error);
    return next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
      });
    }
    next();
  };
};

export const authenticateToken = protect;
export const authorizeRole = (...roles) => authorize(...roles);

export default protect;
