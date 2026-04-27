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
    await query('DELETE FROM invoice_appointments');
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
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES
         ('Admin User', 'admin@example.com', $1, 'admin', TRUE),
         ('Test User', 'test@gmail.com', $2, 'practitioner', TRUE),
         ('Practitioner One', 'practitioner@example.com', $3, 'practitioner', TRUE),
         ('Receptionist', 'receptionist@example.com', $4, 'receptionist', TRUE)
       RETURNING id, name, email, role`,
      [adminHash, testHash, practitionerHash, receptionistHash]
    );

    const practitioner = users.rows.find((u) => u.email === 'test@gmail.com');

    console.log(`Created ${users.rowCount} users`);

    console.log('Creating test patients...');
    const patients = await query(
      `INSERT INTO patients (
         practitioner_id, first_name, last_name, email, phone, date_of_birth, gender,
         address_street, address_city, address_zip_code, address_country,
         emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
         insurance_provider, insurance_policy_number, medical_history, current_medications, status
       ) VALUES
         ($1, 'Jean', 'Dupont', 'jean.dupont@email.com', '+33612345678', '1990-05-15', 'male',
          '123 Rue de Paris', 'Paris', '75001', 'France',
          'Marie Dupont', 'Sister', '+33687654321',
          'Mutuelle France', 'MF123456789', 'Anxiety disorder, history of insomnia', 'Sertraline 50mg daily', 'active'),
         ($1, 'Sophie', 'Martin', 'sophie.martin@email.com', '+33698765432', '1985-08-22', 'female',
          '456 Avenue des Champs', 'Lyon', '69000', 'France',
          'Pierre Martin', 'Husband', '+33612987654',
          'MGEN', 'MGEN987654321', 'ADHD, mild depression', 'None', 'active'),
         ($1, 'Michel', 'Bernard', 'michel.bernard@email.com', '+33645123789', '1995-11-10', 'male',
          '789 Boulevard Saint-Germain', 'Marseille', '13000', 'France',
          'Claire Bernard', 'Mother', '+33656789012',
          'Allianz', 'ALZ456789123', 'No significant medical history', 'None', 'active')
       RETURNING id, first_name, last_name`,
      [practitioner.id]
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
      `INSERT INTO appointments (patient_id, practitioner_id, service_id, start_time, end_time, status, notes)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour', 'scheduled', 'Initial session')
       RETURNING id`,
      [patients.rows[0].id, practitioner.id, services.rows[0].id]
    );

    const apt2 = await query(
      `INSERT INTO appointments (patient_id, practitioner_id, service_id, start_time, end_time, status, notes)
       VALUES ($1, $2, $3, NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day' + INTERVAL '50 min', 'completed', 'Follow-up completed')
       RETURNING id`,
      [patients.rows[1].id, practitioner.id, services.rows[2].id]
    );

    const note = await query(
      `INSERT INTO session_notes (appointment_id, patient_id, practitioner_id, observations, interventions, progress_notes)
       VALUES ($1, $2, $3, 'Patient was attentive and calm', 'Breathing + grounding', 'Progress observed')
       RETURNING id`,
      [apt2.rows[0].id, patients.rows[1].id, practitioner.id]
    );

    await query('UPDATE appointments SET session_note_id = $2 WHERE id = $1', [apt2.rows[0].id, note.rows[0].id]);

    const invoice = await query(
      `INSERT INTO expenses (invoice_number, patient_id, practitioner_id, line_items, subtotal, tax, total, due_date, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, NOW() + INTERVAL '15 day', 'sent')
       RETURNING id`,
      [
        `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0001`,
        patients.rows[1].id,
        practitioner.id,
        JSON.stringify([
          {
            description: services.rows[2].name,
            quantity: 1,
            unitPrice: Number(services.rows[2].price),
            totalPrice: Number(services.rows[2].price),
            appointmentId: apt2.rows[0].id,
          },
        ]),
        Number(services.rows[2].price),
        Number(services.rows[2].price) * 0.1,
        Number(services.rows[2].price) * 1.1,
      ]
    );

    await query('INSERT INTO invoice_appointments (invoice_id, appointment_id) VALUES ($1, $2)', [invoice.rows[0].id, apt2.rows[0].id]);

    await query(
      `INSERT INTO payments (invoice_id, patient_id, amount, payment_method, status, notes)
       VALUES ($1, $2, $3, 'cash', 'completed', 'Seed payment')`,
      [invoice.rows[0].id, patients.rows[1].id, Number(services.rows[2].price) * 1.1]
    );

    console.log('Database seeded successfully!');
    console.log('Test Accounts:');
    console.log('Email: test@gmail.com | Password: 1234 | Role: practitioner');
    console.log('Email: admin@example.com | Password: Admin123! | Role: admin');
    console.log('Email: receptionist@example.com | Password: password123 | Role: receptionist');

    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
