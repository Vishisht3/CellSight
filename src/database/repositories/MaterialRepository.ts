import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';
import { MaterialLot, MaterialLotCreateInput } from '../../models/types';

const SELECT_COLS = `
  id, lot_number as lotNumber, material_type as materialType,
  supplier_id as supplierId, quantity, country, received_at as receivedAt,
  quality_score as qualityScore, specification_min as specificationMin,
  specification_max as specificationMax, organization_id as organizationId,
  created_at as createdAt
`;

export class MaterialRepository {
  constructor(private db: DbDriver) {}

  create(input: MaterialLotCreateInput): MaterialLot {
    const now = new Date().toISOString();
    const lot: MaterialLot = {
      id: uuidv4(),
      lotNumber: input.lotNumber,
      materialType: input.materialType,
      supplierId: input.supplierId,
      quantity: input.quantity,
      country: input.country,
      receivedAt: input.receivedAt || now,
      qualityScore: input.qualityScore ?? null,
      specificationMin: input.specificationMin ?? null,
      specificationMax: input.specificationMax ?? null,
      organizationId: input.organizationId,
      createdAt: now,
    };

    this.db.prepare(`
      INSERT INTO material_lots (
        id, lot_number, material_type, supplier_id, quantity, country,
        received_at, quality_score, specification_min, specification_max,
        organization_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lot.id, lot.lotNumber, lot.materialType, lot.supplierId,
      lot.quantity, lot.country, lot.receivedAt,
      lot.qualityScore, lot.specificationMin, lot.specificationMax,
      lot.organizationId, lot.createdAt
    );

    return lot;
  }

  findById(id: string): MaterialLot | null {
    return this.db.prepare(`SELECT ${SELECT_COLS} FROM material_lots WHERE id = ?`).get(id) as MaterialLot | null;
  }

  findByLotNumber(lotNumber: string): MaterialLot | null {
    return this.db.prepare(`SELECT ${SELECT_COLS} FROM material_lots WHERE lot_number = ?`).get(lotNumber) as MaterialLot | null;
  }

  list(organizationId: string): MaterialLot[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM material_lots WHERE organization_id = ? ORDER BY received_at DESC`
    ).all(organizationId) as MaterialLot[];
  }

  listBySupplier(supplierId: string, organizationId: string): MaterialLot[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM material_lots WHERE supplier_id = ? AND organization_id = ? ORDER BY received_at DESC`
    ).all(supplierId, organizationId) as MaterialLot[];
  }

  listByMaterialType(materialType: string, organizationId: string): MaterialLot[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM material_lots WHERE material_type = ? AND organization_id = ? ORDER BY received_at DESC`
    ).all(materialType, organizationId) as MaterialLot[];
  }

  getSupplierConcentration(materialType: string, organizationId: string): Array<{
    supplierId: string;
    totalQuantity: number;
    share: number;
  }> {
    return this.db.prepare(`
      SELECT
        supplier_id as supplierId,
        SUM(quantity) as totalQuantity,
        SUM(quantity) * 1.0 / (
          SELECT SUM(quantity) FROM material_lots
          WHERE material_type = ? AND organization_id = ?
        ) as share
      FROM material_lots
      WHERE material_type = ? AND organization_id = ?
      GROUP BY supplier_id
      ORDER BY share DESC
    `).all(materialType, organizationId, materialType, organizationId) as any[];
  }

  getQualityDeviations(threshold: number, organizationId: string): MaterialLot[] {
    return this.db.prepare(`
      SELECT ${SELECT_COLS} FROM material_lots
      WHERE organization_id = ?
        AND quality_score IS NOT NULL
        AND specification_min IS NOT NULL
        AND specification_max IS NOT NULL
        AND (
          quality_score < specification_min * (1 - ?)
          OR quality_score > specification_max * (1 + ?)
        )
      ORDER BY received_at DESC
    `).all(organizationId, threshold, threshold) as MaterialLot[];
  }
}
