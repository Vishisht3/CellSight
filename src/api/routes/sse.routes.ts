import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../../middleware/auth';
import { sseService } from '../../services/SseService';
import { getDatabaseContext } from '../../database';

const router = Router();

/**
 * GET /api/sse/alerts
 *
 * Opens a Server-Sent Events stream for the authenticated user.
 *
 * Last-Event-ID replay
 * ─────────────────────
 * If the client sends a Last-Event-ID header (the outbox row ID it last
 * received), the server replays all undelivered outbox events created
 * after that ID before handing the connection to the live stream.
 * This closes the gap for clients that reconnect after a brief
 * disconnection — they will not miss any events that fired while they
 * were gone.
 *
 * Events
 * ──────
 *   event: connected      — sent immediately on connect
 *   event: alert          — new alert created
 *   event: alert:ack      — alert acknowledged
 *   event: alert:resolve  — alert resolved
 *   : heartbeat           — comment line every 25 s, keeps proxies alive
 *
 * Fallback
 * ────────
 * If SSE is blocked (strict proxies, some mobile networks) the frontend
 * useAlertFeed hook falls back to polling GET /api/alerts automatically.
 */
router.get('/alerts', authenticate, async (req: Request, res: Response) => {
  const clientId    = uuidv4();
  const userId      = req.user!.userId;
  const orgId       = req.user!.organizationId;
  const lastEventId = req.headers['last-event-id'] as string | undefined;

  // Open the SSE connection immediately so the browser doesn't time out
  // while we are replaying missed events.
  sseService.add(clientId, userId, res);

  // ── Replay missed events ────────────────────────────────────────────────
  if (lastEventId) {
    try {
      const ctx = await getDatabaseContext();

      // Fetch all outbox rows for this org that were created after the
      // last event the client acknowledges.  Rows are ordered oldest-first
      // so the client receives them in the original creation order.
      const missed = ctx.db.prepare(`
        SELECT id, event_type, payload, created_at
        FROM   outbox_events
        WHERE  organization_id = ?
          AND  created_at > (
                 SELECT created_at FROM outbox_events WHERE id = ?
               )
        ORDER BY created_at ASC
        LIMIT 200
      `).all(orgId, lastEventId) as Array<{
        id: string; event_type: string; payload: string; created_at: string;
      }>;

      for (const row of missed) {
        if (res.writableEnded) break;
        try {
          const data = JSON.parse(row.payload);
          // Write with id: so the browser updates its lastEventId automatically
          res.write(`id: ${row.id}\nevent: ${row.event_type}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Malformed payload — skip
        }
      }
    } catch (err) {
      // DB unavailable — continue without replay rather than dropping the connection
    }
  }
});

export default router;
