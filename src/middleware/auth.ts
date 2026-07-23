import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { getDatabaseContext } from '../database';
import { UserRole } from '../config/constants';

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

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Accept token from Authorization header OR ?token= query param (SSE fallback)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  const raw = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : queryToken ?? null;

  if (!raw) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  // getDatabaseContext is now async — we resolve it then verify
  getDatabaseContext()
    .then(dbContext => {
      const authService = new AuthService(dbContext);
      const decoded = authService.verifyToken(raw);
      req.user = decoded;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid or expired token' });
    });
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
