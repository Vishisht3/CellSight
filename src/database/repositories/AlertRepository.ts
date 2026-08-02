import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertCreateInput } from '../../models/types';
import { AlertStatus } from '../../config/constants';

const SELECT_COLS = `
  id, type, severity, source_agent as sourceAgent,
  asset_id as assetId, supplier_id as supplierId, cell_batch_id as cellBatchId,
  title, description, status,
  acknowledged_by as acknowledgedBy, acknowledged_at as acknowledgedAt,
  resolved_by as resolvedBy, resolved_at as resolvedAt,
  metadata, organization_id as organizationId,
  created_at as createdAt, updated_at as updatedAt
`;

export class AlertRepository {
  constructor(private db: DbDriver) {}

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
      organizationId: input.organizationId,
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO alerts (
        id, type, severity, source_agent, asset_id, supplier_id, cell_batch_id,
        title, description, status, acknowledged_by, acknowledged_at,
        resolved_by, resolved_at, metadata, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert.id, alert.type, alert.severity, alert.sourceAgent,
      alert.assetId, alert.supplierId, alert.cellBatchId,
      alert.title, alert.description, alert.status,
      alert.acknowledgedBy, alert.acknowledgedAt,
      alert.resolvedBy, alert.resolvedAt,
      alert.metadata, alert.organizationId,
      alert.createdAt, alert.updatedAt
    );

    return alert;
  }

  findById(id: string): Alert | null {
    return this.db.prepare(`SELECT ${SELECT_COLS} FROM alerts WHERE id = ?`).get(id) as Alert | null;
  }

  list(organizationId: string, status?: AlertStatus, limit = 100): Alert[] {
    const query = status
      ? `SELECT ${SELECT_COLS} FROM alerts WHERE organization_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?`
      : `SELECT ${SELECT_COLS} FROM alerts WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`;
    const params = status ? [organizationId, status, limit] : [organizationId, limit];
    return this.db.prepare(query).all(...params) as Alert[];
  }

  listByAsset(assetId: string, organizationId: string, limit = 50): Alert[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM alerts WHERE asset_id = ? AND organization_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(assetId, organizationId, limit) as Alert[];
  }

  listBySupplier(supplierId: string, organizationId: string, limit = 50): Alert[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM alerts WHERE supplier_id = ? AND organization_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(supplierId, organizationId, limit) as Alert[];
  }

  acknowledge(id: string, userId: string): boolean {
    const result = this.db.prepare(`
      UPDATE alerts
      SET status = ?, acknowledged_by = ?, acknowledged_at = ?, updated_at = ?
      WHERE id = ? AND status = ?
    `).run(AlertStatus.ACKNOWLEDGED, userId, new Date().toISOString(), new Date().toISOString(), id, AlertStatus.OPEN);
    return result.changes > 0;
  }

  resolve(id: string, userId: string): boolean {
    const result = this.db.prepare(`
      UPDATE alerts
      SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
      WHERE id = ? AND status IN (?, ?)
    `).run(
      AlertStatus.RESOLVED, userId, new Date().toISOString(), new Date().toISOString(),
      id, AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED
    );
    return result.changes > 0;
  }

  countByStatus(status: AlertStatus, organizationId: string): number {
    const result = this.db.prepare(
      `SELECT COUNT(*) as count FROM alerts WHERE status = ? AND organization_id = ?`
    ).get(status, organizationId) as { count: number };
    return result.count;
  }

  deleteOlderThan(date: string, organizationId: string): number {
    const result = this.db.prepare(
      `DELETE FROM alerts WHERE created_at < ? AND status = ? AND organization_id = ?`
    ).run(date, AlertStatus.RESOLVED, organizationId);
    return result.changes;
  }
}
