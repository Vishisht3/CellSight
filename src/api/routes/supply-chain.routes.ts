import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { TraceabilityService } from '../../services/supply-chain';
import { 
  supplierCreateSchema, 
  materialLotCreateSchema,
  cellBatchCreateSchema,
  batteryPackCreateSchema,
} from '../../utils/validation';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All supply chain routes require authentication
router.use(authenticate);

/**
 * GET /api/supply-chain/suppliers
 * REQ-6: List suppliers with risk scores
 */
router.get('/suppliers', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const { tier, highRiskOnly } = req.query;

    let suppliers = tier
      ? dbContext.suppliers.listByTier(tier as string)
      : dbContext.suppliers.list();

    if (highRiskOnly === 'true') {
      suppliers = suppliers.filter(s => s.riskScore >= 60);
    }

    const summary = dbContext.suppliers.getSummary();

    res.json({
      suppliers,
      summary,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

/**
 * GET /api/supply-chain/suppliers/:id
 * Get detailed supplier information
 */
router.get('/suppliers/:id', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const supplier = dbContext.suppliers.findById(req.params.id);

    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    // Get material lots from this supplier
    const materialLots = dbContext.materials.listBySupplier(supplier.id);

    // Get alerts for this supplier
    const alerts = dbContext.alerts.listBySupplier(supplier.id, 10);

    res.json({
      supplier,
      materialLots,
      alerts,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier details' });
  }
});

/**
 * POST /api/supply-chain/suppliers
 * Create a new supplier
 */
router.post('/suppliers', (req: Request, res: Response) => {
  try {
    const validated = supplierCreateSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const supplier = dbContext.suppliers.create(validated);

    res.status(201).json({ supplier });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }
});

/**
 * GET /api/supply-chain/materials
 * REQ-5: List material lots
 */
router.get('/materials', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const { supplierId, materialType } = req.query;

    let materials;
    if (supplierId) {
      materials = dbContext.materials.listBySupplier(supplierId as string);
    } else if (materialType) {
      materials = dbContext.materials.listByMaterialType(materialType as string);
    } else {
      materials = dbContext.materials.list();
    }

    res.json({ materials });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

/**
 * POST /api/supply-chain/materials
 * REQ-5: Register new material lot
 */
router.post('/materials', (req: Request, res: Response) => {
  try {
    const validated = materialLotCreateSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const traceabilityService = new TraceabilityService(dbContext);
    
    const materialLot = traceabilityService.registerMaterialLot(validated as any);

    res.status(201).json({ materialLot });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to register material lot' });
    }
  }
});

/**
 * POST /api/supply-chain/cell-batches
 * REQ-5: Register new cell batch
 */
router.post('/cell-batches', (req: Request, res: Response) => {
  try {
    const validated = cellBatchCreateSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const traceabilityService = new TraceabilityService(dbContext);
    
    const cellBatch = traceabilityService.registerCellBatch(validated as any);

    res.status(201).json({ cellBatch });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to register cell batch' });
    }
  }
});

/**
 * POST /api/supply-chain/battery-packs
 * REQ-5: Register new battery pack
 */
router.post('/battery-packs', (req: Request, res: Response) => {
  try {
    const validated = batteryPackCreateSchema.parse(req.body);
    
    const dbContext = getDatabaseContext();
    const traceabilityService = new TraceabilityService(dbContext);
    
    const batteryPack = traceabilityService.registerBatteryPack(validated);

    res.status(201).json({ batteryPack });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to register battery pack' });
    }
  }
});

/**
 * GET /api/supply-chain/trace/:assetId
 * REQ-5: Trace asset to source materials (within 3 seconds)
 */
router.get('/trace/:assetId', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const traceabilityService = new TraceabilityService(dbContext);
    
    const trace = traceabilityService.traceAssetToSource(req.params.assetId);

    if (!trace) {
      res.status(404).json({ error: 'Asset not found or trace incomplete' });
      return;
    }

    res.json({ trace });
  } catch (error) {
    res.status(500).json({ error: 'Tracing failed' });
  }
});

/**
 * GET /api/supply-chain/dashboard
 * Supply chain risk dashboard summary
 */
router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    
    const supplierSummary = dbContext.suppliers.getSummary();
    const materialCount = dbContext.materials.list().length;
    const traceabilityService = new TraceabilityService(dbContext);
    const traceStats = traceabilityService.getTraceabilityStats();

    res.json({
      ...supplierSummary,
      totalMaterialLots: materialCount,
      traceabilityStats: traceStats,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
