import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../../middleware/auth';
import { sseService } from '../../services/SseService';

const router = Router();

/**
 * GET /api/sse/alerts
 *
 * Opens a Server-Sent Events stream for the authenticated user.
 * The client receives:
 *   event: connected  — immediately on connect
 *   event: alert      — when a new alert is created
 *   event: alert:ack  — when an alert is acknowledged
 *   event: alert:resolve — when an alert is resolved
 *   : heartbeat       — every 25 s (comment line, no event fired)
 *
 * If the platform doesn't support persistent connections the client
 * falls back to polling /api/alerts automatically (see useAlertFeed hook).
 */
router.get('/alerts', authenticate, (req: Request, res: Response) => {
  const clientId = uuidv4();
  const userId   = req.user!.userId;
  sseService.add(clientId, userId, res);
});

export default router;
