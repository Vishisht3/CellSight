import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';
import { 
  AlertSeverity, 
  AlertType, 
  AlertSourceAgent,
  TEMP_MIN_SAFE,
  TEMP_MAX_SAFE,
  OPTIMAL_SOC_MIN,
  OPTIMAL_SOC_MAX,
} from '../../config/constants';

interface ChargePatternAnalysis {
  assetId: string;
  averageSocMin: number;
  averageSocMax: number;
  fullCycleCount: number;
  partialCycleCount: number;
  recommendation: string | null;
}

interface MaintenanceTrigger {
  assetId: string;
  type: AlertType;
  severity: AlertSeverity;
  reason: string;
  recommendedAction: string;
  metadata: Record<string, any>;
}

export class PredictiveMaintenanceService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Monitor for thermal events
   * REQ-3: Generate maintenance alert within 1 minute of thermal event
   */
  checkThermalEvents(assetId: string): MaintenanceTrigger | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset) {
        return null;
      }

      // Get recent telemetry (last 10 readings)
      const recentTelemetry = this.dbContext.telemetry.findByAsset(assetId, 10);
      if (recentTelemetry.length === 0) {
        return null;
      }

      // Check for temperature excursions
      for (const telemetry of recentTelemetry) {
        if (telemetry.temperature < TEMP_MIN_SAFE || telemetry.temperature > TEMP_MAX_SAFE) {
          const severity = 
            telemetry.temperature < TEMP_MIN_SAFE - 10 || telemetry.temperature > TEMP_MAX_SAFE + 10
              ? AlertSeverity.CRITICAL
              : AlertSeverity.WARNING;

          const reason = telemetry.temperature < TEMP_MIN_SAFE
            ? `Temperature below safe minimum: ${telemetry.temperature}°C (safe range: ${TEMP_MIN_SAFE}°C to ${TEMP_MAX_SAFE}°C)`
            : `Temperature above safe maximum: ${telemetry.temperature}°C (safe range: ${TEMP_MIN_SAFE}°C to ${TEMP_MAX_SAFE}°C)`;

          const recommendedAction = telemetry.temperature < TEMP_MIN_SAFE
            ? 'Inspect battery thermal management system. Check for cold weather operation without preconditioning. Consider garage storage or battery heating.'
            : 'Inspect battery cooling system. Verify coolant levels and pump operation. Check for blocked air vents. Reduce charging rate if charging.';

          logger.warn('Thermal event detected', {
            assetId,
            temperature: telemetry.temperature,
            timestamp: telemetry.timestamp,
          });

          return {
            assetId,
            type: AlertType.THERMAL_EVENT,
            severity,
            reason,
            recommendedAction,
            metadata: {
              temperature: telemetry.temperature,
              timestamp: telemetry.timestamp,
              safeMin: TEMP_MIN_SAFE,
              safeMax: TEMP_MAX_SAFE,
            },
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Thermal event check failed', { assetId, error });
      return null;
    }
  }

  /**
   * Analyze charge patterns and recommend optimization
   * REQ-3: Recommend adjusted charge-discharge patterns
   */
  analyzeChargePattern(assetId: string): ChargePatternAnalysis | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset) {
        return null;
      }

      // Get telemetry history (last 100 readings)
      const telemetryHistory = this.dbContext.telemetry.findByAsset(assetId, 100);
      if (telemetryHistory.length < 10) {
        return null; // Not enough data
      }

      // Analyze SoC patterns
      const socReadings = telemetryHistory.map(t => t.stateOfCharge);
      
      // Find charge cycles (min to max transitions)
      let fullCycleCount = 0;
      let partialCycleCount = 0;
      const minSocValues: number[] = [];
      const maxSocValues: number[] = [];

      for (let i = 1; i < socReadings.length; i++) {
        const prevSoc = socReadings[i - 1];
        const currentSoc = socReadings[i];

        // Detect charging (SoC increasing)
        if (currentSoc > prevSoc + 10) {
          minSocValues.push(prevSoc);
        }

        // Detect full discharge-charge cycle
        if (prevSoc < 20 && currentSoc > 80) {
          fullCycleCount++;
          maxSocValues.push(currentSoc);
        } else if (Math.abs(currentSoc - prevSoc) > 20) {
          partialCycleCount++;
        }
      }

      const averageSocMin = minSocValues.length > 0
        ? minSocValues.reduce((sum, val) => sum + val, 0) / minSocValues.length
        : 50;

      const averageSocMax = maxSocValues.length > 0
        ? maxSocValues.reduce((sum, val) => sum + val, 0) / maxSocValues.length
        : 80;

      // Generate recommendation if pattern is suboptimal
      let recommendation: string | null = null;

      if (fullCycleCount > 3 || averageSocMin < OPTIMAL_SOC_MIN || averageSocMax > OPTIMAL_SOC_MAX) {
        const issues: string[] = [];
        
        if (fullCycleCount > 3) {
          issues.push(`${fullCycleCount} full 0-100% cycles detected`);
        }
        if (averageSocMin < OPTIMAL_SOC_MIN) {
          issues.push(`average minimum SoC ${averageSocMin.toFixed(0)}% is below optimal ${OPTIMAL_SOC_MIN}%`);
        }
        if (averageSocMax > OPTIMAL_SOC_MAX) {
          issues.push(`average maximum SoC ${averageSocMax.toFixed(0)}% is above optimal ${OPTIMAL_SOC_MAX}%`);
        }

        recommendation = `Suboptimal charge pattern detected: ${issues.join(', ')}. ` +
          `Recommended: Maintain SoC between ${OPTIMAL_SOC_MIN}% and ${OPTIMAL_SOC_MAX}% for optimal battery longevity. ` +
          `Avoid full 0-100% cycles when possible.`;

        logger.info('Suboptimal charge pattern detected', {
          assetId,
          fullCycleCount,
          averageSocMin: averageSocMin.toFixed(0),
          averageSocMax: averageSocMax.toFixed(0),
        });
      }

      return {
        assetId,
        averageSocMin,
        averageSocMax,
        fullCycleCount,
        partialCycleCount,
        recommendation,
      };
    } catch (error) {
      logger.error('Charge pattern analysis failed', { assetId, error });
      return null;
    }
  }

  /**
   * Check for RUL threshold crossing
   * REQ-3: Generate alerts when RUL crosses thresholds
   */
  checkRulThreshold(assetId: string): MaintenanceTrigger | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset || !asset.predictedRulDays) {
        return null;
      }

      // Check if RUL is below critical threshold (30 days)
      if (asset.predictedRulDays <= 30) {
        const severity = asset.predictedRulDays <= 7 
          ? AlertSeverity.CRITICAL 
          : AlertSeverity.WARNING;

        const reason = `Remaining Useful Life: ${asset.predictedRulDays} days (${asset.predictedRulCycles || 'N/A'} cycles). Battery approaching end of life threshold.`;

        const recommendedAction = asset.predictedRulDays <= 7
          ? 'Schedule immediate battery replacement. Order replacement pack. Plan vehicle downtime.'
          : 'Plan battery replacement within next 30 days. Review maintenance budget and replacement timeline.';

        logger.warn('RUL threshold crossed', {
          assetId,
          rulDays: asset.predictedRulDays,
          rulCycles: asset.predictedRulCycles,
        });

        return {
          assetId,
          type: AlertType.RUL_THRESHOLD,
          severity,
          reason,
          recommendedAction,
          metadata: {
            rulDays: asset.predictedRulDays,
            rulCycles: asset.predictedRulCycles,
            currentSoh: asset.currentSoh,
            threshold: config.sohThresholdCritical,
          },
        };
      }

      return null;
    } catch (error) {
      logger.error('RUL threshold check failed', { assetId, error });
      return null;
    }
  }

  /**
   * Check for SoH degradation alerts
   */
  checkSohDegradation(assetId: string): MaintenanceTrigger | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset || !asset.currentSoh) {
        return null;
      }

      // Check if SoH is below warning threshold
      if (asset.currentSoh < config.sohThresholdWarning && asset.currentSoh >= config.sohThresholdCritical) {
        return {
          assetId,
          type: AlertType.SOH_DEGRADATION,
          severity: AlertSeverity.WARNING,
          reason: `State of Health: ${asset.currentSoh.toFixed(1)}% (below warning threshold of ${config.sohThresholdWarning}%)`,
          recommendedAction: 'Monitor battery performance closely. Plan for replacement in near future. Review charging patterns.',
          metadata: {
            currentSoh: asset.currentSoh,
            warningThreshold: config.sohThresholdWarning,
            criticalThreshold: config.sohThresholdCritical,
          },
        };
      }

      // Check if SoH is below critical threshold
      if (asset.currentSoh < config.sohThresholdCritical) {
        return {
          assetId,
          type: AlertType.SOH_DEGRADATION,
          severity: AlertSeverity.CRITICAL,
          reason: `State of Health: ${asset.currentSoh.toFixed(1)}% (below critical threshold of ${config.sohThresholdCritical}%)`,
          recommendedAction: 'Battery has reached critical degradation level. Schedule immediate replacement to avoid operational disruption.',
          metadata: {
            currentSoh: asset.currentSoh,
            criticalThreshold: config.sohThresholdCritical,
          },
        };
      }

      return null;
    } catch (error) {
      logger.error('SoH degradation check failed', { assetId, error });
      return null;
    }
  }

  /**
   * Generate maintenance trigger from charge pattern analysis
   */
  private createChargePatternTrigger(analysis: ChargePatternAnalysis): MaintenanceTrigger | null {
    if (!analysis.recommendation) {
      return null;
    }

    return {
      assetId: analysis.assetId,
      type: AlertType.CHARGE_PATTERN,
      severity: AlertSeverity.INFO,
      reason: 'Suboptimal charge pattern detected affecting battery longevity',
      recommendedAction: analysis.recommendation,
      metadata: {
        averageSocMin: analysis.averageSocMin,
        averageSocMax: analysis.averageSocMax,
        fullCycleCount: analysis.fullCycleCount,
        optimalSocMin: OPTIMAL_SOC_MIN,
        optimalSocMax: OPTIMAL_SOC_MAX,
      },
    };
  }

  /**
   * Run all maintenance checks for an asset
   * REQ-3: Rank alerts by severity and RUL
   */
  runMaintenanceChecks(assetId: string): MaintenanceTrigger[] {
    const triggers: MaintenanceTrigger[] = [];

    // Check thermal events (highest priority)
    const thermalTrigger = this.checkThermalEvents(assetId);
    if (thermalTrigger) {
      triggers.push(thermalTrigger);
    }

    // Check SoH degradation
    const sohTrigger = this.checkSohDegradation(assetId);
    if (sohTrigger) {
      triggers.push(sohTrigger);
    }

    // Check RUL threshold
    const rulTrigger = this.checkRulThreshold(assetId);
    if (rulTrigger) {
      triggers.push(rulTrigger);
    }

    // Check charge patterns (lower priority)
    const chargeAnalysis = this.analyzeChargePattern(assetId);
    if (chargeAnalysis) {
      const chargeTrigger = this.createChargePatternTrigger(chargeAnalysis);
      if (chargeTrigger) {
        triggers.push(chargeTrigger);
      }
    }

    // Sort by severity: CRITICAL > WARNING > INFO
    triggers.sort((a, b) => {
      const severityOrder = {
        [AlertSeverity.CRITICAL]: 3,
        [AlertSeverity.WARNING]: 2,
        [AlertSeverity.INFO]: 1,
      };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return triggers;
  }

  /**
   * Run maintenance checks for all assets
   */
  runMaintenanceChecksForAllAssets(): {
    totalChecked: number;
    totalTriggers: number;
    alertsCreated: number;
  } {
    const assets = this.dbContext.assets.list();
    let totalChecked = 0;
    let totalTriggers = 0;
    let alertsCreated = 0;

    for (const asset of assets) {
      totalChecked++;
      const triggers = this.runMaintenanceChecks(asset.id);
      totalTriggers += triggers.length;

      // Create alerts for triggers
      for (const trigger of triggers) {
        // Check if similar alert already exists
        const existingAlerts = this.dbContext.alerts.listByAsset(asset.id, 10);
        const recentSimilarAlert = existingAlerts.find(
          alert => alert.type === trigger.type && alert.status === 'open'
        );

        if (!recentSimilarAlert) {
          this.dbContext.alerts.create({
            type: trigger.type,
            severity: trigger.severity,
            sourceAgent: AlertSourceAgent.APM,
            assetId: asset.id,
            title: `${trigger.type.replace(/_/g, ' ').toUpperCase()}: ${asset.name}`,
            description: `${trigger.reason}\n\nRecommended Action: ${trigger.recommendedAction}`,
            metadata: trigger.metadata,
          });
          alertsCreated++;
        }
      }
    }

    logger.info('Maintenance checks completed', {
      totalChecked,
      totalTriggers,
      alertsCreated,
    });

    return { totalChecked, totalTriggers, alertsCreated };
  }
}
