import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { 
  BatchCorrelation, 
  SupplierCorrelation,
} from '../../models/types';
import { 
  AlertSeverity, 
  AlertType, 
  AlertSourceAgent,
  AlertStatus,
} from '../../config/constants';

export class CorrelationService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Calculate degradation correlation for a cell batch
   * REQ-7: Associate degradation rates with cell batches
   */
  calculateBatchCorrelation(cellBatchId: string): BatchCorrelation | null {
    try {
      const cellBatch = this.dbContext.cellBatches.findBatchById(cellBatchId);
      if (!cellBatch) {
        logger.warn('Cell batch not found for correlation', { cellBatchId });
        return null;
      }

      // Get all assets using this cell batch
      const packs = this.dbContext.cellBatches.listPacksByBatch(cellBatchId);
      const assetIds: string[] = [];
      
      for (const pack of packs) {
        const assets = this.dbContext.assets.listByBatteryPack(pack.id);
        assetIds.push(...assets.map(a => a.id));
      }

      if (assetIds.length === 0) {
        logger.debug('No assets found for cell batch', { cellBatchId });
        return null;
      }

      // Calculate average degradation rate for this batch's assets
      let totalDegradationRate = 0;
      let assetsWithData = 0;

      for (const assetId of assetIds) {
        const degradationRate = this.dbContext.soh.getAverageDegradationRate(assetId);
        if (degradationRate !== null && degradationRate > 0) {
          totalDegradationRate += degradationRate;
          assetsWithData++;
        }
      }

      if (assetsWithData === 0) {
        logger.debug('No degradation data available for cell batch', { cellBatchId });
        return null;
      }

      const avgDegradationRate = totalDegradationRate / assetsWithData;

      // Calculate fleet-wide average for comparison
      const fleetAvg = this.calculateFleetAverageDegradation();

      // Calculate deviation from fleet average
      const deviationPercent = fleetAvg > 0 
        ? ((avgDegradationRate - fleetAvg) / fleetAvg) * 100 
        : 0;

      // Calculate confidence based on sample size
      const confidence = Math.min(1.0, assetsWithData / 10); // Full confidence at 10+ samples

      const correlation: BatchCorrelation = {
        cellBatchId,
        batchNumber: cellBatch.batchNumber,
        assetCount: assetsWithData,
        avgDegradationRate,
        fleetAvgDegradationRate: fleetAvg,
        deviationPercent,
        sampleSize: assetsWithData,
        confidence,
      };

      logger.info('Batch correlation calculated', {
        cellBatchId,
        batchNumber: cellBatch.batchNumber,
        assetCount: assetsWithData,
        deviationPercent: deviationPercent.toFixed(2),
      });

      return correlation;
    } catch (error) {
      logger.error('Batch correlation calculation failed', { cellBatchId, error });
      return null;
    }
  }

  /**
   * Calculate degradation correlation for a supplier
   * REQ-7: Associate degradation rates with suppliers
   */
  calculateSupplierCorrelation(supplierId: string): SupplierCorrelation | null {
    try {
      const supplier = this.dbContext.suppliers.findById(supplierId);
      if (!supplier) {
        logger.warn('Supplier not found for correlation', { supplierId });
        return null;
      }

      // Get all material lots from this supplier
      const materialLots = this.dbContext.materials.listBySupplier(supplierId);
      
      // Find all cell batches that used materials from this supplier
      const cellBatchIds = new Set<string>();
      const allBatches = this.dbContext.cellBatches.listBatches();
      
      for (const batch of allBatches) {
        const batchMaterials = this.dbContext.cellBatches.getMaterialsForBatch(batch.id);
        const usesSupplierMaterial = batchMaterials.some(materialId =>
          materialLots.some(lot => lot.id === materialId)
        );
        
        if (usesSupplierMaterial) {
          cellBatchIds.add(batch.id);
        }
      }

      if (cellBatchIds.size === 0) {
        logger.debug('No cell batches found for supplier', { supplierId });
        return null;
      }

      // Collect all assets using batches from this supplier
      const assetIds = new Set<string>();
      
      for (const batchId of cellBatchIds) {
        const packs = this.dbContext.cellBatches.listPacksByBatch(batchId);
        for (const pack of packs) {
          const assets = this.dbContext.assets.listByBatteryPack(pack.id);
          assets.forEach(asset => assetIds.add(asset.id));
        }
      }

      if (assetIds.size === 0) {
        logger.debug('No assets found for supplier', { supplierId });
        return null;
      }

      // Calculate average degradation rate for assets using this supplier's materials
      let totalDegradationRate = 0;
      let assetsWithData = 0;

      for (const assetId of assetIds) {
        const degradationRate = this.dbContext.soh.getAverageDegradationRate(assetId);
        if (degradationRate !== null && degradationRate > 0) {
          totalDegradationRate += degradationRate;
          assetsWithData++;
        }
      }

      if (assetsWithData === 0) {
        logger.debug('No degradation data available for supplier', { supplierId });
        return null;
      }

      const avgDegradationRate = totalDegradationRate / assetsWithData;

      // Calculate fleet-wide average for comparison
      const fleetAvg = this.calculateFleetAverageDegradation();

      // Calculate deviation from fleet average
      const deviationPercent = fleetAvg > 0 
        ? ((avgDegradationRate - fleetAvg) / fleetAvg) * 100 
        : 0;

      // Calculate confidence based on sample size
      const confidence = Math.min(1.0, assetsWithData / 15); // Full confidence at 15+ samples

      const correlation: SupplierCorrelation = {
        supplierId,
        supplierName: supplier.name,
        assetCount: assetsWithData,
        avgDegradationRate,
        fleetAvgDegradationRate: fleetAvg,
        deviationPercent,
        sampleSize: assetsWithData,
        confidence,
      };

      logger.info('Supplier correlation calculated', {
        supplierId,
        supplierName: supplier.name,
        assetCount: assetsWithData,
        deviationPercent: deviationPercent.toFixed(2),
      });

      return correlation;
    } catch (error) {
      logger.error('Supplier correlation calculation failed', { supplierId, error });
      return null;
    }
  }

  /**
   * Calculate fleet-wide average degradation rate
   */
  private calculateFleetAverageDegradation(): number {
    const assets = this.dbContext.assets.list();
    let totalDegradationRate = 0;
    let assetsWithData = 0;

    for (const asset of assets) {
      const degradationRate = this.dbContext.soh.getAverageDegradationRate(asset.id);
      if (degradationRate !== null && degradationRate > 0) {
        totalDegradationRate += degradationRate;
        assetsWithData++;
      }
    }

    return assetsWithData > 0 ? totalDegradationRate / assetsWithData : 0;
  }

  /**
   * Generate cross-functional insights for batches with anomalous degradation
   * REQ-7: Raise cross-functional insight when batch degrades faster than fleet average
   */
  generateBatchInsights(): number {
    try {
      const batches = this.dbContext.cellBatches.listBatches();
      let insightsGenerated = 0;

      for (const batch of batches) {
        const correlation = this.calculateBatchCorrelation(batch.id);
        
        if (!correlation) {
          continue;
        }

        // Check if deviation is significant (>20% worse than fleet average)
        // and we have enough samples (confidence >= 0.5)
        if (correlation.deviationPercent > 20 && correlation.confidence >= 0.5) {
          // Check if we already have an open alert for this batch
          const existingAlerts = this.dbContext.alerts.list(AlertStatus.OPEN, 100);
          const hasExistingAlert = existingAlerts.some(
            alert => 
              alert.type === AlertType.FIELD_TO_SOURCE_CORRELATION &&
              alert.cellBatchId === batch.id
          );

          if (!hasExistingAlert) {
            this.dbContext.alerts.create({
              type: AlertType.FIELD_TO_SOURCE_CORRELATION,
              severity: AlertSeverity.WARNING,
              sourceAgent: AlertSourceAgent.CORRELATION,
              cellBatchId: batch.id,
              title: `Elevated Degradation: Batch ${batch.batchNumber}`,
              description: `Cell batch ${batch.batchNumber} shows ${correlation.deviationPercent.toFixed(1)}% faster degradation than fleet average. ` +
                `${correlation.assetCount} assets affected. ` +
                `Average degradation rate: ${correlation.avgDegradationRate.toFixed(4)}% per day vs fleet average ${correlation.fleetAvgDegradationRate.toFixed(4)}% per day. ` +
                `Review manufacturing process, material quality, and supplier for this batch.`,
              metadata: {
                cellBatchId: batch.id,
                batchNumber: batch.batchNumber,
                assetCount: correlation.assetCount,
                avgDegradationRate: correlation.avgDegradationRate,
                fleetAvgDegradationRate: correlation.fleetAvgDegradationRate,
                deviationPercent: correlation.deviationPercent,
                confidence: correlation.confidence,
              },
            });

            insightsGenerated++;
            logger.info('Batch correlation insight generated', {
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              deviationPercent: correlation.deviationPercent.toFixed(2),
            });
          }
        }
      }

      return insightsGenerated;
    } catch (error) {
      logger.error('Batch insight generation failed', { error });
      return 0;
    }
  }

  /**
   * Generate cross-functional insights for suppliers with anomalous degradation
   * REQ-7: Raise cross-functional insight when supplier degrades faster than fleet average
   */
  generateSupplierInsights(): number {
    try {
      const suppliers = this.dbContext.suppliers.list();
      let insightsGenerated = 0;

      for (const supplier of suppliers) {
        const correlation = this.calculateSupplierCorrelation(supplier.id);
        
        if (!correlation) {
          continue;
        }

        // Check if deviation is significant (>15% worse than fleet average)
        // and we have enough samples (confidence >= 0.6)
        if (correlation.deviationPercent > 15 && correlation.confidence >= 0.6) {
          // Check if we already have an open alert for this supplier
          const existingAlerts = this.dbContext.alerts.listBySupplier(supplier.id, 10);
          const hasExistingAlert = existingAlerts.some(
            alert => 
              alert.type === AlertType.FIELD_TO_SOURCE_CORRELATION &&
              alert.status === 'open'
          );

          if (!hasExistingAlert) {
            this.dbContext.alerts.create({
              type: AlertType.FIELD_TO_SOURCE_CORRELATION,
              severity: AlertSeverity.WARNING,
              sourceAgent: AlertSourceAgent.CORRELATION,
              supplierId: supplier.id,
              title: `Elevated Degradation: Supplier ${supplier.name}`,
              description: `Materials from supplier ${supplier.name} correlate with ${correlation.deviationPercent.toFixed(1)}% faster degradation than fleet average. ` +
                `${correlation.assetCount} assets affected. ` +
                `Average degradation rate: ${correlation.avgDegradationRate.toFixed(4)}% per day vs fleet average ${correlation.fleetAvgDegradationRate.toFixed(4)}% per day. ` +
                `Review supplier quality control, material sourcing, and consider alternative suppliers.`,
              metadata: {
                supplierId: supplier.id,
                supplierName: supplier.name,
                assetCount: correlation.assetCount,
                avgDegradationRate: correlation.avgDegradationRate,
                fleetAvgDegradationRate: correlation.fleetAvgDegradationRate,
                deviationPercent: correlation.deviationPercent,
                confidence: correlation.confidence,
              },
            });

            insightsGenerated++;
            logger.info('Supplier correlation insight generated', {
              supplierId: supplier.id,
              supplierName: supplier.name,
              deviationPercent: correlation.deviationPercent.toFixed(2),
            });
          }
        }
      }

      return insightsGenerated;
    } catch (error) {
      logger.error('Supplier insight generation failed', { error });
      return 0;
    }
  }

  /**
   * Run all correlation analysis and generate insights
   * REQ-7: Visible to both fleet manager and supply chain manager
   */
  runCorrelationAnalysis(): {
    batchesAnalyzed: number;
    suppliersAnalyzed: number;
    insightsGenerated: number;
  } {
    const batchInsights = this.generateBatchInsights();
    const supplierInsights = this.generateSupplierInsights();

    const batchesAnalyzed = this.dbContext.cellBatches.listBatches().length;
    const suppliersAnalyzed = this.dbContext.suppliers.list().length;

    logger.info('Correlation analysis completed', {
      batchesAnalyzed,
      suppliersAnalyzed,
      insightsGenerated: batchInsights + supplierInsights,
    });

    return {
      batchesAnalyzed,
      suppliersAnalyzed,
      insightsGenerated: batchInsights + supplierInsights,
    };
  }

  /**
   * Get all batch correlations
   */
  getAllBatchCorrelations(): BatchCorrelation[] {
    const batches = this.dbContext.cellBatches.listBatches();
    const correlations: BatchCorrelation[] = [];

    for (const batch of batches) {
      const correlation = this.calculateBatchCorrelation(batch.id);
      if (correlation) {
        correlations.push(correlation);
      }
    }

    // Sort by deviation (worst first)
    correlations.sort((a, b) => b.deviationPercent - a.deviationPercent);

    return correlations;
  }

  /**
   * Get all supplier correlations
   */
  getAllSupplierCorrelations(): SupplierCorrelation[] {
    const suppliers = this.dbContext.suppliers.list();
    const correlations: SupplierCorrelation[] = [];

    for (const supplier of suppliers) {
      const correlation = this.calculateSupplierCorrelation(supplier.id);
      if (correlation) {
        correlations.push(correlation);
      }
    }

    // Sort by deviation (worst first)
    correlations.sort((a, b) => b.deviationPercent - a.deviationPercent);

    return correlations;
  }
}
