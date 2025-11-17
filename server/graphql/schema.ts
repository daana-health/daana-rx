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
    unit: Unit!
    user: User!
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
  }

  input CheckOutInput {
    unitId: ID!
    quantity: Int!
    patientName: String
    patientReferenceId: String
    notes: String
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

  type Query {
    # Auth
    me: User!

    # Dashboard
    getDashboardStats: DashboardStats!

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

    # Transactions
    updateTransaction(input: UpdateTransactionInput!): Transaction!

    # Clinic
    updateClinic(name: String, primaryColor: String, secondaryColor: String): Clinic!
  }
`;
