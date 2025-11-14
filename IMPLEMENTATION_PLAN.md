# DaanaRx Implementation Plan

## Current Status: Building Systematically

### ✅ Completed
1. Project initialization with all dependencies
2. TypeScript configuration (strict mode)
3. Complete type definitions (`src/types/index.ts`)
4. Supabase database schema with RLS policies (`supabase-schema.sql`)
5. GraphQL schema (`server/graphql/schema.ts`)
6. Server utilities (Supabase client, JWT auth)

### 🚧 In Progress

#### Checkpoint 1: Database + Auth Backend (CURRENT)
- [ ] GraphQL resolvers for authentication
- [ ] Service layer for user management
- [ ] Express.js server setup with Apollo
- [ ] Authentication middleware
- [ ] Drug lookup API integration (RxNorm, FDA)

#### Checkpoint 2: Frontend Auth + Navigation
- [ ] Next.js App Router setup
- [ ] Mantine UI provider configuration
- [ ] Redux store setup
- [ ] Authentication pages (sign in, sign up)
- [ ] Protected route middleware
- [ ] Main navigation layout
- [ ] Home page with dashboard

#### Checkpoint 3: Check-In Flow (First Working Feature)
- [ ] Location management (create/list)
- [ ] Lot creation
- [ ] Drug search (NDC barcode + manual)
- [ ] Unit creation
- [ ] QR code generation
- [ ] Complete check-in workflow end-to-end

#### Checkpoint 4: Check-Out Flow (Second Working Feature)
- [ ] Unit lookup (QR scan + manual)
- [ ] Quantity validation
- [ ] Transaction creation
- [ ] Inventory update
- [ ] Complete check-out workflow end-to-end

#### Checkpoint 5: Remaining Features
- [ ] Scan/Lookup page
- [ ] Inventory page with search, filter, export
- [ ] Reports page with transaction logs
- [ ] Admin page (location management)
- [ ] Settings page (user management, invites)
- [ ] Role-based access control refinement
- [ ] Barcode scanning with camera
- [ ] CSV export functionality
- [ ] Error boundaries and error handling
- [ ] Loading states and optimistic updates

### 📋 Remaining Implementation Tasks

#### Backend Files Needed
1. **GraphQL Resolvers** (7 files)
   - `server/graphql/resolvers/authResolvers.ts`
   - `server/graphql/resolvers/locationResolvers.ts`
   - `server/graphql/resolvers/lotResolvers.ts`
   - `server/graphql/resolvers/unitResolvers.ts`
   - `server/graphql/resolvers/transactionResolvers.ts`
   - `server/graphql/resolvers/drugResolvers.ts`
   - `server/graphql/resolvers/index.ts`

2. **Service Layer** (6 files)
   - `server/services/authService.ts`
   - `server/services/drugService.ts` (RxNorm + FDA integration)
   - `server/services/unitService.ts`
   - `server/services/transactionService.ts`
   - `server/services/locationService.ts`
   - `server/services/clinicService.ts`

3. **Middleware** (3 files)
   - `server/middleware/auth.ts`
   - `server/middleware/errorHandler.ts`
   - `server/middleware/roleCheck.ts`

4. **Main Server** (1 file)
   - `server/index.ts`

#### Frontend Files Needed

1. **Core Setup** (5 files)
   - `src/app/layout.tsx` (root layout with providers)
   - `src/app/page.tsx` (home page)
   - `src/lib/apollo.ts` (Apollo Client setup)
   - `src/lib/mantine.ts` (Mantine theme)
   - `src/store/index.ts` (Redux store)

2. **Store Slices** (3 files)
   - `src/store/authSlice.ts`
   - `src/store/clinicSlice.ts`
   - `src/store/uiSlice.ts`

3. **Shared Components** (8+ files)
   - `src/components/layout/Navigation.tsx`
   - `src/components/layout/Header.tsx`
   - `src/components/layout/ProtectedRoute.tsx`
   - `src/components/shared/BarcodeScanner.tsx`
   - `src/components/shared/QRCodeGenerator.tsx`
   - `src/components/shared/ConfirmModal.tsx`
   - `src/components/shared/SearchDropdown.tsx`
   - `src/components/shared/DataTable.tsx`

4. **Page Components** (10+ files)
   - `src/app/auth/signin/page.tsx`
   - `src/app/auth/signup/page.tsx`
   - `src/app/checkin/page.tsx`
   - `src/app/checkout/page.tsx`
   - `src/app/scan/page.tsx`
   - `src/app/inventory/page.tsx`
   - `src/app/reports/page.tsx`
   - `src/app/admin/page.tsx`
   - `src/app/settings/page.tsx`

5. **Hooks** (5 files)
   - `src/hooks/useAuth.ts`
   - `src/hooks/useToast.ts`
   - `src/hooks/useDebounce.ts`
   - `src/hooks/useCamera.ts`
   - `src/hooks/useQRScanner.ts`

6. **Utilities** (3 files)
   - `src/utils/validation.ts`
   - `src/utils/formatting.ts`
   - `src/utils/export.ts` (CSV export)

### 🎯 Implementation Strategy

#### Phase 1: Backend Foundation
1. Create all GraphQL resolvers
2. Build service layer with Supabase integration
3. Implement drug lookup APIs (RxNorm, FDA)
4. Set up Express server with middleware
5. Test auth flow with Postman/GraphQL Playground

#### Phase 2: Frontend Foundation
1. Set up Next.js app router structure
2. Configure Mantine UI + Redux
3. Build authentication pages
4. Create protected route wrapper
5. Build main navigation and layout
6. Create home page dashboard

#### Phase 3: Check-In Feature (End-to-End)
1. Admin: Location creation page
2. Check-in: Lot creation form
3. Check-in: Drug search (NDC + manual)
4. Check-in: Unit creation form
5. QR code generation
6. Complete flow testing

#### Phase 4: Check-Out Feature (End-to-End)
1. Check-out: Unit lookup (QR scan + manual search)
2. Check-out: Dispense form with validation
3. Transaction creation
4. Inventory update verification
5. Complete flow testing

#### Phase 5: Polish & Remaining Features
1. Scan/Lookup page
2. Inventory management page
3. Reports and transaction logs
4. Settings and user management
5. Role-based access control
6. CSV exports
7. Error handling and loading states
8. Performance optimization

### 📝 Manual Steps Required

1. **Supabase Setup**
   - ✅ Project created
   - ⚠️ **ACTION REQUIRED**: Run `supabase-schema.sql` in SQL Editor
   - [ ] Enable Google OAuth in Supabase Auth settings

2. **Environment Variables**
   - ✅ NEXT_PUBLIC_SUPABASE_URL
   - ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
   - ✅ NEXT_PUBLIC_GOOGLE_CLIENT_ID
   - ⚠️ **TODO**: Add SUPABASE_SERVICE_KEY (get from Supabase dashboard > Settings > API)
   - ⚠️ **TODO**: Add JWT_SECRET (generate a random string)

3. **Google OAuth Setup** (if using)
   - In Supabase dashboard: Authentication > Providers > Google
   - Enable Google provider
   - Add the Google Client ID from .env.local
   - Add Google Client Secret (you'll need to get this from Google Cloud Console)

### 🔧 How to Implement Remaining Features

#### Drug Lookup Integration
```typescript
// server/services/drugService.ts implementation
- Use axios to call RxNorm API: https://rxnav.nlm.nih.gov/REST/
- Normalize NDC codes (10 to 11 digits)
- Search by NDC: /REST/ndcstatus.json?ndc={ndc}
- Search by name: /REST/drugs.json?name={name}
- Fallback to openFDA API if RxNorm fails
- Cache results in drugs table
```

#### Barcode Scanning
```typescript
// Use html5-qrcode library for camera access
- Request camera permissions
- Initialize QR scanner
- Handle NDC barcode formats
- Implement retry logic (3 attempts)
- Fallback to manual entry
- Photo upload option
```

#### CSV Export
```typescript
// Use Papa Parse or custom CSV generator
- Convert JSON data to CSV format
- Include all relevant columns
- Trigger browser download
- Maintain data privacy (no PHI in exports without authorization)
```

#### Role-Based Access Control
```typescript
// Middleware approach:
- Check user role from JWT token
- Protect GraphQL mutations based on role
- Protect frontend routes with role checks
- Hide/disable UI elements based on permissions
```

### 🚨 Potential Issues & Solutions

1. **Issue**: Supabase RLS policies might be too restrictive
   - **Solution**: Test with service role key first, then enable RLS

2. **Issue**: Apollo Server v4 is deprecated
   - **Solution**: Already using it, will work fine; can upgrade to v5 later

3. **Issue**: Camera access for barcode scanning on web
   - **Solution**: Requires HTTPS in production; works on localhost

4. **Issue**: Large bundle size with all dependencies
   - **Solution**: Use Next.js code splitting and dynamic imports

### 📊 Estimated Remaining Work

- **Backend**: ~15 files, ~2000 lines of code
- **Frontend**: ~30 files, ~3500 lines of code
- **Total**: ~45 files remaining, ~5500 lines of code

### ✅ Testing Checklist

- [ ] User can sign up and create a clinic
- [ ] User can sign in with existing credentials
- [ ] Admin can create locations
- [ ] User can create lots linked to locations
- [ ] User can search drugs by NDC
- [ ] User can create units with drug data
- [ ] QR codes are generated for units
- [ ] User can scan/lookup units by QR code
- [ ] User can check out units
- [ ] Inventory decrements correctly
- [ ] Transactions are recorded
- [ ] Only clinic data is visible (RLS works)
- [ ] Superadmin can edit data
- [ ] Admin has read-only access
- [ ] Employee has limited access
- [ ] CSV export works
- [ ] No TypeScript errors
- [ ] No sensitive data in network logs

### 🎯 Success Metrics

1. **Security**: Zero PHI exposure, working RLS policies
2. **Functionality**: All core flows work end-to-end
3. **Type Safety**: Zero TypeScript errors
4. **Performance**: Page loads < 2 seconds
5. **UX**: Intuitive interface for non-technical users
6. **Compliance**: HIPAA-compliant architecture

---

**Next Steps**: Continue building backend resolvers and services, then move to frontend implementation with working checkpoints.
