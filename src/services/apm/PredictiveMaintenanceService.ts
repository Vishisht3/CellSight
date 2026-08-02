import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';
import {
  AlertSeverity, AlertType, AlertSourceAgent,
  TEMP_MIN_SAFE, TEMP_MAX_SAFE, OPTIMAL_SOC_MIN, OPTIMAL_SOC_MAX,
} from '../../config/constants';

interface MaintenanceTrigger {
  assetId: string;
  type: AlertType;
  severity: AlertSeverity;
  reason: string;
  recommendedAction: string;
  metadata: Record<string, any>;
}

export class PredictiveMaintenanceService {
  constructor(
    private dbContext: DatabaseContext,
    private organizationId: string
  ) {}

  checkThermalEvents(assetId: string): MaintenanceTrigger | null {
    try {
      const recent = this.dbContext.telemetry.findByAsset(assetId, 10);
      for (const t of recent) {
        if (t.temperature < TEMP_MIN_SAFE || t.temperature > TEMP_MAX_SAFE) {
          const high = t.temperature > TEMP_MAX_SAFE;
          const severe = high ? t.temperature > TEMP_MAX_SAFE + 10 : t.temperature < TEMP_MIN_SAFE - 10;
          return {
            assetId,
            type: AlertType.THERMAL_EVENT,
            severity: severe ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
            reason: `Temperature ${high ? 'above' : 'below'} safe range: ${t.temperature.toFixed(1)}°C`,
            recommendedAction: high
              ? 'Inspect battery cooling system. Verify coolant levels and pump operation.'
              : 'Inspect thermal management system. Consider battery preconditioning.',
            metadata: { temperature: t.temperature, timestamp: t.timestamp, safeMin: TEMP_MIN_SAFE, safeMax: TEMP_MAX_SAFE },
          };
        }
      }
      return null;
    } catch (error) {
      logger.error('Thermal event check failed', { assetId, error });
      return null;
    }
  }

  checkRulThreshold(assetId: string): MaintenanceTrigger | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset?.predictedRulDays || asset.predictedRulDays > 30) return null;
      return {
        assetId,
        type: AlertType.RUL_THRESHOLD,
        severity: asset.predictedRulDays <= 7 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        reason: `Remaining Useful Life: ${asset.predictedRulDays} days`,
        recommendedAction: asset.predictedRulDays <= 7
          ? 'Schedule immediate battery replacement.'
          : 'Plan battery replacement within 30 days.',
        metadata: { rulDays: asset.predictedRulDays, rulCycles: asset.predictedRulCycles, currentSoh: asset.currentSoh },
      };
    } catch (error) {
      logger.error('RUL threshold check failed', { assetId, error });
      return null;
    }
  }

  checkSohDegradation(assetId: string): MaintenanceTrigger | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset?.currentSoh) return null;
      if (asset.currentSoh < config.sohThresholdCritical) {
        return { assetId, type: AlertType.SOH_DEGRADATION, severity: AlertSeverity.CRITICAL, reason: `SoH ${asset.currentSoh.toFixed(1)}% below critical threshold ${config.sohThresholdCritical}%`, recommendedAction: 'Schedule immediate battery replacement.', metadata: { currentSoh: asset.currentSoh, criticalThreshold: config.sohThresholdCritical } };
      }
      if (asset.currentSoh < config.sohThresholdWarning) {
        return { assetId, type: AlertType.SOH_DEGRADATION, severity: AlertSeverity.WARNING, reason: `SoH ${asset.currentSoh.toFixed(1)}% below warning threshold ${config.sohThresholdWarning}%`, recommendedAction: 'Monitor performance and plan replacement.', metadata: { currentSoh: asset.currentSoh, warningThreshold: config.sohThresholdWarning } };
      }
      return null;
    } catch (error) {
      logger.error('SoH degradation check failed', { assetId, error });
      return null;
    }
  }

  analyzeChargePattern(assetId: string): MaintenanceTrigger | null {
    try {
      const history = this.dbContext.telemetry.findByAsset(assetId, 100);
      if (history.length < 10) return null;
      const socs = history.map(t => t.stateOfCharge);
      let fullCycles = 0;
      const minSocs: number[] = [];
      const maxSocs: number[] = [];
      for (let i = 1; i < socs.length; i++) {
        if (socs[i] > socs[i - 1] + 10) minSocs.push(socs[i - 1]);
        if (socs[i - 1] < 20 && socs[i] > 80) { fullCycles++; maxSocs.push(socs[i]); }
      }
      const avgMin = minSocs.length ? minSocs.reduce((s, v) => s + v, 0) / minSocs.length : 50;
      const avgMax = maxSocs.length ? maxSocs.reduce((s, v) => s + v, 0) / maxSocs.length : 80;
      if (fullCycles > 3 || avgMin < OPTIMAL_SOC_MIN || avgMax > OPTIMAL_SOC_MAX) {
        return { assetId, type: AlertType.CHARGE_PATTERN, severity: AlertSeverity.INFO, reason: 'Suboptimal charge pattern detected', recommendedAction: `Maintain SoC between ${OPTIMAL_SOC_MIN}% and ${OPTIMAL_SOC_MAX}%. Avoid full 0–100% cycles.`, metadata: { fullCycles, avgMin, avgMax } };
      }
      return null;
    } catch (error) {
      logger.error('Charge pattern analysis failed', { assetId, error });
      return null;
    }
  }

  runMaintenanceChecks(assetId: string): MaintenanceTrigger[] {
    const triggers = [
      this.checkThermalEvents(assetId),
      this.checkSohDegradation(assetId),
      this.checkRulThreshold(assetId),
      this.analyzeChargePattern(assetId),
    ].filter((t): t is MaintenanceTrigger => t !== null);
    const order = { [AlertSeverity.CRITICAL]: 3, [AlertSeverity.WARNING]: 2, [AlertSeverity.INFO]: 1 };
    return triggers.sort((a, b) => order[b.severity] - order[a.severity]);
  }

  runMaintenanceChecksForAllAssets(): { totalChecked: number; totalTriggers: number; alertsCreated: number } {
    const assets = this.dbContext.assets.list(this.organizationId);
    let totalChecked = 0, totalTriggers = 0, alertsCreated = 0;
    for (const asset of assets) {
      totalChecked++;
      const triggers = this.runMaintenanceChecks(asset.id);
      totalTriggers += triggers.length;
      for (const trigger of triggers) {
        const existing = this.dbContext.alerts.listByAsset(asset.id, this.organizationId, 10);
        if (!existing.some(a => a.type === trigger.type && a.status === 'open')) {
          this.dbContext.alerts.create({
            type: trigger.type, severity: trigger.severity,
            sourceAgent: AlertSourceAgent.APM, assetId: asset.id,
            title: `${trigger.type.replace(/_/g, ' ').toUpperCase()}: ${asset.name}`,
            description: `${trigger.reason}\n\nRecommended Action: ${trigger.recommendedAction}`,
            metadata: trigger.metadata, organizationId: this.organizationId,
          });
          alertsCreated++;
        }
      }
    }
    logger.info('Maintenance checks completed', { totalChecked, totalTriggers, alertsCreated });
    return { totalChecked, totalTriggers, alertsCreated };
  }
}
