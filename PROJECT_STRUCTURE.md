# Psychology Practice Management System

A comprehensive full-stack MERN application for managing psychology and neurofeedback practices.

## Project Overview

MindCare is a professional practice management system designed for psychologists, therapists, and neurofeedback practitioners. It provides complete tools for client management, appointment scheduling, session notes, invoicing, and financial analytics.

## Technology Stack

### Frontend
- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui
- **Charts:** Recharts for data visualization
- **State Management:** React Context API + SWR for data fetching
- **Authentication:** JWT with Auth Context

### Backend
- **Server:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcryptjs
- **Payments:** Stripe integration (ready for implementation)

## Project Structure

```
psychology-practice-app/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with AuthProvider
│   ├── page.tsx                 # Home page with redirect logic
│   ├── auth/                    # Authentication pages
│   │   ├── login/page.tsx       # Login page
│   │   └── register/page.tsx    # Registration page
│   └── dashboard/               # Protected dashboard routes
│       ├── layout.tsx           # Dashboard layout with navigation
│       ├── page.tsx             # Main dashboard with KPIs
│       ├── analytics/
│       │   └── page.tsx         # Analytics with charts
│       ├── clients/             # Client management
│       │   ├── page.tsx         # List clients
│       │   ├── new/page.tsx     # Create new client
│       │   ├── [id]/page.tsx    # Client detail view
│       │   └── [id]/edit/page.tsx
│       ├── services/            # Service management
│       │   ├── page.tsx         # List services
│       │   ├── new/page.tsx     # Create service
│       │   └── [id]/edit/page.tsx
│       ├── appointments/        # Appointment scheduling
│       │   ├── page.tsx         # Calendar view
│       │   ├── new/page.tsx     # Schedule appointment
│       │   └── [id]/page.tsx    # Appointment detail
│       ├── session-notes/       # Clinical notes
│       │   ├── page.tsx         # List session notes
│       │   └── [id]/page.tsx    # View/edit session note
│       └── invoices/            # Billing management
│           ├── page.tsx         # List invoices
│           ├── new/page.tsx     # Create invoice
│           └── [id]/page.tsx    # Invoice detail
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── dashboard-nav.tsx        # Navigation component
│   ├── client-form.tsx          # Reusable client form
│   ├── service-form.tsx         # Service form component
│   ├── appointment-form.tsx     # Appointment booking form
│   ├── session-note-form.tsx    # Session notes form
│   └── invoice-form.tsx         # Invoice creation form
├── lib/
│   ├── api.ts                   # API client utilities
│   ├── auth-context.tsx         # Authentication context
│   └── utils.ts                 # Utility functions
├── public/                      # Static assets
├── backend/                     # Express backend
│   ├── config/
│   │   └── db.js               # MongoDB connection
│   ├── middleware/
│   │   └── auth.js             # JWT authentication
│   ├── models/
│   │   ├── User.js             # User/Practitioner model
│   │   ├── Client.js           # Patient model
│   │   ├── Service.js          # Service/Procedure model
│   │   ├── Appointment.js      # Appointment model
│   │   ├── SessionNote.js      # Clinical notes model
│   │   ├── Invoice.js          # Invoice model
│   │   └── Payment.js          # Payment transaction model
│   ├── routes/
│   │   ├── auth.js             # Authentication endpoints
│   │   ├── clients.js          # Client CRUD endpoints
│   │   ├── services.js         # Service management endpoints
│   │   ├── appointments.js     # Appointment endpoints
│   │   ├── session-notes.js    # Session notes endpoints
│   │   └── invoices.js         # Invoice endpoints
│   ├── scripts/
│   │   └── seed.js             # Database seeding script
│   ├── server.js               # Main Express server
│   ├── .env.example            # Environment variables template
│   ├── package.json
│   └── README.md
├── SETUP.md                     # Setup instructions
├── IMPLEMENTATION_SUMMARY.md    # What's been built
└── PROJECT_STRUCTURE.md         # This file
```

## Key Features

### 1. Client Management
- Complete client profiles with demographics
- Medical history and allergies tracking
- Emergency contact information
- Insurance details
- Client status tracking (active, inactive, discharged)

### 2. Service Catalog
- Service definitions with categories
- Pricing and duration management
- Service descriptions for client communication
- 5 default categories: Neurofeedback, Therapy, Assessment, Consultation, Other

### 3. Appointment Scheduling
- Calendar-based scheduling interface
- Appointment status tracking (scheduled, completed, cancelled, no-show)
- Automatic conflict detection
- Integration with client and service information
- Reminders and notifications (ready for implementation)

### 4. Clinical Documentation
- Session notes with detailed templates
- Progress tracking and observations
- Neurofeedback metrics recording
- Treatment plan documentation
- Clinical assessment tracking

### 5. Invoicing & Payments
- Invoice generation from appointments
- Payment status tracking
- Manual invoice creation with line items
- Payment recording and reconciliation
- Stripe integration ready (requires API keys)

### 6. Financial Analytics
- Revenue tracking and trends
- Payment status overview
- Service utilization analysis
- Client acquisition tracking
- Financial forecasting ready

### 7. Dashboard & KPIs
- Real-time KPI cards
- 6 key metrics: Total Clients, Upcoming Appointments, Completed Sessions, Revenue, Pending Invoices, Average Session Duration
- Recent activity feeds
- Quick action buttons for common tasks
- Analytics page with trend charts

## Authentication & Authorization

### User Roles
1. **Admin** - Full system access, user management
2. **Practitioner** - Can manage own clients, appointments, and notes
3. **Receptionist** - Can schedule appointments, manage client contact info

### Security Features
- JWT tokens with 7-day expiration
- Password hashing with bcryptjs
- Role-based access control (RBAC)
- Protected routes requiring authentication
- HTTP-only cookie storage (ready for implementation)

## Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (admin, practitioner, receptionist),
  specialization: String,
  license: String,
  phone: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Client Model
```javascript
{
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  dateOfBirth: Date,
  gender: String,
  address: String,
  city: String,
  zipCode: String,
  country: String,
  medicalHistory: String,
  allergies: [String],
  currentMedications: String,
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  insurance: {
    provider: String,
    policyNumber: String,
    expirationDate: Date
  },
  status: String (active, inactive, discharged),
  createdAt: Date,
  updatedAt: Date
}
```

### Service Model
```javascript
{
  name: String,
  category: String,
  description: String,
  duration: Number (minutes),
  price: Number,
  unit: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Appointment Model
```javascript
{
  client: ObjectId (ref: Client),
  practitioner: ObjectId (ref: User),
  service: ObjectId (ref: Service),
  startTime: Date,
  endTime: Date,
  status: String (scheduled, completed, cancelled, no-show),
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### SessionNote Model
```javascript
{
  appointment: ObjectId (ref: Appointment),
  client: ObjectId (ref: Client),
  practitioner: ObjectId (ref: User),
  serviceType: String,
  observations: String,
  treatment: String,
  metrics: {
    baseline: String,
    result: String,
    improvement: Number
  },
  nextSteps: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Invoice Model
```javascript
{
  invoiceNumber: String,
  client: ObjectId (ref: Client),
  appointment: ObjectId (ref: Appointment),
  items: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    total: Number
  }],
  subtotal: Number,
  tax: Number,
  total: Number,
  status: String (draft, sent, paid, overdue),
  dueDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Payment Model
```javascript
{
  invoice: ObjectId (ref: Invoice),
  amount: Number,
  paymentMethod: String (cash, card, transfer, check),
  stripePaymentId: String (optional),
  status: String (pending, completed, failed),
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Clients
- `GET /api/clients` - List all clients
- `POST /api/clients` - Create new client
- `GET /api/clients/:id` - Get client details
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client
- `GET /api/clients/search/:query` - Search clients

### Services
- `GET /api/services` - List all services
- `POST /api/services` - Create service
- `GET /api/services/:id` - Get service details
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `GET /api/services/category/:category` - Filter by category

### Appointments
- `GET /api/appointments` - List appointments
- `POST /api/appointments` - Schedule appointment
- `GET /api/appointments/:id` - Get appointment details
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment
- `PUT /api/appointments/:id/complete` - Mark as completed
- `GET /api/appointments/availability/:date` - Check availability

### Session Notes
- `GET /api/session-notes` - List all notes
- `POST /api/session-notes` - Create session note
- `GET /api/session-notes/:id` - Get note details
- `PUT /api/session-notes/:id` - Update note
- `DELETE /api/session-notes/:id` - Delete note
- `GET /api/session-notes/client/:clientId` - Get client notes

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice details
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice
- `PUT /api/invoices/:id/send` - Send invoice
- `PUT /api/invoices/:id/mark-paid` - Mark as paid
- `GET /api/invoices/client/:clientId` - Get client invoices

## Getting Started

### Prerequisites
- Node.js v16 or higher
- MongoDB (local or Atlas)
- npm or pnpm

### Installation & Setup

1. **Clone the repository**
```bash
git clone <repo-url>
cd psychology-practice-app
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run seed      # Populate test data
npm run dev       # Start development server
```

3. **Setup Frontend**
```bash
npm install
npm run dev       # Start on http://localhost:3000
```

4. **Test Accounts**
```
Email: test@gmail.com
Password: 1234
Role: Practitioner
```

## Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/psychology-practice
JWT_SECRET=your_jwt_secret_key_here_min_32_chars_long
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Next Steps & Future Enhancements

1. **Email Integration**
   - Appointment reminders
   - Invoice delivery
   - Client notifications

2. **Payment Processing**
   - Stripe integration for online payments
   - Payment automation

3. **Reporting**
   - Custom report generation
   - Export to PDF/Excel
   - Schedule automated reports

4. **Communication**
   - Client messaging system
   - Secure document sharing
   - Video consultation integration

5. **HIPAA Compliance**
   - Audit logging
   - Data encryption
   - Access controls
   - Backup and disaster recovery

6. **Advanced Features**
   - Telemedicine/video sessions
   - AI-powered session analysis
   - Predictive analytics
   - Mobile app

## Support & Documentation

- **Backend README:** See `/backend/README.md`
- **Setup Guide:** See `/SETUP.md`
- **Implementation Summary:** See `/IMPLEMENTATION_SUMMARY.md`

## License

ISC

## Developer Notes

- All API endpoints require JWT authentication (except auth endpoints)
- CORS is configured for frontend URL in environment variables
- All passwords are hashed and never stored in plain text
- Consider implementing HIPAA compliance for production use
- Regular database backups are recommended
- Rate limiting should be implemented in production
