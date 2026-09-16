import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, query, closePool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const seedDatabase = async () => {
  try {
    console.log('Connecting to PostgreSQL...');
    await connectDB();

    console.log('Clearing existing data...');
    await query('DELETE FROM activity_logs');
    await query('DELETE FROM payments');
    await query('DELETE FROM expenses');
    await query('DELETE FROM session_notes');
    await query('DELETE FROM appointments');
    await query('DELETE FROM services');
    await query('DELETE FROM patients');
    await query('DELETE FROM users');

    console.log('Creating test users...');
    const adminHash = await bcryptjs.hash('Admin123!', 10);
    const testHash = await bcryptjs.hash('1234', 10);
    const practitionerHash = await bcryptjs.hash('password123', 10);
    const receptionistHash = await bcryptjs.hash('password123', 10);

    const users = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES
         ('Admin User', 'admin@example.com', $1, 'admin'),
         ('Test User', 'test@gmail.com', $2, 'psy'),
         ('Practitioner One', 'practitioner@example.com', $3, 'psy'),
         ('Receptionist', 'receptionist@example.com', $4, 'coach')
       RETURNING id, name, email, role`,
      [adminHash, testHash, practitionerHash, receptionistHash]
    );

    const practitioner = users.rows.find((u) => u.email === 'test@gmail.com');

    console.log(`Created ${users.rowCount} users`);

    console.log('Creating test patients...');
    const patients = await query(
      `INSERT INTO patients (
         first_name, last_name, email, phone, date_of_birth, gender
       ) VALUES
         ('Jean', 'Dupont', 'jean.dupont@email.com', '+33612345678', '1990-05-15', 'male'),
         ('Sophie', 'Martin', 'sophie.martin@email.com', '+33698765432', '1985-08-22', 'female'),
         ('Michel', 'Bernard', 'michel.bernard@email.com', '+33645123789', '1995-11-10', 'male')
       RETURNING id, first_name, last_name`
    );

    console.log(`Created ${patients.rowCount} patients`);

    console.log('Creating test services...');
    const services = await query(
      `INSERT INTO services (name, category, description, duration, price, is_active)
       VALUES
         ('Neurofeedback Session - Basic', 'neurofeedback', 'Standard neurofeedback session using EEG to train brainwave patterns', 60, 120, TRUE),
         ('Neurofeedback Session - Advanced', 'neurofeedback', 'Advanced neurofeedback with multi-channel EEG and customized protocols', 90, 180, TRUE),
         ('Individual Therapy Session', 'therapy', 'One-on-one psychotherapy session for anxiety, depression, and other concerns', 50, 100, TRUE),
         ('Group Therapy Session', 'therapy', 'Group therapy session for shared experiences and peer support', 90, 45, TRUE),
         ('Psychological Assessment', 'assessment', 'Comprehensive psychological assessment and evaluation', 120, 250, TRUE),
         ('Neuropsychological Testing', 'assessment', 'In-depth testing of cognitive and neuropsychological functions', 180, 400, TRUE),
         ('Consultation', 'consultation', 'Initial consultation to discuss treatment options and goals', 30, 50, TRUE),
         ('Medication Management Follow-up', 'consultation', 'Follow-up appointment to monitor medication effectiveness', 30, 80, TRUE)
       RETURNING id, name, price`
    );

    console.log(`Created ${services.rowCount} services`);

    const apt1 = await query(
      `INSERT INTO appointments (practitioner_id, service_id, start_time, end_time, status)
       VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour', 'scheduled')
       RETURNING id`,
      [practitioner.id, services.rows[0].id]
    );

    await query('INSERT INTO appointment_patients (appointment_id, patient_id) VALUES ($1, $2)', [apt1.rows[0].id, patients.rows[0].id]);

    const apt2 = await query(
      `INSERT INTO appointments (practitioner_id, service_id, start_time, end_time, status)
       VALUES ($1, $2, NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day' + INTERVAL '50 min', 'completed')
       RETURNING id`,
      [practitioner.id, services.rows[2].id]
    );

    const junction2 = await query(
      'INSERT INTO appointment_patients (appointment_id, patient_id) VALUES ($1, $2) RETURNING id',
      [apt2.rows[0].id, patients.rows[1].id]
    );

    await query(
      `INSERT INTO session_notes (appointment_patient_id, practitioner_id, progress_notes)
       VALUES ($1, $2, 'Patient was attentive and calm. Progress observed')`,
      [junction2.rows[0].id, practitioner.id]
    );

    await query(
      `INSERT INTO payments (patient_id, amount, payment_method, status, notes)
       VALUES ($1, $2, 'cash', 'completed', 'Seed payment')`,
      [patients.rows[1].id, Number(services.rows[2].price) * 1.1]
    );

    console.log('Database seeded successfully!');
    console.log('Test Accounts:');
    console.log('Email: test@gmail.com | Password: 1234 | Role: psy');
    console.log('Email: admin@example.com | Password: Admin123! | Role: admin');
    console.log('Email: receptionist@example.com | Password: password123 | Role: coach');

    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
