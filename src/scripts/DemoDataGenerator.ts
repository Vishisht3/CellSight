import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import {
  AssetType,
  MaterialType,
  SupplierTier,
  UserRole,
} from '../config/constants';
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
  private assetNames = [
    'FreightLiner-001', 'FreightLiner-002', 'FreightLiner-003', 'FreightLiner-004', 'FreightLiner-005',
    'Haul-Truck-A1', 'Haul-Truck-A2', 'Haul-Truck-B1', 'Haul-Truck-B2', 'Haul-Truck-C1',
    'Forklift-FL01', 'Forklift-FL02', 'Forklift-FL03', 'Forklift-FL04', 'Forklift-FL05',
    'Forklift-FL06', 'Forklift-FL07', 'Forklift-FL08', 'Forklift-FL09', 'Forklift-FL10',
    'Excavator-EX1', 'Excavator-EX2', 'Excavator-EX3', 'Loader-LD1', 'Loader-LD2',
  ];

  private supplierNames = [
    { name: 'LithiumCorp', country: 'US', tier: SupplierTier.TIER_3 },
    { name: 'CobaltMines Ltd', country: 'CD', tier: SupplierTier.TIER_3 },
    { name: 'NickelSource Inc', country: 'CA', tier: SupplierTier.TIER_3 },
    { name: 'Graphite Supplies', country: 'CN', tier: SupplierTier.TIER_3 },
    { name: 'RareEarth Materials', country: 'AU', tier: SupplierTier.TIER_3 },
    { name: 'GlobalCells Manufacturing', country: 'KR', tier: SupplierTier.TIER_2 },
    { name: 'PowerCell Industries', country: 'JP', tier: SupplierTier.TIER_2 },
    { name: 'BatteryTech Corp', country: 'DE', tier: SupplierTier.TIER_2 },
    { name: 'ElectroCell Systems', country: 'US', tier: SupplierTier.TIER_2 },
    { name: 'EnergyCells Ltd', country: 'CN', tier: SupplierTier.TIER_2 },
    { name: 'Prime Battery Assembly', country: 'US', tier: SupplierTier.TIER_1 },
    { name: 'Advanced Power Systems', country: 'JP', tier: SupplierTier.TIER_1 },
  ];

  constructor(private dbContext: DatabaseContext) {}

  /**
   * Generate complete demo dataset
   * REQ-10: Generate synthetic telemetry for configurable vehicles with realistic degradation
   */
  async generate(): Promise<GeneratedData> {
    logger.info('Starting demo data generation...');

    const stats: GeneratedData = {
      users: 0,
      suppliers: 0,
      materialLots: 0,
      cellBatches: 0,
      batteryPacks: 0,
      assets: 0,
      telemetryRecords: 0,
    };

    // Generate users
    stats.users = await this.generateUsers();

    // Generate suppliers with intentional risk scenarios
    stats.suppliers = await this.generateSuppliers();

    // Generate material lots
    stats.materialLots = await this.generateMaterialLots();

    // Generate cell batches
    stats.cellBatches = await this.generateCellBatches();

    // Generate battery packs
    stats.batteryPacks = await this.generateBatteryPacks();

    // Generate assets
    stats.assets = await this.generateAssets();

    // Generate telemetry with realistic degradation curves and anomalies
    stats.telemetryRecords = await this.generateTelemetry();

    logger.info('Demo data generation complete', stats);
    return stats;
  }

  private async generateUsers(): Promise<number> {
    const passwordHash = await bcrypt.hash('demo123', 10);

    // Create admin user
    this.dbContext.users.create({
      email: 'admin@cellsight.com',
      passwordHash,
      role: UserRole.ADMIN,
      name: 'Admin User',
    });

    // Create fleet manager
    this.dbContext.users.create({
      email: 'fleet@cellsight.com',
      passwordHash,
      role: UserRole.FLEET_MANAGER,
      name: 'Fleet Manager',
    });

    // Create supply chain manager
    this.dbContext.users.create({
      email: 'supply@cellsight.com',
      passwordHash,
      role: UserRole.SUPPLY_CHAIN_MANAGER,
      name: 'Supply Chain Manager',
    });

    logger.info('Created 3 demo users');
    return 3;
  }

  private async generateSuppliers(): Promise<number> {
    const suppliers = [];

    for (const supplierData of this.supplierNames) {
      // Add certification expiry dates (some expired, some expiring soon)
      let certificationExpiry: string | undefined;
      const rand = Math.random();
      
      if (rand < 0.2) {
        // 20% expired
        certificationExpiry = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (rand < 0.4) {
        // 20% expiring soon
        certificationExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        // 60% valid
        certificationExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      const supplier = this.dbContext.suppliers.create({
        name: supplierData.name,
        tier: supplierData.tier,
        country: supplierData.country,
        certificationExpiry,
      });

      suppliers.push(supplier);
    }

    logger.info(`Created ${suppliers.length} suppliers`);
    return suppliers.length;
  }

  private async generateMaterialLots(): Promise<number> {
    const suppliers = this.dbContext.suppliers.list();
    const materialTypes = [
      MaterialType.LITHIUM,
      MaterialType.COBALT,
      MaterialType.NICKEL,
      MaterialType.GRAPHITE,
      MaterialType.MANGANESE,
    ];

    let count = 0;

    for (const materialType of materialTypes) {
      // Get suppliers that provide this material type (tier 3)
      const materialSuppliers = suppliers.filter(s => s.tier === SupplierTier.TIER_3);

      for (const supplier of materialSuppliers) {
        // Create 2-5 material lots per supplier per material type
        const lotCount = 2 + Math.floor(Math.random() * 4);

        for (let i = 0; i < lotCount; i++) {
          const lotNumber = `${materialType.toUpperCase()}-${supplier.country}-${count.toString().padStart(4, '0')}`;
          
          // Generate quality scores with occasional deviations
          const baseQuality = 85 + Math.random() * 10;
          const hasDeviation = Math.random() < 0.15; // 15% have quality issues
          const qualityScore = hasDeviation ? baseQuality - 10 - Math.random() * 5 : baseQuality;

          this.dbContext.materials.create({
            lotNumber,
            materialType,
            supplierId: supplier.id,
            quantity: 1000 + Math.random() * 4000,
            country: supplier.country,
            receivedAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
            qualityScore: Math.round(qualityScore * 10) / 10,
            specificationMin: 85,
            specificationMax: 95,
          });

          count++;
        }
      }
    }

    logger.info(`Created ${count} material lots`);
    return count;
  }

  private async generateCellBatches(): Promise<number> {
    const suppliers = this.dbContext.suppliers.list();
    const cellManufacturers = suppliers.filter(s => s.tier === SupplierTier.TIER_2);
    const materialLots = this.dbContext.materials.list();

    let count = 0;

    for (const manufacturer of cellManufacturers) {
      // Create 3-6 batches per manufacturer
      const batchCount = 3 + Math.floor(Math.random() * 4);

      for (let i = 0; i < batchCount; i++) {
        const batchNumber = `BATCH-${manufacturer.name.substring(0, 3).toUpperCase()}-${count.toString().padStart(3, '0')}`;
        
        const cellBatch = this.dbContext.cellBatches.createBatch({
          batchNumber,
          manufacturerId: manufacturer.id,
          productionDate: new Date(Date.now() - Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString(),
          quantity: 5000 + Math.floor(Math.random() * 5000),
        });

        // Link 3-5 random material lots to this batch
        const linkedMaterials = new Set<string>();
        const linkCount = 3 + Math.floor(Math.random() * 3);
        
        while (linkedMaterials.size < linkCount && linkedMaterials.size < materialLots.length) {
          const randomLot = materialLots[Math.floor(Math.random() * materialLots.length)];
          if (!linkedMaterials.has(randomLot.id)) {
            this.dbContext.cellBatches.linkBatchToMaterial(cellBatch.id, randomLot.id);
            linkedMaterials.add(randomLot.id);
          }
        }

        count++;
      }
    }

    logger.info(`Created ${count} cell batches`);
    return count;
  }

  private async generateBatteryPacks(): Promise<number> {
    const cellBatches = this.dbContext.cellBatches.listBatches();
    let count = 0;

    for (const batch of cellBatches) {
      // Create 2-4 packs per batch
      const packCount = 2 + Math.floor(Math.random() * 3);

      for (let i = 0; i < packCount; i++) {
        const packNumber = `PACK-${batch.batchNumber}-${i + 1}`;
        
        this.dbContext.cellBatches.createPack({
          packNumber,
          cellBatchId: batch.id,
          assemblyDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
          capacity: 100 + Math.random() * 200, // 100-300 kWh
        });

        count++;
      }
    }

    logger.info(`Created ${count} battery packs`);
    return count;
  }

  private async generateAssets(): Promise<number> {
    const batteryPacks = this.dbContext.cellBatches.listPacks();
    const assetTypes = [
      AssetType.FREIGHT_TRUCK,
      AssetType.MINING_VEHICLE,
      AssetType.FORKLIFT,
      AssetType.CONSTRUCTION_EQUIPMENT,
    ];

    const targetCount = config.demoAssetCount;
    let count = 0;

    for (let i = 0; i < targetCount && i < batteryPacks.length && i < this.assetNames.length; i++) {
      const pack = batteryPacks[i];
      const assetType = assetTypes[i % assetTypes.length];
      
      this.dbContext.assets.create({
        name: this.assetNames[i],
        assetType,
        batteryPackId: pack.id,
      });

      count++;
    }

    logger.info(`Created ${count} assets`);
    return count;
  }

  private async generateTelemetry(): Promise<number> {
    const assets = this.dbContext.assets.list();
    let totalRecords = 0;

    for (const asset of assets) {
      // Generate 150-300 telemetry records per asset (spanning 30-60 days)
      const recordCount = 150 + Math.floor(Math.random() * 151);
      const daysSpan = 30 + Math.floor(Math.random() * 31);
      
      // Determine if this asset should have anomalous behavior (20% chance)
      const hasAnomalies = Math.random() < 0.2;
      const degradationMultiplier = hasAnomalies ? 1.5 + Math.random() * 0.5 : 1.0;

      let baseSoh = 100;
      let totalCycles = 0;

      for (let i = 0; i < recordCount; i++) {
        const daysAgo = daysSpan * (1 - i / recordCount);
        const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

        // Simulate realistic degradation
        const cyclesSinceStart = Math.floor((recordCount - i) / 2);
        totalCycles = cyclesSinceStart;

        // Degrade SoH over time (0.03-0.05% per cycle, accelerated for anomalies)
        const degradationPerCycle = (0.03 + Math.random() * 0.02) * degradationMultiplier;
        baseSoh = 100 - (cyclesSinceStart * degradationPerCycle);

        // Add some variance
        const sohVariance = (Math.random() - 0.5) * 2;
        const currentSoh = Math.max(70, Math.min(100, baseSoh + sohVariance));

        // Generate realistic telemetry values
        const nominalVoltage = 400;
        const voltage = nominalVoltage * (currentSoh / 100) + (Math.random() - 0.5) * 10;
        
        const current = -50 + Math.random() * 100; // -50A to +50A
        
        // Temperature with occasional thermal events for some assets
        let temperature = 25 + Math.random() * 15; // Normal: 25-40°C
        if (hasAnomalies && Math.random() < 0.05) {
          // 5% chance of thermal event for anomalous assets
          temperature = Math.random() < 0.5 
            ? TEMP_MIN_SAFE - 5 - Math.random() * 5  // Cold event
            : TEMP_MAX_SAFE + 5 + Math.random() * 10; // Hot event
        }

        // State of charge varies
        const stateOfCharge = 20 + Math.random() * 60;

        this.dbContext.telemetry.create({
          assetId: asset.id,
          timestamp,
          voltage,
          current,
          temperature,
          stateOfCharge,
          cycleCount: totalCycles,
        });

        totalRecords++;
      }

      // Update asset with latest telemetry timestamp
      const latestTelemetry = this.dbContext.telemetry.getLatestByAsset(asset.id);
      if (latestTelemetry) {
        this.dbContext.assets.updateTelemetryTimestamp(
          asset.id,
          latestTelemetry.timestamp,
          latestTelemetry.cycleCount
        );
      }
    }

    logger.info(`Created ${totalRecords} telemetry records`);
    return totalRecords;
  }
}

// Import constants for thermal limits
const TEMP_MIN_SAFE = -10;
const TEMP_MAX_SAFE = 45;
