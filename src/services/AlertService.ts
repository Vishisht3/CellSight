import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';
import { Alert, AlertCreateInput } from '../models/types';
import { AlertStatus } from '../config/constants';

export class AlertService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Create a new alert
   * REQ-8: Post to unified alert feed with source agent, severity, and timestamp
   */
  createAlert(input: AlertCreateInput): Alert {
    try {
      const alert = this.dbContext.alerts.create(input);

      logger.info('Alert created', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        sourceAgent: alert.sourceAgent,
      });

      return alert;
    } catch (error) {
      logger.error('Alert creation failed', { input, error });
      throw error;
    }
  }

  /**
   * Get unified alert feed
   * REQ-8: Single feed covering both APM and supply chain agents
   */
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
        alerts = this.dbContext.alerts.listByAsset(options.assetId, options.limit || 50);
      } else if (options?.supplierId) {
        alerts = this.dbContext.alerts.listBySupplier(options.supplierId, options.limit || 50);
      } else {
        alerts = this.dbContext.alerts.list(options?.status, options?.limit || 100);
      }

      // Filter by source agent if specified
      if (options?.sourceAgent) {
        alerts = alerts.filter(alert => alert.sourceAgent === options.sourceAgent);
      }

      return alerts;
    } catch (error) {
      logger.error('Failed to get alert feed', { options, error });
      return [];
    }
  }

  /**
   * Acknowledge an alert
   * REQ-8: Update status and record which user made the change
   */
  acknowledgeAlert(alertId: string, userId: string): boolean {
    try {
      const success = this.dbContext.alerts.acknowledge(alertId, userId);

      if (success) {
        logger.info('Alert acknowledged', { alertId, userId });
      } else {
        logger.warn('Alert acknowledgment failed - alert not found or already acknowledged', { alertId });
      }

      return success;
    } catch (error) {
      logger.error('Alert acknowledgment failed', { alertId, userId, error });
      return false;
    }
  }

  /**
   * Resolve an alert
   * REQ-8: Update status and record which user made the change
   */
  resolveAlert(alertId: string, userId: string): boolean {
    try {
      const success = this.dbContext.alerts.resolve(alertId, userId);

      if (success) {
        logger.info('Alert resolved', { alertId, userId });
      } else {
        logger.warn('Alert resolution failed - alert not found or not in valid state', { alertId });
      }

      return success;
    } catch (error) {
      logger.error('Alert resolution failed', { alertId, userId, error });
      return false;
    }
  }

  /**
   * Get alert by ID
   */
  getAlertById(alertId: string): Alert | null {
    try {
      return this.dbContext.alerts.findById(alertId);
    } catch (error) {
      logger.error('Failed to get alert by ID', { alertId, error });
      return null;
    }
  }

  /**
   * Get alert counts by status
   */
  getAlertCounts(): {
    open: number;
    acknowledged: number;
    resolved: number;
    total: number;
  } {
    try {
      const open = this.dbContext.alerts.countByStatus(AlertStatus.OPEN);
      const acknowledged = this.dbContext.alerts.countByStatus(AlertStatus.ACKNOWLEDGED);
      const resolved = this.dbContext.alerts.countByStatus(AlertStatus.RESOLVED);

      return {
        open,
        acknowledged,
        resolved,
        total: open + acknowledged + resolved,
      };
    } catch (error) {
      logger.error('Failed to get alert counts', { error });
      return { open: 0, acknowledged: 0, resolved: 0, total: 0 };
    }
  }

  /**
   * Clean up old resolved alerts
   */
  cleanupOldAlerts(daysToKeep: number): number {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const deleted = this.dbContext.alerts.deleteOlderThan(cutoffDate.toISOString());

      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} old resolved alerts`);
      }

      return deleted;
    } catch (error) {
      logger.error('Alert cleanup failed', { error });
      return 0;
    }
  }

  /**
   * Get alert statistics by source agent
   */
  getAlertStatsBySourceAgent(): Record<string, { open: number; total: number }> {
    try {
      const allAlerts = this.dbContext.alerts.list(undefined, 10000);
      const stats: Record<string, { open: number; total: number }> = {};

      for (const alert of allAlerts) {
        if (!stats[alert.sourceAgent]) {
          stats[alert.sourceAgent] = { open: 0, total: 0 };
        }

        stats[alert.sourceAgent].total++;
        if (alert.status === AlertStatus.OPEN) {
          stats[alert.sourceAgent].open++;
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get alert stats by source agent', { error });
      return {};
    }
  }
}
