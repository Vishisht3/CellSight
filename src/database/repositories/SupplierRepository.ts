import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';
import { Supplier, SupplierCreateInput } from '../../models/types';

const SELECT_COLS = `
  id, name, tier, country, risk_score as riskScore,
  concentration_risk as concentrationRisk, geopolitical_risk as geopoliticalRisk,
  quality_risk as qualityRisk, compliance_risk as complianceRisk,
  certification_expiry as certificationExpiry,
  organization_id as organizationId,
  created_at as createdAt, updated_at as updatedAt
`;

export class SupplierRepository {
  constructor(private db: DbDriver) {}

  create(input: SupplierCreateInput): Supplier {
    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: uuidv4(),
      name: input.name,
      tier: input.tier,
      country: input.country,
      riskScore: 0,
      concentrationRisk: 0,
      geopoliticalRisk: 0,
      qualityRisk: 0,
      complianceRisk: 0,
      certificationExpiry: input.certificationExpiry || null,
      organizationId: input.organizationId,
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO suppliers (
        id, name, tier, country, risk_score, concentration_risk,
        geopolitical_risk, quality_risk, compliance_risk,
        certification_expiry, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      supplier.id, supplier.name, supplier.tier, supplier.country,
      supplier.riskScore, supplier.concentrationRisk, supplier.geopoliticalRisk,
      supplier.qualityRisk, supplier.complianceRisk, supplier.certificationExpiry,
      supplier.organizationId, supplier.createdAt, supplier.updatedAt
    );

    return supplier;
  }

  findById(id: string): Supplier | null {
    return this.db.prepare(`SELECT ${SELECT_COLS} FROM suppliers WHERE id = ?`).get(id) as Supplier | null;
  }

  list(organizationId: string): Supplier[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM suppliers WHERE organization_id = ? ORDER BY risk_score DESC, name ASC`
    ).all(organizationId) as Supplier[];
  }

  listByTier(tier: string, organizationId: string): Supplier[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM suppliers WHERE tier = ? AND organization_id = ? ORDER BY risk_score DESC, name ASC`
    ).all(tier, organizationId) as Supplier[];
  }

  getHighRiskSuppliers(threshold: number, organizationId: string): Supplier[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM suppliers WHERE risk_score >= ? AND organization_id = ? ORDER BY risk_score DESC`
    ).all(threshold, organizationId) as Supplier[];
  }

  updateRiskScores(id: string, risks: {
    concentrationRisk: number;
    geopoliticalRisk: number;
    qualityRisk: number;
    complianceRisk: number;
  }): boolean {
    const riskScore = Math.min(100, Math.round(
      (risks.concentrationRisk * 30 + risks.geopoliticalRisk * 25 +
       risks.qualityRisk * 30 + risks.complianceRisk * 15) * 100
    ) / 100);

    const result = this.db.prepare(`
      UPDATE suppliers
      SET risk_score = ?, concentration_risk = ?, geopolitical_risk = ?,
          quality_risk = ?, compliance_risk = ?, updated_at = ?
      WHERE id = ?
    `).run(
      riskScore, risks.concentrationRisk, risks.geopoliticalRisk,
      risks.qualityRisk, risks.complianceRisk, new Date().toISOString(), id
    );
    return result.changes > 0;
  }

  getSummary(organizationId: string): {
    totalSuppliers: number;
    highRiskSuppliers: number;
    avgRiskScore: number;
  } {
    return this.db.prepare(`
      SELECT
        COUNT(*) as totalSuppliers,
        SUM(CASE WHEN risk_score >= 60 THEN 1 ELSE 0 END) as highRiskSuppliers,
        AVG(risk_score) as avgRiskScore
      FROM suppliers
      WHERE organization_id = ?
    `).get(organizationId) as any;
  }
}
