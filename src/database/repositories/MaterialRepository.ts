import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';
import { MaterialLot, MaterialLotCreateInput } from '../../models/types';

export class MaterialRepository {
  constructor(private db: DbDriver) {}

  create(input: MaterialLotCreateInput): MaterialLot {
    const now = new Date().toISOString();
    const materialLot: MaterialLot = {
      id: uuidv4(),
      lotNumber: input.lotNumber,
      materialType: input.materialType,
      supplierId: input.supplierId,
      quantity: input.quantity,
      country: input.country,
      receivedAt: input.receivedAt || now,
      qualityScore: input.qualityScore || null,
      specificationMin: input.specificationMin || null,
      specificationMax: input.specificationMax || null,
      createdAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO material_lots (
        id, lot_number, material_type, supplier_id, quantity, country,
        received_at, quality_score, specification_min, specification_max, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      materialLot.id,
      materialLot.lotNumber,
      materialLot.materialType,
      materialLot.supplierId,
      materialLot.quantity,
      materialLot.country,
      materialLot.receivedAt,
      materialLot.qualityScore,
      materialLot.specificationMin,
      materialLot.specificationMax,
      materialLot.createdAt
    );

    return materialLot;
  }

  findById(id: string): MaterialLot | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, lot_number as lotNumber, material_type as materialType,
        supplier_id as supplierId, quantity, country, received_at as receivedAt,
        quality_score as qualityScore, specification_min as specificationMin,
        specification_max as specificationMax, created_at as createdAt
      FROM material_lots 
      WHERE id = ?
    `);

    return stmt.get(id) as MaterialLot | undefined || null;
  }

  findByLotNumber(lotNumber: string): MaterialLot | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, lot_number as lotNumber, material_type as materialType,
        supplier_id as supplierId, quantity, country, received_at as receivedAt,
        quality_score as qualityScore, specification_min as specificationMin,
        specification_max as specificationMax, created_at as createdAt
      FROM material_lots 
      WHERE lot_number = ?
    `);

    return stmt.get(lotNumber) as MaterialLot | undefined || null;
  }

  list(): MaterialLot[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, lot_number as lotNumber, material_type as materialType,
        supplier_id as supplierId, quantity, country, received_at as receivedAt,
        quality_score as qualityScore, specification_min as specificationMin,
        specification_max as specificationMax, created_at as createdAt
      FROM material_lots 
      ORDER BY received_at DESC
    `);

    return stmt.all() as MaterialLot[];
  }

  listBySupplier(supplierId: string): MaterialLot[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, lot_number as lotNumber, material_type as materialType,
        supplier_id as supplierId, quantity, country, received_at as receivedAt,
        quality_score as qualityScore, specification_min as specificationMin,
        specification_max as specificationMax, created_at as createdAt
      FROM material_lots 
      WHERE supplier_id = ?
      ORDER BY received_at DESC
    `);

    return stmt.all(supplierId) as MaterialLot[];
  }

  listByMaterialType(materialType: string): MaterialLot[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, lot_number as lotNumber, material_type as materialType,
        supplier_id as supplierId, quantity, country, received_at as receivedAt,
        quality_score as qualityScore, specification_min as specificationMin,
        specification_max as specificationMax, created_at as createdAt
      FROM material_lots 
      WHERE material_type = ?
      ORDER BY received_at DESC
    `);

    return stmt.all(materialType) as MaterialLot[];
  }

  getSupplierConcentration(materialType: string): Array<{
    supplierId: string;
    totalQuantity: number;
    share: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        supplier_id as supplierId,
        SUM(quantity) as totalQuantity,
        SUM(quantity) * 1.0 / (SELECT SUM(quantity) FROM material_lots WHERE material_type = ?) as share
      FROM material_lots
      WHERE material_type = ?
      GROUP BY supplier_id
      ORDER BY share DESC
    `);

    return stmt.all(materialType, materialType) as any[];
  }

  getQualityDeviations(threshold: number): MaterialLot[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, lot_number as lotNumber, material_type as materialType,
        supplier_id as supplierId, quantity, country, received_at as receivedAt,
        quality_score as qualityScore, specification_min as specificationMin,
        specification_max as specificationMax, created_at as createdAt
      FROM material_lots 
      WHERE quality_score IS NOT NULL 
        AND specification_min IS NOT NULL 
        AND specification_max IS NOT NULL
        AND (
          quality_score < specification_min * (1 - ?)
          OR quality_score > specification_max * (1 + ?)
        )
      ORDER BY received_at DESC
    `);

    return stmt.all(threshold, threshold) as MaterialLot[];
  }
}
