// DaanaRx Type Definitions
// Strict TypeScript types for the entire application

export type UserRole = 'superadmin' | 'admin' | 'employee';
export type TempType = 'fridge' | 'room_temp';
export type TransactionType = 'adjust' | 'check_out' | 'check_in';
export type InvitationStatus = 'invited' | 'accepted' | 'expired';
export type StrengthUnit = string; // mg, g, mcg, etc.
export type DrugForm = string; // tablet, capsule, liquid, etc.

export interface User {
  userId: string;
  username: string;
  password: string;
  clinicId: string;
  userRole: UserRole;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Clinic {
  clinicId: string;
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invitation {
  invitationId: string;
  email: string;
  clinicId: string;
  clinic?: Clinic;
  invitedBy: string;
  invitedByUser?: {
    userId: string;
    username: string;
    email: string;
  };
  userRole: string;
  status: InvitationStatus;
  invitationToken: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface Location {
  locationId: string;
  name: string;
  temp: TempType;
  clinicId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lot {
  lotId: string;
  source: string;
  note?: string;
  dateCreated: Date;
  locationId: string;
  clinicId: string;
}

export interface Drug {
  drugId: string;
  medicationName: string;
  genericName: string;
  strength: number;
  strengthUnit: StrengthUnit;
  ndcId: string;
  form: DrugForm;
}

export interface Unit {
  unitId: string;
  totalQuantity: number;
  availableQuantity: number;
  patientReferenceId?: string;
  lotId: string;
  expiryDate: Date;
  dateCreated: Date;
  userId: string;
  drug: Drug;
  drugId: string;
  qrCode?: string;
  optionalNotes?: string;
  clinicId: string;
  lot: Lot;
  user: User;
}

export interface Transaction {
  transactionId: string;
  timestamp: Date;
  type: TransactionType;
  quantity: number;
  unitId: string;
  patientName?: string;
  patientReferenceId?: string;
  userId: string;
  notes?: string;
  clinicId: string;
}

// API Request/Response types
export interface SignUpRequest {
  email: string;
  password: string;
  clinicName: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  clinic: Clinic;
  token: string;
}

export interface CreateLotRequest {
  source: string;
  note?: string;
  locationId: string;
}

export interface CreateUnitRequest {
  totalQuantity: number;
  availableQuantity: number;
  lotId: string;
  expiryDate: string;
  drugId?: string;
  drugData?: {
    medicationName: string;
    genericName: string;
    strength: number;
    strengthUnit: string;
    ndcId: string;
    form: string;
  };
  optionalNotes?: string;
}

export interface CheckOutRequest {
  unitId: string;
  quantity: number;
  patientName?: string;
  patientReferenceId?: string;
  notes?: string;
}

export interface DrugSearchResult {
  drugId?: string;
  medicationName: string;
  genericName: string;
  strength: number;
  strengthUnit: string;
  ndcId: string;
  form: string;
  inInventory?: boolean;
}

export interface DashboardStats {
  totalUnits: number;
  unitsExpiringSoon: number;
  recentCheckIns: number;
  recentCheckOuts: number;
  lowStockAlerts: number;
}

// GraphQL specific types
export interface GraphQLContext {
  user?: User;
  clinic?: Clinic;
}

// Frontend UI types
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: React.ReactNode;
}
