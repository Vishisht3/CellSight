import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { AlertService } from '../../services/AlertService';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All alert routes require authentication
router.use(authenticate);

/**
 * GET /api/alerts
 * REQ-8: Get unified alert feed
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const alertService = new AlertService(dbContext);
    
    const { status, limit, sourceAgent, assetId, supplierId } = req.query;

    const alerts = alertService.getAlertFeed({
      status: status as any,
      limit: limit ? parseInt(limit as string) : undefined,
      sourceAgent: sourceAgent as string,
      assetId: assetId as string,
      supplierId: supplierId as string,
    });

    const counts = alertService.getAlertCounts();

    res.json({
      alerts,
      counts,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/alerts/:id
 * Get alert by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const alertService = new AlertService(dbContext);
    
    const alert = alertService.getAlertById(req.params.id);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json({ alert });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

/**
 * PUT /api/alerts/:id/acknowledge
 * REQ-8: Acknowledge an alert
 */
router.put('/:id/acknowledge', (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const dbContext = getDatabaseContext();
    const alertService = new AlertService(dbContext);
    
    const success = alertService.acknowledgeAlert(req.params.id, req.user.userId);

    if (success) {
      res.json({ message: 'Alert acknowledged successfully' });
    } else {
      res.status(400).json({ error: 'Failed to acknowledge alert' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Acknowledgment failed' });
  }
});

/**
 * PUT /api/alerts/:id/resolve
 * REQ-8: Resolve an alert
 */
router.put('/:id/resolve', (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const dbContext = getDatabaseContext();
    const alertService = new AlertService(dbContext);
    
    const success = alertService.resolveAlert(req.params.id, req.user.userId);

    if (success) {
      res.json({ message: 'Alert resolved successfully' });
    } else {
      res.status(400).json({ error: 'Failed to resolve alert' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Resolution failed' });
  }
});

/**
 * GET /api/alerts/stats/by-agent
 * Get alert statistics by source agent
 */
router.get('/stats/by-agent', (_req: Request, res: Response) => {
  try {
    const dbContext = getDatabaseContext();
    const alertService = new AlertService(dbContext);
    
    const stats = alertService.getAlertStatsBySourceAgent();

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
