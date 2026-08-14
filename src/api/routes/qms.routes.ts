import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { QualityIntelligenceService } from '../../services/QualityIntelligenceService';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/qms/batches ───────────────────────────────────────────────
// Returns production batches with optional defect rate filtering
router.get('/batches', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const qmsService = new QualityIntelligenceService(dbContext, orgId);

    const { defective_only } = req.query;

    if (defective_only === 'true') {
      const batches = qmsService.detectDefectiveBatches();
      res.json({ batches, count: batches.length });
    } else {
      // Return all batches
      const query = `
        SELECT * FROM production_batches
        WHERE organization_id = ?
        ORDER BY updated_at DESC
        LIMIT 100
      `;
      const batches = dbContext.db.all(query, [orgId]);
      res.json({ batches, count: batches.length });
    }
  } catch (error) {
    console.error('QMS batches fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch production batches' });
  }
});

// ── GET /api/qms/batches/:id ───────────────────────────────────────────
// Returns detailed production batch with inspections and traceability
router.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const qmsService = new QualityIntelligenceService(dbContext, orgId);

    const batch = dbContext.db.get(
      `SELECT * FROM production_batches WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );

    if (!batch) {
      res.status(404).json({ error: 'Production batch not found' });
      return;
    }

    const inspections = qmsService.getInspectionsByBatch(req.params.id);
    const traceability = qmsService.getProductionTraceability(req.params.id);

    res.json({ batch, inspections, traceability });
  } catch (error) {
    console.error('QMS batch detail error:', error);
    res.status(500).json({ error: 'Failed to fetch batch details' });
  }
});

// ── GET /api/qms/inspections ───────────────────────────────────────────
// Returns quality inspections with optional filtering
router.get('/inspections', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();

    const { batch_id, result, type } = req.query;

    let query = `
      SELECT qi.*, pb.batch_number
      FROM quality_inspections qi
      INNER JOIN production_batches pb ON qi.production_batch_id = pb.id
      WHERE qi.organization_id = ?
    `;
    const params: any[] = [orgId];

    if (batch_id) {
      query += ` AND qi.production_batch_id = ?`;
      params.push(batch_id);
    }

    if (result) {
      query += ` AND qi.result = ?`;
      params.push(result);
    }

    if (type) {
      query += ` AND qi.inspection_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY qi.inspection_timestamp DESC LIMIT 100`;

    const inspections = dbContext.db.all(query, params);
    res.json({ inspections, count: inspections.length });
  } catch (error) {
    console.error('QMS inspections fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// ── GET /api/qms/spc-status ────────────────────────────────────────────
// Returns current SPC status for all monitored process parameters
router.get('/spc-status', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const qmsService = new QualityIntelligenceService(dbContext, orgId);

    const spcStatus = qmsService.getSpcStatus();
    const controlLimits = qmsService.getControlLimits();

    const summary = {
      inControl: spcStatus.filter((s) => s.status === 'in_control').length,
      warning: spcStatus.filter((s) => s.status === 'warning').length,
      outOfControl: spcStatus.filter((s) => s.status === 'out_of_control').length,
      total: spcStatus.length,
    };

    res.json({ spcStatus, controlLimits, summary });
  } catch (error) {
    console.error('QMS SPC status error:', error);
    res.status(500).json({ error: 'Failed to fetch SPC status' });
  }
});

// ── GET /api/qms/control-limits ────────────────────────────────────────
// Returns all SPC control limits
router.get('/control-limits', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const qmsService = new QualityIntelligenceService(dbContext, orgId);

    const controlLimits = qmsService.getControlLimits();
    res.json({ controlLimits, count: controlLimits.length });
  } catch (error) {
    console.error('QMS control limits error:', error);
    res.status(500).json({ error: 'Failed to fetch control limits' });
  }
});

// ── GET /api/qms/correlations ──────────────────────────────────────────
// Returns quality issue correlations with process parameters
router.get('/correlations', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const qmsService = new QualityIntelligenceService(dbContext, orgId);

    const correlations = qmsService.correlateQualityIssues();

    const summary = {
      highLikelihood: correlations.filter((c) => c.rootCauseLikelihood === 'high').length,
      mediumLikelihood: correlations.filter((c) => c.rootCauseLikelihood === 'medium').length,
      lowLikelihood: correlations.filter((c) => c.rootCauseLikelihood === 'low').length,
      total: correlations.length,
    };

    res.json({ correlations, summary });
  } catch (error) {
    console.error('QMS correlations error:', error);
    res.status(500).json({ error: 'Failed to analyze quality correlations' });
  }
});

// ── GET /api/qms/process-parameters ────────────────────────────────────
// Returns process parameters for a specific batch
router.get('/process-parameters', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();

    const { batch_id, parameter_name } = req.query;

    if (!batch_id) {
      res.status(400).json({ error: 'batch_id query parameter is required' });
      return;
    }

    let query = `
      SELECT * FROM process_parameters
      WHERE production_batch_id = ? AND organization_id = ?
    `;
    const params: any[] = [batch_id, orgId];

    if (parameter_name) {
      query += ` AND parameter_name = ?`;
      params.push(parameter_name);
    }

    query += ` ORDER BY measurement_time ASC`;

    const parameters = dbContext.db.all(query, params);
    res.json({ parameters, count: parameters.length });
  } catch (error) {
    console.error('QMS process parameters error:', error);
    res.status(500).json({ error: 'Failed to fetch process parameters' });
  }
});

export default router;
