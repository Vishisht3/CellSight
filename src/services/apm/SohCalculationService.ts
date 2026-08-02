import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';
import { AssetStatus, SOH_MODEL_VERSION } from '../../config/constants';
import { DegradationPrediction } from '../../models/types';

// ── Tiny OLS regression (no external ML library) ──────────────────────────
// Feature vector per 100-point window:
//   [totalCycles, avgVoltage, avgTemperature, avgStateOfCharge, voltageStdDev, tempStdDev]
// Target: SoH computed from the legacy rule-based formula on the same window (ground truth).

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[], avg: number): number {
  return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
}

/**
 * Compute OLS coefficients via the normal equation: β = (XᵀX)⁻¹ Xᵀy
 * X is (n × k), y is (n). Returns β of length k, or null if singular.
 */
function fitOLS(X: number[][], y: number[]): number[] | null {
  const n = X.length;
  const k = X[0].length;

  // XᵀX  (k×k)
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      for (let r = 0; r < n; r++) XtX[i][j] += X[r][i] * X[r][j];
    }
  }

  // Xᵀy  (k)
  const Xty: number[] = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let r = 0; r < n; r++) Xty[i] += X[r][i] * y[r];
  }

  // Gauss-Jordan inversion of XᵀX
  const aug: number[][] = XtX.map((row, i) => {
    const ext = new Array(k).fill(0);
    ext[i] = 1;
    return [...row, ...ext];
  });

  for (let col = 0; col < k; col++) {
    let pivot = -1;
    let pivotVal = 0;
    for (let row = col; row < k; row++) {
      if (Math.abs(aug[row][col]) > pivotVal) { pivotVal = Math.abs(aug[row][col]); pivot = row; }
    }
    if (pivotVal < 1e-12) return null; // singular
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const div = aug[col][col];
    for (let j = 0; j < 2 * k; j++) aug[col][j] /= div;
    for (let row = 0; row < k; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * k; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  // Extract inverse and multiply by Xᵀy
  const inv: number[][] = aug.map(row => row.slice(k));
  return inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
}

// ── SoH rule-based formula (kept as training target + fallback) ───────────

function ruleBased(
  telemetry: Array<{ voltage: number; temperature: number; stateOfCharge: number }>,
  totalCycles: number
): number {
  const recent = telemetry.slice(0, 100);
  const avgVoltage = mean(recent.map(t => t.voltage));
  const nominalVoltage = 400;
  const voltageFade = Math.max(0, (nominalVoltage - avgVoltage) / nominalVoltage) * 10;
  const avgTemp = mean(recent.map(t => t.temperature));
  const tempStress = avgTemp > 35 ? (avgTemp - 35) * 0.2 : 0;
  const cycleDeg = totalCycles * 0.05;
  return Math.max(50, Math.min(100, 100 - cycleDeg - voltageFade - tempStress));
}

// ── Service ───────────────────────────────────────────────────────────────

export class SohCalculationService {
  /** OLS weights: [bias, totalCycles, avgVoltage, avgTemp, avgSoC, voltStd, tempStd] */
  private weights: number[] | null = null;
  private modelRmse: number = 0;
  private modelTrained = false;

  constructor(private dbContext: DatabaseContext) {}

  // ── Model training ──────────────────────────────────────────────────────

  /** Build feature vector (with bias column 1) for a telemetry window. */
  private buildFeatures(
    telemetry: Array<{ voltage: number; temperature: number; stateOfCharge: number }>,
    totalCycles: number
  ): number[] {
    const w = telemetry.slice(0, 100);
    const voltages = w.map(t => t.voltage);
    const temps    = w.map(t => t.temperature);
    const socs     = w.map(t => t.stateOfCharge);
    const avgV  = mean(voltages);
    const avgT  = mean(temps);
    const avgS  = mean(socs);
    const stdV  = stddev(voltages, avgV);
    const stdT  = stddev(temps,    avgT);
    return [1, totalCycles, avgV, avgT, avgS, stdV, stdT];
  }

  trainModel(): void {
    try {
      // Collect ALL assets (across all orgs) that have sufficient data
      const allAssets = (() => {
        const stmt = this.dbContext.db.prepare(
          `SELECT id, total_cycles as totalCycles FROM assets`
        );
        return stmt.all() as Array<{ id: string; totalCycles: number }>;
      })();

      const X: number[][] = [];
      const y: number[]   = [];

      for (const asset of allAssets) {
        const count = this.dbContext.telemetry.countByAsset(asset.id);
        if (count < config.telemetryMinHistoryPoints) continue;

        const telemetry = this.dbContext.telemetry.findByAsset(asset.id, 500);
        // Build sliding 100-point windows
        for (let start = 0; start + 100 <= telemetry.length; start += 50) {
          const window = telemetry.slice(start, start + 100);
          const label  = ruleBased(window, asset.totalCycles);
          X.push(this.buildFeatures(window, asset.totalCycles));
          y.push(label);
        }
      }

      if (X.length < 10) {
        logger.info('SoH model: insufficient training data, using rule-based fallback', { samples: X.length });
        return;
      }

      // 80/20 train/test split
      const splitIdx = Math.floor(X.length * 0.8);
      const Xtrain = X.slice(0, splitIdx);
      const ytrain = y.slice(0, splitIdx);
      const Xtest  = X.slice(splitIdx);
      const ytest  = y.slice(splitIdx);

      const beta = fitOLS(Xtrain, ytrain);
      if (!beta) {
        logger.warn('SoH model: OLS matrix singular, using rule-based fallback');
        return;
      }

      // RMSE on held-out set
      const preds = Xtest.map(row => row.reduce((s, v, i) => s + v * beta[i], 0));
      const rmse  = Math.sqrt(
        preds.reduce((s, p, i) => s + (p - ytest[i]) ** 2, 0) / preds.length
      );

      this.weights    = beta;
      this.modelRmse  = rmse;
      this.modelTrained = true;

      logger.info('SoH regression model trained', {
        trainSamples: Xtrain.length,
        testSamples:  Xtest.length,
        rmse:         rmse.toFixed(4),
      });
    } catch (error) {
      logger.error('SoH model training failed, using rule-based fallback', { error });
    }
  }

  // ── Prediction ──────────────────────────────────────────────────────────

  private computeSohFromTelemetry(
    telemetry: any[],
    totalCycles: number
  ): { soh: number; confidence: number } {
    if (telemetry.length === 0) return { soh: 100, confidence: 0 };

    let soh: number;

    if (this.weights && telemetry.length >= 100) {
      const features = this.buildFeatures(telemetry, totalCycles);
      const raw = features.reduce((s, v, i) => s + v * this.weights![i], 0);
      soh = Math.max(50, Math.min(100, raw));
    } else {
      // Fallback to rule-based formula
      soh = ruleBased(telemetry, totalCycles);
    }

    const confidence = Math.min(1.0, telemetry.length / (config.telemetryMinHistoryPoints * 2));
    return { soh, confidence };
  }

  // ── Public API (unchanged interface) ───────────────────────────────────

  calculateSoh(assetId: string): { success: boolean; soh?: number; confidence?: number; error?: string } {
    // Lazily train on first call
    if (!this.modelTrained) this.trainModel();

    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset) return { success: false, error: 'Asset not found' };

      const telemetryCount = this.dbContext.telemetry.countByAsset(assetId);
      if (telemetryCount < config.telemetryMinHistoryPoints) {
        return { success: false, error: 'Insufficient telemetry history' };
      }

      const telemetryData = this.dbContext.telemetry.findByAsset(assetId, 500);
      const { soh, confidence } = this.computeSohFromTelemetry(telemetryData, asset.totalCycles);

      this.dbContext.soh.create(assetId, soh, confidence, SOH_MODEL_VERSION, telemetryData.length);
      this.dbContext.assets.updateSohData(assetId, soh, confidence, null, null);
      this.updateAssetStatusBySoh(assetId, soh);

      logger.info('SoH calculated', {
        assetId,
        soh: soh.toFixed(2),
        confidence: confidence.toFixed(2),
        method: this.weights ? 'regression' : 'rule-based',
        ...(this.weights ? { modelRmse: this.modelRmse.toFixed(4) } : {}),
      });

      return { success: true, soh, confidence };
    } catch (error) {
      logger.error('SoH calculation failed', { assetId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  predictRemainingUsefulLife(assetId: string): DegradationPrediction | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset?.currentSoh) return null;

      const sohHistory = this.dbContext.soh.findByAsset(assetId, 100);
      if (sohHistory.length < 2) return null;

      const oldest = sohHistory[sohHistory.length - 1];
      const newest = sohHistory[0];
      const sohDelta   = oldest.sohValue - newest.sohValue;
      const daysDelta  = (new Date(newest.computedAt).getTime() - new Date(oldest.computedAt).getTime()) / 86_400_000;

      if (daysDelta <= 0 || sohDelta <= 0) return null;

      const degradationRatePerDay   = sohDelta / daysDelta;
      const cycleDelta              = asset.totalCycles * 0.2;
      const degradationRatePerCycle = cycleDelta > 0 ? sohDelta / cycleDelta : 0;

      const threshold     = config.sohThresholdCritical;
      const sohToThreshold = asset.currentSoh - threshold;

      if (sohToThreshold <= 0) {
        return { assetId, currentSoh: asset.currentSoh, predictedRulDays: 0, predictedRulCycles: 0, confidence: newest.confidence, threshold, degradationRatePerCycle };
      }

      const predictedRulDays   = Math.floor(sohToThreshold / degradationRatePerDay);
      const predictedRulCycles = degradationRatePerCycle > 0
        ? Math.floor(sohToThreshold / degradationRatePerCycle)
        : 999_999;
      const confidence = Math.min(newest.confidence, 0.95);

      this.dbContext.assets.updateSohData(assetId, asset.currentSoh, asset.sohConfidence ?? confidence, predictedRulDays, predictedRulCycles);

      logger.info('RUL predicted', { assetId, rulDays: predictedRulDays, rulCycles: predictedRulCycles });
      return { assetId, currentSoh: asset.currentSoh, predictedRulDays, predictedRulCycles, confidence, threshold, degradationRatePerCycle };
    } catch (error) {
      logger.error('RUL prediction failed', { assetId, error });
      return null;
    }
  }

  private updateAssetStatusBySoh(assetId: string, soh: number): void {
    const status = soh >= config.sohThresholdWarning
      ? AssetStatus.HEALTHY
      : soh >= config.sohThresholdCritical
      ? AssetStatus.WATCH
      : AssetStatus.CRITICAL;
    this.dbContext.assets.updateStatus(assetId, status);
  }

  calculateAllSoh(): { calculated: number; skipped: number } {
    if (!this.modelTrained) this.trainModel();

    const assets = (() => {
      const stmt = this.dbContext.db.prepare(`SELECT id, status FROM assets`);
      return stmt.all() as Array<{ id: string; status: string }>;
    })();

    let calculated = 0;
    let skipped    = 0;

    for (const asset of assets) {
      if (asset.status === AssetStatus.DATA_STALE) { skipped++; continue; }
      const result = this.calculateSoh(asset.id);
      if (result.success) {
        calculated++;
        this.predictRemainingUsefulLife(asset.id);
      } else {
        skipped++;
      }
    }

    logger.info('SoH calculation batch complete', { calculated, skipped });
    return { calculated, skipped };
  }
}
