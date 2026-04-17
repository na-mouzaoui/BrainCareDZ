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

    const email = 'admin@gmail.com';
    const password = 'Admin@123';

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      console.log('[Admin Setup] Admin account already exists');
      console.log('Email: admin@gmail.com');
      console.log('Password: Admin@123');
      await closePool();
      return;
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    await query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      ['Admin User', email, passwordHash, 'admin']
    );

    console.log('\nAdmin account created successfully!\n');
    console.log('Email: admin@gmail.com');
    console.log('Password: Admin@123');
    console.log('Role: admin\n');

    await closePool();
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
