# DaanaRx - HIPAA-Compliant Medication Tracking System

A comprehensive web application for non-profit clinics to track and distribute donated prescription medications.

## 🎯 Overview

DaanaRx provides:
- **Complete Inventory Management**: Track medications from check-in to dispensing
- **QR Code System**: Generate and scan QR codes for quick unit identification
- **Drug Lookup**: Integrated RxNorm and FDA APIs for NDC barcode scanning
- **Role-Based Access**: Superadmin, Admin, and Employee roles with appropriate permissions
- **HIPAA Compliance**: Row-level security, encrypted data, audit trails
- **Multi-Clinic Support**: Isolated data per clinic with automatic RLS policies

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Google Cloud project (for OAuth, optional)

### 1. Database Setup

1. Go to your Supabase dashboard: https://cnjajswnqmzzhzoyadqa.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Open `supabase-schema.sql` file from this project
4. Copy all contents and paste into the SQL Editor
5. Click **Run** to execute the SQL commands

This will create:
- All database tables (clinics, users, locations, lots, units, drugs, transactions)
- Row-level security policies
- Indexes for performance
- Seed data with common medications

### 2. Environment Variables

The `.env.local` file is already configured with:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://cnjajswnqmzzhzoyadqa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>
```

**Add these additional environment variables:**

```bash
# Get this from Supabase Dashboard > Settings > API > service_role key
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Generate a random secret for JWT tokens
JWT_SECRET=your_random_secret_here_at_least_32_chars

# Optional: For production
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Application

**Development mode (runs both frontend and backend):**
```bash
npm run dev:all
```

This starts:
- Next.js frontend: http://localhost:3000
- GraphQL backend: http://localhost:4000/graphql

**Or run separately:**

Terminal 1 - Frontend:
```bash
npm run dev
```

Terminal 2 - Backend:
```bash
npm run server
```

### 5. Create Your First Account

1. Open http://localhost:3000
2. Click "Sign up"
3. Enter:
   - Your email
   - A secure password
   - Your clinic name
4. You'll be automatically logged in as a **Superadmin**

## 📋 Core Features

### 1. Check-In Flow
- Create or select existing lot (donation source)
- Search drugs by NDC barcode or manual entry
- Create unit with quantity and expiry date
- Generate QR code for the unit
- Print labels

### 2. Check-Out Flow
- Scan QR code or search by unit ID
- View unit details and available quantity
- Dispense medication with patient reference
- Automatic inventory updates
- Transaction logging

### 3. Scan/Lookup
- Quick unit information lookup
- View transaction history
- Direct link to check-out

### 4. Inventory Management
- View all units with pagination
- Search by drug name or notes
- See expiry dates and stock levels
- Color-coded status (expired, expiring soon)

### 5. Reports
- Complete transaction audit trail
- Filter by date, type, patient reference
- Export capabilities (future enhancement)

### 6. Admin Panel
- Create and manage storage locations
- Set temperature requirements (fridge/room temp)
- Delete protection for locations with inventory

### 7. Settings (Superadmin)
- Invite new users
- Assign roles (Admin, Employee)
- View all clinic users

## 👥 User Roles

### Superadmin
- Full access to all features
- Can edit units and transactions
- User management
- Location management

### Admin
- Read-only access to inventory and reports
- Can check-in and check-out medications
- Can create locations
- Cannot edit existing data
- Cannot manage users

### Employee
- Can check-in medications
- Can check-out medications
- Can scan/lookup units
- View-only access to inventory
- No access to reports, admin, or settings

## 🗄️ Database Schema

### Key Tables
- **clinics**: Clinic information and branding
- **users**: User accounts with role-based access
- **locations**: Storage locations with temperature tracking
- **lots**: Donation batches linked to locations
- **drugs**: Universal drug database (cached from APIs)
- **units**: Individual medication units in inventory
- **transactions**: Complete audit trail of all operations

### Security
- **Row-Level Security (RLS)**: Automatic clinic data isolation
- **Encrypted Auth**: Supabase handles password hashing
- **JWT Tokens**: Secure session management
- **Audit Logs**: Every transaction is recorded

## 🔌 API Integration

### RxNorm API
- NDC barcode lookup
- Drug name search
- Strength and form information
- **No API key required**

### openFDA API
- Fallback for NDC lookups
- Additional drug information
- **No API key required**

### Usage
Both APIs are called automatically when:
1. Scanning an NDC barcode during check-in
2. Searching drugs by generic name
3. Results are cached in the local drugs table

## 🏗️ Architecture

### Frontend (Next.js 14 + React 18)
- **App Router**: Modern Next.js file-based routing
- **Mantine UI**: Component library for consistent design
- **Apollo Client**: GraphQL data management
- **Redux Toolkit**: Global state (auth, clinic)
- **TypeScript**: Strict typing throughout

### Backend (Express + Apollo Server)
- **GraphQL API**: Single endpoint at `/graphql`
- **Authentication**: JWT-based with Supabase Auth
- **Middleware**: Security headers, rate limiting, CORS
- **Services**: Business logic layer
- **Type Safety**: Shared types between frontend and backend

### Database (Supabase/PostgreSQL)
- **Managed PostgreSQL**: Automatic backups
- **Row-Level Security**: Built-in multi-tenancy
- **Real-time** (optional): Can enable subscriptions
- **Auth Integration**: Built-in user management

## 📦 Project Structure

```
DaanarRX/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── auth/              # Sign in, sign up
│   │   ├── checkin/           # Check-in flow
│   │   ├── checkout/          # Check-out flow
│   │   ├── scan/              # Scan/lookup
│   │   ├── inventory/         # Inventory management
│   │   ├── reports/           # Transaction logs
│   │   ├── admin/             # Location management
│   │   ├── settings/          # User management
│   │   └── layout.tsx         # Root layout with providers
│   ├── components/            # Reusable components
│   │   └── layout/            # AppShell, Navigation
│   ├── store/                 # Redux slices
│   ├── lib/                   # Apollo Client, Supabase
│   ├── types/                 # TypeScript definitions
│   └── hooks/                 # Custom React hooks
├── server/
│   ├── graphql/               # Schema and resolvers
│   ├── services/              # Business logic
│   ├── middleware/            # Auth, error handling
│   ├── utils/                 # Helpers
│   └── index.ts               # Express server
├── supabase-schema.sql        # Database initialization
├── IMPLEMENTATION_PLAN.md     # Development roadmap
└── package.json               # Dependencies
```

## 🧪 Testing

### Manual Testing Checklist

#### Authentication
- [ ] Sign up creates new clinic and superadmin user
- [ ] Sign in with existing credentials
- [ ] Logout clears session

#### Check-In
- [ ] Create new location
- [ ] Create new lot with location
- [ ] Search drug by NDC barcode
- [ ] Manual drug entry
- [ ] Create unit with all required fields
- [ ] QR code generates successfully

#### Check-Out
- [ ] Search unit by ID
- [ ] Search unit by QR code
- [ ] Dispense reduces available quantity
- [ ] Cannot dispense more than available
- [ ] Transaction is created

#### Role-Based Access
- [ ] Superadmin can edit data
- [ ] Admin cannot edit data
- [ ] Employee cannot access reports/settings
- [ ] Settings page only visible to superadmin

### Future Enhancements
- Unit tests with Jest
- Integration tests with Cypress
- E2E testing for critical flows

## 🚨 Troubleshooting

### "User record not found" error
- Make sure you ran `supabase-schema.sql` in Supabase
- Check that RLS policies are enabled
- Verify SUPABASE_SERVICE_KEY is set correctly

### GraphQL endpoint not connecting
- Ensure backend server is running (`npm run server`)
- Check NEXT_PUBLIC_GRAPHQL_URL in `.env.local`
- Verify port 4000 is not in use

### TypeScript errors
- Run `npm install` to ensure all dependencies are installed
- Check that `@types/*` packages are in devDependencies
- Verify TypeScript version is 5.6+

### Camera access denied for barcode scanning
- Barcode scanning requires HTTPS in production
- Use localhost for development
- Check browser permissions

## 📝 Development Notes

### Zero TypeScript Errors
This project has **zero TypeScript compilation errors** with strict mode enabled.

### API Rate Limiting
- GraphQL API limited to 100 requests per 15 minutes per IP
- Adjust in `server/index.ts` if needed

### Database Migrations
- Manual migrations via Supabase SQL Editor
- Future: Consider using Prisma or Supabase CLI

### HIPAA Compliance Notes
- All PHI is encrypted at rest (Supabase handles this)
- No sensitive data in network logs
- Audit trail via transactions table
- User access controls via RLS
- **Consult legal team for full compliance certification**

## 🔧 Configuration

### Enable Google OAuth (Optional)

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Google provider
3. Add your Google Client ID and Secret
4. Configure redirect URLs

### Customize Branding

Clinic-specific branding (colors, logo) can be configured in the Settings page (Superadmin only).

## 📚 Additional Documentation

- [Technical Specification](/.env.local) - Full technical spec
- [Implementation Plan](/IMPLEMENTATION_PLAN.md) - Development roadmap
- [Supabase Docs](https://supabase.com/docs)
- [RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html)
- [Mantine UI](https://mantine.dev/)

## 🤝 Contributing

This is a private project for specific clinic use. For bugs or feature requests:
1. Document the issue clearly
2. Include steps to reproduce
3. Note your user role and permissions

## 📄 License

Proprietary - All Rights Reserved

## 🎉 Getting Started Summary

```bash
# 1. Run SQL schema in Supabase dashboard
# 2. Add SUPABASE_SERVICE_KEY and JWT_SECRET to .env.local
# 3. Install dependencies
npm install

# 4. Start application
npm run dev:all

# 5. Open browser
# http://localhost:3000

# 6. Sign up to create your clinic
```

---

**Built with ❤️ for non-profit clinics providing essential healthcare services.**
