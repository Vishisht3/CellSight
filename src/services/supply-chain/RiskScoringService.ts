import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';
import { AlertSeverity, AlertType, AlertSourceAgent } from '../../config/constants';

export class RiskScoringService {
  constructor(
    private dbContext: DatabaseContext,
    private organizationId: string
  ) {}

  calculateConcentrationRisk(supplierId: string): number {
    try {
      const supplierLots = this.dbContext.materials.listBySupplier(supplierId, this.organizationId);
      if (supplierLots.length === 0) return 0;
      const materialTypes = new Set(supplierLots.map(l => l.materialType));
      let maxConcentration = 0;
      for (const mt of materialTypes) {
        const concentration = this.dbContext.materials.getSupplierConcentration(mt, this.organizationId);
        const share = concentration.find(c => c.supplierId === supplierId)?.share ?? 0;
        if (share > maxConcentration) maxConcentration = share;
      }
      return Math.min(1, maxConcentration >= config.supplierConcentrationThreshold
        ? 1
        : maxConcentration / config.supplierConcentrationThreshold);
    } catch (error) {
      logger.error('Concentration risk failed', { supplierId, error });
      return 0;
    }
  }

  calculateGeopoliticalRisk(supplierId: string): number {
    const supplier = this.dbContext.suppliers.findById(supplierId);
    return supplier && config.geopoliticalRiskRegions.includes(supplier.country) ? 1 : 0;
  }

  calculateQualityRisk(supplierId: string): number {
    try {
      const lots = this.dbContext.materials.listBySupplier(supplierId, this.organizationId);
      const withData = lots.filter(l => l.qualityScore !== null && l.specificationMin !== null && l.specificationMax !== null);
      if (withData.length === 0) return 0;
      const t = config.qualityDeviationThreshold;
      const deviating = withData.filter(l =>
        l.qualityScore! < l.specificationMin! * (1 - t) ||
        l.qualityScore! > l.specificationMax! * (1 + t)
      );
      return deviating.length / withData.length;
    } catch (error) {
      logger.error('Quality risk failed', { supplierId, error });
      return 0;
    }
  }

  calculateComplianceRisk(supplierId: string): number {
    const supplier = this.dbContext.suppliers.findById(supplierId);
    if (!supplier) return 0;
    if (!supplier.certificationExpiry) return 1;
    const expiry = new Date(supplier.certificationExpiry);
    const now = new Date();
    if (expiry < now) return 1;
    const daysToExpiry = (expiry.getTime() - now.getTime()) / 86_400_000;
    return daysToExpiry <= 90 ? 1 - daysToExpiry / 90 : 0;
  }

  updateSupplierRiskScore(supplierId: string): boolean {
    try {
      return this.dbContext.suppliers.updateRiskScores(supplierId, {
        concentrationRisk: this.calculateConcentrationRisk(supplierId),
        geopoliticalRisk:  this.calculateGeopoliticalRisk(supplierId),
        qualityRisk:       this.calculateQualityRisk(supplierId),
        complianceRisk:    this.calculateComplianceRisk(supplierId),
      });
    } catch (error) {
      logger.error('Risk score update failed', { supplierId, error });
      return false;
    }
  }

  generateSupplierRiskAlerts(supplierId: string): number {
    try {
      const supplier = this.dbContext.suppliers.findById(supplierId);
      if (!supplier) return 0;
      let alertsCreated = 0;

      const existing = this.dbContext.alerts.listBySupplier(supplierId, this.organizationId, 20);
      const hasOpen  = (type: string) => existing.some(a => a.type === type && a.status === 'open');

      if (supplier.concentrationRisk >= 0.8 && !hasOpen(AlertType.CONCENTRATION_RISK)) {
        this.dbContext.alerts.create({ type: AlertType.CONCENTRATION_RISK, severity: AlertSeverity.WARNING, sourceAgent: AlertSourceAgent.SUPPLY_CHAIN, supplierId, title: `Supplier Concentration Risk: ${supplier.name}`, description: `${supplier.name} accounts for a high share of critical material volume.`, metadata: { concentrationRisk: supplier.concentrationRisk }, organizationId: this.organizationId });
        alertsCreated++;
      }
      if (supplier.geopoliticalRisk >= 1 && !hasOpen(AlertType.GEOPOLITICAL_RISK)) {
        this.dbContext.alerts.create({ type: AlertType.GEOPOLITICAL_RISK, severity: AlertSeverity.WARNING, sourceAgent: AlertSourceAgent.SUPPLY_CHAIN, supplierId, title: `Geopolitical Risk: ${supplier.name}`, description: `${supplier.name} is in high-risk region ${supplier.country}.`, metadata: { country: supplier.country }, organizationId: this.organizationId });
        alertsCreated++;
      }
      if (supplier.qualityRisk >= 0.3 && !hasOpen(AlertType.QUALITY_DEVIATION)) {
        this.dbContext.alerts.create({ type: AlertType.QUALITY_DEVIATION, severity: AlertSeverity.WARNING, sourceAgent: AlertSourceAgent.SUPPLY_CHAIN, supplierId, title: `Quality Deviation: ${supplier.name}`, description: `${supplier.name} has significant proportion of out-of-spec material lots.`, metadata: { qualityRisk: supplier.qualityRisk }, organizationId: this.organizationId });
        alertsCreated++;
      }
      if (supplier.complianceRisk >= 0.5 && !hasOpen(AlertType.COMPLIANCE_GAP)) {
        this.dbContext.alerts.create({ type: AlertType.COMPLIANCE_GAP, severity: supplier.complianceRisk >= 1 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING, sourceAgent: AlertSourceAgent.SUPPLY_CHAIN, supplierId, title: `Compliance Gap: ${supplier.name}`, description: `${supplier.name} certification ${supplier.certificationExpiry ? `expires ${supplier.certificationExpiry}` : 'is missing'}.`, metadata: { complianceRisk: supplier.complianceRisk, certificationExpiry: supplier.certificationExpiry }, organizationId: this.organizationId });
        alertsCreated++;
      }

      return alertsCreated;
    } catch (error) {
      logger.error('Risk alert generation failed', { supplierId, error });
      return 0;
    }
  }

  updateAllSupplierRiskScores(): { updated: number; alertsCreated: number } {
    const suppliers = this.dbContext.suppliers.list(this.organizationId);
    let updated = 0;
    let alertsCreated = 0;
    for (const s of suppliers) {
      if (this.updateSupplierRiskScore(s.id)) {
        updated++;
        alertsCreated += this.generateSupplierRiskAlerts(s.id);
      }
    }
    logger.info('Supplier risk scoring completed', { updated, alertsCreated });
    return { updated, alertsCreated };
  }
}
