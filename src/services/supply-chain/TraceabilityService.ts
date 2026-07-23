import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { AssetTrace, MaterialLot, Supplier } from '../../models/types';

export class TraceabilityService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Trace an asset back to its source materials and suppliers
   * REQ-5: Return full upstream material and supplier chain within 3 seconds
   */
  traceAssetToSource(assetId: string): AssetTrace | null {
    try {
      const startTime = Date.now();

      // Get the asset
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset) {
        logger.warn('Asset not found for tracing', { assetId });
        return null;
      }

      // Get the battery pack
      const batteryPack = this.dbContext.cellBatches.findPackById(asset.batteryPackId);
      if (!batteryPack) {
        logger.warn('Battery pack not found for asset', { assetId, batteryPackId: asset.batteryPackId });
        return null;
      }

      // Get the cell batch
      const cellBatch = this.dbContext.cellBatches.findBatchById(batteryPack.cellBatchId);
      if (!cellBatch) {
        logger.warn('Cell batch not found for pack', { batteryPackId: batteryPack.id, cellBatchId: batteryPack.cellBatchId });
        return null;
      }

      // Get the manufacturer
      const manufacturer = this.dbContext.suppliers.findById(cellBatch.manufacturerId);
      if (!manufacturer) {
        logger.warn('Manufacturer not found for batch', { cellBatchId: cellBatch.id, manufacturerId: cellBatch.manufacturerId });
        return null;
      }

      // Get material lots linked to the cell batch
      const materialLotIds = this.dbContext.cellBatches.getMaterialsForBatch(cellBatch.id);
      const materialLots: Array<MaterialLot & { supplier: Supplier }> = [];

      for (const materialLotId of materialLotIds) {
        const materialLot = this.dbContext.materials.findById(materialLotId);
        if (materialLot) {
          const supplier = this.dbContext.suppliers.findById(materialLot.supplierId);
          if (supplier) {
            materialLots.push({
              ...materialLot,
              supplier,
            });
          }
        }
      }

      const trace: AssetTrace = {
        asset,
        batteryPack,
        cellBatch,
        manufacturer,
        materialLots,
      };

      const elapsedTime = Date.now() - startTime;
      logger.info('Asset traced to source', {
        assetId,
        materialLotCount: materialLots.length,
        elapsedTimeMs: elapsedTime,
      });

      return trace;
    } catch (error) {
      logger.error('Asset tracing failed', { assetId, error });
      return null;
    }
  }

  /**
   * Get all assets linked to a specific cell batch
   */
  getAssetsByBatch(cellBatchId: string): string[] {
    try {
      const packs = this.dbContext.cellBatches.listPacksByBatch(cellBatchId);
      const assetIds: string[] = [];

      for (const pack of packs) {
        const assets = this.dbContext.assets.listByBatteryPack(pack.id);
        assetIds.push(...assets.map(a => a.id));
      }

      return assetIds;
    } catch (error) {
      logger.error('Failed to get assets by batch', { cellBatchId, error });
      return [];
    }
  }

  /**
   * Get all assets linked to a specific supplier (through material lots)
   */
  getAssetsBySupplier(supplierId: string): string[] {
    try {
      const assetIds = new Set<string>();

      // Find material lots from this supplier
      const materialLots = this.dbContext.materials.listBySupplier(supplierId);

      for (const materialLot of materialLots) {
        // Find cell batches that used this material lot
        const batches = this.dbContext.cellBatches.listBatches();
        
        for (const batch of batches) {
          const batchMaterials = this.dbContext.cellBatches.getMaterialsForBatch(batch.id);
          
          if (batchMaterials.includes(materialLot.id)) {
            // Find assets linked to this batch
            const batchAssets = this.getAssetsByBatch(batch.id);
            batchAssets.forEach(assetId => assetIds.add(assetId));
          }
        }
      }

      return Array.from(assetIds);
    } catch (error) {
      logger.error('Failed to get assets by supplier', { supplierId, error });
      return [];
    }
  }

  /**
   * Get traceability statistics
   */
  getTraceabilityStats(): {
    totalAssets: number;
    assetsWithFullTrace: number;
    totalBatches: number;
    totalMaterialLots: number;
    totalSuppliers: number;
  } {
    const assets = this.dbContext.assets.list();
    let assetsWithFullTrace = 0;

    for (const asset of assets) {
      const trace = this.traceAssetToSource(asset.id);
      if (trace && trace.materialLots.length > 0) {
        assetsWithFullTrace++;
      }
    }

    return {
      totalAssets: assets.length,
      assetsWithFullTrace,
      totalBatches: this.dbContext.cellBatches.listBatches().length,
      totalMaterialLots: this.dbContext.materials.list().length,
      totalSuppliers: this.dbContext.suppliers.list().length,
    };
  }

  /**
   * Register new material lot and link to suppliers
   * REQ-5: Record supplier, tier, country, and lot ID
   */
  registerMaterialLot(input: {
    lotNumber: string;
    materialType: string;
    supplierId: string;
    quantity: number;
    country: string;
    receivedAt?: string;
    qualityScore?: number;
    specificationMin?: number;
    specificationMax?: number;
  }) {
    try {
      const materialLot = this.dbContext.materials.create(input as any);
      
      logger.info('Material lot registered', {
        lotId: materialLot.id,
        lotNumber: materialLot.lotNumber,
        materialType: materialLot.materialType,
        supplierId: materialLot.supplierId,
      });

      return materialLot;
    } catch (error) {
      logger.error('Material lot registration failed', { input, error });
      throw error;
    }
  }

  /**
   * Register new cell batch with material linkage
   * REQ-5: Maintain traceable chain from material to cell batch to pack to asset
   */
  registerCellBatch(input: {
    batchNumber: string;
    manufacturerId: string;
    productionDate?: string;
    quantity: number;
    materialLotIds?: string[];
  }) {
    try {
      const cellBatch = this.dbContext.cellBatches.createBatch({
        batchNumber: input.batchNumber,
        manufacturerId: input.manufacturerId,
        productionDate: input.productionDate,
        quantity: input.quantity,
      });

      // Link material lots to cell batch
      if (input.materialLotIds && input.materialLotIds.length > 0) {
        for (const materialLotId of input.materialLotIds) {
          this.dbContext.cellBatches.linkBatchToMaterial(cellBatch.id, materialLotId);
        }
      }

      logger.info('Cell batch registered', {
        batchId: cellBatch.id,
        batchNumber: cellBatch.batchNumber,
        materialLotCount: input.materialLotIds?.length || 0,
      });

      return cellBatch;
    } catch (error) {
      logger.error('Cell batch registration failed', { input, error });
      throw error;
    }
  }

  /**
   * Register new battery pack
   */
  registerBatteryPack(input: {
    packNumber: string;
    cellBatchId: string;
    assemblyDate?: string;
    capacity: number;
  }) {
    try {
      const batteryPack = this.dbContext.cellBatches.createPack(input);

      logger.info('Battery pack registered', {
        packId: batteryPack.id,
        packNumber: batteryPack.packNumber,
        cellBatchId: batteryPack.cellBatchId,
      });

      return batteryPack;
    } catch (error) {
      logger.error('Battery pack registration failed', { input, error });
      throw error;
    }
  }
}
