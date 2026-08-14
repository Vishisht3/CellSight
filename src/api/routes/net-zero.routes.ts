import { Router, Request, Response } from 'express';
import { getDatabaseContext } from '../../database';
import { NetZeroService } from '../../services/NetZeroService';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/net-zero/progress ─────────────────────────────────────────
// Returns full net-zero progress including baseline, target, and current emissions
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const netZeroService = new NetZeroService(dbContext, orgId);

    const progress = netZeroService.getNetZeroProgress();

    if (!progress) {
      res.status(404).json({ error: 'No net-zero target configured for this organization' });
      return;
    }

    res.json({ progress });
  } catch (error) {
    console.error('Net Zero progress error:', error);
    res.status(500).json({ error: 'Failed to fetch net-zero progress' });
  }
});

// ── GET /api/net-zero/target ───────────────────────────────────────────
// Returns the current net-zero target
router.get('/target', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const netZeroService = new NetZeroService(dbContext, orgId);

    const target = netZeroService.getNetZeroTarget();

    if (!target) {
      res.status(404).json({ error: 'No net-zero target configured' });
      return;
    }

    res.json({ target });
  } catch (error) {
    console.error('Net Zero target error:', error);
    res.status(500).json({ error: 'Failed to fetch net-zero target' });
  }
});

// ── GET /api/net-zero/emissions ────────────────────────────────────────
// Returns current emissions breakdown
router.get('/emissions', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const netZeroService = new NetZeroService(dbContext, orgId);

    const current = netZeroService.getCurrentEmissions();

    res.json({ emissions: current });
  } catch (error) {
    console.error('Net Zero emissions error:', error);
    res.status(500).json({ error: 'Failed to fetch current emissions' });
  }
});

// ── GET /api/net-zero/priorities ───────────────────────────────────────
// Returns electrification priorities ranked by carbon impact and readiness
router.get('/priorities', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const netZeroService = new NetZeroService(dbContext, orgId);

    const priorities = netZeroService.getElectrificationPriorities();

    const summary = {
      highPriority: priorities.filter((p) => p.priority === 'high').length,
      mediumPriority: priorities.filter((p) => p.priority === 'medium').length,
      lowPriority: priorities.filter((p) => p.priority === 'low').length,
      totalPotentialReduction: priorities.reduce((sum, p) => sum + p.potentialAnnualReduction, 0),
      totalCurrentEmissions: priorities.reduce((sum, p) => sum + p.currentAnnualCo2Tonnes, 0),
    };

    res.json({ priorities, summary });
  } catch (error) {
    console.error('Net Zero priorities error:', error);
    res.status(500).json({ error: 'Failed to fetch electrification priorities' });
  }
});

// ── GET /api/net-zero/routes ───────────────────────────────────────────
// Returns route-level emission analysis
router.get('/routes', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const netZeroService = new NetZeroService(dbContext, orgId);

    const routes = netZeroService.getRouteEmissionAnalysis();

    const summary = {
      totalRoutes: routes.length,
      totalCo2: routes.reduce((sum, r) => sum + r.totalCo2Tonnes, 0),
      totalDistance: routes.reduce((sum, r) => sum + r.totalDistanceKm, 0),
      totalPotentialReduction: routes.reduce((sum, r) => sum + r.potentialReduction, 0),
    };

    res.json({ routes, summary });
  } catch (error) {
    console.error('Net Zero routes error:', error);
    res.status(500).json({ error: 'Failed to fetch route emission analysis' });
  }
});

// ── GET /api/net-zero/report ───────────────────────────────────────────
// Returns monthly progress report with trajectory analysis
router.get('/report', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const netZeroService = new NetZeroService(dbContext, orgId);

    const report = netZeroService.getMonthlyProgressReport();

    if (!report) {
      res.status(404).json({ error: 'No net-zero target configured' });
      return;
    }

    res.json({ report });
  } catch (error) {
    console.error('Net Zero report error:', error);
    res.status(500).json({ error: 'Failed to generate progress report' });
  }
});

// ── POST /api/net-zero/emissions ───────────────────────────────────────
// Records a new emission entry
router.post('/emissions', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();
    const netZeroService = new NetZeroService(dbContext, orgId);

    const {
      assetId,
      recordDate,
      scope,
      category,
      co2Tonnes,
      route,
      distanceKm,
      fuelLitres,
      kwhConsumed,
      calculationMethod,
    } = req.body;

    // Basic validation
    if (!assetId || !recordDate || !scope || !category || co2Tonnes === undefined || !calculationMethod) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (scope !== 1 && scope !== 3) {
      res.status(400).json({ error: 'Scope must be 1 or 3' });
      return;
    }

    const emission = netZeroService.recordEmission({
      assetId,
      recordDate,
      scope,
      category,
      co2Tonnes,
      route,
      distanceKm,
      fuelLitres,
      kwhConsumed,
      calculationMethod,
    });

    res.status(201).json({ emission });
  } catch (error) {
    console.error('Net Zero record emission error:', error);
    res.status(500).json({ error: 'Failed to record emission' });
  }
});

// ── GET /api/net-zero/emission-records ─────────────────────────────────
// Returns emission records with optional filtering
router.get('/emission-records', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const dbContext = await getDatabaseContext();

    const { asset_id, scope, start_date, end_date, route } = req.query;

    let query = `
      SELECT e.*, a.name as asset_name, a.asset_type
      FROM emission_records e
      INNER JOIN assets a ON e.asset_id = a.id
      WHERE e.organization_id = ?
    `;
    const params: any[] = [orgId];

    if (asset_id) {
      query += ` AND e.asset_id = ?`;
      params.push(asset_id);
    }

    if (scope) {
      query += ` AND e.scope = ?`;
      params.push(scope);
    }

    if (start_date) {
      query += ` AND e.record_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND e.record_date <= ?`;
      params.push(end_date);
    }

    if (route) {
      query += ` AND e.route = ?`;
      params.push(route);
    }

    query += ` ORDER BY e.record_date DESC LIMIT 500`;

    const records = dbContext.db.prepare(query).all(...params);

    const summary = {
      totalRecords: records.length,
      totalCo2: records.reduce((sum: number, r: any) => sum + r.co2_tonnes, 0),
      scope1Count: records.filter((r: any) => r.scope === 1).length,
      scope3Count: records.filter((r: any) => r.scope === 3).length,
    };

    res.json({ records, summary });
  } catch (error) {
    console.error('Net Zero emission records error:', error);
    res.status(500).json({ error: 'Failed to fetch emission records' });
  }
});

export default router;
