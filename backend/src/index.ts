import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './db/index.js';
import { ensureSchema } from './db/schema.js';
import authRoutes from './modules/auth.js';
import patientRoutes from './modules/patients.js';
import patientOutcomeRoutes from './modules/patient-outcomes.js';
import serviceRoutes from './modules/services.js';
import appointmentRoutes from './modules/appointments.js';
import sessionNotesRoutes from './modules/session-notes.js';
import expenseRoutes from './modules/expenses.js';
import companyRoutes from './modules/companies.js';
import companyInvoiceRoutes from './modules/company-invoices.js';
import paymentRoutes from './modules/payments.js';
import userRoutes from './modules/users.js';
import activityLogRoutes from './modules/activity-logs.js';
import patientPackRoutes from './modules/patient-packs.js';
import settingsRoutes from './modules/settings.js';
import waitingListRoutes from './modules/waiting-list.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// Refuse de démarrer sans secret JWT fort (évite les tokens forgeables).
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('[security] JWT_SECRET manquant ou trop court (minimum 32 caractères). Arrêt.');
  process.exit(1);
}

await connectDB();
await ensureSchema();

app.disable('x-powered-by');
app.use(helmet({
  // L'API est consommée en cross-origin par le frontend Next.js.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Origines locales / réseau privé tolérées uniquement hors production.
const isDevOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && isDevOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

// Limiteur global + limiteur strict sur l'authentification (anti brute-force).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, réessayez plus tard.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives de connexion, réessayez plus tard.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/session-notes', sessionNotesRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company-invoices', companyInvoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/patient-packs', patientPackRoutes);
app.use('/api/patient-outcomes', patientOutcomeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/waiting-list', waitingListRoutes);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.statusCode || err?.status || 500;
  if (status >= 500) console.error('[unhandled]', err);
  res.status(status).json({ success: false, message: status >= 500 ? 'Something went wrong' : 'Requête invalide' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
