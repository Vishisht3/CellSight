import { Database } from '../sqlite-shim';
import { v4 as uuidv4 } from 'uuid';
import { Supplier, SupplierCreateInput } from '../../models/types';

export class SupplierRepository {
  constructor(private db: Database) {}

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
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO suppliers (
        id, name, tier, country, risk_score, concentration_risk,
        geopolitical_risk, quality_risk, compliance_risk,
        certification_expiry, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      supplier.id,
      supplier.name,
      supplier.tier,
      supplier.country,
      supplier.riskScore,
      supplier.concentrationRisk,
      supplier.geopoliticalRisk,
      supplier.qualityRisk,
      supplier.complianceRisk,
      supplier.certificationExpiry,
      supplier.createdAt,
      supplier.updatedAt
    );

    return supplier;
  }

  findById(id: string): Supplier | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, name, tier, country, risk_score as riskScore,
        concentration_risk as concentrationRisk, geopolitical_risk as geopoliticalRisk,
        quality_risk as qualityRisk, compliance_risk as complianceRisk,
        certification_expiry as certificationExpiry,
        created_at as createdAt, updated_at as updatedAt
      FROM suppliers 
      WHERE id = ?
    `);

    return stmt.get(id) as Supplier | undefined || null;
  }

  list(): Supplier[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, name, tier, country, risk_score as riskScore,
        concentration_risk as concentrationRisk, geopolitical_risk as geopoliticalRisk,
        quality_risk as qualityRisk, compliance_risk as complianceRisk,
        certification_expiry as certificationExpiry,
        created_at as createdAt, updated_at as updatedAt
      FROM suppliers 
      ORDER BY risk_score DESC, name ASC
    `);

    return stmt.all() as Supplier[];
  }

  listByTier(tier: string): Supplier[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, name, tier, country, risk_score as riskScore,
        concentration_risk as concentrationRisk, geopolitical_risk as geopoliticalRisk,
        quality_risk as qualityRisk, compliance_risk as complianceRisk,
        certification_expiry as certificationExpiry,
        created_at as createdAt, updated_at as updatedAt
      FROM suppliers 
      WHERE tier = ?
      ORDER BY risk_score DESC, name ASC
    `);

    return stmt.all(tier) as Supplier[];
  }

  updateRiskScores(
    id: string,
    risks: {
      concentrationRisk: number;
      geopoliticalRisk: number;
      qualityRisk: number;
      complianceRisk: number;
    }
  ): boolean {
    // Calculate composite risk score (0-100)
    // Each component is already 0-1, weighted sum gives 0-1, multiply by 100 for 0-100 scale
    const riskScore = Math.min(100, Math.round(
      (risks.concentrationRisk * 30 +
        risks.geopoliticalRisk * 25 +
        risks.qualityRisk * 30 +
        risks.complianceRisk * 15) * 100
    ) / 100);

    const stmt = this.db.prepare(`
      UPDATE suppliers 
      SET risk_score = ?,
          concentration_risk = ?,
          geopolitical_risk = ?,
          quality_risk = ?,
          compliance_risk = ?,
          updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      riskScore,
      risks.concentrationRisk,
      risks.geopoliticalRisk,
      risks.qualityRisk,
      risks.complianceRisk,
      new Date().toISOString(),
      id
    );

    return result.changes > 0;
  }

  getHighRiskSuppliers(threshold = 60): Supplier[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, name, tier, country, risk_score as riskScore,
        concentration_risk as concentrationRisk, geopolitical_risk as geopoliticalRisk,
        quality_risk as qualityRisk, compliance_risk as complianceRisk,
        certification_expiry as certificationExpiry,
        created_at as createdAt, updated_at as updatedAt
      FROM suppliers 
      WHERE risk_score >= ?
      ORDER BY risk_score DESC
    `);

    return stmt.all(threshold) as Supplier[];
  }

  getSummary(): {
    totalSuppliers: number;
    highRiskSuppliers: number;
    avgRiskScore: number;
  } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as totalSuppliers,
        SUM(CASE WHEN risk_score >= 60 THEN 1 ELSE 0 END) as highRiskSuppliers,
        AVG(risk_score) as avgRiskScore
      FROM suppliers
    `);

    return stmt.get() as any;
  }
}
