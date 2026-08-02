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
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const { status, type } = req.query;
    let assets = status
      ? dbContext.assets.listByStatus(status as any, orgId)
      : dbContext.assets.list(orgId);
    if (type) assets = assets.filter(a => a.assetType === type);
    const summary = dbContext.assets.getFleetSummary(orgId);
    res.json({ assets, summary });
  } catch { res.status(500).json({ error: 'Failed to fetch assets' }); }
});

router.get('/assets/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const asset = dbContext.assets.findById(req.params.id);
    if (!asset || asset.organizationId !== orgId) {
      res.status(404).json({ error: 'Asset not found' }); return;
    }
    const sohHistory = dbContext.soh.findByAsset(asset.id, 30);
    const alerts = dbContext.alerts.listByAsset(asset.id, orgId, 10);
    res.json({ asset, sohHistory, alerts });
  } catch { res.status(500).json({ error: 'Failed to fetch asset details' }); }
});

router.post('/assets', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const validated = assetCreateSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const asset = dbContext.assets.create({ ...validated, organizationId: orgId });
    res.status(201).json({ asset });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.get('/assets/:id/telemetry', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const { limit = '100' } = req.query;
    const asset = dbContext.assets.findById(req.params.id);
    if (!asset || asset.organizationId !== orgId) {
      res.status(404).json({ error: 'Asset not found' }); return;
    }
    const telemetry = new TelemetryIngestionService(dbContext).getTelemetryHistory(req.params.id, parseInt(limit as string));
    res.json({ telemetry });
  } catch { res.status(500).json({ error: 'Failed to fetch telemetry' }); }
});

router.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const validated = telemetryIngestSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const result = await new TelemetryIngestionService(dbContext).ingest(validated);
    if (result.success) res.status(201).json({ message: 'Telemetry ingested', telemetryId: result.telemetryId });
    else res.status(400).json({ error: result.error });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Telemetry ingestion failed' });
  }
});

router.post('/telemetry/batch', async (req: Request, res: Response) => {
  try {
    const { telemetry } = req.body;
    if (!Array.isArray(telemetry)) { res.status(400).json({ error: 'Expected array' }); return; }
    const dbContext = await getDatabaseContext();
    const result = await new TelemetryIngestionService(dbContext).ingestBatch(telemetry);
    res.json({ successCount: result.successCount, failureCount: result.failureCount, errors: result.errors });
  } catch { res.status(500).json({ error: 'Batch ingestion failed' }); }
});

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const fleetSummary = dbContext.assets.getFleetSummary(orgId);
    const openAlerts = dbContext.alerts.countByStatus(AlertStatus.OPEN, orgId);
    res.json({ ...fleetSummary, openAlerts });
  } catch { res.status(500).json({ error: 'Failed to fetch dashboard data' }); }
});

export default router;
