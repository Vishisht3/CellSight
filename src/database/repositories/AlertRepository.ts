import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertCreateInput } from '../../models/types';
import { AlertStatus } from '../../config/constants';

export class AlertRepository {
  constructor(private db: Database.Database) {}

  create(input: AlertCreateInput): Alert {
    const now = new Date().toISOString();
    const alert: Alert = {
      id: uuidv4(),
      type: input.type,
      severity: input.severity,
      sourceAgent: input.sourceAgent,
      assetId: input.assetId || null,
      supplierId: input.supplierId || null,
      cellBatchId: input.cellBatchId || null,
      title: input.title,
      description: input.description,
      status: AlertStatus.OPEN,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      metadata: JSON.stringify(input.metadata || {}),
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO alerts (
        id, type, severity, source_agent, asset_id, supplier_id, cell_batch_id,
        title, description, status, acknowledged_by, acknowledged_at,
        resolved_by, resolved_at, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      alert.id,
      alert.type,
      alert.severity,
      alert.sourceAgent,
      alert.assetId,
      alert.supplierId,
      alert.cellBatchId,
      alert.title,
      alert.description,
      alert.status,
      alert.acknowledgedBy,
      alert.acknowledgedAt,
      alert.resolvedBy,
      alert.resolvedAt,
      alert.metadata,
      alert.createdAt,
      alert.updatedAt
    );

    return alert;
  }

  findById(id: string): Alert | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, type, severity, source_agent as sourceAgent,
        asset_id as assetId, supplier_id as supplierId, cell_batch_id as cellBatchId,
        title, description, status,
        acknowledged_by as acknowledgedBy, acknowledged_at as acknowledgedAt,
        resolved_by as resolvedBy, resolved_at as resolvedAt,
        metadata, created_at as createdAt, updated_at as updatedAt
      FROM alerts 
      WHERE id = ?
    `);

    return stmt.get(id) as Alert | undefined || null;
  }

  list(status?: AlertStatus, limit = 100): Alert[] {
    let query = `
      SELECT 
        id, type, severity, source_agent as sourceAgent,
        asset_id as assetId, supplier_id as supplierId, cell_batch_id as cellBatchId,
        title, description, status,
        acknowledged_by as acknowledgedBy, acknowledged_at as acknowledgedAt,
        resolved_by as resolvedBy, resolved_at as resolvedAt,
        metadata, created_at as createdAt, updated_at as updatedAt
      FROM alerts
    `;

    if (status) {
      query += ` WHERE status = ?`;
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;

    const stmt = this.db.prepare(query);
    const params = status ? [status, limit] : [limit];

    return stmt.all(...params) as Alert[];
  }

  listByAsset(assetId: string, limit = 50): Alert[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, type, severity, source_agent as sourceAgent,
        asset_id as assetId, supplier_id as supplierId, cell_batch_id as cellBatchId,
        title, description, status,
        acknowledged_by as acknowledgedBy, acknowledged_at as acknowledgedAt,
        resolved_by as resolvedBy, resolved_at as resolvedAt,
        metadata, created_at as createdAt, updated_at as updatedAt
      FROM alerts 
      WHERE asset_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(assetId, limit) as Alert[];
  }

  listBySupplier(supplierId: string, limit = 50): Alert[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, type, severity, source_agent as sourceAgent,
        asset_id as assetId, supplier_id as supplierId, cell_batch_id as cellBatchId,
        title, description, status,
        acknowledged_by as acknowledgedBy, acknowledged_at as acknowledgedAt,
        resolved_by as resolvedBy, resolved_at as resolvedAt,
        metadata, created_at as createdAt, updated_at as updatedAt
      FROM alerts 
      WHERE supplier_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(supplierId, limit) as Alert[];
  }

  acknowledge(id: string, userId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE alerts 
      SET status = ?, acknowledged_by = ?, acknowledged_at = ?, updated_at = ?
      WHERE id = ? AND status = ?
    `);

    const result = stmt.run(
      AlertStatus.ACKNOWLEDGED,
      userId,
      new Date().toISOString(),
      new Date().toISOString(),
      id,
      AlertStatus.OPEN
    );

    return result.changes > 0;
  }

  resolve(id: string, userId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE alerts 
      SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
      WHERE id = ? AND status IN (?, ?)
    `);

    const result = stmt.run(
      AlertStatus.RESOLVED,
      userId,
      new Date().toISOString(),
      new Date().toISOString(),
      id,
      AlertStatus.OPEN,
      AlertStatus.ACKNOWLEDGED
    );

    return result.changes > 0;
  }

  countByStatus(status: AlertStatus): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM alerts 
      WHERE status = ?
    `);

    const result = stmt.get(status) as { count: number };
    return result.count;
  }

  deleteOlderThan(date: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM alerts 
      WHERE created_at < ? AND status = ?
    `);

    const result = stmt.run(date, AlertStatus.RESOLVED);
    return result.changes;
  }
}
