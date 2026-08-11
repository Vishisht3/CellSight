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
