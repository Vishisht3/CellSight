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
 * If the client sends a Last-Event-ID header the server replays all
 * already-delivered outbox events for this org that were created after
 * that row.  Undelivered rows are excluded — the OutboxPublisher will
 * push them within its next poll interval, avoiding duplicate delivery.
 * A non-matching ID silently returns no rows rather than an error, so
 * stale IDs (e.g. from a different deployment) degrade gracefully.
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
 * If SSE is blocked the frontend useAlertFeed hook falls back to polling
 * GET /api/alerts automatically.
 */
router.get('/alerts', authenticate, async (req: Request, res: Response) => {
  const clientId    = uuidv4();
  const userId      = req.user!.userId;
  const orgId       = req.user!.organizationId;
  const lastEventId = req.headers['last-event-id'] as string | undefined;

  // Open the SSE connection immediately so the browser doesn't time out
  // while we replay missed events.
  sseService.add(clientId, userId, res);

  // ── Replay missed events ────────────────────────────────────────────────
  if (lastEventId) {
    try {
      const ctx = await getDatabaseContext();

      // Only replay delivered rows — undelivered ones will arrive via the
      // OutboxPublisher within its next 2-second poll, preventing duplicates.
      const missed = ctx.outbox.listSince(orgId, lastEventId);

      for (const row of missed) {
        if (res.writableEnded) break;
        try {
          const data = JSON.parse(row.payload);
          res.write(`id: ${row.id}\nevent: ${row.eventType}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Malformed payload — skip and continue
        }
      }
    } catch {
      // DB unavailable — open the connection anyway without replay
    }
  }
});

export default router;
