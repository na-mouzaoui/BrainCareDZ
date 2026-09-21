import express from 'express';
import cors from 'cors';
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

await connectDB();
await ensureSchema();

app.use(express.json());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    // En développement : autorise localhost et les accès réseau (téléphone, autre PC)
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

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
  res.status(500).json({ success: false, message: 'Something went wrong', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
