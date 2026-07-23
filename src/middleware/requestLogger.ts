import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Attaches a unique request-ID to every incoming request and logs
 * METHOD path status duration — without echoing auth headers.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    logger[level](`${req.method} ${req.path}`, {
      requestId,
      status:  res.statusCode,
      ms,
      ip:      req.ip,
      userId:  (req as any).user?.userId,
    });
  });

  next();
}
