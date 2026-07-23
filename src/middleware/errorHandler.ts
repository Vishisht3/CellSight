import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
  });

  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (error.message.includes('not found')) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error.message.includes('already exists')) {
    res.status(409).json({ error: error.message });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
}
