/**
 * DemoDataGenerator — generates a full synthetic fleet dataset.
 *
 * On Postgres (production) every step uses queryAsync batch INSERTs so
 * the entire seed completes in under 2 minutes instead of hours.
 * On SQLite (local dev) it falls back to the synchronous repository layer.
 */
import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import {
  AssetType, MaterialType, SupplierTier, UserRole,
  DEMO_ORG_ID, TEMP_MIN_SAFE, TEMP_MAX_SAFE,
} from '../config/constants';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

interface GeneratedData {
  users: number; suppliers: number; materialLots: number;
  cellBatches: number; batteryPacks: number; assets: number; telemetryRecords: number;
}

// ── helpers ───────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }
function daysAgo(d: number) { return new Date(Date.now() - d * 86_400_000).toISOString(); }
function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }

/** Postgres batch insert via queryAsync. Chunks params to stay under PG limit. */
async function pgInsert(db: any, table: string, cols: string[], rows: unknown[][]): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK = 50; // stay well under the 65535 param limit
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const placeholders = chunk.map((_, ri) =>
      '(' + cols.map((__, ci) => `$${ri * cols.length + ci + 1}`).join(',') + ')'
    ).join(',');
    await db.queryAsync(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`,
      chunk.flat()
    );
  }
}

// ── Generator class ───────────────────────────────────────────────────────

export class DemoDataGenerator {
  private readonly orgId = DEMO_ORG_ID;
  private isPostgres = false;
  private pg: any = null;

  // in-memory caches
  private supplierRows:    Array<{ id: string; tier: string; name: string }> = [];
  private materialLotRows: Array<{ id: string }> = [];
  private cellBatchRows:   Array<{ id: string; batchNumber: string }> = [];
  private batteryPackRows: Array<{ id: string }> = [];
  private assetRows:       Array<{ id: string }> = [];

  private assetNames = [
    'FreightLiner-001','FreightLiner-002','FreightLiner-003','FreightLiner-004','FreightLiner-005',
    'Haul-Truck-A1','Haul-Truck-A2','Haul-Truck-B1','Haul-Truck-B2','Haul-Truck-C1',
    'Forklift-FL01','Forklift-FL02','Forklift-FL03','Forklift-FL04','Forklift-FL05',
    'Forklift-FL06','Forklift-FL07','Forklift-FL08','Forklift-FL09','Forklift-FL10',
    'Excavator-EX1','Excavator-EX2','Excavator-EX3','Loader-LD1','Loader-LD2',
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
    const { PgDatabase } = await import('../database/pg-adapter');
    this.isPostgres = this.dbContext.db instanceof PgDatabase;
    this.pg = this.isPostgres ? this.dbContext.db : null;

    const stats: GeneratedData = {
      users: 0, suppliers: 0, materialLots: 0, cellBatches: 0,
      batteryPacks: 0, assets: 0, telemetryRecords: 0,
    };

    stats.users            = await this.generateUsers();
    stats.suppliers        = await this.generateSuppliers();
    stats.materialLots     = await this.generateMaterialLots();
    stats.cellBatches      = await this.generateCellBatches();
    stats.batteryPacks     = await this.generateBatteryPacks();
    stats.assets           = await this.generateAssets();
    stats.telemetryRecords = await this.generateTelemetry();

    logger.info('Demo data generation complete', stats);
    return stats;
  }

  // ── Users ────────────────────────────────────────────────────────────────

  private async generateUsers(): Promise<number> {
    const passwordHash = await bcrypt.hash('demo123', 10);
    const t = now();
    const rows = [
      [uuidv4(), 'maintenance@cellsight.com', passwordHash, UserRole.FLEET_MANAGER,         'Maya Patel, Maintenance Planner', this.orgId, t, t],
      [uuidv4(), 'fleet@cellsight.com',        passwordHash, UserRole.FLEET_MANAGER,         'Jordan Lee, Fleet Operations',    this.orgId, t, t],
      [uuidv4(), 'supply@cellsight.com',        passwordHash, UserRole.SUPPLY_CHAIN_MANAGER,  'Elena Ruiz, Supplier Quality',    this.orgId, t, t],
    ];
    if (this.isPostgres) {
      await pgInsert(this.pg, 'users',
        ['id','email','password_hash','role','name','organization_id','created_at','updated_at'], rows);
    } else {
      for (const r of rows) {
        this.dbContext.users.create({
          email: r[1] as string, passwordHash: r[2] as string,
          role: r[3] as any, name: r[4] as string, organizationId: r[5] as string,
        });
      }
    }
    logger.info('Created 3 portal demo users');
    return 3;
  }

  // ── Suppliers ────────────────────────────────────────────────────────────

  private async generateSuppliers(): Promise<number> {
    const t = now();
    const rows = this.supplierDefs.map(sd => {
      const r = Math.random();
      const certExp = r < 0.2 ? daysAgo(-365) : r < 0.4 ? daysAgo(-30) : daysAgo(-0);
      const id = uuidv4();
      this.supplierRows.push({ id, tier: sd.tier, name: sd.name });
      return [id, sd.name, sd.tier, sd.country, 0, 0, 0, 0, 0, certExp, this.orgId, t, t];
    });
    if (this.isPostgres) {
      await pgInsert(this.pg, 'suppliers',
        ['id','name','tier','country','risk_score','concentration_risk','geopolitical_risk',
         'quality_risk','compliance_risk','certification_expiry','organization_id','created_at','updated_at'],
        rows);
    } else {
      for (const sd of this.supplierDefs) {
        const r = Math.random();
        const certExp = r < 0.2 ? daysAgo(-365) : r < 0.4 ? daysAgo(-30) : daysAgo(-0);
        this.dbContext.suppliers.create({ name: sd.name, tier: sd.tier, country: sd.country, certificationExpiry: certExp, organizationId: this.orgId });
      }
    }
    logger.info(`Created ${this.supplierRows.length} suppliers`);
    return this.supplierRows.length;
  }

  // ── Material lots ─────────────────────────────────────────────────────────

  private async generateMaterialLots(): Promise<number> {
    const materialTypes = [MaterialType.LITHIUM, MaterialType.COBALT, MaterialType.NICKEL, MaterialType.GRAPHITE, MaterialType.MANGANESE];
    const tier3 = this.supplierRows.filter(s => s.tier === SupplierTier.TIER_3);
    const rows: unknown[][] = [];
    let count = 0;

    // need supplier country — look it up from supplierDefs
    const countryMap = Object.fromEntries(this.supplierDefs.map(s => [s.name, s.country]));

    for (const materialType of materialTypes) {
      for (const supplier of tier3) {
        const country = countryMap[supplier.name] ?? 'US';
        const lotCount = randInt(2, 5);
        for (let i = 0; i < lotCount; i++) {
          const id = uuidv4();
          const lotNumber = `${materialType.toUpperCase()}-${country}-${new Date().getFullYear()}-${(count + 1842).toString().padStart(5,'0')}`;
          const baseQ = rand(85, 95);
          const qualityScore = Math.random() < 0.15 ? baseQ - rand(5, 10) : baseQ;
          const t = now();
          rows.push([id, lotNumber, materialType, supplier.id, rand(1000,5000), country,
            daysAgo(rand(0,180)), Math.round(qualityScore*10)/10, 85, 95, this.orgId, t]);
          this.materialLotRows.push({ id });
          count++;
        }
      }
    }

    if (this.isPostgres) {
      await pgInsert(this.pg, 'material_lots',
        ['id','lot_number','material_type','supplier_id','quantity','country','received_at',
         'quality_score','specification_min','specification_max','organization_id','created_at'],
        rows);
    } else {
      for (const r of rows) {
        this.dbContext.materials.create({
          lotNumber: r[1] as string, materialType: r[2] as any, supplierId: r[3] as string,
          quantity: r[4] as number, country: r[5] as string, receivedAt: r[6] as string,
          qualityScore: r[7] as number, specificationMin: 85, specificationMax: 95,
          organizationId: this.orgId,
        });
      }
    }
    logger.info(`Created ${count} material lots`);
    return count;
  }

  // ── Cell batches ──────────────────────────────────────────────────────────

  private async generateCellBatches(): Promise<number> {
    const tier2 = this.supplierRows.filter(s => s.tier === SupplierTier.TIER_2);
    const batchRows: unknown[][] = [];
    const linkRows:  unknown[][] = [];
    let count = 0;

    for (const mfr of tier2) {
      const batchCount = randInt(3, 6);
      for (let i = 0; i < batchCount; i++) {
        const id = uuidv4();
        const code = mfr.name.split(' ').map(p => p[0]).join('').slice(0,4).toUpperCase();
        const batchNumber = `CELL-${code}-${(count + 620).toString().padStart(4,'0')}`;
        const t = now();
        batchRows.push([id, batchNumber, mfr.id, daysAgo(rand(0,120)), randInt(5000,10000), this.orgId, t]);
        this.cellBatchRows.push({ id, batchNumber });

        const linkCount = randInt(3, 5);
        const linked = new Set<string>();
        while (linked.size < linkCount && linked.size < this.materialLotRows.length) {
          const lot = this.materialLotRows[Math.floor(Math.random() * this.materialLotRows.length)];
          if (!linked.has(lot.id)) { linked.add(lot.id); linkRows.push([uuidv4(), id, lot.id, t]); }
        }
        count++;
      }
    }

    if (this.isPostgres) {
      await pgInsert(this.pg, 'cell_batches',
        ['id','batch_number','manufacturer_id','production_date','quantity','organization_id','created_at'],
        batchRows);
      await pgInsert(this.pg, 'batch_material_links',
        ['id','cell_batch_id','material_lot_id','created_at'], linkRows);
    } else {
      for (const r of batchRows) {
        this.dbContext.cellBatches.createBatch({
          batchNumber: r[1] as string, manufacturerId: r[2] as string,
          productionDate: r[3] as string, quantity: r[4] as number, organizationId: this.orgId,
        });
      }
      for (const r of linkRows) {
        this.dbContext.cellBatches.linkBatchToMaterial(r[1] as string, r[2] as string);
      }
    }
    logger.info(`Created ${count} cell batches`);
    return count;
  }

  // ── Battery packs ─────────────────────────────────────────────────────────

  private async generateBatteryPacks(): Promise<number> {
    const rows: unknown[][] = [];
    for (const batch of this.cellBatchRows) {
      const packCount = randInt(2, 4);
      for (let i = 0; i < packCount; i++) {
        const id = uuidv4();
        const t = now();
        rows.push([id, `PACK-${batch.batchNumber}-${String(i+1).padStart(2,'0')}`,
          batch.id, daysAgo(rand(0,90)), rand(100,300), this.orgId, t]);
        this.batteryPackRows.push({ id });
      }
    }
    if (this.isPostgres) {
      await pgInsert(this.pg, 'battery_packs',
        ['id','pack_number','cell_batch_id','assembly_date','capacity','organization_id','created_at'],
        rows);
    } else {
      for (const r of rows) {
        this.dbContext.cellBatches.createPack({
          packNumber: r[1] as string, cellBatchId: r[2] as string,
          assemblyDate: r[3] as string, capacity: r[4] as number, organizationId: this.orgId,
        });
      }
    }
    logger.info(`Created ${this.batteryPackRows.length} battery packs`);
    return this.batteryPackRows.length;
  }

  // ── Assets ───────────────────────────────────────────────────────────────

  private async generateAssets(): Promise<number> {
    const assetTypes = [AssetType.FREIGHT_TRUCK, AssetType.MINING_VEHICLE, AssetType.FORKLIFT, AssetType.CONSTRUCTION_EQUIPMENT];
    const target = Math.min(config.demoAssetCount, this.batteryPackRows.length, this.assetNames.length);
    const rows: unknown[][] = [];
    for (let i = 0; i < target; i++) {
      const id = uuidv4();
      const t = now();
      rows.push([id, this.assetNames[i], assetTypes[i % assetTypes.length],
        this.batteryPackRows[i].id, 'insufficient_data', null, null, null, null, null, 0, this.orgId, t, t]);
      this.assetRows.push({ id });
    }
    if (this.isPostgres) {
      await pgInsert(this.pg, 'assets',
        ['id','name','asset_type','battery_pack_id','status','current_soh','soh_confidence',
         'predicted_rul_days','predicted_rul_cycles','last_telemetry_at','total_cycles',
         'organization_id','created_at','updated_at'],
        rows);
    } else {
      for (const r of rows) {
        this.dbContext.assets.create({
          name: r[1] as string, assetType: r[2] as any,
          batteryPackId: r[3] as string, organizationId: this.orgId,
        });
      }
    }
    logger.info(`Created ${target} assets`);
    return target;
  }

  // ── Telemetry ─────────────────────────────────────────────────────────────

  private async generateTelemetry(): Promise<number> {
    // Use in-memory assetRows (already inserted above — no DB read needed)
    const assets = this.assetRows;
    let totalRecords = 0;

    for (const { id: assetId } of assets) {
      const recordCount  = randInt(150, 300);
      const daysSpan     = randInt(30, 60);
      const hasAnomalies = Math.random() < 0.2;
      const degradMult   = hasAnomalies ? rand(1.5, 2.0) : 1.0;
      const t = now();

      const rows: unknown[][] = [];
      let firstTs = '';

      for (let i = 0; i < recordCount; i++) {
        const agedays    = daysSpan * (1 - i / recordCount);
        const timestamp  = new Date(Date.now() - agedays * 86_400_000).toISOString();
        const cycles     = Math.floor((recordCount - i) / 2);
        const baseSoh    = 100 - cycles * (0.03 + Math.random() * 0.02) * degradMult;
        const currentSoh = Math.max(70, Math.min(100, baseSoh + (Math.random() - 0.5) * 2));
        const voltage    = 400 * (currentSoh / 100) + (Math.random() - 0.5) * 10;
        const current    = rand(-50, 50);
        let temperature  = rand(25, 40);
        if (hasAnomalies && Math.random() < 0.05) {
          temperature = Math.random() < 0.5 ? TEMP_MIN_SAFE - rand(5,10) : TEMP_MAX_SAFE + rand(5,15);
        }
        if (i === 0) firstTs = timestamp;
        rows.push([uuidv4(), assetId, timestamp, voltage, current, temperature,
          rand(20, 80), cycles, t]);
      }

      if (this.isPostgres) {
        const CHUNK = 100;
        for (let s = 0; s < rows.length; s += CHUNK) {
          const chunk = rows.slice(s, s + CHUNK);
          const vals  = chunk.map((_, j) => {
            const b = j * 9;
            return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`;
          }).join(',');
          await this.pg.queryAsync(
            `INSERT INTO telemetry_data (id,asset_id,timestamp,voltage,current,temperature,state_of_charge,cycle_count,created_at) VALUES ${vals}`,
            chunk.flat()
          );
        }
        // Update asset last_telemetry_at
        await this.pg.queryAsync(
          `UPDATE assets SET last_telemetry_at=$1, total_cycles=$2, updated_at=$3 WHERE id=$4`,
          [firstTs, rows[0][7], t, assetId]
        );
      } else {
        for (const r of rows) {
          this.dbContext.telemetry.create({
            assetId, timestamp: r[2] as string, voltage: r[3] as number,
            current: r[4] as number, temperature: r[5] as number,
            stateOfCharge: r[6] as number, cycleCount: r[7] as number,
          });
        }
        if (firstTs) this.dbContext.assets.updateTelemetryTimestamp(assetId, firstTs, rows[0][7] as number);
      }
      totalRecords += rows.length;
    }

    logger.info(`Created ${totalRecords} telemetry records`);
    return totalRecords;
  }
}
