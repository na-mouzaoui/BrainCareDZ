# Psychology Practice Management System - Backend

A comprehensive Express.js and PostgreSQL backend for managing psychology and neurofeedback practices.

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (local instance)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env` and update with your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/BrainCare
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=BrainCare
JWT_SECRET=your_jwt_secret_key_here_min_32_chars_long
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### 3. Create Database Schema

```bash
psql -U postgres -d BrainCare -f sql/init_postgres.sql
```

### 4. Seed the Database (Optional)

To populate the database with test data:

```bash
npm run seed
```

This will create and seed:
- **Test Users** with different roles (Admin, Practitioner, Receptionist)
- **Test Clients, Services, Appointments, Session Notes, expenses, Payments**

**Test Account Credentials:**
- Email: `test@gmail.com`
- Password: `1234`
- Role: Practitioner

### 5. Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires authentication)

### Health Check
- `GET /api/health` - Check if server is running

## Database Tables

### User (Practitioners, Admin, Receptionists)
- Personal information
- Role-based access control
- Specializations and license info

### Client (Patients)
- Demographics and contact information
- Emergency contacts
- Medical history and allergies
- Insurance information
- Session tracking

### Service (Services/Procedures)
- Service name and description
- Category (neurofeedback, therapy, assessment, etc.)
- Duration and pricing

### Appointment
- Scheduling details
- Client and practitioner assignment
- Status tracking (scheduled, completed, cancelled, no-show)
- Session notes reference

### SessionNote
- Clinical notes and observations
- Treatment plans and interventions
- Neurofeedback metrics
- Progress tracking

### Invoice
- Billing details
- Payment status
- Line items with pricing

### Payment
- Payment records
- Stripe integration
- Transaction tracking

## Project Structure

```
backend/
├── config/
│   └── db.js              # MongoDB connection
├── middleware/
│   └── auth.js            # JWT authentication & authorization
├── models/
│   ├── User.js            # User model
│   ├── Client.js          # Client model
│   ├── Service.js         # Service model
│   ├── Appointment.js     # Appointment model
│   ├── SessionNote.js     # Session note model
│   ├── Invoice.js         # Invoice model
│   └── Payment.js         # Payment model
├── routes/
│   └── auth.js            # Authentication routes
├── server.js              # Main server file
├── .env.example           # Environment variables template
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Next Steps

The following phases will be implemented:

1. ✅ Backend Setup & Authentication
2. Client Management Module
3. Services & Packages Module
4. Appointment Scheduling Module
5. Clinical Notes & Session Management
6. Invoicing & Payment Processing
7. Dashboard & Analytics

## Notes

- All passwords are hashed using bcryptjs
- JWT tokens expire after 7 days
- CORS is configured for frontend URL
- All models include created/updated timestamps
- Consider HIPAA compliance for production
