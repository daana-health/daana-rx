export const typeDefs = `#graphql
  scalar Date
  scalar DateTime

  type User {
    userId: ID!
    username: String!
    email: String!
    clinicId: ID!
    userRole: UserRole!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Clinic {
    clinicId: ID!
    name: String!
    primaryColor: String
    secondaryColor: String
    logoUrl: String
    userRole: UserRole
    joinedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Invitation {
    invitationId: ID!
    email: String!
    clinicId: ID!
    clinic: Clinic!
    invitedBy: ID!
    invitedByUser: User!
    userRole: String!
    status: InvitationStatus!
    invitationToken: ID!
    createdAt: DateTime!
    expiresAt: DateTime!
    acceptedAt: DateTime
  }

  enum InvitationStatus {
    invited
    accepted
    expired
  }

  type Location {
    locationId: ID!
    name: String!
    temp: TempType!
    clinicId: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Lot {
    lotId: ID!
    source: String!
    note: String
    dateCreated: DateTime!
    locationId: ID!
    clinicId: ID!
    maxCapacity: Int
    currentCapacity: Int
    availableCapacity: Int
    location: Location
  }

  type Drug {
    drugId: ID!
    medicationName: String!
    genericName: String!
    strength: Float!
    strengthUnit: String!
    ndcId: String!
    form: String!
    inInventory: Boolean
  }

  type Unit {
    unitId: ID!
    totalQuantity: Int!
    availableQuantity: Int!
    patientReferenceId: String
    lotId: ID!
    expiryDate: Date!
    dateCreated: DateTime!
    userId: ID!
    drugId: ID!
    qrCode: String
    optionalNotes: String
    manufacturerLotNumber: String
    clinicId: ID!
    drug: Drug!
    lot: Lot!
    user: User!
  }

  type Transaction {
    transactionId: ID!
    timestamp: DateTime!
    type: TransactionType!
    quantity: Int!
    unitId: ID!
    patientName: String
    patientReferenceId: String
    userId: ID!
    notes: String
    clinicId: ID!
    unit: Unit
    user: User
  }

  type AuthPayload {
    token: String!
    user: User!
    clinic: Clinic!
  }

  type DashboardStats {
    totalUnits: Int!
    unitsExpiringSoon: Int!
    recentCheckIns: Int!
    recentCheckOuts: Int!
    lowStockAlerts: Int!
  }

  type DrugSearchResult {
    drugId: ID
    medicationName: String!
    genericName: String!
    strength: Float!
    strengthUnit: String!
    ndcId: String!
    form: String!
    inInventory: Boolean
  }

  type PaginatedUnits {
    units: [Unit!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type PaginatedTransactions {
    transactions: [Transaction!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  enum UserRole {
    superadmin
    admin
    employee
  }

  enum TempType {
    fridge
    room_temp
  }

  enum TransactionType {
    adjust
    check_out
    check_in
  }

  enum FeedbackType {
    Feature_Request
    Bug
    Other
  }

  input SignUpInput {
    email: String!
    password: String!
    clinicName: String!
  }

  input SignInInput {
    email: String!
    password: String!
  }

  input SendInvitationInput {
    email: String!
    userRole: String!
  }

  input AcceptInvitationInput {
    invitationToken: ID!
    password: String!
  }

  input CreateLocationInput {
    name: String!
    temp: TempType!
  }

  input UpdateLocationInput {
    locationId: ID!
    name: String
    temp: TempType
  }

  input CreateLotInput {
    source: String!
    note: String
    locationId: ID!
    maxCapacity: Int
  }

  input DrugInput {
    medicationName: String!
    genericName: String!
    strength: Float!
    strengthUnit: String!
    ndcId: String!
    form: String!
  }

  input CreateUnitInput {
    totalQuantity: Int!
    availableQuantity: Int!
    lotId: ID!
    expiryDate: Date!
    drugId: ID
    drugData: DrugInput
    optionalNotes: String
    manufacturerLotNumber: String
  }

  input CheckOutInput {
    unitId: ID!
    quantity: Int!
    patientName: String
    patientReferenceId: String
    notes: String
  }

  input FEFOCheckOutInput {
    ndcId: String
    medicationName: String
    strength: Float
    strengthUnit: String
    quantity: Int!
    patientName: String
    patientReferenceId: String
    notes: String
  }

  type FEFOUnitUsed {
    unitId: ID!
    quantityTaken: Int!
    expiryDate: Date!
    medicationName: String!
  }

  type FEFOCheckOutResult {
    transactions: [Transaction!]!
    totalQuantityDispensed: Int!
    unitsUsed: [FEFOUnitUsed!]!
  }

  input UpdateUnitInput {
    unitId: ID!
    totalQuantity: Int
    availableQuantity: Int
    expiryDate: Date
    optionalNotes: String
  }

  input UpdateTransactionInput {
    transactionId: ID!
    quantity: Int
    notes: String
  }

  input InviteUserInput {
    email: String!
    username: String!
    userRole: UserRole!
  }

  input CreateClinicInput {
    name: String!
  }

  input CreateFeedbackInput {
    feedbackType: FeedbackType!
    feedbackMessage: String!
  }

  type EmailCheckResult {
    exists: Boolean!
    message: String!
  }

  type Feedback {
    feedbackId: ID!
    clinicId: ID!
    userId: ID!
    feedbackType: FeedbackType!
    feedbackMessage: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Query {
    # Auth
    me: User!
    checkEmailExists(email: String!): EmailCheckResult!

    # Dashboard
    getDashboardStats(clinicId: ID): DashboardStats!

    # Locations
    getLocations: [Location!]!
    getLocation(locationId: ID!): Location

    # Lots
    getLots: [Lot!]!
    getLot(lotId: ID!): Lot

    # Drugs
    searchDrugs(query: String!): [DrugSearchResult!]!
    searchDrugByNDC(ndc: String!): DrugSearchResult
    getDrug(drugId: ID!): Drug

    # Units
    getUnits(page: Int, pageSize: Int, search: String): PaginatedUnits!
    getUnit(unitId: ID!): Unit
    searchUnitsByQuery(query: String!): [Unit!]!

    # Transactions
    getTransactions(page: Int, pageSize: Int, search: String, unitId: ID): PaginatedTransactions!
    getTransaction(transactionId: ID!): Transaction

    # Users
    getUsers: [User!]!

    # Invitations
    getInvitations: [Invitation!]!
    getInvitationByToken(invitationToken: ID!): Invitation

    # Clinic
    getClinic: Clinic!
    getUserClinics: [Clinic!]!
  }

  type Mutation {
    # Auth
    signUp(input: SignUpInput!): AuthPayload!
    signIn(input: SignInInput!): AuthPayload!
    inviteUser(input: InviteUserInput!): User!

    # Invitations
    sendInvitation(input: SendInvitationInput!): Invitation!
    acceptInvitation(input: AcceptInvitationInput!): AuthPayload!
    resendInvitation(invitationId: ID!): Invitation!
    cancelInvitation(invitationId: ID!): Boolean!

    # Locations
    createLocation(input: CreateLocationInput!): Location!
    updateLocation(input: UpdateLocationInput!): Location!
    deleteLocation(locationId: ID!): Boolean!

    # Lots
    createLot(input: CreateLotInput!): Lot!

    # Units
    createUnit(input: CreateUnitInput!): Unit!
    updateUnit(input: UpdateUnitInput!): Unit!

    # Check-out
    checkOutUnit(input: CheckOutInput!): Transaction!
    checkOutMedicationFEFO(input: FEFOCheckOutInput!): FEFOCheckOutResult!

    # Transactions
    updateTransaction(input: UpdateTransactionInput!): Transaction!

    # Clinic
    updateClinic(name: String, primaryColor: String, secondaryColor: String): Clinic!
    createClinic(input: CreateClinicInput!): AuthPayload!
    deleteClinic(clinicId: ID!): Boolean!
    switchClinic(clinicId: ID!): AuthPayload!

    # Feedback
    createFeedback(input: CreateFeedbackInput!): Feedback!
  }
`;
