import { DatabaseContext } from '../../database';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';
import { 
  AlertSeverity, 
  AlertType, 
  AlertSourceAgent,
} from '../../config/constants';

export class RiskScoringService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Calculate concentration risk for a supplier
   * REQ-6: Flag concentration risk when supplier exceeds threshold
   */
  calculateConcentrationRisk(supplierId: string): number {
    try {
      const supplier = this.dbContext.suppliers.findById(supplierId);
      if (!supplier) {
        return 0;
      }

      // Get all material lots from this supplier
      const supplierLots = this.dbContext.materials.listBySupplier(supplierId);
      
      if (supplierLots.length === 0) {
        return 0;
      }

      // Group by material type and calculate concentration
      const materialTypes = new Set(supplierLots.map(lot => lot.materialType));
      let maxConcentration = 0;

      for (const materialType of materialTypes) {
        const concentration = this.dbContext.materials.getSupplierConcentration(materialType);
        const supplierShare = concentration.find(c => c.supplierId === supplierId);
        
        if (supplierShare && supplierShare.share > maxConcentration) {
          maxConcentration = supplierShare.share;
        }
      }

      // Risk is normalized: 0 if below threshold, 1 if at/above threshold
      const concentrationRisk = maxConcentration >= config.supplierConcentrationThreshold ? 1 : maxConcentration / config.supplierConcentrationThreshold;

      return Math.min(1, concentrationRisk);
    } catch (error) {
      logger.error('Concentration risk calculation failed', { supplierId, error });
      return 0;
    }
  }

  /**
   * Calculate geopolitical risk for a supplier
   * REQ-6: Surface geopolitical exposure flag
   */
  calculateGeopoliticalRisk(supplierId: string): number {
    try {
      const supplier = this.dbContext.suppliers.findById(supplierId);
      if (!supplier) {
        return 0;
      }

      // Check if supplier country is in high-risk regions
      const isHighRiskRegion = config.geopoliticalRiskRegions.includes(supplier.country);
      
      return isHighRiskRegion ? 1 : 0;
    } catch (error) {
      logger.error('Geopolitical risk calculation failed', { supplierId, error });
      return 0;
    }
  }

  /**
   * Calculate quality risk for a supplier
   * REQ-6: Generate quality-deviation alert
   */
  calculateQualityRisk(supplierId: string): number {
    try {
      const supplierLots = this.dbContext.materials.listBySupplier(supplierId);
      
      if (supplierLots.length === 0) {
        return 0;
      }

      // Calculate quality deviation rate
      let lotsWithQualityData = 0;
      let lotsWithDeviations = 0;

      for (const lot of supplierLots) {
        if (lot.qualityScore !== null && lot.specificationMin !== null && lot.specificationMax !== null) {
          lotsWithQualityData++;
          
          const deviationThreshold = config.qualityDeviationThreshold;
          const isOutOfSpec = 
            lot.qualityScore < lot.specificationMin * (1 - deviationThreshold) ||
            lot.qualityScore > lot.specificationMax * (1 + deviationThreshold);
          
          if (isOutOfSpec) {
            lotsWithDeviations++;
          }
        }
      }

      if (lotsWithQualityData === 0) {
        return 0;
      }

      // Risk is the proportion of lots with quality deviations
      return lotsWithDeviations / lotsWithQualityData;
    } catch (error) {
      logger.error('Quality risk calculation failed', { supplierId, error });
      return 0;
    }
  }

  /**
   * Calculate compliance risk for a supplier
   * REQ-6: Flag compliance gap
   */
  calculateComplianceRisk(supplierId: string): number {
    try {
      const supplier = this.dbContext.suppliers.findById(supplierId);
      if (!supplier) {
        return 0;
      }

      // Check if certification is missing or expired
      if (!supplier.certificationExpiry) {
        return 1; // Missing certification = full risk
      }

      const expiryDate = new Date(supplier.certificationExpiry);
      const now = new Date();

      if (expiryDate < now) {
        return 1; // Expired certification = full risk
      }

      // Calculate risk based on time to expiry (risk increases in last 90 days)
      const daysToExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysToExpiry <= 90) {
        return 1 - (daysToExpiry / 90); // Risk increases as expiry approaches
      }

      return 0;
    } catch (error) {
      logger.error('Compliance risk calculation failed', { supplierId, error });
      return 0;
    }
  }

  /**
   * Update risk scores for a supplier
   * REQ-6: Combine risk signals into composite risk score
   */
  updateSupplierRiskScore(supplierId: string): boolean {
    try {
      const concentrationRisk = this.calculateConcentrationRisk(supplierId);
      const geopoliticalRisk = this.calculateGeopoliticalRisk(supplierId);
      const qualityRisk = this.calculateQualityRisk(supplierId);
      const complianceRisk = this.calculateComplianceRisk(supplierId);

      const updated = this.dbContext.suppliers.updateRiskScores(supplierId, {
        concentrationRisk,
        geopoliticalRisk,
        qualityRisk,
        complianceRisk,
      });

      if (updated) {
        logger.info('Supplier risk scores updated', {
          supplierId,
          concentrationRisk: concentrationRisk.toFixed(2),
          geopoliticalRisk: geopoliticalRisk.toFixed(2),
          qualityRisk: qualityRisk.toFixed(2),
          complianceRisk: complianceRisk.toFixed(2),
        });
      }

      return updated;
    } catch (error) {
      logger.error('Supplier risk score update failed', { supplierId, error });
      return false;
    }
  }

  /**
   * Generate alerts for supplier risks
   */
  generateSupplierRiskAlerts(supplierId: string): number {
    try {
      const supplier = this.dbContext.suppliers.findById(supplierId);
      if (!supplier) {
        return 0;
      }

      let alertsCreated = 0;

      // Check for concentration risk alert
      if (supplier.concentrationRisk >= 0.8) {
        const existingAlerts = this.dbContext.alerts.listBySupplier(supplierId, 5);
        const hasRecentAlert = existingAlerts.some(
          alert => alert.type === AlertType.CONCENTRATION_RISK && alert.status === 'open'
        );

        if (!hasRecentAlert) {
          this.dbContext.alerts.create({
            type: AlertType.CONCENTRATION_RISK,
            severity: AlertSeverity.WARNING,
            sourceAgent: AlertSourceAgent.SUPPLY_CHAIN,
            supplierId,
            title: `Supplier Concentration Risk: ${supplier.name}`,
            description: `Supplier ${supplier.name} accounts for high proportion of critical material volume. Consider diversifying supply sources to reduce dependency.`,
            metadata: {
              concentrationRisk: supplier.concentrationRisk,
              threshold: config.supplierConcentrationThreshold,
            },
          });
          alertsCreated++;
        }
      }

      // Check for geopolitical risk alert
      if (supplier.geopoliticalRisk >= 1) {
        const existingAlerts = this.dbContext.alerts.listBySupplier(supplierId, 5);
        const hasRecentAlert = existingAlerts.some(
          alert => alert.type === AlertType.GEOPOLITICAL_RISK && alert.status === 'open'
        );

        if (!hasRecentAlert) {
          this.dbContext.alerts.create({
            type: AlertType.GEOPOLITICAL_RISK,
            severity: AlertSeverity.WARNING,
            sourceAgent: AlertSourceAgent.SUPPLY_CHAIN,
            supplierId,
            title: `Geopolitical Risk: ${supplier.name}`,
            description: `Supplier ${supplier.name} is located in region ${supplier.country} with elevated geopolitical risk. Monitor supply stability and consider alternative sources.`,
            metadata: {
              country: supplier.country,
              riskRegions: config.geopoliticalRiskRegions,
            },
          });
          alertsCreated++;
        }
      }

      // Check for quality deviation alert
      if (supplier.qualityRisk >= 0.3) {
        const existingAlerts = this.dbContext.alerts.listBySupplier(supplierId, 5);
        const hasRecentAlert = existingAlerts.some(
          alert => alert.type === AlertType.QUALITY_DEVIATION && alert.status === 'open'
        );

        if (!hasRecentAlert) {
          this.dbContext.alerts.create({
            type: AlertType.QUALITY_DEVIATION,
            severity: AlertSeverity.WARNING,
            sourceAgent: AlertSourceAgent.SUPPLY_CHAIN,
            supplierId,
            title: `Quality Deviation: ${supplier.name}`,
            description: `Supplier ${supplier.name} has significant proportion of material lots with quality deviations. Review quality control processes and incoming inspection procedures.`,
            metadata: {
              qualityRisk: supplier.qualityRisk,
              threshold: config.qualityDeviationThreshold,
            },
          });
          alertsCreated++;
        }
      }

      // Check for compliance gap alert
      if (supplier.complianceRisk >= 0.5) {
        const existingAlerts = this.dbContext.alerts.listBySupplier(supplierId, 5);
        const hasRecentAlert = existingAlerts.some(
          alert => alert.type === AlertType.COMPLIANCE_GAP && alert.status === 'open'
        );

        if (!hasRecentAlert) {
          const severity = supplier.complianceRisk >= 1 
            ? AlertSeverity.CRITICAL 
            : AlertSeverity.WARNING;

          const description = supplier.certificationExpiry
            ? `Supplier ${supplier.name} certification expires soon or has expired (${supplier.certificationExpiry}). Verify compliance status and renewal timeline.`
            : `Supplier ${supplier.name} is missing required sustainability or responsible-sourcing certification. Verify compliance with sourcing standards.`;

          this.dbContext.alerts.create({
            type: AlertType.COMPLIANCE_GAP,
            severity,
            sourceAgent: AlertSourceAgent.SUPPLY_CHAIN,
            supplierId,
            title: `Compliance Gap: ${supplier.name}`,
            description,
            metadata: {
              complianceRisk: supplier.complianceRisk,
              certificationExpiry: supplier.certificationExpiry,
            },
          });
          alertsCreated++;
        }
      }

      return alertsCreated;
    } catch (error) {
      logger.error('Risk alert generation failed', { supplierId, error });
      return 0;
    }
  }

  /**
   * Update risk scores for all suppliers
   */
  updateAllSupplierRiskScores(): { updated: number; alertsCreated: number } {
    const suppliers = this.dbContext.suppliers.list();
    let updated = 0;
    let alertsCreated = 0;

    for (const supplier of suppliers) {
      const success = this.updateSupplierRiskScore(supplier.id);
      if (success) {
        updated++;
        alertsCreated += this.generateSupplierRiskAlerts(supplier.id);
      }
    }

    logger.info('Supplier risk scoring completed', { updated, alertsCreated });
    return { updated, alertsCreated };
  }
}
