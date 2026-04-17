import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, query, closePool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function createAdmin() {
  try {
    console.log('[Admin Setup] Connecting to PostgreSQL...');
    await connectDB();

    const email = 'admin@example.com';
    const password = 'Admin123!';
    const passwordHash = await bcryptjs.hash(password, 10);

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      await query(
        `UPDATE users
         SET name = $2,
             password_hash = $3,
             role = 'admin',
             is_active = TRUE,
             updated_at = NOW()
         WHERE email = $1`,
        [email, 'Admin User', passwordHash]
      );

      console.log('[Admin Setup] Admin account already existed and was updated');
      console.log('Email: admin@example.com');
      console.log('Password: Admin123!');
      await closePool();
      return;
    }

    await query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      ['Admin User', email, passwordHash, 'admin']
    );

    console.log('\nAdmin account created successfully!\n');
    console.log('Email: admin@example.com');
    console.log('Password: Admin123!');
    console.log('Role: admin\n');

    await closePool();
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
