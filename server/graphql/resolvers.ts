import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../types/index';
import * as authService from '../services/authService';
import * as drugService from '../services/drugService';
import * as unitService from '../services/unitService';
import * as transactionService from '../services/transactionService';
import * as locationService from '../services/locationService';
import { invitationService } from '../services/invitationService';
import { supabaseServer } from '../utils/supabase';

// Helper to require authentication
function requireAuth(context: GraphQLContext) {
  if (!context.user || !context.clinic) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return { user: context.user, clinic: context.clinic };
}

// Helper to require specific role
function requireRole(context: GraphQLContext, allowedRoles: string[]) {
  const { user } = requireAuth(context);
  if (!allowedRoles.includes(user.userRole)) {
    throw new GraphQLError('Insufficient permissions', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}

export const resolvers = {
  Query: {
    // Auth
    me: (_: unknown, __: unknown, context: GraphQLContext) => {
      const { user } = requireAuth(context);
      return user;
    },

    checkEmailExists: async (_: unknown, { email }: { email: string }) => {
      return authService.checkEmailExists(email);
    },

    // Dashboard
    getDashboardStats: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return unitService.getDashboardStats(clinic.clinicId);
    },

    // Locations
    getLocations: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return locationService.getLocations(clinic.clinicId);
    },

    getLocation: async (_: unknown, { locationId }: { locationId: string }, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return locationService.getLocationById(locationId, clinic.clinicId);
    },

    // Lots
    getLots: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return locationService.getLots(clinic.clinicId);
    },

    getLot: async (_: unknown, { lotId }: { lotId: string }, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return locationService.getLotById(lotId, clinic.clinicId);
    },

    // Drugs
    searchDrugs: async (
      _: unknown,
      { query }: { query: string },
      context: GraphQLContext
    ) => {
      const { clinic } = requireAuth(context);
      return drugService.searchDrugs(query, clinic.clinicId);
    },

    searchDrugByNDC: async (
      _: unknown,
      { ndc }: { ndc: string },
      context: GraphQLContext
    ) => {
      const { clinic } = requireAuth(context);
      return drugService.searchDrugByNDC(ndc, clinic.clinicId);
    },

    getDrug: async (_: unknown, { drugId }: { drugId: string }) => {
      const { data: drug, error } = await supabaseServer
        .from('drugs')
        .select('*')
        .eq('drug_id', drugId)
        .single();

      if (error || !drug) return null;

      return {
        drugId: drug.drug_id,
        medicationName: drug.medication_name,
        genericName: drug.generic_name,
        strength: drug.strength,
        strengthUnit: drug.strength_unit,
        ndcId: drug.ndc_id,
        form: drug.form,
      };
    },

    // Units
    getUnits: async (
      _: unknown,
      { page, pageSize, search }: { page?: number; pageSize?: number; search?: string },
      context: GraphQLContext
    ) => {
      const { clinic } = requireAuth(context);
      return unitService.getUnits(clinic.clinicId, page, pageSize, search);
    },

    getUnit: async (_: unknown, { unitId }: { unitId: string }, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return unitService.getUnitById(unitId, clinic.clinicId);
    },

    searchUnitsByQuery: async (_: unknown, { query }: { query: string }, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return unitService.searchUnits(query, clinic.clinicId);
    },

    // Transactions
    getTransactions: async (
      _: unknown,
      { page, pageSize, search, unitId }: { page?: number; pageSize?: number; search?: string; unitId?: string },
      context: GraphQLContext
    ) => {
      const { clinic } = requireAuth(context);
      return transactionService.getTransactions(clinic.clinicId, page, pageSize, search, unitId);
    },

    getTransaction: async (_: unknown, { transactionId }: { transactionId: string }, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return transactionService.getTransactionById(transactionId, clinic.clinicId);
    },

    // Users
    getUsers: async (_: unknown, __: unknown, context: GraphQLContext) => {
      requireRole(context, ['superadmin', 'admin']);
      const { clinic } = requireAuth(context);
      return authService.getUsersByClinicId(clinic.clinicId);
    },

    // Invitations
    getInvitations: async (_: unknown, __: unknown, context: GraphQLContext) => {
      requireRole(context, ['superadmin', 'admin']);
      const { clinic } = requireAuth(context);
      return invitationService.getInvitations(clinic.clinicId);
    },

    getInvitationByToken: async (_: unknown, { invitationToken }: { invitationToken: string }) => {
      return invitationService.getInvitationByToken(invitationToken);
    },

    // Clinic
    getClinic: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const { clinic } = requireAuth(context);
      return clinic;
    },

    getUserClinics: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const { user } = requireAuth(context);

      // Use the SQL function to get all clinics for the user
      const { data: clinics, error } = await supabaseServer.rpc('get_user_clinics', {
        p_user_id: user.userId,
      });

      if (error) {
        console.error('Error fetching user clinics:', error);
        throw new GraphQLError('Failed to fetch user clinics');
      }

      // Transform the response to match the Clinic type
      return (clinics || []).map((clinic: any) => ({
        clinicId: clinic.clinic_id,
        name: clinic.clinic_name,
        primaryColor: clinic.primary_color,
        secondaryColor: clinic.secondary_color,
        logoUrl: clinic.logo_url,
        createdAt: clinic.created_at ? new Date(clinic.created_at) : new Date(),
        updatedAt: clinic.updated_at ? new Date(clinic.updated_at) : new Date(),
      }));
    },
  },

  Mutation: {
    // Auth
    signUp: async (_: unknown, { input }: { input: { email: string; password: string; clinicName: string } }) => {
      return authService.signUp(input.email, input.password, input.clinicName);
    },

    signIn: async (_: unknown, { input }: { input: { email: string; password: string } }) => {
      try {
        console.log('Sign in resolver called with email:', input.email);
        const result = await authService.signIn(input.email, input.password);
        console.log('Sign in resolver successful');
        return result;
      } catch (error: any) {
        console.error('Sign in resolver error:', {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
        });
        // Preserve the original error message
        const errorMessage = error?.message || 'Sign in failed';
        throw new GraphQLError(errorMessage, {
          extensions: { 
            code: 'UNAUTHENTICATED',
            originalError: error?.message,
          },
        });
      }
    },

    inviteUser: async (
      _: unknown,
      { input }: { input: { email: string; username: string; userRole: 'admin' | 'employee' } },
      context: GraphQLContext
    ) => {
      requireRole(context, ['superadmin', 'admin']);
      const { clinic } = requireAuth(context);
      return authService.inviteUser(input.email, input.username, input.userRole, clinic.clinicId);
    },

    // Invitations (only superadmins can invite users to support multi-clinic access)
    sendInvitation: async (
      _: unknown,
      { input }: { input: { email: string; userRole: string } },
      context: GraphQLContext
    ) => {
      requireRole(context, ['superadmin']);
      const { user, clinic } = requireAuth(context);
      return invitationService.sendInvitation({
        email: input.email,
        userRole: input.userRole,
        clinicId: clinic.clinicId,
        invitedBy: user.userId,
      });
    },

    acceptInvitation: async (
      _: unknown,
      { input }: { input: { invitationToken: string; password: string } }
    ) => {
      const result = await invitationService.acceptInvitation({
        invitationToken: input.invitationToken,
        password: input.password,
      });
      return {
        token: result.token,
        user: result.user,
        clinic: result.clinic,
      };
    },

    resendInvitation: async (
      _: unknown,
      { invitationId }: { invitationId: string },
      context: GraphQLContext
    ) => {
      requireRole(context, ['superadmin']);
      const { clinic } = requireAuth(context);
      return invitationService.resendInvitation(invitationId, clinic.clinicId);
    },

    cancelInvitation: async (
      _: unknown,
      { invitationId }: { invitationId: string },
      context: GraphQLContext
    ) => {
      requireRole(context, ['superadmin']);
      const { clinic } = requireAuth(context);
      return invitationService.cancelInvitation(invitationId, clinic.clinicId);
    },

    // Locations
    createLocation: async (
      _: unknown,
      { input }: { input: { name: string; temp: 'fridge' | 'room_temp' } },
      context: GraphQLContext
    ) => {
      requireRole(context, ['superadmin', 'admin']);
      const { clinic } = requireAuth(context);
      return locationService.createLocation(input.name, input.temp, clinic.clinicId);
    },

    updateLocation: async (
      _: unknown,
      { input }: { input: { locationId: string; name?: string; temp?: 'fridge' | 'room_temp' } },
      context: GraphQLContext
    ) => {
      requireRole(context, ['superadmin']);
      const { clinic } = requireAuth(context);
      const updates: { name?: string; temp?: 'fridge' | 'room_temp' } = {};
      if (input.name) updates.name = input.name;
      if (input.temp) updates.temp = input.temp;
      return locationService.updateLocation(input.locationId, updates, clinic.clinicId);
    },

    deleteLocation: async (_: unknown, { locationId }: { locationId: string }, context: GraphQLContext) => {
      requireRole(context, ['superadmin']);
      const { clinic } = requireAuth(context);
      return locationService.deleteLocation(locationId, clinic.clinicId);
    },

    // Lots
    createLot: async (
      _: unknown,
      { input }: { input: { source: string; note?: string; locationId: string } },
      context: GraphQLContext
    ) => {
      const { clinic } = requireAuth(context);
      return locationService.createLot(input.source, input.locationId, clinic.clinicId, input.note);
    },

    // Units
    createUnit: async (_: unknown, { input }: { input: any }, context: GraphQLContext) => {
      const { user, clinic } = requireAuth(context);
      return unitService.createUnit(input, user.userId, clinic.clinicId);
    },

    updateUnit: async (_: unknown, { input }: { input: any }, context: GraphQLContext) => {
      requireRole(context, ['superadmin']);
      const { clinic } = requireAuth(context);
      return unitService.updateUnit(input.unitId, input, clinic.clinicId);
    },

    // Check-out
    checkOutUnit: async (_: unknown, { input }: { input: any }, context: GraphQLContext) => {
      const { user, clinic } = requireAuth(context);
      return transactionService.checkOutUnit(input, user.userId, clinic.clinicId);
    },

    // Transactions
    updateTransaction: async (_: unknown, { input }: { input: any }, context: GraphQLContext) => {
      requireRole(context, ['superadmin']);
      const { clinic } = requireAuth(context);
      return transactionService.updateTransaction(input.transactionId, input, clinic.clinicId);
    },

    // Clinic
    updateClinic: async (
      _: unknown,
      { name, primaryColor, secondaryColor }: { name?: string; primaryColor?: string; secondaryColor?: string },
      context: GraphQLContext
    ) => {
      requireRole(context, ['superadmin']);
      const { clinic } = requireAuth(context);

      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (primaryColor) updates.primary_color = primaryColor;
      if (secondaryColor) updates.secondary_color = secondaryColor;

      const { data: updatedClinic, error } = await supabaseServer
        .from('clinics')
        .update(updates)
        .eq('clinic_id', clinic.clinicId)
        .select()
        .single();

      if (error || !updatedClinic) {
        throw new GraphQLError('Failed to update clinic');
      }

      return {
        clinicId: updatedClinic.clinic_id,
        name: updatedClinic.name,
        primaryColor: updatedClinic.primary_color,
        secondaryColor: updatedClinic.secondary_color,
        logoUrl: updatedClinic.logo_url,
        createdAt: new Date(updatedClinic.created_at),
        updatedAt: new Date(updatedClinic.updated_at),
      };
    },

    createClinic: async (
      _: unknown,
      { input }: { input: { name: string; password: string } },
      context: GraphQLContext
    ) => {
      const { user } = requireAuth(context);
      return authService.createClinic(user.userId, input.name, input.password);
    },
  },
};
