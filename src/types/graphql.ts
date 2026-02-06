// GraphQL Query/Mutation Response Types
// These types match the GraphQL schema exactly

export interface DrugData {
  drugId?: string;
  medicationName: string;
  genericName?: string | null;
  strength: number;
  strengthUnit: string;
  ndcId?: string | null;
  form: string;
  inInventory?: boolean;
}

// Batch check-in types
export interface BatchCheckInInput {
  lotId: string;
  medicationName: string;
  dosage: string;
  quantity: number;
  expiryDate?: string | null;
  manufacturerLotNumber?: string | null;
}

export interface BatchCreatedUnit {
  unitId: string;
  qrCode: string;
  totalQuantity: number;
  availableQuantity: number;
  expiryDate?: string | null;
  drug: {
    medicationName: string;
    strength: number;
    strengthUnit: string;
    form: string;
  };
}

// Batch check-out types
export interface BatchCheckOutItem {
  unitId: string;
  quantity: number;
}

export interface BatchCheckOutResult {
  transactions: TransactionData[];
  totalItems: number;
  totalQuantity: number;
}

// Clinic with settings
export interface ClinicWithSettings {
  clinicId: string;
  name: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  requireLotLocation?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationData {
  locationId: string;
  name: string;
  temp: 'fridge' | 'room temp' | 'room_temp';
  createdAt: string;
  updatedAt?: string;
}

export interface LotData {
  lotId: string;
  source?: string | null;
  lotCode?: string | null;
  note?: string | null;
  dateCreated: string;
  locationId: string;
  maxCapacity?: number | null;
  currentCapacity?: number | null;
  availableCapacity?: number | null;
  location?: LocationData;
}

export interface UnitData {
  unitId: string;
  totalQuantity: number;
  availableQuantity: number;
  expiryDate: string;
  optionalNotes?: string | null;
  manufacturerLotNumber?: string | null;
  drug: DrugData;
  lot?: LotData;
  user?: {
    userId: string;
    username: string;
  };
}

export interface TransactionData {
  transactionId: string;
  timestamp: string;
  type: 'check_in' | 'check_out' | 'adjust';
  quantity: number;
  notes?: string | null;
}

export interface UserData {
  userId: string;
  username: string;
  email: string;
  userRole: 'superadmin' | 'admin' | 'employee';
  createdAt: string;
}

// Query Response Types
export interface GetLocationsResponse {
  getLocations: LocationData[];
}

export interface GetLotsResponse {
  getLots: LotData[];
}

export interface SearchDrugByNDCResponse {
  searchDrugByNDC: DrugData | null;
}

export interface SearchDrugsResponse {
  searchDrugs: DrugData[];
}

export interface SearchMedicationsByNameResponse {
  searchMedicationsByName: DrugData[];
}

export interface BatchCreateUnitsResponse {
  batchCreateUnits: BatchCreatedUnit[];
}

export interface BatchCheckOutUnitsResponse {
  batchCheckOutUnits: BatchCheckOutResult;
}

export interface GetUnitResponse {
  getUnit: UnitData | null;
}

export interface SearchUnitsResponse {
  searchUnitsByQuery: UnitData[];
}

export interface GetTransactionsResponse {
  getTransactions: {
    transactions: TransactionData[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface GetUsersResponse {
  getUsers: UserData[];
}

export interface GetDashboardStatsResponse {
  getDashboardStats: {
    totalUnits: number;
    unitsExpiringSoon: number;
    recentCheckIns: number;
    recentCheckOuts: number;
    lowStockAlerts: number;
  };
}

export interface GetUnitsResponse {
  getUnits: {
    units: UnitData[];
    total: number;
    page: number;
    pageSize: number;
  };
}

// Mutation Response Types
export interface CreateLotResponse {
  createLot: LotData;
}

export interface CreateUnitResponse {
  createUnit: UnitData;
}

export interface CheckOutUnitResponse {
  checkOutUnit: TransactionData;
}

export interface CreateLocationResponse {
  createLocation: LocationData;
}

export interface UpdateLocationResponse {
  updateLocation: LocationData;
}

export interface DeleteLocationResponse {
  deleteLocation: boolean;
}

export interface InviteUserResponse {
  inviteUser: UserData;
}

// Auth Types
export interface AuthPayload {
  token: string;
  user: {
    userId: string;
    username: string;
    email: string;
    clinicId: string;
    userRole: 'superadmin' | 'admin' | 'employee';
  };
  clinic: {
    clinicId: string;
    name: string;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    logoUrl?: string | null;
  };
}

export interface SignUpResponse {
  signUp: AuthPayload;
}

export interface SignInResponse {
  signIn: AuthPayload;
}

// Feedback Types
export interface FeedbackData {
  feedbackId: string;
  clinicId: string;
  userId: string;
  feedbackType: 'Feature_Request' | 'Bug' | 'Other';
  feedbackMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeedbackResponse {
  createFeedback: FeedbackData;
}

// Clinic Types
export interface ClinicData {
  clinicId: string;
  name: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetUserClinicsResponse {
  getUserClinics: ClinicData[];
}

export interface CreateClinicResponse {
  createClinic: AuthPayload;
}

export interface DeleteClinicResponse {
  deleteClinic: boolean;
}

export interface SwitchClinicResponse {
  switchClinic: AuthPayload;
}

// Advanced Inventory Query Types
export interface UnitDataWithLocation {
  unitId: string;
  totalQuantity: number;
  availableQuantity: number;
  expiryDate: string;
  optionalNotes?: string | null;
  manufacturerLotNumber?: string | null;
  dateCreated: string;
  drug: DrugData;
  lot: {
    lotId: string;
    source: string;
    note?: string | null;
    dateCreated: string;
    locationId: string;
    clinicId: string;
    location?: LocationData;
  };
  user?: {
    userId: string;
    username: string;
    email: string;
  };
}

export interface GetUnitsAdvancedResponse {
  getUnitsAdvanced: {
    units: UnitDataWithLocation[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface MedicationExpiringData {
  drugId: string;
  medicationName: string;
  genericName: string;
  strength: number;
  strengthUnit: string;
  ndcId: string;
  totalUnits: number;
  totalQuantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  units: UnitDataWithLocation[];
}

export interface GetMedicationsExpiringResponse {
  getMedicationsExpiring: MedicationExpiringData[];
}

export interface ExpiryReportSummaryData {
  expired: number;
  expiring7Days: number;
  expiring30Days: number;
  expiring60Days: number;
  expiring90Days: number;
  total: number;
}

export interface GetExpiryReportResponse {
  getExpiryReport: {
    summary: ExpiryReportSummaryData;
    medications: MedicationExpiringData[];
  };
}

export interface GetInventoryByLocationResponse {
  getInventoryByLocation: UnitDataWithLocation[];
}
