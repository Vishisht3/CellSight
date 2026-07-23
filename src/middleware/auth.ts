import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { getDatabaseContext } from '../database';
import { UserRole } from '../config/constants';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const dbContext = getDatabaseContext();
    const authService = new AuthService(dbContext);

    const decoded = authService.verifyToken(token);
    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to authorize requests based on user role
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
