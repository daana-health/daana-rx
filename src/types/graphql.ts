// GraphQL Query/Mutation Response Types
// These types match the GraphQL schema exactly

export interface DrugData {
  drugId?: string;
  medicationName: string;
  genericName: string;
  strength: number;
  strengthUnit: string;
  ndcId: string;
  form: string;
  inInventory?: boolean;
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
  source: string;
  note?: string | null;
  dateCreated: string;
  locationId: string;
  location?: LocationData;
}

export interface UnitData {
  unitId: string;
  totalQuantity: number;
  availableQuantity: number;
  expiryDate: string;
  optionalNotes?: string | null;
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
  patientReferenceId?: string | null;
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
