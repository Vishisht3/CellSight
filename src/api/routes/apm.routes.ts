import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { TelemetryIngestionService } from '../../services/apm';
import { telemetryIngestSchema, assetCreateSchema } from '../../utils/validation';
import { authenticate } from '../../middleware/auth';
import { AlertStatus } from '../../config/constants';

const router = Router();
router.use(authenticate);

router.get('/assets', async (req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const { status, type } = req.query;
    let assets = status ? dbContext.assets.listByStatus(status as any) : dbContext.assets.list();
    if (type) assets = assets.filter(a => a.assetType === type);
    const summary = dbContext.assets.getFleetSummary();
    res.json({ assets, summary });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch assets' }); }
});

router.get('/assets/:id', async (req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const asset = dbContext.assets.findById(req.params.id);
    if (!asset) { res.status(404).json({ error: 'Asset not found' }); return; }
    const sohHistory = dbContext.soh.findByAsset(asset.id, 30);
    const alerts = dbContext.alerts.listByAsset(asset.id, 10);
    res.json({ asset, sohHistory, alerts });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch asset details' }); }
});

router.post('/assets', async (req: Request, res: Response) => {
  try {
    const validated = assetCreateSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const asset = dbContext.assets.create(validated);
    res.status(201).json({ asset });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.get('/assets/:id/telemetry', async (req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const { limit = '100' } = req.query;
    const asset = dbContext.assets.findById(req.params.id);
    if (!asset) { res.status(404).json({ error: 'Asset not found' }); return; }
    const telemetryService = new TelemetryIngestionService(dbContext);
    const telemetry = telemetryService.getTelemetryHistory(req.params.id, parseInt(limit as string));
    res.json({ telemetry });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch telemetry' }); }
});

router.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const validated = telemetryIngestSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const telemetryService = new TelemetryIngestionService(dbContext);
    const result = await telemetryService.ingest(validated);
    if (result.success) res.status(201).json({ message: 'Telemetry ingested successfully', telemetryId: result.telemetryId });
    else res.status(400).json({ error: result.error });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Telemetry ingestion failed' });
  }
});

router.post('/telemetry/batch', async (req: Request, res: Response) => {
  try {
    const { telemetry } = req.body;
    if (!Array.isArray(telemetry)) { res.status(400).json({ error: 'Expected array of telemetry records' }); return; }
    const dbContext = await getDatabaseContext();
    const telemetryService = new TelemetryIngestionService(dbContext);
    const result = await telemetryService.ingestBatch(telemetry);
    res.json({ successCount: result.successCount, failureCount: result.failureCount, errors: result.errors });
  } catch (error) { res.status(500).json({ error: 'Batch ingestion failed' }); }
});

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const fleetSummary = dbContext.assets.getFleetSummary();
    const openAlerts = dbContext.alerts.countByStatus(AlertStatus.OPEN);
    res.json({ ...fleetSummary, openAlerts });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch dashboard data' }); }
});

export default router;
