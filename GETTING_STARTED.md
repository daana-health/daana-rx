# 🚀 DaanaRx Getting Started Guide

## ⚡ Quick Setup (5 Minutes)

### Step 1: Database Setup (2 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://cnjajswnqmzzhzoyadqa.supabase.co
   - Log in with your Supabase account

2. **Run Database Schema**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"
   - Open the `supabase-schema.sql` file in this project
   - Copy **all** contents (Cmd+A, Cmd+C)
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - ✅ You should see "Success. No rows returned"

### Step 2: Add Missing Environment Variables (1 minute)

Open `.env.local` and add these two required variables:

```bash
# Get from Supabase Dashboard > Settings > API > service_role key (secret!)
SUPABASE_SERVICE_KEY=eyJhbGc...your_service_key_here

# Generate any random 32+ character string
JWT_SECRET=your_super_secret_jwt_key_here_at_least_32_characters_long
```

**How to get SUPABASE_SERVICE_KEY:**
1. In Supabase dashboard, go to Settings (gear icon)
2. Click "API" in the settings menu
3. Find "Project API keys" section
4. Copy the `service_role` key (NOT the anon key!)
5. Paste it into `.env.local`

**How to generate JWT_SECRET:**
```bash
# Option 1: Use openssl
openssl rand -base64 32

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Just type a long random string (32+ chars)
```

### Step 3: Install and Run (2 minutes)

```bash
# Install dependencies (if not already done)
npm install

# Start both frontend and backend
npm run dev:all
```

You should see:
```
🚀 DaanaRx Server ready at http://localhost:4000/graphql
▲ Next.js 14.2.0
- Local: http://localhost:3000
```

### Step 4: Create Your Account

1. Open http://localhost:3000
2. Click "Sign up"
3. Fill in:
   - **Email**: your email
   - **Password**: choose a secure password
   - **Clinic Name**: your clinic's name
4. Click "Create Account"

🎉 **You're now logged in as a Superadmin!**

---

## 📋 Next Steps

### 1. Create Storage Locations

Before checking in medications, create at least one location:

1. Click "Admin" in the sidebar
2. Click "Create Location"
3. Enter name (e.g., "Main Refrigerator" or "Cabinet A")
4. Select temperature type (Fridge or Room Temperature)
5. Click "Create"

### 2. Check In Your First Medication

1. Click "Check In" in the sidebar
2. **Step 1: Create Lot**
   - Enter donation source (e.g., "CVS Pharmacy")
   - Select the location you created
   - Click "Continue to Drug Search"

3. **Step 2: Find Drug**
   - Enter NDC barcode (e.g., `0781-1506-01` for Lisinopril)
   - Click "Search"
   - OR enter drug details manually
   - Click "Continue to Unit Details"

4. **Step 3: Create Unit**
   - Enter total quantity (e.g., 100)
   - Available quantity will auto-fill
   - Select expiry date
   - Click "Create Unit"

5. **QR Code Generated!**
   - Your QR code is displayed
   - Click "Print Label" to print
   - Click "Add Another Unit" to continue

### 3. Check Out a Medication

1. Click "Check Out" in the sidebar
2. Enter the Unit ID (from previous step)
   - Or scan the QR code
3. Click "Search"
4. View unit details
5. Enter:
   - Quantity to dispense
   - Patient reference ID (optional)
   - Notes (optional)
6. Click "Check Out"

---

## 🔍 Testing the System

### Test Flow 1: Complete Medication Lifecycle

1. **Admin**: Create a location called "Test Fridge"
2. **Check In**:
   - Create lot from "Test Pharmacy"
   - Add Lisinopril 10mg (NDC: 0781-1506-01)
   - Quantity: 100
   - Expiry: 1 year from now
3. **Home**: View dashboard stats (should show 1 total unit)
4. **Inventory**: See your unit listed
5. **Scan**: Lookup the unit by ID
6. **Check Out**:
   - Search for the unit
   - Dispense 10 units
   - Add patient ref: "TEST-001"
7. **Reports**: See the check-in and check-out transactions
8. **Inventory**: Verify available quantity is now 90

### Test Flow 2: Role-Based Access

1. **Settings**: Invite a new user
   - Email: test@example.com
   - Username: testuser
   - Role: Employee
2. Log out and sign in as the new user (use temp password from logs)
3. Verify Employee can:
   - ✅ Access Check In
   - ✅ Access Check Out
   - ✅ View Inventory
   - ❌ NOT access Reports
   - ❌ NOT access Settings

---

## 🎯 Common Tasks

### Add More Medications
Go to Check In → Use existing lot → Select your lot → Add units

### View Inventory
Inventory page shows all units with search and pagination

### Print QR Labels
After creating a unit, click "Print Label" in the QR modal

### See Transaction History
Reports page shows all transactions with filters

### Manage Users
Settings (Superadmin only) → Invite User

### Manage Locations
Admin → Create Location (or Edit/Delete existing)

---

## 🆘 Troubleshooting

### "Network Error" when signing in
- ✅ Check backend is running: http://localhost:4000/health
- ✅ Should return: `{"status":"ok","timestamp":"..."}`
- ❌ If not running: `npm run server`

### "User record not found"
- ❌ Database schema not run
- ✅ Go back to Step 1 and run `supabase-schema.sql`

### TypeScript errors
- ✅ Should have zero errors!
- Run: `npx tsc --noEmit`
- If errors, run: `npm install`

### Can't access certain pages
- ✅ Check your user role
- Employees: Limited access
- Admins: Read-only for inventory/reports
- Superadmin: Full access

---

## 📊 Dashboard Metrics

The home page shows:
- **Total Units**: All units with available quantity > 0
- **Expiring Soon**: Units expiring within 30 days
- **Recent Check-Ins**: Check-ins in the last 7 days
- **Recent Check-Outs**: Check-outs in the last 7 days
- **Low Stock Alerts**: Units with <10% remaining

---

## 🔐 Security Notes

### Never Commit These Files:
- `.env.local` (contains secrets!)
- `node_modules/`
- `.next/`

### Password Best Practices:
- Use strong passwords (12+ characters)
- Don't share accounts
- Each user should have their own account

### Production Deployment:
- Use HTTPS (required for camera access)
- Enable Supabase RLS policies (already done)
- Set up proper CORS in production
- Use environment variables for all secrets

---

## 📞 Need Help?

### Check These First:
1. README.md - Full documentation
2. IMPLEMENTATION_PLAN.md - Development roadmap
3. Console logs - Frontend: Browser DevTools, Backend: Terminal

### Database Issues:
- Verify schema is run in Supabase
- Check RLS policies are enabled
- Ensure service key is correct

### API Issues:
- RxNorm API: No key needed, might be rate-limited
- OpenFDA: Backup if RxNorm fails
- Both cache results in local database

---

## ✅ Success Checklist

Before using in production:

- [ ] Database schema executed successfully
- [ ] All environment variables configured
- [ ] Can sign up and create account
- [ ] Can create locations
- [ ] Can check in medications
- [ ] QR codes generate correctly
- [ ] Can check out medications
- [ ] Transactions appear in reports
- [ ] Inventory updates correctly
- [ ] Role-based access working
- [ ] Zero TypeScript errors
- [ ] Backend health endpoint responsive

---

**You're all set! Start managing your clinic's medication inventory with DaanaRx.**
