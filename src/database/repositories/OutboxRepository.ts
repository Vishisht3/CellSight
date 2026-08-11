import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';

export interface OutboxEvent {
  id: string;
  eventType: string;
  payload: string;       // JSON-serialised
  organizationId: string;
  createdAt: string;
  deliveredAt: string | null;
  attempts: number;
}

export class OutboxRepository {
  constructor(private db: DbDriver) {}

  /** Write one event row.  Called inside the same synchronous DB operation
   *  as the alert INSERT so both land in the same SQLite write transaction. */
  create(eventType: string, payload: unknown, organizationId: string): OutboxEvent {
    const row: OutboxEvent = {
      id: uuidv4(),
      eventType,
      payload: JSON.stringify(payload),
      organizationId,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      attempts: 0,
    };
    this.db.prepare(`
      INSERT INTO outbox_events
        (id, event_type, payload, organization_id, created_at, delivered_at, attempts)
      VALUES (?, ?, ?, ?, ?, NULL, 0)
    `).run(row.id, row.eventType, row.payload, row.organizationId, row.createdAt);
    return row;
  }

  /** Fetch up to `limit` rows that have not been delivered yet,
   *  ordered oldest-first so we publish in creation order. */
  listUndelivered(limit = 100): OutboxEvent[] {
    return this.db.prepare(`
      SELECT id, event_type as eventType, payload,
             organization_id as organizationId,
             created_at as createdAt,
             delivered_at as deliveredAt,
             attempts
      FROM outbox_events
      WHERE delivered_at IS NULL
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit) as OutboxEvent[];
  }

  /**
   * Fetch delivered rows for a given org created after a reference event.
   * Used by the SSE reconnect replay: already-delivered rows are replayed
   * to the reconnecting client; undelivered rows will be pushed by the
   * OutboxPublisher shortly and are excluded to avoid duplicate delivery.
   *
   * If sinceEventId does not match any row, the inner SELECT returns NULL
   * and the outer `created_at > NULL` condition is false — no rows are
   * returned.  This is the correct silent no-op for an unrecognised ID.
   */
  listSince(organizationId: string, sinceEventId: string, limit = 200): OutboxEvent[] {
    return this.db.prepare(`
      SELECT id, event_type as eventType, payload,
             organization_id as organizationId,
             created_at as createdAt,
             delivered_at as deliveredAt,
             attempts
      FROM outbox_events
      WHERE organization_id = ?
        AND delivered_at IS NOT NULL
        AND created_at > (
              SELECT created_at FROM outbox_events WHERE id = ?
            )
      ORDER BY created_at ASC
      LIMIT ?
    `).all(organizationId, sinceEventId, limit) as OutboxEvent[];
  }

  /** Mark a row as successfully delivered. */
  markDelivered(id: string): void {
    this.db.prepare(`
      UPDATE outbox_events
      SET delivered_at = ?, attempts = attempts + 1
      WHERE id = ?
    `).run(new Date().toISOString(), id);
  }

  /** Increment the attempt counter without marking delivered (for retries). */
  recordFailedAttempt(id: string): void {
    this.db.prepare(`
      UPDATE outbox_events SET attempts = attempts + 1 WHERE id = ?
    `).run(id);
  }

  /** Remove rows delivered more than `daysToKeep` days ago. */
  purgeDelivered(daysToKeep = 7): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const result = this.db.prepare(`
      DELETE FROM outbox_events
      WHERE delivered_at IS NOT NULL AND delivered_at < ?
    `).run(cutoff.toISOString());
    return result.changes;
  }
}
