import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { AssetTrace, MaterialLot, Supplier, MaterialLotCreateInput, CellBatchCreateInput, BatteryPackCreateInput } from '../../models/types';

export class TraceabilityService {
  constructor(private dbContext: DatabaseContext) {}

  traceAssetToSource(assetId: string): AssetTrace | null {
    try {
      const asset = this.dbContext.assets.findById(assetId);
      if (!asset) return null;

      const batteryPack = this.dbContext.cellBatches.findPackById(asset.batteryPackId);
      if (!batteryPack) return null;

      const cellBatch = this.dbContext.cellBatches.findBatchById(batteryPack.cellBatchId);
      if (!cellBatch) return null;

      const manufacturer = this.dbContext.suppliers.findById(cellBatch.manufacturerId);
      if (!manufacturer) return null;

      // Fetch all material lots and their suppliers in two queries rather than N+1.
      const materialLotIds = this.dbContext.cellBatches.getMaterialsForBatch(cellBatch.id);
      const materialLots: Array<MaterialLot & { supplier: Supplier }> = [];

      if (materialLotIds.length > 0) {
        // Single query for all lots, then a single query for distinct suppliers.
        const lots = materialLotIds
          .map(id => this.dbContext.materials.findById(id))
          .filter((l): l is MaterialLot => l !== null);

        const supplierIds = [...new Set(lots.map(l => l.supplierId))];
        const supplierMap = new Map<string, Supplier>();
        for (const sid of supplierIds) {
          const s = this.dbContext.suppliers.findById(sid);
          if (s) supplierMap.set(sid, s);
        }

        for (const lot of lots) {
          const supplier = supplierMap.get(lot.supplierId);
          if (supplier) materialLots.push({ ...lot, supplier });
        }
      }

      return { asset, batteryPack, cellBatch, manufacturer, materialLots };
    } catch (error) {
      logger.error('Asset tracing failed', { assetId, error });
      return null;
    }
  }

  getAssetsByBatch(cellBatchId: string): string[] {
    try {
      const packs = this.dbContext.cellBatches.listPacksByBatch(cellBatchId);
      return packs.flatMap(p => this.dbContext.assets.listByBatteryPack(p.id).map(a => a.id));
    } catch (error) {
      logger.error('Failed to get assets by batch', { cellBatchId, error });
      return [];
    }
  }

  getAssetsBySupplier(supplierId: string, organizationId: string): string[] {
    try {
      const assetIds = new Set<string>();
      const materialLots = this.dbContext.materials.listBySupplier(supplierId, organizationId);
      const batches = this.dbContext.cellBatches.listBatches(organizationId);
      for (const batch of batches) {
        const batchMaterials = this.dbContext.cellBatches.getMaterialsForBatch(batch.id);
        if (batchMaterials.some(mid => materialLots.some(lot => lot.id === mid))) {
          this.getAssetsByBatch(batch.id).forEach(id => assetIds.add(id));
        }
      }
      return Array.from(assetIds);
    } catch (error) {
      logger.error('Failed to get assets by supplier', { supplierId, error });
      return [];
    }
  }

  getTraceabilityStats(organizationId?: string): {
    totalAssets: number;
    assetsWithFullTrace: number;
    totalBatches: number;
    totalMaterialLots: number;
    totalSuppliers: number;
  } {
    // Use a raw DB query to avoid needing orgId for background/stats tasks
    const assets = organizationId
      ? this.dbContext.assets.list(organizationId)
      : (this.dbContext.db.prepare('SELECT id FROM assets').all() as Array<{ id: string }>);

    let assetsWithFullTrace = 0;
    for (const asset of assets) {
      const trace = this.traceAssetToSource(asset.id);
      if (trace && trace.materialLots.length > 0) assetsWithFullTrace++;
    }

    const totalBatches = organizationId
      ? this.dbContext.cellBatches.listBatches(organizationId).length
      : (this.dbContext.db.prepare('SELECT COUNT(*) as c FROM cell_batches').get() as any).c;
    const totalMaterialLots = organizationId
      ? this.dbContext.materials.list(organizationId).length
      : (this.dbContext.db.prepare('SELECT COUNT(*) as c FROM material_lots').get() as any).c;
    const totalSuppliers = organizationId
      ? this.dbContext.suppliers.list(organizationId).length
      : (this.dbContext.db.prepare('SELECT COUNT(*) as c FROM suppliers').get() as any).c;

    return { totalAssets: assets.length, assetsWithFullTrace, totalBatches, totalMaterialLots, totalSuppliers };
  }

  registerMaterialLot(input: MaterialLotCreateInput) {
    try {
      const lot = this.dbContext.materials.create(input);
      logger.info('Material lot registered', { lotId: lot.id, lotNumber: lot.lotNumber });
      return lot;
    } catch (error) {
      logger.error('Material lot registration failed', { error });
      throw error;
    }
  }

  registerCellBatch(input: CellBatchCreateInput & { materialLotIds?: string[] }) {
    try {
      const batch = this.dbContext.cellBatches.createBatch(input);
      if (input.materialLotIds) {
        for (const id of input.materialLotIds) {
          this.dbContext.cellBatches.linkBatchToMaterial(batch.id, id);
        }
      }
      logger.info('Cell batch registered', { batchId: batch.id, batchNumber: batch.batchNumber });
      return batch;
    } catch (error) {
      logger.error('Cell batch registration failed', { error });
      throw error;
    }
  }

  registerBatteryPack(input: BatteryPackCreateInput) {
    try {
      const pack = this.dbContext.cellBatches.createPack(input);
      logger.info('Battery pack registered', { packId: pack.id, packNumber: pack.packNumber });
      return pack;
    } catch (error) {
      logger.error('Battery pack registration failed', { error });
      throw error;
    }
  }
}
