import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { TraceabilityService } from '../../services/supply-chain';
import {
  supplierCreateSchema, materialLotCreateSchema,
  cellBatchCreateSchema, batteryPackCreateSchema,
} from '../../utils/validation';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const { tier, highRiskOnly } = req.query;
    let suppliers = tier ? dbContext.suppliers.listByTier(tier as string) : dbContext.suppliers.list();
    if (highRiskOnly === 'true') suppliers = suppliers.filter(s => s.riskScore >= 60);
    const summary = dbContext.suppliers.getSummary();
    res.json({ suppliers, summary });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch suppliers' }); }
});

router.get('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const supplier = dbContext.suppliers.findById(req.params.id);
    if (!supplier) { res.status(404).json({ error: 'Supplier not found' }); return; }
    const materialLots = dbContext.materials.listBySupplier(supplier.id);
    const alerts = dbContext.alerts.listBySupplier(supplier.id, 10);
    res.json({ supplier, materialLots, alerts });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch supplier details' }); }
});

router.post('/suppliers', async (req: Request, res: Response) => {
  try {
    const validated = supplierCreateSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const supplier = dbContext.suppliers.create(validated);
    res.status(201).json({ supplier });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Failed to create supplier' });
  }
});

router.get('/materials', async (req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const { supplierId, materialType } = req.query;
    const materials = supplierId
      ? dbContext.materials.listBySupplier(supplierId as string)
      : materialType
      ? dbContext.materials.listByMaterialType(materialType as string)
      : dbContext.materials.list();
    res.json({ materials });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch materials' }); }
});

router.post('/materials', async (req: Request, res: Response) => {
  try {
    const validated = materialLotCreateSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const materialLot = new TraceabilityService(dbContext).registerMaterialLot(validated as any);
    res.status(201).json({ materialLot });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Failed to register material lot' });
  }
});

router.post('/cell-batches', async (req: Request, res: Response) => {
  try {
    const validated = cellBatchCreateSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const cellBatch = new TraceabilityService(dbContext).registerCellBatch(validated as any);
    res.status(201).json({ cellBatch });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Failed to register cell batch' });
  }
});

router.post('/battery-packs', async (req: Request, res: Response) => {
  try {
    const validated = batteryPackCreateSchema.parse(req.body);
    const dbContext = await getDatabaseContext();
    const batteryPack = new TraceabilityService(dbContext).registerBatteryPack(validated);
    res.status(201).json({ batteryPack });
  } catch (error) {
    if (error instanceof Error) res.status(400).json({ error: error.message });
    else res.status(500).json({ error: 'Failed to register battery pack' });
  }
});

router.get('/trace/:assetId', async (req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const trace = new TraceabilityService(dbContext).traceAssetToSource(req.params.assetId);
    if (!trace) { res.status(404).json({ error: 'Asset not found or trace incomplete' }); return; }
    res.json({ trace });
  } catch (error) { res.status(500).json({ error: 'Tracing failed' }); }
});

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const dbContext = await getDatabaseContext();
    const supplierSummary = dbContext.suppliers.getSummary();
    const materialCount = dbContext.materials.list().length;
    const traceStats = new TraceabilityService(dbContext).getTraceabilityStats();
    res.json({ ...supplierSummary, totalMaterialLots: materialCount, traceabilityStats: traceStats });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch dashboard data' }); }
});

export default router;
