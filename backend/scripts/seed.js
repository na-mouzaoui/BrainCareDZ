import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Service from '../models/Service.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Client.deleteMany({});
    await Service.deleteMany({});

    // Create test users
    console.log('Creating test users...');
    
    const testUsers = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
      },
      {
        name: 'Test User',
        email: 'test@gmail.com',
        password: await bcrypt.hash('1234', 10),
        role: 'practitioner',
      },
      {
        name: 'Practitioner One',
        email: 'practitioner@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'practitioner',
      },
      {
        name: 'Receptionist',
        email: 'receptionist@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'receptionist',
      },
    ];

    const createdUsers = await User.insertMany(testUsers);
    console.log(`✓ Created ${createdUsers.length} test users`);

    // Create test clients
    console.log('Creating test clients...');
    
    const testClients = [
      {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@email.com',
        phone: '+33612345678',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'Male',
        address: '123 Rue de Paris',
        city: 'Paris',
        zipCode: '75001',
        country: 'France',
        medicalHistory: 'Anxiety disorder, history of insomnia',
        currentMedications: 'Sertraline 50mg daily',
        emergencyContact: {
          name: 'Marie Dupont',
          relationship: 'Sister',
          phone: '+33687654321',
        },
        insurance: {
          provider: 'Mutuelle France',
          policyNumber: 'MF123456789',
          expirationDate: new Date('2025-12-31'),
        },
        status: 'active',
      },
      {
        firstName: 'Sophie',
        lastName: 'Martin',
        email: 'sophie.martin@email.com',
        phone: '+33698765432',
        dateOfBirth: new Date('1985-08-22'),
        gender: 'Female',
        address: '456 Avenue des Champs',
        city: 'Lyon',
        zipCode: '69000',
        country: 'France',
        medicalHistory: 'ADHD, mild depression',
        currentMedications: 'None',
        emergencyContact: {
          name: 'Pierre Martin',
          relationship: 'Husband',
          phone: '+33612987654',
        },
        insurance: {
          provider: 'MGEN',
          policyNumber: 'MGEN987654321',
          expirationDate: new Date('2026-06-30'),
        },
        status: 'active',
      },
      {
        firstName: 'Michel',
        lastName: 'Bernard',
        email: 'michel.bernard@email.com',
        phone: '+33645123789',
        dateOfBirth: new Date('1995-11-10'),
        gender: 'Male',
        address: '789 Boulevard Saint-Germain',
        city: 'Marseille',
        zipCode: '13000',
        country: 'France',
        medicalHistory: 'No significant medical history',
        currentMedications: 'None',
        emergencyContact: {
          name: 'Claire Bernard',
          relationship: 'Mother',
          phone: '+33656789012',
        },
        insurance: {
          provider: 'Allianz',
          policyNumber: 'ALZ456789123',
          expirationDate: new Date('2025-09-15'),
        },
        status: 'active',
      },
    ];

    const createdClients = await Client.insertMany(testClients);
    console.log(`✓ Created ${createdClients.length} test clients`);

    // Create test services
    console.log('Creating test services...');
    
    const testServices = [
      {
        name: 'Neurofeedback Session - Basic',
        category: 'Neurofeedback',
        description: 'Standard neurofeedback session using EEG to train brainwave patterns',
        duration: 60,
        price: 120,
        unit: 'per session',
      },
      {
        name: 'Neurofeedback Session - Advanced',
        category: 'Neurofeedback',
        description: 'Advanced neurofeedback with multi-channel EEG and customized protocols',
        duration: 90,
        price: 180,
        unit: 'per session',
      },
      {
        name: 'Individual Therapy Session',
        category: 'Therapy',
        description: 'One-on-one psychotherapy session for anxiety, depression, and other concerns',
        duration: 50,
        price: 100,
        unit: 'per session',
      },
      {
        name: 'Group Therapy Session',
        category: 'Therapy',
        description: 'Group therapy session for shared experiences and peer support',
        duration: 90,
        price: 45,
        unit: 'per session',
      },
      {
        name: 'Psychological Assessment',
        category: 'Assessment',
        description: 'Comprehensive psychological assessment and evaluation',
        duration: 120,
        price: 250,
        unit: 'per assessment',
      },
      {
        name: 'Neuropsychological Testing',
        category: 'Assessment',
        description: 'In-depth testing of cognitive and neuropsychological functions',
        duration: 180,
        price: 400,
        unit: 'per assessment',
      },
      {
        name: 'Consultation',
        category: 'Consultation',
        description: 'Initial consultation to discuss treatment options and goals',
        duration: 30,
        price: 50,
        unit: 'per consultation',
      },
      {
        name: 'Medication Management Follow-up',
        category: 'Consultation',
        description: 'Follow-up appointment to monitor medication effectiveness',
        duration: 30,
        price: 80,
        unit: 'per visit',
      },
    ];

    const createdServices = await Service.insertMany(testServices);
    console.log(`✓ Created ${createdServices.length} test services`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest Accounts:');
    console.log('─────────────────────────────────────');
    console.log('Email: test@gmail.com');
    console.log('Password: 1234');
    console.log('Role: Practitioner');
    console.log('─────────────────────────────────────');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('Role: Admin');
    console.log('─────────────────────────────────────');
    console.log('Email: receptionist@example.com');
    console.log('Password: password123');
    console.log('Role: Receptionist');
    console.log('─────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
