import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { CorrelationService } from '../../services/correlation';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/batch/:batchId', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const correlation = new CorrelationService(dbContext, orgId).calculateBatchCorrelation(req.params.batchId);
    if (!correlation) { res.status(404).json({ error: 'Batch not found or insufficient data' }); return; }
    res.json({ correlation });
  } catch { res.status(500).json({ error: 'Correlation calculation failed' }); }
});

router.get('/supplier/:supplierId', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const correlation = new CorrelationService(dbContext, orgId).calculateSupplierCorrelation(req.params.supplierId);
    if (!correlation) { res.status(404).json({ error: 'Supplier not found or insufficient data' }); return; }
    res.json({ correlation });
  } catch { res.status(500).json({ error: 'Correlation calculation failed' }); }
});

router.get('/batches', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const correlations = new CorrelationService(dbContext, orgId).getAllBatchCorrelations();
    res.json({ correlations });
  } catch { res.status(500).json({ error: 'Failed to fetch batch correlations' }); }
});

router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const correlations = new CorrelationService(dbContext, orgId).getAllSupplierCorrelations();
    res.json({ correlations });
  } catch { res.status(500).json({ error: 'Failed to fetch supplier correlations' }); }
});

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const results = new CorrelationService(dbContext, orgId).runCorrelationAnalysis();
    res.json({ results });
  } catch { res.status(500).json({ error: 'Correlation analysis failed' }); }
});

export default router;
