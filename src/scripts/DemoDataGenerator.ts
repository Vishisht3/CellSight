import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import {
  AssetType,
  MaterialType,
  SupplierTier,
  UserRole,
  DEMO_ORG_ID,
  TEMP_MIN_SAFE,
  TEMP_MAX_SAFE,
} from '../config/constants';
import { Supplier, MaterialLot, CellBatch, BatteryPack } from '../models/types';
import bcrypt from 'bcryptjs';

interface GeneratedData {
  users: number;
  suppliers: number;
  materialLots: number;
  cellBatches: number;
  batteryPacks: number;
  assets: number;
  telemetryRecords: number;
}

export class DemoDataGenerator {
  private readonly orgId = DEMO_ORG_ID;

  // In-memory caches so subsequent steps don't need to read back from DB
  private suppliers: Supplier[] = [];
  private materialLots: MaterialLot[] = [];
  private cellBatches: CellBatch[] = [];
  private batteryPacks: BatteryPack[] = [];

  private assetNames = [
    'FreightLiner-001', 'FreightLiner-002', 'FreightLiner-003', 'FreightLiner-004', 'FreightLiner-005',
    'Haul-Truck-A1',    'Haul-Truck-A2',    'Haul-Truck-B1',    'Haul-Truck-B2',    'Haul-Truck-C1',
    'Forklift-FL01',    'Forklift-FL02',    'Forklift-FL03',    'Forklift-FL04',    'Forklift-FL05',
    'Forklift-FL06',    'Forklift-FL07',    'Forklift-FL08',    'Forklift-FL09',    'Forklift-FL10',
    'Excavator-EX1',    'Excavator-EX2',    'Excavator-EX3',    'Loader-LD1',       'Loader-LD2',
  ];

  private supplierDefs = [
    { name: 'Silver Peak Lithium Operations', country: 'US', tier: SupplierTier.TIER_3 },
    { name: 'Katanga Cobalt Refining',         country: 'CD', tier: SupplierTier.TIER_3 },
    { name: 'Sudbury Nickel Works',             country: 'CA', tier: SupplierTier.TIER_3 },
    { name: 'Qingdao Graphite Materials',       country: 'CN', tier: SupplierTier.TIER_3 },
    { name: 'Pilbara Manganese and Minerals',   country: 'AU', tier: SupplierTier.TIER_3 },
    { name: 'LG Energy Solution Ochang',        country: 'KR', tier: SupplierTier.TIER_2 },
    { name: 'Panasonic Energy Suminoe',         country: 'JP', tier: SupplierTier.TIER_2 },
    { name: 'Northvolt Ett Cell Plant',         country: 'SE', tier: SupplierTier.TIER_2 },
    { name: 'Ultium Cells Spring Hill',         country: 'US', tier: SupplierTier.TIER_2 },
    { name: 'CATL Ningde Plant 3',              country: 'CN', tier: SupplierTier.TIER_2 },
    { name: 'Proterra Powered Assembly',        country: 'US', tier: SupplierTier.TIER_1 },
    { name: 'Bosch Battery Systems Stuttgart',  country: 'DE', tier: SupplierTier.TIER_1 },
  ];

  constructor(private dbContext: DatabaseContext) {}

  async generate(): Promise<GeneratedData> {
    logger.info('Starting demo data generation...');
    const stats: GeneratedData = {
      users: 0, suppliers: 0, materialLots: 0, cellBatches: 0,
      batteryPacks: 0, assets: 0, telemetryRecords: 0,
    };

    stats.users          = await this.generateUsers();
    stats.suppliers      = await this.generateSuppliers();
    stats.materialLots   = await this.generateMaterialLots();
    stats.cellBatches    = await this.generateCellBatches();
    stats.batteryPacks   = await this.generateBatteryPacks();
    stats.assets         = await this.generateAssets();
    stats.telemetryRecords = await this.generateTelemetry();

    logger.info('Demo data generation complete', stats);
    return stats;
  }

  private async generateUsers(): Promise<number> {
    const passwordHash = await bcrypt.hash('demo123', 10);
    this.dbContext.users.create({ email: 'maintenance@cellsight.com', passwordHash, role: UserRole.FLEET_MANAGER,        name: 'Maya Patel, Maintenance Planner', organizationId: this.orgId });
    this.dbContext.users.create({ email: 'fleet@cellsight.com',       passwordHash, role: UserRole.FLEET_MANAGER,        name: 'Jordan Lee, Fleet Operations',    organizationId: this.orgId });
    this.dbContext.users.create({ email: 'supply@cellsight.com',      passwordHash, role: UserRole.SUPPLY_CHAIN_MANAGER, name: 'Elena Ruiz, Supplier Quality',    organizationId: this.orgId });
    logger.info('Created 3 portal demo users');
    return 3;
  }

  private async generateSuppliers(): Promise<number> {
    for (const sd of this.supplierDefs) {
      const rand = Math.random();
      const certificationExpiry = rand < 0.2
        ? new Date(Date.now() - 30 * 86_400_000).toISOString()
        : rand < 0.4
        ? new Date(Date.now() + 30 * 86_400_000).toISOString()
        : new Date(Date.now() + 365 * 86_400_000).toISOString();
      const supplier = this.dbContext.suppliers.create({
        name: sd.name, tier: sd.tier, country: sd.country,
        certificationExpiry, organizationId: this.orgId,
      });
      this.suppliers.push(supplier);  // cache in memory
    }
    logger.info(`Created ${this.suppliers.length} suppliers`);
    return this.suppliers.length;
  }

  private async generateMaterialLots(): Promise<number> {
    // Use in-memory suppliers — no DB read needed
    const materialTypes = [MaterialType.LITHIUM, MaterialType.COBALT, MaterialType.NICKEL, MaterialType.GRAPHITE, MaterialType.MANGANESE];
    const tier3 = this.suppliers.filter(s => s.tier === SupplierTier.TIER_3);
    let count = 0;

    for (const materialType of materialTypes) {
      for (const supplier of tier3) {
        const lotCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < lotCount; i++) {
          const lotNumber = `${materialType.toUpperCase()}-${supplier.country}-${new Date().getFullYear()}-${(count + 1842).toString().padStart(5, '0')}`;
          const baseQuality = 85 + Math.random() * 10;
          const qualityScore = Math.random() < 0.15 ? baseQuality - 10 - Math.random() * 5 : baseQuality;
          const lot = this.dbContext.materials.create({
            lotNumber, materialType, supplierId: supplier.id,
            quantity: 1000 + Math.random() * 4000, country: supplier.country,
            receivedAt: new Date(Date.now() - Math.random() * 180 * 86_400_000).toISOString(),
            qualityScore: Math.round(qualityScore * 10) / 10,
            specificationMin: 85, specificationMax: 95,
            organizationId: this.orgId,
          });
          this.materialLots.push(lot);  // cache
          count++;
        }
      }
    }
    logger.info(`Created ${count} material lots`);
    return count;
  }

  private async generateCellBatches(): Promise<number> {
    // Use in-memory suppliers and materialLots
    const tier2 = this.suppliers.filter(s => s.tier === SupplierTier.TIER_2);
    let count = 0;

    for (const mfr of tier2) {
      const batchCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < batchCount; i++) {
        const code = mfr.name.split(' ').map(p => p[0]).join('').slice(0, 4).toUpperCase();
        const batch = this.dbContext.cellBatches.createBatch({
          batchNumber: `CELL-${code}-${(count + 620).toString().padStart(4, '0')}`,
          manufacturerId: mfr.id,
          productionDate: new Date(Date.now() - Math.random() * 120 * 86_400_000).toISOString(),
          quantity: 5000 + Math.floor(Math.random() * 5000),
          organizationId: this.orgId,
        });
        this.cellBatches.push(batch);  // cache

        // Link to random material lots
        const linked = new Set<string>();
        const linkCount = 3 + Math.floor(Math.random() * 3);
        while (linked.size < linkCount && linked.size < this.materialLots.length) {
          const lot = this.materialLots[Math.floor(Math.random() * this.materialLots.length)];
          if (!linked.has(lot.id)) {
            this.dbContext.cellBatches.linkBatchToMaterial(batch.id, lot.id);
            linked.add(lot.id);
          }
        }
        count++;
      }
    }
    logger.info(`Created ${count} cell batches`);
    return count;
  }

  private async generateBatteryPacks(): Promise<number> {
    // Use in-memory cellBatches
    let count = 0;
    for (const batch of this.cellBatches) {
      const packCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < packCount; i++) {
        const pack = this.dbContext.cellBatches.createPack({
          packNumber:   `PACK-${batch.batchNumber}-${String(i + 1).padStart(2, '0')}`,
          cellBatchId:  batch.id,
          assemblyDate: new Date(Date.now() - Math.random() * 90 * 86_400_000).toISOString(),
          capacity:     100 + Math.random() * 200,
          organizationId: this.orgId,
        });
        this.batteryPacks.push(pack);  // cache
        count++;
      }
    }
    logger.info(`Created ${count} battery packs`);
    return count;
  }

  private async generateAssets(): Promise<number> {
    // Use in-memory batteryPacks
    const assetTypes = [AssetType.FREIGHT_TRUCK, AssetType.MINING_VEHICLE, AssetType.FORKLIFT, AssetType.CONSTRUCTION_EQUIPMENT];
    const target = config.demoAssetCount;
    let count = 0;

    for (let i = 0; i < target && i < this.batteryPacks.length && i < this.assetNames.length; i++) {
      this.dbContext.assets.create({
        name: this.assetNames[i],
        assetType: assetTypes[i % assetTypes.length],
        batteryPackId: this.batteryPacks[i].id,
        organizationId: this.orgId,
      });
      count++;
    }
    logger.info(`Created ${count} assets`);
    return count;
  }

  private async generateTelemetry(): Promise<number> {
    // Use queryAsync on Postgres to bypass the runSync spin loop
    let assetRows: Array<{ id: string }> = [];
    const { PgDatabase } = await import('../database/pg-adapter');
    if (this.dbContext.db instanceof PgDatabase) {
      assetRows = await this.dbContext.db.queryAsync(
        `SELECT id FROM assets WHERE organization_id = $1`, [this.orgId]
      ) as Array<{ id: string }>;
    } else {
      assetRows = this.dbContext.db.prepare(
        `SELECT id FROM assets WHERE organization_id = ?`
      ).all(this.orgId) as Array<{ id: string }>;
    }

    let totalRecords = 0;
    for (const { id: assetId } of assetRows) {
      const recordCount = 150 + Math.floor(Math.random() * 151);
      const daysSpan    = 30 + Math.floor(Math.random() * 31);
      const hasAnomalies = Math.random() < 0.2;
      const degradMult  = hasAnomalies ? 1.5 + Math.random() * 0.5 : 1.0;
      let lastTimestamp = '';
      let lastCycles = 0;

      for (let i = 0; i < recordCount; i++) {
        const daysAgo    = daysSpan * (1 - i / recordCount);
        const timestamp  = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
        const cycles     = Math.floor((recordCount - i) / 2);
        const baseSoh    = 100 - cycles * (0.03 + Math.random() * 0.02) * degradMult;
        const currentSoh = Math.max(70, Math.min(100, baseSoh + (Math.random() - 0.5) * 2));
        const voltage    = 400 * (currentSoh / 100) + (Math.random() - 0.5) * 10;
        const current    = -50 + Math.random() * 100;
        let temperature  = 25 + Math.random() * 15;
        if (hasAnomalies && Math.random() < 0.05) {
          temperature = Math.random() < 0.5
            ? TEMP_MIN_SAFE - 5 - Math.random() * 5
            : TEMP_MAX_SAFE + 5 + Math.random() * 10;
        }
        this.dbContext.telemetry.create({
          assetId, timestamp, voltage, current, temperature,
          stateOfCharge: 20 + Math.random() * 60, cycleCount: cycles,
        });
        // Track the last (earliest in time = first in loop) record
        if (i === 0) { lastTimestamp = timestamp; lastCycles = cycles; }
        totalRecords++;
      }
      if (lastTimestamp) {
        this.dbContext.assets.updateTelemetryTimestamp(assetId, lastTimestamp, lastCycles);
      }
    }
    logger.info(`Created ${totalRecords} telemetry records`);
    return totalRecords;
  }
}
