# Psychology Practice Management System - Setup Guide

## Overview

This is a full-stack MERN application for managing psychology and neurofeedback practices. It consists of:

- **Frontend**: Next.js 16 with TypeScript and shadcn/ui components
- **Backend**: Express.js with MongoDB
- **Database**: MongoDB (local or Atlas)

## Prerequisites

- Node.js v16+ and npm
- MongoDB (local instance or MongoDB Atlas account)
- Git (optional, for version control)

## Project Structure

```
.
├── app/                          # Next.js frontend
│   ├── auth/                     # Authentication pages
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/                # Dashboard pages
│   │   ├── page.tsx              # Main dashboard
│   │   ├── clients/              # (To be built)
│   │   ├── appointments/         # (To be built)
│   │   ├── session-notes/        # (To be built)
│   │   └── invoicing/            # (To be built)
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/                   # React components
│   └── ui/                       # shadcn/ui components
├── lib/                          # Utilities and helpers
│   ├── api.ts                    # API client
│   ├── auth-context.tsx          # Auth state management
│   └── utils.ts
├── backend/                      # Express backend
│   ├── config/                   # Configuration
│   │   └── db.js                 # MongoDB connection
│   ├── middleware/               # Express middleware
│   │   └── auth.js               # JWT authentication
│   ├── models/                   # MongoDB schemas
│   │   ├── User.js
│   │   ├── Client.js
│   │   ├── Service.js
│   │   ├── Appointment.js
│   │   ├── SessionNote.js
│   │   ├── Invoice.js
│   │   └── Payment.js
│   ├── routes/                   # API routes
│   │   └── auth.js
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── SETUP.md
```

## Installation & Setup

### 1. Frontend Setup

The frontend is already configured. Just ensure dependencies are installed:

```bash
npm install
```

### 2. Backend Setup

#### Step 1: Navigate to Backend Directory

```bash
cd backend
```

#### Step 2: Install Dependencies

```bash
npm install
```

#### Step 3: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/psychology-practice
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/psychology-practice

# JWT Secret (minimum 32 characters - generate a strong one!)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_minimum_32_chars

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Stripe (optional, for payment processing)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

#### Step 4: Start MongoDB

**Option A: Local MongoDB**

```bash
# Make sure MongoDB is installed and running
mongod
```

**Option B: MongoDB Atlas (Cloud)**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Get your connection string
4. Update `MONGODB_URI` in `.env`

#### Step 5: Start the Backend Server

```bash
npm run dev
```

The backend should start on `http://localhost:5000`

### 3. Frontend Setup (continued)

In a new terminal, start the frontend:

```bash
npm run dev
```

The frontend should start on `http://localhost:3000`

## Testing the Application

### Create a Test Account

1. Go to `http://localhost:3000`
2. You should be redirected to the login page
3. Click "Sign up" to create a new account
4. Fill in the registration form:
   - Full Name: Your Name
   - Email: test@example.com
   - Role: Practitioner (or Admin/Receptionist)
   - Password: securepassword123
   - Confirm Password: securepassword123
5. Click "Create Account"

### Test Login

1. After registration, you should be redirected to the dashboard
2. Click "Sign Out" to log out
3. Use your email and password to log back in

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user (requires token) |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check if backend is running |

## Next Steps

The following modules will be implemented in phases:

1. ✅ **Backend Setup & Authentication** - Complete
2. **Client Management Module** - Create, read, update, delete clients
3. **Services & Packages Module** - Manage services and packages
4. **Appointment Scheduling Module** - Calendar and scheduling
5. **Clinical Notes & Session Management** - Session notes and tracking
6. **Invoicing & Payment Processing** - Invoicing and Stripe integration
7. **Dashboard & Analytics** - KPIs and reporting

## Important Notes

### Security

- **Production JWT Secret**: Generate a strong, random JWT secret (minimum 32 characters)
- **Password Hashing**: All passwords are hashed using bcryptjs
- **CORS**: Configure CORS for your production domain
- **HTTPS**: Always use HTTPS in production
- **Environment Variables**: Never commit `.env` files to version control
- **Token Expiry**: JWT tokens expire after 7 days

### Database

- MongoDB connection pooling is configured automatically
- All models include timestamps (createdAt, updatedAt)
- Consider setting up database backups
- For production, use MongoDB Atlas with proper security settings

### Frontend

- `NEXT_PUBLIC_API_URL` can be set in `.env.local` if needed (recommended value: `http://localhost:5000/api`)
- Authentication token is stored in localStorage
- Protected routes redirect to login if not authenticated

## Troubleshooting

### Backend won't start

1. Check MongoDB is running: `mongod`
2. Check `.env` file is properly configured
3. Verify port 5000 is not in use
4. Check for typos in MongoDB URI

### Login fails

1. Make sure backend is running on port 5000
2. Check frontend `NEXT_PUBLIC_API_URL` configuration
3. Verify JWT_SECRET is set in backend `.env`
4. Check browser console for error messages

### CORS errors

1. Verify `FRONTEND_URL` in backend `.env` is correct
2. Make sure frontend and backend URLs match

### Database connection errors

1. Verify MongoDB is running
2. Check MongoDB URI in `.env`
3. For Atlas, ensure your IP is whitelisted
4. Verify database name in connection string

## Development Tips

- Use MongoDB Compass for visual database management
- Check browser DevTools (Network tab) for API request/response details
- Use `console.log()` in backend for debugging
- Use Postman or similar for API testing
- Read backend console logs for detailed error messages

## Production Deployment

When deploying to production:

1. Update all environment variables with production values
2. Use a strong, random JWT secret
3. Enable HTTPS
4. Use MongoDB Atlas with strong passwords
5. Set `NODE_ENV=production`
6. Configure proper CORS settings
7. Set up proper logging and monitoring
8. Consider implementing rate limiting
9. Enable database backups
10. Use environment variables from your hosting platform (Vercel, Railway, etc.)

## Support

For issues or questions:
- Check the backend README.md for detailed backend documentation
- Review the API endpoints documentation
- Check browser console and backend logs for error messages
- Verify all environment variables are correctly set

---

**Version**: 1.0.0
**Last Updated**: 2024
