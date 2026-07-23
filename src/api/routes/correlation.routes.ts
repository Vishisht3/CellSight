import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { CorrelationService } from '../../services/correlation';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All correlation routes require authentication
router.use(authenticate);

/**
 * GET /api/correlation/batch/:batchId
 * REQ-7: Get degradation correlation for batch
 */
router.get('/batch/:batchId', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const correlationService = new CorrelationService(dbContext);
    
    const correlation = correlationService.calculateBatchCorrelation(req.params.batchId);

    if (!correlation) {
      res.status(404).json({ error: 'Batch not found or insufficient data' });
      return;
    }

    res.json({ correlation });
  } catch (error) {
    res.status(500).json({ error: 'Correlation calculation failed' });
  }
});

/**
 * GET /api/correlation/supplier/:supplierId
 * REQ-7: Get degradation correlation for supplier
 */
router.get('/supplier/:supplierId', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const correlationService = new CorrelationService(dbContext);
    
    const correlation = correlationService.calculateSupplierCorrelation(req.params.supplierId);

    if (!correlation) {
      res.status(404).json({ error: 'Supplier not found or insufficient data' });
      return;
    }

    res.json({ correlation });
  } catch (error) {
    res.status(500).json({ error: 'Correlation calculation failed' });
  }
});

/**
 * GET /api/correlation/batches
 * Get all batch correlations
 */
router.get('/batches', (_req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const correlationService = new CorrelationService(dbContext);
    
    const correlations = correlationService.getAllBatchCorrelations();

    res.json({ correlations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch batch correlations' });
  }
});

/**
 * GET /api/correlation/suppliers
 * Get all supplier correlations
 */
router.get('/suppliers', (_req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const correlationService = new CorrelationService(dbContext);
    
    const correlations = correlationService.getAllSupplierCorrelations();

    res.json({ correlations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier correlations' });
  }
});

/**
 * POST /api/correlation/analyze
 * Run correlation analysis and generate insights
 */
router.post('/analyze', (_req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const correlationService = new CorrelationService(dbContext);
    
    const results = correlationService.runCorrelationAnalysis();

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Correlation analysis failed' });
  }
});

export default router;
