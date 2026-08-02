import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';
import { CellBatch, CellBatchCreateInput, BatteryPack, BatteryPackCreateInput } from '../../models/types';

const BATCH_COLS = `
  id, batch_number as batchNumber, manufacturer_id as manufacturerId,
  production_date as productionDate, quantity,
  organization_id as organizationId, created_at as createdAt
`;

const PACK_COLS = `
  id, pack_number as packNumber, cell_batch_id as cellBatchId,
  assembly_date as assemblyDate, capacity,
  organization_id as organizationId, created_at as createdAt
`;

export class CellBatchRepository {
  constructor(private db: DbDriver) {}

  // ── Cell Batches ──────────────────────────────────────────────────────

  createBatch(input: CellBatchCreateInput): CellBatch {
    const now = new Date().toISOString();
    const batch: CellBatch = {
      id: uuidv4(),
      batchNumber: input.batchNumber,
      manufacturerId: input.manufacturerId,
      productionDate: input.productionDate || now,
      quantity: input.quantity,
      organizationId: input.organizationId,
      createdAt: now,
    };

    this.db.prepare(`
      INSERT INTO cell_batches (id, batch_number, manufacturer_id, production_date, quantity, organization_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(batch.id, batch.batchNumber, batch.manufacturerId, batch.productionDate, batch.quantity, batch.organizationId, batch.createdAt);

    return batch;
  }

  findBatchById(id: string): CellBatch | null {
    return this.db.prepare(`SELECT ${BATCH_COLS} FROM cell_batches WHERE id = ?`).get(id) as CellBatch | null;
  }

  findBatchByNumber(batchNumber: string): CellBatch | null {
    return this.db.prepare(`SELECT ${BATCH_COLS} FROM cell_batches WHERE batch_number = ?`).get(batchNumber) as CellBatch | null;
  }

  listBatches(organizationId: string): CellBatch[] {
    return this.db.prepare(
      `SELECT ${BATCH_COLS} FROM cell_batches WHERE organization_id = ? ORDER BY production_date DESC`
    ).all(organizationId) as CellBatch[];
  }

  linkBatchToMaterial(batchId: string, materialLotId: string): void {
    this.db.prepare(
      `INSERT OR IGNORE INTO batch_material_links (id, cell_batch_id, material_lot_id, created_at) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), batchId, materialLotId, new Date().toISOString());
  }

  getMaterialsForBatch(batchId: string): string[] {
    const rows = this.db.prepare(
      `SELECT material_lot_id as materialLotId FROM batch_material_links WHERE cell_batch_id = ?`
    ).all(batchId) as Array<{ materialLotId: string }>;
    return rows.map(r => r.materialLotId);
  }

  // ── Battery Packs ─────────────────────────────────────────────────────

  createPack(input: BatteryPackCreateInput): BatteryPack {
    const now = new Date().toISOString();
    const pack: BatteryPack = {
      id: uuidv4(),
      packNumber: input.packNumber,
      cellBatchId: input.cellBatchId,
      assemblyDate: input.assemblyDate || now,
      capacity: input.capacity,
      organizationId: input.organizationId,
      createdAt: now,
    };

    this.db.prepare(`
      INSERT INTO battery_packs (id, pack_number, cell_batch_id, assembly_date, capacity, organization_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(pack.id, pack.packNumber, pack.cellBatchId, pack.assemblyDate, pack.capacity, pack.organizationId, pack.createdAt);

    return pack;
  }

  findPackById(id: string): BatteryPack | null {
    return this.db.prepare(`SELECT ${PACK_COLS} FROM battery_packs WHERE id = ?`).get(id) as BatteryPack | null;
  }

  findPackByNumber(packNumber: string): BatteryPack | null {
    return this.db.prepare(`SELECT ${PACK_COLS} FROM battery_packs WHERE pack_number = ?`).get(packNumber) as BatteryPack | null;
  }

  listPacks(organizationId: string): BatteryPack[] {
    return this.db.prepare(
      `SELECT ${PACK_COLS} FROM battery_packs WHERE organization_id = ? ORDER BY assembly_date DESC`
    ).all(organizationId) as BatteryPack[];
  }

  listPacksByBatch(cellBatchId: string): BatteryPack[] {
    return this.db.prepare(
      `SELECT ${PACK_COLS} FROM battery_packs WHERE cell_batch_id = ? ORDER BY assembly_date DESC`
    ).all(cellBatchId) as BatteryPack[];
  }
}
