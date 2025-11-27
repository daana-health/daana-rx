import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken } from '../utils/auth';
import { getUserById, getClinicById } from '../services/authService';
import { GraphQLContext } from '../types/index';
import { supabaseServer } from '../utils/supabase';

// Helper to verify user has access to a clinic
async function verifyUserClinicAccess(userId: string, clinicId: string): Promise<boolean> {
  const { data, error } = await supabaseServer.rpc('get_user_clinics', {
    p_user_id: userId,
  });

  if (error || !data) {
    return false;
  }

  return data.some((clinic: any) => clinic.clinic_id === clinicId);
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);
    const requestedClinicId = req.headers['x-clinic-id'] as string | undefined;

    if (token) {
      const payload = verifyToken(token);
      const user = await getUserById(payload.userId);
      
      if (user) {
        let clinic = null;
        
        // If a specific clinic is requested, verify access and use it
        if (requestedClinicId) {
          const hasAccess = await verifyUserClinicAccess(user.userId, requestedClinicId);
          if (hasAccess) {
            clinic = await getClinicById(requestedClinicId);
          }
        }
        
        // Fall back to user's primary clinic if no valid requested clinic
        if (!clinic) {
          clinic = await getClinicById(user.clinicId);
        }

        if (clinic) {
          (req as any).user = user;
          (req as any).clinic = clinic;
          (req as any).token = token;
        }
      }
    }

    next();
  } catch (error) {
    // Token invalid or expired, continue without auth
    next();
  }
}

export function createGraphQLContext({ req }: { req: any }): GraphQLContext {
  return {
    user: (req as any).user,
    clinic: (req as any).clinic,
    token: (req as any).token,
  };
}

export async function createGraphQLContextFromNextRequest(req: any): Promise<GraphQLContext> {
  try {
    const authHeader = req.headers.get('authorization');
    const requestedClinicId = req.headers.get('x-clinic-id');
    const token = extractToken(authHeader);

    if (token) {
      const payload = verifyToken(token);
      const user = await getUserById(payload.userId);
      
      if (user) {
        let clinic = null;
        
        // If a specific clinic is requested, verify access and use it
        if (requestedClinicId) {
          const hasAccess = await verifyUserClinicAccess(user.userId, requestedClinicId);
          if (hasAccess) {
            clinic = await getClinicById(requestedClinicId);
          }
        }
        
        // Fall back to user's primary clinic if no valid requested clinic
        if (!clinic) {
          clinic = await getClinicById(user.clinicId);
        }

        if (clinic) {
          return { user, clinic, token };
        }
      }
    }
  } catch (error) {
    // Token invalid or expired, return empty context
  }

  return { user: undefined, clinic: undefined, token: undefined };
}
