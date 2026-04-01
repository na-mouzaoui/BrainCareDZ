import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    console.log('[Admin Setup] Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/psychology-practice');
    
    console.log('[Admin Setup] Connected to MongoDB');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    if (existingAdmin) {
      console.log('[Admin Setup] Admin account already exists');
      console.log('Email: admin@gmail.com');
      console.log('Password: Admin@123');
      await mongoose.connection.close();
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcryptjs.hash('Admin@123', 10);
    
    // Create admin user
    const admin = new User({
      name: 'Admin User',
      email: 'admin@gmail.com',
      password: hashedPassword,
      role: 'Admin'
    });
    
    await admin.save();
    
    console.log('\n✅ Admin account created successfully!\n');
    console.log('📧 Email: admin@gmail.com');
    console.log('🔐 Password: Admin@123');
    console.log('👤 Role: Admin\n');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
