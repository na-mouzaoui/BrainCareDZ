import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, query } from './config/db.js';
import { logActivity } from './utils/activity-logger.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import serviceRoutes from './routes/services.js';
import appointmentRoutes from './routes/appointments.js';
import sessionNotesRoutes from './routes/session-notes.js';
import invoiceRoutes from './routes/invoices.js';
import expenseRoutes from './routes/expenses.js';
import companyRoutes from './routes/companies.js';
import companyInvoiceRoutes from './routes/company-invoices.js';
import paymentRoutes from './routes/payments.js';
import userRoutes from './routes/users.js';
import activityLogRoutes from './routes/activity-logs.js';
import patientPackRoutes from './routes/patient-packs.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize Express app
const app = express();

// Connect to PostgreSQL
await connectDB();

// Create practitioner_services table if not exists
try {
  await query(
    `CREATE TABLE IF NOT EXISTS practitioner_services (
      practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (practitioner_id, service_id)
    )`
  );
} catch (error) {
  console.error('Could not create practitioner_services table:', error.message);
}

// Create activity_logs table if not exists
try {
  await query(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      user_name VARCHAR(255),
      user_email VARCHAR(255),
      user_role VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255),
      resource_name VARCHAR(255),
      changes JSONB,
      status VARCHAR(50) DEFAULT 'success',
      error_message TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)');
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource)');
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)');
} catch (error) {
  console.error('Could not create activity_logs table:', error.message);
}

// Drop any CHECK constraint on activity_logs.action (pre-existing constraint blocks new action types)
try {
  const constraints = await query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'activity_logs'::regclass AND contype = 'c'`
  );
  for (const row of constraints.rows) {
    await query(`ALTER TABLE activity_logs DROP CONSTRAINT "${row.conname}"`);
    console.log(`Dropped constraint: ${row.conname}`);
  }
} catch { /* ignore */ }

// Drop any CHECK constraint on patients/clients.status (blocks new status values like "En cours", "Terminé", "Abandon")
for (const table of ['patients', 'clients']) {
  try {
    const constraints = await query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = '${table}'::regclass AND contype = 'c'`
    );
    for (const row of constraints.rows) {
      await query(`ALTER TABLE ${table} DROP CONSTRAINT "${row.conname}"`);
      console.log(`Dropped constraint ${row.conname} on ${table}`);
    }
  } catch { /* table may not exist */ }
}

// Add type column to services table
try {
  await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'consultation'`);
  console.log('Services type column added');
} catch (error) {
  console.error('Could not add type column to services:', error.message);
}

// Add type column to patient_packs table
try {
  await query(`ALTER TABLE patient_packs ADD COLUMN IF NOT EXISTS type VARCHAR(50)`);
  console.log('Patient packs type column added');
} catch (error) {
  console.error('Could not add type column to patient_packs:', error.message);
}

// Create appointment_patients junction table (for multi-patient neurofeedback sessions)
try {
  await query(
    `CREATE TABLE IF NOT EXISTS appointment_patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (appointment_id, patient_id)
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS idx_appointment_patients_appointment_id ON appointment_patients(appointment_id)');
  console.log('Appointment patients table created');
} catch (error) {
  console.error('Could not create appointment_patients table:', error.message);
}

// Create invoices table if not exists
try {
  await query(
    `CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number TEXT NOT NULL,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total NUMERIC(12, 2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE,
      paid_date DATE,
      payment_method TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_invoices_practitioner_id ON invoices(practitioner_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');
  console.log('Invoices table ready');
} catch (error) {
  console.error('Could not create invoices table:', error.message);
}

try {
  await query(`CREATE TABLE IF NOT EXISTS invoice_appointments (
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    PRIMARY KEY (invoice_id, appointment_id)
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_invoice_appointments_appointment_id ON invoice_appointments(appointment_id)');
  console.log('Invoice appointments table ready');
} catch (error) {
  console.error('Could not create invoice_appointments table:', error.message);
}

// Add invoice_number column if missing (for existing tables)
try {
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT`);
  console.log('Invoice number column verified');
} catch (error) {
  console.error('Could not add invoice_number column:', error.message);
}

// Add missing columns to patients table
try {
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS children_count INTEGER`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS profession VARCHAR(255)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS education_level VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS socio_category VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_type VARCHAR(50)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS show_parent_info BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS parent_relationship VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS consultation_reasons JSONB DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS difficulty_duration VARCHAR(50)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_consultation BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_type VARCHAR(255)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_follow_up BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS follow_up_details TEXT`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS source_of_acquisition VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS source_details TEXT`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_contact_date DATE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_appointment_date DATE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS appointment_frequency VARCHAR(50)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS planned_sessions INTEGER`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS completed_sessions INTEGER`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS abandon_reason TEXT`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS perceived_improvement INTEGER`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS observed_changes TEXT`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS improvement_start_month INTEGER`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS global_satisfaction INTEGER`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN DEFAULT FALSE`);
  console.log('All patient columns added successfully');
} catch (error) {
  console.error('Could not add patient columns:', error.message);
}

// Verify activity_logs table
try {
  await query('SELECT COUNT(*)::int AS count FROM activity_logs');
  console.log('Activity logs table is ready');
  // Test log entry
  await logActivity({ req: { ip: '127.0.0.1', get: () => 'startup' } as any, action: 'STARTUP', resource: 'server', resourceName: 'Server started' });
  console.log('Test log entry created successfully');
} catch (err) {
  console.warn('Activity logs table not available - logging will be disabled:', err.message);
}

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/session-notes', sessionNotesRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company-invoices', companyInvoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/patient-packs', patientPackRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
