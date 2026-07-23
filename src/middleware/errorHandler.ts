import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  logger.error('Unhandled request error', {
    requestId,
    method:  req.method,
    path:    req.path,
    userId:  (req as any).user?.userId,
    message: error.message,
    // stack only in dev — never in prod logs sent to log drains
    stack:   process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });

  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      requestId,
      details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (error.message?.toLowerCase().includes('not found')) {
    res.status(404).json({ error: error.message, requestId });
    return;
  }

  if (error.message?.toLowerCase().includes('already exists')) {
    res.status(409).json({ error: error.message, requestId });
    return;
  }

  // CORS errors
  if (error.message?.startsWith('CORS:')) {
    res.status(403).json({ error: error.message, requestId });
    return;
  }

  res.status(500).json({
    error:     'Internal server error',
    requestId,
    // Only surface message in dev
    detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
}
