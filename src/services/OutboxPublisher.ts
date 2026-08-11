/**
 * OutboxPublisher — polls the outbox_events table and delivers
 * undelivered events to connected SSE clients.
 *
 * Why this exists
 * ───────────────
 * AlertService writes two rows atomically:
 *   1. alerts          — the alert record
 *   2. outbox_events   — a pending delivery receipt
 *
 * Because both writes happen in the same synchronous SQLite operation (or the
 * same Postgres connection) they are effectively atomic: if the process crashes
 * after the alert INSERT but before the outbox INSERT, the alert row exists
 * without an outbox row — which is the safe failure mode (no phantom notification
 * without a persisted alert).  The inverse — outbox row with no alert — cannot
 * happen because the alert INSERT runs first inside a try/catch that rethrows.
 *
 * The publisher runs on a short interval, reads undelivered rows, pushes them
 * to SSE clients, and marks them delivered.  If the SSE push fails the row
 * stays undelivered and will be retried on the next tick.
 *
 * This removes the dual-write risk from AlertService completely:
 *   Before: DB write → fire-and-forget SSE push in the same call stack
 *   After:  DB write (atomic with outbox row) → publisher delivers asynchronously
 */

import { DatabaseContext } from '../database';
import { sseService } from './SseService';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 2_000;   // check every 2 s
const BATCH_SIZE       = 50;      // rows per poll cycle
const MAX_ATTEMPTS     = 5;       // give up after 5 failed delivery attempts
const PURGE_INTERVAL   = 60 * 60 * 1000; // purge delivered rows hourly

export class OutboxPublisher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private purgeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private dbContext: DatabaseContext) {}

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);

    // Purge delivered rows that are older than 7 days
    this.purgeTimer = setInterval(() => {
      const deleted = this.dbContext.outbox.purgeDelivered(7);
      if (deleted > 0) logger.info('Outbox: purged delivered rows', { deleted });
    }, PURGE_INTERVAL);

    logger.info('OutboxPublisher started', { pollIntervalMs: POLL_INTERVAL_MS });
  }

  stop(): void {
    if (this.timer)      { clearInterval(this.timer);      this.timer      = null; }
    if (this.purgeTimer) { clearInterval(this.purgeTimer); this.purgeTimer = null; }
    logger.info('OutboxPublisher stopped');
  }

  private tick(): void {
    try {
      const rows = this.dbContext.outbox.listUndelivered(BATCH_SIZE);
      if (rows.length === 0) return;

      for (const row of rows) {
        // Abandon rows that have failed too many times
        if (row.attempts >= MAX_ATTEMPTS) {
          logger.warn('Outbox: abandoning undeliverable event', {
            id: row.id, eventType: row.eventType, attempts: row.attempts,
          });
          // Mark as delivered so it leaves the hot path; the log is the record.
          this.dbContext.outbox.markDelivered(row.id);
          continue;
        }

        try {
          const payload = JSON.parse(row.payload);

          // Broadcast to all SSE clients in the same organization.
          // SseService.broadcast is synchronous and never throws (errors are caught
          // internally), so the only failure mode here is a JSON.parse error above.
          sseService.broadcast(row.eventType, payload, undefined, row.id);

          this.dbContext.outbox.markDelivered(row.id);

          logger.debug('Outbox: delivered event', {
            id: row.id, eventType: row.eventType,
          });
        } catch (err) {
          // JSON parse failed or something unexpected — record the failed attempt
          this.dbContext.outbox.recordFailedAttempt(row.id);
          logger.error('Outbox: delivery failed', { id: row.id, error: err });
        }
      }
    } catch (err) {
      // DB read failed — log and wait for next tick
      logger.error('Outbox: poll failed', { error: err });
    }
  }
}
