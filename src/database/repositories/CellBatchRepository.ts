import { Database } from '../sqlite-shim';
import { v4 as uuidv4 } from 'uuid';
import { CellBatch, CellBatchCreateInput, BatteryPack, BatteryPackCreateInput } from '../../models/types';

export class CellBatchRepository {
  constructor(private db: Database) {}

  createBatch(input: CellBatchCreateInput): CellBatch {
    const now = new Date().toISOString();
    const batch: CellBatch = {
      id: uuidv4(),
      batchNumber: input.batchNumber,
      manufacturerId: input.manufacturerId,
      productionDate: input.productionDate || now,
      quantity: input.quantity,
      createdAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO cell_batches (
        id, batch_number, manufacturer_id, production_date, quantity, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      batch.id,
      batch.batchNumber,
      batch.manufacturerId,
      batch.productionDate,
      batch.quantity,
      batch.createdAt
    );

    return batch;
  }

  findBatchById(id: string): CellBatch | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, batch_number as batchNumber, manufacturer_id as manufacturerId,
        production_date as productionDate, quantity, created_at as createdAt
      FROM cell_batches 
      WHERE id = ?
    `);

    return stmt.get(id) as CellBatch | undefined || null;
  }

  findBatchByNumber(batchNumber: string): CellBatch | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, batch_number as batchNumber, manufacturer_id as manufacturerId,
        production_date as productionDate, quantity, created_at as createdAt
      FROM cell_batches 
      WHERE batch_number = ?
    `);

    return stmt.get(batchNumber) as CellBatch | undefined || null;
  }

  listBatches(): CellBatch[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, batch_number as batchNumber, manufacturer_id as manufacturerId,
        production_date as productionDate, quantity, created_at as createdAt
      FROM cell_batches 
      ORDER BY production_date DESC
    `);

    return stmt.all() as CellBatch[];
  }

  linkBatchToMaterial(batchId: string, materialLotId: string): void {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO batch_material_links (id, cell_batch_id, material_lot_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, batchId, materialLotId, new Date().toISOString());
  }

  getMaterialsForBatch(batchId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT material_lot_id as materialLotId
      FROM batch_material_links 
      WHERE cell_batch_id = ?
    `);

    const results = stmt.all(batchId) as Array<{ materialLotId: string }>;
    return results.map((r) => r.materialLotId);
  }

  // Battery Pack methods
  createPack(input: BatteryPackCreateInput): BatteryPack {
    const now = new Date().toISOString();
    const pack: BatteryPack = {
      id: uuidv4(),
      packNumber: input.packNumber,
      cellBatchId: input.cellBatchId,
      assemblyDate: input.assemblyDate || now,
      capacity: input.capacity,
      createdAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO battery_packs (
        id, pack_number, cell_batch_id, assembly_date, capacity, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pack.id,
      pack.packNumber,
      pack.cellBatchId,
      pack.assemblyDate,
      pack.capacity,
      pack.createdAt
    );

    return pack;
  }

  findPackById(id: string): BatteryPack | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, pack_number as packNumber, cell_batch_id as cellBatchId,
        assembly_date as assemblyDate, capacity, created_at as createdAt
      FROM battery_packs 
      WHERE id = ?
    `);

    return stmt.get(id) as BatteryPack | undefined || null;
  }

  findPackByNumber(packNumber: string): BatteryPack | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, pack_number as packNumber, cell_batch_id as cellBatchId,
        assembly_date as assemblyDate, capacity, created_at as createdAt
      FROM battery_packs 
      WHERE pack_number = ?
    `);

    return stmt.get(packNumber) as BatteryPack | undefined || null;
  }

  listPacks(): BatteryPack[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, pack_number as packNumber, cell_batch_id as cellBatchId,
        assembly_date as assemblyDate, capacity, created_at as createdAt
      FROM battery_packs 
      ORDER BY assembly_date DESC
    `);

    return stmt.all() as BatteryPack[];
  }

  listPacksByBatch(cellBatchId: string): BatteryPack[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, pack_number as packNumber, cell_batch_id as cellBatchId,
        assembly_date as assemblyDate, capacity, created_at as createdAt
      FROM battery_packs 
      WHERE cell_batch_id = ?
      ORDER BY assembly_date DESC
    `);

    return stmt.all(cellBatchId) as BatteryPack[];
  }
}
