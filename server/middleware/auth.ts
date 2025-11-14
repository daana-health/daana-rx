import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken } from '../utils/auth';
import { getUserById, getClinicById } from '../services/authService';
import { GraphQLContext } from '../types/index';

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);

    if (token) {
      const payload = verifyToken(token);
      const user = await getUserById(payload.userId);
      const clinic = user ? await getClinicById(user.clinicId) : null;

      if (user && clinic) {
        (req as any).user = user;
        (req as any).clinic = clinic;
        (req as any).token = token;
      }
    }

    next();
  } catch (error) {
    // Token invalid or expired, continue without auth
    next();
  }
}

export function createGraphQLContext({ req }: { req: Request }): GraphQLContext {
  return {
    user: (req as any).user,
    clinic: (req as any).clinic,
    token: (req as any).token,
  };
}
