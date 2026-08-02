import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';
import { Alert, AlertCreateInput } from '../models/types';
import { AlertStatus } from '../config/constants';
import { sseService } from './SseService';

export class AlertService {
  constructor(private dbContext: DatabaseContext, private organizationId: string) {}

  createAlert(input: Omit<AlertCreateInput, 'organizationId'>): Alert {
    try {
      const alert = this.dbContext.alerts.create({ ...input, organizationId: this.organizationId });
      try { sseService.broadcast('alert', alert); } catch { /* ignore */ }
      logger.info('Alert created', { alertId: alert.id, type: alert.type, severity: alert.severity, sourceAgent: alert.sourceAgent });
      return alert;
    } catch (error) {
      logger.error('Alert creation failed', { input, error });
      throw error;
    }
  }

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
        alerts = this.dbContext.alerts.listByAsset(options.assetId, this.organizationId, options.limit || 50);
      } else if (options?.supplierId) {
        alerts = this.dbContext.alerts.listBySupplier(options.supplierId, this.organizationId, options.limit || 50);
      } else {
        alerts = this.dbContext.alerts.list(this.organizationId, options?.status, options?.limit || 100);
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

  acknowledgeAlert(alertId: string, userId: string): boolean {
    try {
      const success = this.dbContext.alerts.acknowledge(alertId, userId);
      if (success) logger.info('Alert acknowledged', { alertId, userId });
      return success;
    } catch (error) {
      logger.error('Alert acknowledgment failed', { alertId, userId, error });
      return false;
    }
  }

  resolveAlert(alertId: string, userId: string): boolean {
    try {
      const success = this.dbContext.alerts.resolve(alertId, userId);
      if (success) logger.info('Alert resolved', { alertId, userId });
      return success;
    } catch (error) {
      logger.error('Alert resolution failed', { alertId, userId, error });
      return false;
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
      const allAlerts = this.dbContext.alerts.list(this.organizationId, undefined, 10000);
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
