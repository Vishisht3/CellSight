/**
 * QualityIntelligenceService
 *
 * Manufacturing Quality Intelligence for EV battery production
 * ─────────────────────────────────────────────────────────────
 * Monitors production batch quality, detects defects, performs SPC
 * (Statistical Process Control) analysis, and correlates quality
 * deviations with process parameters to enable root-cause analysis.
 *
 * Key capabilities:
 * • Defect detection — flags batches with defect rates above threshold
 * • SPC monitoring — identifies process parameters outside control limits
 * • Root-cause correlation — links quality failures to specific process deviations
 * • Cell-to-pack traceability — enables full quality chain from raw material to vehicle
 */

import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  cellBatchId: string;
  productionLine: string;
  startTime: string;
  endTime: string | null;
  targetQuantity: number;
  producedQuantity: number;
  passedQuantity: number;
  failedQuantity: number;
  status: 'in_progress' | 'completed' | 'failed';
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityInspection {
  id: string;
  productionBatchId: string;
  inspectionType: 'incoming' | 'in-line' | 'final' | 'destructive';
  inspectionTimestamp: string;
  defectType: string | null;
  defectCount: number;
  sampleSize: number;
  passed: number;
  result: 'pass' | 'fail' | 'conditional';
  inspectorId: string | null;
  notes: string | null;
  organizationId: string;
  createdAt: string;
}

export interface ProcessParameter {
  id: string;
  productionBatchId: string;
  parameterName: string;
  parameterValue: number;
  measurementTime: string;
  unit: string;
  organizationId: string;
  createdAt: string;
}

export interface SpcControlLimit {
  id: string;
  parameterName: string;
  centerLine: number;
  ucl: number; // Upper Control Limit
  lcl: number; // Lower Control Limit
  usl: number | null; // Upper Specification Limit
  lsl: number | null; // Lower Specification Limit
  lastUpdated: string;
  organizationId: string;
  createdAt: string;
}

export interface SpcStatus {
  parameterName: string;
  currentValue: number;
  centerLine: number;
  ucl: number;
  lcl: number;
  status: 'in_control' | 'warning' | 'out_of_control';
  deviation: number;
  measurementTime: string;
}

export interface QualityCorrelation {
  productionBatchId: string;
  batchNumber: string;
  defectRate: number;
  defectTypes: string[];
  correlatedParameters: {
    parameterName: string;
    averageValue: number;
    deviation: number;
    controlStatus: string;
  }[];
  rootCauseLikelihood: 'high' | 'medium' | 'low';
}

export class QualityIntelligenceService {
  constructor(private dbContext: DatabaseContext, private organizationId: string) {}

  // ── Defect Detection ───────────────────────────────────────────────────

  /**
   * Analyzes production batches and identifies those with defect rates
   * exceeding the acceptable threshold (default: 3%)
   */
  detectDefectiveBatches(thresholdPercent: number = 3.0): ProductionBatch[] {
    const query = `
      SELECT * FROM production_batches
      WHERE organization_id = ?
        AND produced_quantity > 0
        AND (CAST(failed_quantity AS REAL) / produced_quantity * 100) >= ?
      ORDER BY updated_at DESC
      LIMIT 50
    `;
    const rows = this.dbContext.db.prepare(query).all(this.organizationId, thresholdPercent);
    return rows as ProductionBatch[];
  }

  /**
   * Gets all quality inspections for a specific production batch
   */
  getInspectionsByBatch(productionBatchId: string): QualityInspection[] {
    const query = `
      SELECT * FROM quality_inspections
      WHERE production_batch_id = ? AND organization_id = ?
      ORDER BY inspection_timestamp ASC
    `;
    const rows = this.dbContext.db.prepare(query).all(productionBatchId, this.organizationId);
    return rows as QualityInspection[];
  }

  // ── SPC Monitoring ─────────────────────────────────────────────────────

  /**
   * Monitors process parameters against Statistical Process Control limits
   * Returns parameters that are currently outside control limits
   */
  getSpcStatus(): SpcStatus[] {
    const query = `
      SELECT
        pp.parameter_name,
        pp.parameter_value as current_value,
        pp.measurement_time,
        spc.center_line,
        spc.ucl,
        spc.lcl
      FROM process_parameters pp
      INNER JOIN spc_control_limits spc ON pp.parameter_name = spc.parameter_name
      WHERE pp.organization_id = ?
        AND pp.id IN (
          -- Get the most recent measurement for each parameter
          SELECT id FROM process_parameters pp2
          WHERE pp2.parameter_name = pp.parameter_name
            AND pp2.organization_id = ?
          ORDER BY pp2.measurement_time DESC
          LIMIT 1
        )
      ORDER BY pp.measurement_time DESC
    `;

    const rows = this.dbContext.db.prepare(query).all(this.organizationId, this.organizationId);

    return rows.map((row: any) => {
      const deviation = Math.abs(row.current_value - row.center_line);
      const range = row.ucl - row.lcl;
      const normalizedDeviation = deviation / (range / 2);

      let status: 'in_control' | 'warning' | 'out_of_control';
      if (row.current_value > row.ucl || row.current_value < row.lcl) {
        status = 'out_of_control';
      } else if (normalizedDeviation > 0.7) {
        // Within control limits but close to boundary
        status = 'warning';
      } else {
        status = 'in_control';
      }

      return {
        parameterName: row.parameter_name,
        currentValue: row.current_value,
        centerLine: row.center_line,
        ucl: row.ucl,
        lcl: row.lcl,
        status,
        deviation: normalizedDeviation,
        measurementTime: row.measurement_time,
      };
    });
  }

  /**
   * Gets all SPC control limits for the organization
   */
  getControlLimits(): SpcControlLimit[] {
    const query = `
      SELECT * FROM spc_control_limits
      WHERE organization_id = ?
      ORDER BY parameter_name ASC
    `;
    const rows = this.dbContext.db.prepare(query).all(this.organizationId);
    return rows as SpcControlLimit[];
  }

  // ── Root-Cause Correlation ─────────────────────────────────────────────

  /**
   * Correlates quality failures with process parameter deviations
   * to identify likely root causes
   */
  correlateQualityIssues(): QualityCorrelation[] {
    // Step 1: Find batches with quality issues (defect rate > 3%)
    const defectiveBatches = this.detectDefectiveBatches(3.0);

    const correlations: QualityCorrelation[] = [];

    for (const batch of defectiveBatches) {
      const defectRate = (batch.failedQuantity / batch.producedQuantity) * 100;

      // Step 2: Get defect types for this batch
      const inspections = this.getInspectionsByBatch(batch.id);
      const defectTypes = [...new Set(inspections.filter((i) => i.defectType).map((i) => i.defectType!))];

      // Step 3: Get process parameters for this batch
      const paramQuery = `
        SELECT
          pp.parameter_name,
          AVG(pp.parameter_value) as avg_value,
          spc.center_line,
          spc.ucl,
          spc.lcl
        FROM process_parameters pp
        LEFT JOIN spc_control_limits spc ON pp.parameter_name = spc.parameter_name
        WHERE pp.production_batch_id = ? AND pp.organization_id = ?
        GROUP BY pp.parameter_name
      `;

      const params = this.dbContext.db.prepare(paramQuery).all(batch.id, this.organizationId) as any[];

      // Step 4: Identify parameters that deviated from control limits
      const correlatedParameters = params
        .map((p) => {
          if (!p.center_line) return null; // No control limits defined

          const deviation = Math.abs(p.avg_value - p.center_line);
          const range = p.ucl - p.lcl;
          const normalizedDeviation = deviation / (range / 2);

          let controlStatus: string;
          if (p.avg_value > p.ucl || p.avg_value < p.lcl) {
            controlStatus = 'out_of_control';
          } else if (normalizedDeviation > 0.7) {
            controlStatus = 'warning';
          } else {
            controlStatus = 'in_control';
          }

          return {
            parameterName: p.parameter_name,
            averageValue: p.avg_value,
            deviation: normalizedDeviation,
            controlStatus,
          };
        })
        .filter((p) => p !== null && p.controlStatus !== 'in_control') as QualityCorrelation['correlatedParameters'];

      // Step 5: Assess root-cause likelihood based on number of out-of-control parameters
      let rootCauseLikelihood: 'high' | 'medium' | 'low';
      const outOfControlCount = correlatedParameters.filter((p) => p.controlStatus === 'out_of_control').length;

      if (outOfControlCount >= 2) {
        rootCauseLikelihood = 'high';
      } else if (outOfControlCount === 1 || correlatedParameters.length >= 2) {
        rootCauseLikelihood = 'medium';
      } else {
        rootCauseLikelihood = 'low';
      }

      correlations.push({
        productionBatchId: batch.id,
        batchNumber: batch.batchNumber,
        defectRate,
        defectTypes,
        correlatedParameters,
        rootCauseLikelihood,
      });
    }

    return correlations;
  }

  /**
   * Gets full cell-to-pack traceability with quality data
   * Links a production batch back to the cell batch and its quality history
   */
  getProductionTraceability(productionBatchId: string): any {
    const batchQuery = `
      SELECT
        pb.*,
        cb.batch_number as cell_batch_number,
        cb.manufacturer_id,
        s.name as manufacturer_name
      FROM production_batches pb
      INNER JOIN cell_batches cb ON pb.cell_batch_id = cb.id
      INNER JOIN suppliers s ON cb.manufacturer_id = s.id
      WHERE pb.id = ? AND pb.organization_id = ?
    `;

    const batch = this.dbContext.db.prepare(batchQuery).get(productionBatchId, this.organizationId);
    if (!batch) return null;

    const inspections = this.getInspectionsByBatch(productionBatchId);
    const spcStatus = this.getSpcStatus();

    return {
      ...batch,
      inspections,
      spcStatus: spcStatus.filter((s) => s.status !== 'in_control'),
    };
  }

  /**
   * Generates a quality alert when defect rate exceeds threshold
   * or when critical process parameters go out of control
   */
  async checkAndRaiseQualityAlerts(): Promise<void> {
    // Check 1: Defect rate alerts
    const defectiveBatches = this.detectDefectiveBatches(5.0); // 5% threshold for CRITICAL

    for (const batch of defectiveBatches) {
      const defectRate = (batch.failedQuantity / batch.producedQuantity) * 100;

      // Check if alert already exists for this batch
      const existingAlert = this.dbContext.db.prepare(
        `SELECT id FROM alerts WHERE type = 'QUALITY_DEFECT' AND metadata LIKE ? AND status = 'open'`
      ).get(`%"productionBatchId":"${batch.id}"%`);

      if (!existingAlert) {
        const alertService = new (require('./AlertService').AlertService)(this.dbContext, this.organizationId);
        alertService.createAlert({
          type: 'QUALITY_DEFECT',
          severity: defectRate >= 10 ? 'CRITICAL' : 'WARNING',
          sourceAgent: 'qms',
          title: `Quality Defect: Batch ${batch.batchNumber} — ${defectRate.toFixed(1)}% defect rate`,
          description: `Production batch ${batch.batchNumber} has ${batch.failedQuantity} failed units out of ${batch.producedQuantity} (${defectRate.toFixed(1)}% defect rate, threshold 5%). Investigate process parameters and incoming material quality.`,
          status: 'open',
          metadata: JSON.stringify({
            productionBatchId: batch.id,
            batchNumber: batch.batchNumber,
            defectRate: defectRate.toFixed(2),
            failedQuantity: batch.failedQuantity,
            producedQuantity: batch.producedQuantity,
          }),
        });

        logger.info('Quality defect alert raised', {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          defectRate: defectRate.toFixed(2),
        });
      }
    }

    // Check 2: SPC out-of-control alerts
    const spcStatus = this.getSpcStatus();
    const outOfControl = spcStatus.filter((s) => s.status === 'out_of_control');

    for (const param of outOfControl) {
      const existingAlert = this.dbContext.db.prepare(
        `SELECT id FROM alerts WHERE type = 'SPC_OUT_OF_CONTROL' AND metadata LIKE ? AND status = 'open'`
      ).get(`%"parameterName":"${param.parameterName}"%`);

      if (!existingAlert) {
        const alertService = new (require('./AlertService').AlertService)(this.dbContext, this.organizationId);
        alertService.createAlert({
          type: 'SPC_OUT_OF_CONTROL',
          severity: 'CRITICAL',
          sourceAgent: 'qms',
          title: `SPC Violation: ${param.parameterName} out of control`,
          description: `Process parameter ${param.parameterName} is ${param.currentValue.toFixed(2)} — outside control limits (${param.lcl.toFixed(2)} to ${param.ucl.toFixed(2)}). Immediate process adjustment required to prevent quality drift.`,
          status: 'open',
          metadata: JSON.stringify({
            parameterName: param.parameterName,
            currentValue: param.currentValue.toFixed(2),
            centerLine: param.centerLine.toFixed(2),
            ucl: param.ucl.toFixed(2),
            lcl: param.lcl.toFixed(2),
            deviation: param.deviation.toFixed(2),
            measurementTime: param.measurementTime,
          }),
        });

        logger.info('SPC out-of-control alert raised', {
          parameterName: param.parameterName,
          currentValue: param.currentValue.toFixed(2),
          deviation: param.deviation.toFixed(2),
        });
      }
    }
  }
}
