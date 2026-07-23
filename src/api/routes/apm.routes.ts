import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { TelemetryIngestionService } from '../../services/apm';
import { telemetryIngestSchema, assetCreateSchema } from '../../utils/validation';
import { authenticate } from '../../middleware/auth';
import { AlertStatus } from '../../config/constants';

const router = Router();

// All APM routes require authentication
router.use(authenticate);

/**
 * GET /api/apm/assets
 * REQ-4: List all assets with health status
 */
router.get('/assets', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const { status, type } = req.query;

    let assets = status
      ? dbContext.assets.listByStatus(status as any)
      : dbContext.assets.list();

    // Filter by asset type if specified
    if (type) {
      assets = assets.filter(asset => asset.assetType === type);
    }

    // Get fleet summary
    const summary = dbContext.assets.getFleetSummary();

    res.json({
      assets,
      summary,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

/**
 * GET /api/apm/assets/:id
 * REQ-4: Get detailed asset information
 */
router.get('/assets/:id', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const asset = dbContext.assets.findById(req.params.id);

    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    // Get latest SoH history
    const sohHistory = dbContext.soh.findByAsset(asset.id, 30);

    // Get recent alerts
    const alerts = dbContext.alerts.listByAsset(asset.id, 10);

    res.json({
      asset,
      sohHistory,
      alerts,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch asset details' });
  }
});

/**
 * POST /api/apm/assets
 * Create a new asset
 */
router.post('/assets', (req: Request, res: Response) => {
  try {
    const validated = assetCreateSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const asset = dbContext.assets.create(validated);

    res.status(201).json({ asset });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create asset' });
    }
  }
});

/**
 * GET /api/apm/assets/:id/telemetry
 * REQ-4: Get asset telemetry history
 */
router.get('/assets/:id/telemetry', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const { limit = '100' } = req.query;

    const asset = dbContext.assets.findById(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const telemetryService = new TelemetryIngestionService(dbContext);
    const telemetry = telemetryService.getTelemetryHistory(req.params.id, parseInt(limit as string));

    res.json({ telemetry });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch telemetry' });
  }
});

/**
 * POST /api/apm/telemetry
 * REQ-1: Ingest new telemetry data
 */
router.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const validated = telemetryIngestSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const telemetryService = new TelemetryIngestionService(dbContext);
    
    const result = await telemetryService.ingest(validated);
    
    if (result.success) {
      res.status(201).json({ 
        message: 'Telemetry ingested successfully',
        telemetryId: result.telemetryId,
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Telemetry ingestion failed' });
    }
  }
});

/**
 * POST /api/apm/telemetry/batch
 * Batch ingest telemetry data
 */
router.post('/telemetry/batch', async (req: Request, res: Response) => {
  try {
    const { telemetry } = req.body;
    
    if (!Array.isArray(telemetry)) {
      res.status(400).json({ error: 'Expected array of telemetry records' });
      return;
    }

    const dbContext = getDatabaseContext();
    const telemetryService = new TelemetryIngestionService(dbContext);
    
    const result = await telemetryService.ingestBatch(telemetry);
    
    res.json({
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({ error: 'Batch ingestion failed' });
  }
});

/**
 * GET /api/apm/dashboard
 * REQ-4: Fleet APM dashboard summary
 */
router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    
    const fleetSummary = dbContext.assets.getFleetSummary();
    const openAlerts = dbContext.alerts.countByStatus(AlertStatus.OPEN);

    res.json({
      ...fleetSummary,
      openAlerts,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
