/**
 * AlertService
 *
 * Outbox pattern for alert creation
 * ──────────────────────────────────
 * createAlert writes TWO rows back-to-back on the same DB connection:
 *   1. alerts        — the alert record
 *   2. outbox_events — a pending delivery receipt
 *
 * On SQLite both writes land in the same WAL frame.  On Postgres each
 * pool.query() call auto-commits independently, so they are NOT in the
 * same transaction — but the ordering guarantee still holds: if the
 * process crashes after the alert INSERT and before the outbox INSERT,
 * the alert row exists without an outbox row.  That is the safe failure
 * mode: the alert is persisted and no phantom SSE notification fires.
 * The inverse (outbox row without an alert) cannot happen because the
 * alert INSERT runs first and rethrows on failure.
 *
 * The OutboxPublisher polls outbox_events every 2 seconds and delivers
 * undelivered rows to SSE clients, fully decoupling the DB write from
 * the network push.
 *
 * Alert acknowledge / resolve also enqueue outbox events so that
 * connected clients receive real-time status updates.
 */

import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';
import { Alert, AlertCreateInput } from '../models/types';
import { AlertStatus } from '../config/constants';

export class AlertService {
  constructor(private dbContext: DatabaseContext, private organizationId: string) {}

  // ── Create ─────────────────────────────────────────────────────────────

  createAlert(input: Omit<AlertCreateInput, 'organizationId'>): Alert {
    // Write 1 — persist the alert
    const alert = this.dbContext.alerts.create({ ...input, organizationId: this.organizationId });

    // Write 2 — enqueue an outbox event in the same DB connection.
    // If this throws the alert still exists; the SSE push simply won't
    // fire.  That is the safe failure mode — the alert is not lost.
    try {
      this.dbContext.outbox.create('alert', alert, this.organizationId);
    } catch (err) {
      logger.error('Outbox: failed to enqueue alert event', { alertId: alert.id, error: err });
    }

    logger.info('Alert created', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      sourceAgent: alert.sourceAgent,
    });
    return alert;
  }

  // ── Acknowledge ────────────────────────────────────────────────────────

  acknowledgeAlert(alertId: string, userId: string): boolean {
    const success = this.dbContext.alerts.acknowledge(alertId, userId);
    if (success) {
      try {
        const alert = this.dbContext.alerts.findById(alertId);
        if (alert) this.dbContext.outbox.create('alert:ack', alert, this.organizationId);
      } catch (err) {
        logger.error('Outbox: failed to enqueue ack event', { alertId, error: err });
      }
      logger.info('Alert acknowledged', { alertId, userId });
    }
    return success;
  }

  // ── Resolve ────────────────────────────────────────────────────────────

  resolveAlert(alertId: string, userId: string): boolean {
    const success = this.dbContext.alerts.resolve(alertId, userId);
    if (success) {
      try {
        const alert = this.dbContext.alerts.findById(alertId);
        if (alert) this.dbContext.outbox.create('alert:resolve', alert, this.organizationId);
      } catch (err) {
        logger.error('Outbox: failed to enqueue resolve event', { alertId, error: err });
      }
      logger.info('Alert resolved', { alertId, userId });
    }
    return success;
  }

  // ── Read helpers ───────────────────────────────────────────────────────

  getAlertFeed(options?: {
    status?: AlertStatus;
    limit?: number;
    sourceAgent?: string;
    assetId?: string;
    supplierId?: string;
  }): Alert[] {
    try {
      let alerts: Alert[];
      if (options?.assetId) {
        alerts = this.dbContext.alerts.listByAsset(options.assetId, this.organizationId, options.limit ?? 50);
      } else if (options?.supplierId) {
        alerts = this.dbContext.alerts.listBySupplier(options.supplierId, this.organizationId, options.limit ?? 50);
      } else {
        alerts = this.dbContext.alerts.list(this.organizationId, options?.status, options?.limit ?? 100);
      }
      if (options?.sourceAgent) {
        alerts = alerts.filter(a => a.sourceAgent === options.sourceAgent);
      }
      return alerts;
    } catch (error) {
      logger.error('Failed to get alert feed', { options, error });
      return [];
    }
  }

  getAlertById(alertId: string): Alert | null {
    return this.dbContext.alerts.findById(alertId);
  }

  getAlertCounts(): { open: number; acknowledged: number; resolved: number; total: number } {
    try {
      const open         = this.dbContext.alerts.countByStatus(AlertStatus.OPEN,         this.organizationId);
      const acknowledged = this.dbContext.alerts.countByStatus(AlertStatus.ACKNOWLEDGED, this.organizationId);
      const resolved     = this.dbContext.alerts.countByStatus(AlertStatus.RESOLVED,     this.organizationId);
      return { open, acknowledged, resolved, total: open + acknowledged + resolved };
    } catch (error) {
      logger.error('Failed to get alert counts', { error });
      return { open: 0, acknowledged: 0, resolved: 0, total: 0 };
    }
  }

  getAlertStatsBySourceAgent(): Record<string, { open: number; total: number }> {
    try {
      const allAlerts = this.dbContext.alerts.list(this.organizationId, undefined, 10_000);
      const stats: Record<string, { open: number; total: number }> = {};
      for (const alert of allAlerts) {
        if (!stats[alert.sourceAgent]) stats[alert.sourceAgent] = { open: 0, total: 0 };
        stats[alert.sourceAgent].total++;
        if (alert.status === AlertStatus.OPEN) stats[alert.sourceAgent].open++;
      }
      return stats;
    } catch (error) {
      logger.error('Failed to get alert stats by source agent', { error });
      return {};
    }
  }

  cleanupOldAlerts(daysToKeep: number): number {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      return this.dbContext.alerts.deleteOlderThan(cutoff.toISOString(), this.organizationId);
    } catch (error) {
      logger.error('Alert cleanup failed', { error });
      return 0;
    }
  }
}
