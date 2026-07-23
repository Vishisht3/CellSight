import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';
import { AssetStatus } from '../../config/constants';
import { SOH_MODEL_VERSION } from '../../config/constants';
import { DegradationPrediction } from '../../models/types';

export class SohCalculationService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Calculate State of Health for an asset
   * REQ-2: Compute SoH with confidence score and model version
   */
  calculateSoh(assetId: string): {
    success: boolean;
    soh?: number;
    confidence?: number;
    error?: string;
  } {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset) {
        return { success: false, error: 'Asset not found' };
      }

      // Check if asset has sufficient telemetry history
      const telemetryCount = this.dbContext.telemetry.countByAsset(assetId);
      if (telemetryCount < config.telemetryMinHistoryPoints) {
        logger.debug(`Insufficient telemetry data for asset ${assetId}`, {
          count: telemetryCount,
          required: config.telemetryMinHistoryPoints,
        });
        return {
          success: false,
          error: 'Insufficient telemetry history',
        };
      }

      // Get recent telemetry data
      const telemetryData = this.dbContext.telemetry.findByAsset(assetId, 500);

      // Calculate SoH using simplified degradation model
      const sohResult = this.computeSohFromTelemetry(telemetryData, asset.totalCycles);

      // Store SoH history
      this.dbContext.soh.create(
        assetId,
        sohResult.soh,
        sohResult.confidence,
        SOH_MODEL_VERSION,
        telemetryData.length
      );

      // Update asset with new SoH
      this.dbContext.assets.updateSohData(
        assetId,
        sohResult.soh,
        sohResult.confidence,
        null, // RUL will be calculated separately
        null
      );

      // Update asset status based on SoH
      this.updateAssetStatusBySoh(assetId, sohResult.soh);

      logger.info('SoH calculated', {
        assetId,
        soh: sohResult.soh.toFixed(2),
        confidence: sohResult.confidence.toFixed(2),
      });

      return {
        success: true,
        soh: sohResult.soh,
        confidence: sohResult.confidence,
      };
    } catch (error) {
      logger.error('SoH calculation failed', { assetId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Compute SoH from telemetry data using a simplified model
   */
  private computeSohFromTelemetry(
    telemetryData: any[],
    totalCycles: number
  ): { soh: number; confidence: number } {
    if (telemetryData.length === 0) {
      return { soh: 100, confidence: 0 };
    }

    // Simplified SoH model based on:
    // 1. Cycle count degradation
    // 2. Voltage capacity fade
    // 3. Temperature stress

    // Baseline degradation from cycles (0.05% per cycle)
    const cycleDegradation = totalCycles * 0.05;

    // Voltage-based capacity fade estimation
    const recentTelemetry = telemetryData.slice(0, 100);
    const avgVoltage = recentTelemetry.reduce((sum, t) => sum + t.voltage, 0) / recentTelemetry.length;
    const nominalVoltage = 400; // Typical EV pack voltage
    const voltageFade = Math.max(0, (nominalVoltage - avgVoltage) / nominalVoltage) * 10;

    // Temperature stress factor
    const avgTemp = recentTelemetry.reduce((sum, t) => sum + t.temperature, 0) / recentTelemetry.length;
    const tempStress = avgTemp > 35 ? (avgTemp - 35) * 0.2 : 0;

    // Combined SoH
    const totalDegradation = cycleDegradation + voltageFade + tempStress;
    const soh = Math.max(50, Math.min(100, 100 - totalDegradation));

    // Confidence based on data quantity and variance
    const confidence = Math.min(1.0, telemetryData.length / (config.telemetryMinHistoryPoints * 2));

    return { soh, confidence };
  }

  /**
   * Predict Remaining Useful Life
   * REQ-2: Generate RUL estimate when SoH crosses threshold
   */
  predictRemainingUsefulLife(assetId: string): DegradationPrediction | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset || !asset.currentSoh) {
        return null;
      }

      // Get SoH history to calculate degradation rate
      const sohHistory = this.dbContext.soh.findByAsset(assetId, 100);
      if (sohHistory.length < 2) {
        return null;
      }

      // Calculate degradation rate (SoH % per day)
      const oldest = sohHistory[sohHistory.length - 1];
      const newest = sohHistory[0];
      const sohDelta = oldest.sohValue - newest.sohValue;
      const timeDeltaMs = new Date(newest.computedAt).getTime() - new Date(oldest.computedAt).getTime();
      const daysDelta = timeDeltaMs / (1000 * 60 * 60 * 24);

      if (daysDelta <= 0 || sohDelta <= 0) {
        return null;
      }

      const degradationRatePerDay = sohDelta / daysDelta;

      // Calculate degradation rate per cycle
      const cycleDelta = asset.totalCycles - (oldest.dataPointsUsed > 0 ? asset.totalCycles * 0.8 : 0);
      const degradationRatePerCycle = cycleDelta > 0 ? sohDelta / cycleDelta : 0;

      // Project RUL to threshold
      const threshold = config.sohThresholdCritical;
      const sohToThreshold = asset.currentSoh - threshold;

      if (sohToThreshold <= 0) {
        // Already below threshold
        return {
          assetId,
          currentSoh: asset.currentSoh,
          predictedRulDays: 0,
          predictedRulCycles: 0,
          confidence: newest.confidence,
          threshold,
          degradationRatePerCycle,
        };
      }

      const predictedRulDays = Math.floor(sohToThreshold / degradationRatePerDay);
      const predictedRulCycles = degradationRatePerCycle > 0 
        ? Math.floor(sohToThreshold / degradationRatePerCycle) 
        : 999999;

      const confidence = Math.min(newest.confidence, 0.95);

      // Update asset with RUL
      this.dbContext.assets.updateSohData(
        assetId,
        asset.currentSoh,
        asset.sohConfidence || confidence,
        predictedRulDays,
        predictedRulCycles
      );

      logger.info('RUL predicted', {
        assetId,
        rulDays: predictedRulDays,
        rulCycles: predictedRulCycles,
        confidence: confidence.toFixed(2),
      });

      return {
        assetId,
        currentSoh: asset.currentSoh,
        predictedRulDays,
        predictedRulCycles,
        confidence,
        threshold,
        degradationRatePerCycle,
      };
    } catch (error) {
      logger.error('RUL prediction failed', { assetId, error });
      return null;
    }
  }

  /**
   * Update asset status based on SoH
   */
  private updateAssetStatusBySoh(assetId: string, soh: number): void {
    let status: AssetStatus;

    if (soh >= config.sohThresholdWarning) {
      status = AssetStatus.HEALTHY;
    } else if (soh >= config.sohThresholdCritical) {
      status = AssetStatus.WATCH;
    } else {
      status = AssetStatus.CRITICAL;
    }

    this.dbContext.assets.updateStatus(assetId, status);
  }

  /**
   * Calculate SoH for all assets with sufficient data
   */
  calculateAllSoh(): { calculated: number; skipped: number } {
    const assets = this.dbContext.assets.list();
    let calculated = 0;
    let skipped = 0;

    for (const asset of assets) {
      // Skip stale assets
      if (asset.status === AssetStatus.DATA_STALE) {
        skipped++;
        continue;
      }

      const result = this.calculateSoh(asset.id);
      if (result.success) {
        calculated++;
        
        // Also predict RUL if we have enough data
        this.predictRemainingUsefulLife(asset.id);
      } else {
        skipped++;
      }
    }

    logger.info(`SoH calculation batch complete`, { calculated, skipped });
    return { calculated, skipped };
  }
}
