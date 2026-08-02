import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { BatchCorrelation, SupplierCorrelation } from '../../models/types';
import { AlertSeverity, AlertType, AlertSourceAgent, AlertStatus } from '../../config/constants';

export class CorrelationService {
  constructor(
    private dbContext: DatabaseContext,
    private organizationId: string
  ) {}

  // ── Z-score helpers ──────────────────────────────────────────────────────

  /**
   * Compute mean and standard deviation for a set of values.
   * Returns { mean: 0, stddev: 0 } for empty or single-element arrays.
   */
  private stats(values: number[]): { mean: number; stddev: number } {
    if (values.length < 2) return { mean: values[0] ?? 0, stddev: 0 };
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return { mean, stddev: Math.sqrt(variance) };
  }

  private zScore(value: number, mean: number, stddev: number): number {
    return stddev === 0 ? 0 : (value - mean) / stddev;
  }

  // ── Fleet-wide degradation rates ─────────────────────────────────────────

  private getFleetRates(): { mean: number; stddev: number } {
    const assets = this.dbContext.assets.list(this.organizationId);
    const rates: number[] = [];
    for (const asset of assets) {
      const rate = this.dbContext.soh.getAverageDegradationRate(asset.id);
      if (rate !== null && rate > 0) rates.push(rate);
    }
    return this.stats(rates);
  }

  // ── Batch correlation ─────────────────────────────────────────────────────

  calculateBatchCorrelation(cellBatchId: string): BatchCorrelation | null {
    try {
      const cellBatch = this.dbContext.cellBatches.findBatchById(cellBatchId);
      if (!cellBatch) return null;

      const packs = this.dbContext.cellBatches.listPacksByBatch(cellBatchId);
      const assetIds: string[] = [];
      for (const pack of packs) {
        this.dbContext.assets.listByBatteryPack(pack.id).forEach(a => assetIds.push(a.id));
      }
      if (assetIds.length === 0) return null;

      const rates: number[] = [];
      for (const id of assetIds) {
        const r = this.dbContext.soh.getAverageDegradationRate(id);
        if (r !== null && r > 0) rates.push(r);
      }
      if (rates.length === 0) return null;

      const avgDegradationRate = rates.reduce((s, r) => s + r, 0) / rates.length;
      const fleet = this.getFleetRates();
      const deviationPercent = fleet.mean > 0
        ? ((avgDegradationRate - fleet.mean) / fleet.mean) * 100
        : 0;
      const confidence = Math.min(1.0, rates.length / 10);

      return {
        cellBatchId,
        batchNumber: cellBatch.batchNumber,
        assetCount: rates.length,
        avgDegradationRate,
        fleetAvgDegradationRate: fleet.mean,
        deviationPercent,
        sampleSize: rates.length,
        confidence,
      };
    } catch (error) {
      logger.error('Batch correlation failed', { cellBatchId, error });
      return null;
    }
  }

  // ── Supplier correlation ──────────────────────────────────────────────────

  calculateSupplierCorrelation(supplierId: string): SupplierCorrelation | null {
    try {
      const supplier = this.dbContext.suppliers.findById(supplierId);
      if (!supplier) return null;

      const materialLots = this.dbContext.materials.listBySupplier(supplierId, this.organizationId);
      const cellBatchIds = new Set<string>();
      const allBatches = this.dbContext.cellBatches.listBatches(this.organizationId);
      for (const batch of allBatches) {
        const batchMaterials = this.dbContext.cellBatches.getMaterialsForBatch(batch.id);
        if (batchMaterials.some(mid => materialLots.some(lot => lot.id === mid))) {
          cellBatchIds.add(batch.id);
        }
      }
      if (cellBatchIds.size === 0) return null;

      const assetIds = new Set<string>();
      for (const batchId of cellBatchIds) {
        const packs = this.dbContext.cellBatches.listPacksByBatch(batchId);
        for (const pack of packs) {
          this.dbContext.assets.listByBatteryPack(pack.id).forEach(a => assetIds.add(a.id));
        }
      }
      if (assetIds.size === 0) return null;

      const rates: number[] = [];
      for (const id of assetIds) {
        const r = this.dbContext.soh.getAverageDegradationRate(id);
        if (r !== null && r > 0) rates.push(r);
      }
      if (rates.length === 0) return null;

      const avgDegradationRate = rates.reduce((s, r) => s + r, 0) / rates.length;
      const fleet = this.getFleetRates();
      const deviationPercent = fleet.mean > 0
        ? ((avgDegradationRate - fleet.mean) / fleet.mean) * 100
        : 0;
      const confidence = Math.min(1.0, rates.length / 15);

      return {
        supplierId,
        supplierName: supplier.name,
        assetCount: rates.length,
        avgDegradationRate,
        fleetAvgDegradationRate: fleet.mean,
        deviationPercent,
        sampleSize: rates.length,
        confidence,
      };
    } catch (error) {
      logger.error('Supplier correlation failed', { supplierId, error });
      return null;
    }
  }

  // ── getAllBatchCorrelations ───────────────────────────────────────────────

  getAllBatchCorrelations(): BatchCorrelation[] {
    const batches = this.dbContext.cellBatches.listBatches(this.organizationId);
    const results: BatchCorrelation[] = [];
    for (const batch of batches) {
      const c = this.calculateBatchCorrelation(batch.id);
      if (c) results.push(c);
    }
    return results;
  }

  getAllSupplierCorrelations(): SupplierCorrelation[] {
    const suppliers = this.dbContext.suppliers.list(this.organizationId);
    const results: SupplierCorrelation[] = [];
    for (const supplier of suppliers) {
      const c = this.calculateSupplierCorrelation(supplier.id);
      if (c) results.push(c);
    }
    return results;
  }

  // ── Z-score insight generation ────────────────────────────────────────────

  /**
   * Flag batches whose degradation rate is a statistical outlier (z > 2.0).
   * Replaces the old flat ">20% above average" threshold with a self-calibrating
   * population z-score — equivalent to the 95th-percentile significance level.
   */
  generateBatchInsights(): number {
    try {
      const batches = this.dbContext.cellBatches.listBatches(this.organizationId);
      const correlations = batches
        .map(b => this.calculateBatchCorrelation(b.id))
        .filter((c): c is BatchCorrelation => c !== null && c.confidence >= 0.5);

      if (correlations.length < 2) return 0;

      const rateStats = this.stats(correlations.map(c => c.avgDegradationRate));
      if (rateStats.stddev === 0) return 0; // all identical — nothing to flag

      let insightsGenerated = 0;

      for (const correlation of correlations) {
        const z = this.zScore(correlation.avgDegradationRate, rateStats.mean, rateStats.stddev);
        if (z <= 2.0) continue; // not a statistical outlier

        const existing = this.dbContext.alerts.list(this.organizationId, AlertStatus.OPEN, 100);
        const alreadyFlagged = existing.some(
          a => a.type === AlertType.FIELD_TO_SOURCE_CORRELATION && a.cellBatchId === correlation.cellBatchId
        );
        if (alreadyFlagged) continue;

        this.dbContext.alerts.create({
          type: AlertType.FIELD_TO_SOURCE_CORRELATION,
          severity: AlertSeverity.WARNING,
          sourceAgent: AlertSourceAgent.CORRELATION,
          cellBatchId: correlation.cellBatchId,
          title: `Elevated Degradation: Batch ${correlation.batchNumber}`,
          description:
            `Cell batch ${correlation.batchNumber} is a statistical outlier — ` +
            `z-score ${z.toFixed(2)} (threshold 2.0). ` +
            `Avg degradation ${correlation.avgDegradationRate.toFixed(4)}%/day vs ` +
            `fleet mean ${correlation.fleetAvgDegradationRate.toFixed(4)}%/day ` +
            `(${correlation.deviationPercent.toFixed(1)}% above average). ` +
            `${correlation.assetCount} assets affected.`,
          metadata: {
            cellBatchId: correlation.cellBatchId,
            batchNumber: correlation.batchNumber,
            zScore: z,
            assetCount: correlation.assetCount,
            avgDegradationRate: correlation.avgDegradationRate,
            fleetAvgDegradationRate: correlation.fleetAvgDegradationRate,
            deviationPercent: correlation.deviationPercent,
            confidence: correlation.confidence,
          },
          organizationId: this.organizationId,
        });

        insightsGenerated++;
        logger.info('Batch outlier flagged', {
          batchId: correlation.cellBatchId,
          batchNumber: correlation.batchNumber,
          zScore: z.toFixed(2),
        });
      }

      return insightsGenerated;
    } catch (error) {
      logger.error('Batch insight generation failed', { error });
      return 0;
    }
  }

  /**
   * Flag suppliers whose degradation rate is a statistical outlier (z > 2.0).
   */
  generateSupplierInsights(): number {
    try {
      const suppliers = this.dbContext.suppliers.list(this.organizationId);
      const correlations = suppliers
        .map(s => this.calculateSupplierCorrelation(s.id))
        .filter((c): c is SupplierCorrelation => c !== null && c.confidence >= 0.5);

      if (correlations.length < 2) return 0;

      const rateStats = this.stats(correlations.map(c => c.avgDegradationRate));
      if (rateStats.stddev === 0) return 0;

      let insightsGenerated = 0;

      for (const correlation of correlations) {
        const z = this.zScore(correlation.avgDegradationRate, rateStats.mean, rateStats.stddev);
        if (z <= 2.0) continue;

        const existing = this.dbContext.alerts.listBySupplier(
          correlation.supplierId, this.organizationId, 10
        );
        const alreadyFlagged = existing.some(
          a => a.type === AlertType.FIELD_TO_SOURCE_CORRELATION && a.status === AlertStatus.OPEN
        );
        if (alreadyFlagged) continue;

        this.dbContext.alerts.create({
          type: AlertType.FIELD_TO_SOURCE_CORRELATION,
          severity: AlertSeverity.WARNING,
          sourceAgent: AlertSourceAgent.CORRELATION,
          supplierId: correlation.supplierId,
          title: `Elevated Degradation: Supplier ${correlation.supplierName}`,
          description:
            `Supplier ${correlation.supplierName} is a statistical outlier — ` +
            `z-score ${z.toFixed(2)} (threshold 2.0). ` +
            `Avg degradation ${correlation.avgDegradationRate.toFixed(4)}%/day vs ` +
            `fleet mean ${correlation.fleetAvgDegradationRate.toFixed(4)}%/day ` +
            `(${correlation.deviationPercent.toFixed(1)}% above average). ` +
            `${correlation.assetCount} assets affected.`,
          metadata: {
            supplierId: correlation.supplierId,
            supplierName: correlation.supplierName,
            zScore: z,
            assetCount: correlation.assetCount,
            avgDegradationRate: correlation.avgDegradationRate,
            fleetAvgDegradationRate: correlation.fleetAvgDegradationRate,
            deviationPercent: correlation.deviationPercent,
            confidence: correlation.confidence,
          },
          organizationId: this.organizationId,
        });

        insightsGenerated++;
        logger.info('Supplier outlier flagged', {
          supplierId: correlation.supplierId,
          supplierName: correlation.supplierName,
          zScore: z.toFixed(2),
        });
      }

      return insightsGenerated;
    } catch (error) {
      logger.error('Supplier insight generation failed', { error });
      return 0;
    }
  }

  runCorrelationAnalysis(): {
    batchesAnalyzed: number;
    suppliersAnalyzed: number;
    insightsGenerated: number;
  } {
    const batchInsights    = this.generateBatchInsights();
    const supplierInsights = this.generateSupplierInsights();
    return {
      batchesAnalyzed:   this.dbContext.cellBatches.listBatches(this.organizationId).length,
      suppliersAnalyzed: this.dbContext.suppliers.list(this.organizationId).length,
      insightsGenerated: batchInsights + supplierInsights,
    };
  }
}
