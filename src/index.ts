import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/environment';
import { getDatabaseContext } from './database';
import apiRoutes from './api/routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { scheduler } from './utils/scheduler';
import { TelemetryIngestionService } from './services/apm/TelemetryIngestionService';
import { SohCalculationService } from './services/apm/SohCalculationService';
import { PredictiveMaintenanceService } from './services/apm/PredictiveMaintenanceService';
import { RiskScoringService } from './services/supply-chain/RiskScoringService';
import { CorrelationService } from './services/correlation/CorrelationService';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false, // allow Recharts canvas
}));

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = Array.isArray(config.corsOrigin)
  ? config.corsOrigin
  : [config.corsOrigin];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, SSR)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Request logging (with request-ID) ────────────────────────────────────
app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/auth/login',   authLimiter);
app.use('/api/auth/refresh', authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use(errorHandler);

// ── Server startup ────────────────────────────────────────────────────────
async function startServer() {
  // Bind to the port immediately so Railway's healthcheck gets a response
  // right away. The /api/health route returns 503 while the DB is still
  // initialising — Railway treats that as "still starting" rather than failed.
  const server = app.listen(config.port, () => {
    logger.info(`🚀 CellSight API`, {
      url: `http://localhost:${config.port}`,
      env: config.nodeEnv,
      demo: config.demoMode,
    });
  });

  const dbContext = await getDatabaseContext();
  logger.info('✅ Database initialised', {
    driver: config.databaseUrl ? 'postgres' : 'sql.js',
  });

  // ── Auto-seed demo data if DEMO_MODE=true and DB is empty ──────────────
  if (config.demoMode) {
    try {
      // Use execAsync on Postgres to avoid the Atomics spin-loop returning undefined
      let userCount = 0;
      if (config.databaseUrl) {
        const { PgDatabase } = await import('./database/pg-adapter');
        if (dbContext.db instanceof PgDatabase) {
          const rows = await dbContext.db.queryAsync('SELECT COUNT(*) as c FROM users');
          userCount = parseInt((rows[0] as any)?.c ?? '0', 10);
        }
      } else {
        userCount = (dbContext.db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c ?? 0;
      }

      if (userCount === 0) {
        logger.info('Demo mode: no users found — running seed...');
        const { DemoDataGenerator } = await import('./scripts/DemoDataGenerator');
        const { SohCalculationService: SohSvc } = await import('./services/apm/SohCalculationService');
        const { RiskScoringService: RiskSvc } = await import('./services/supply-chain/RiskScoringService');
        const { DEMO_ORG_ID, AssetStatus } = await import('./config/constants');
        const gen = new DemoDataGenerator(dbContext);
        await gen.generate();
        const assetRows = (dbContext.db.prepare('SELECT id FROM assets').all() as Array<{ id: string }>);
        for (const a of assetRows) dbContext.assets.updateStatus(a.id, AssetStatus.INSUFFICIENT_DATA);
        new SohSvc(dbContext).calculateAllSoh();
        new RiskSvc(dbContext, DEMO_ORG_ID).updateAllSupplierRiskScores();
        logger.info('Demo data seeded successfully');
      }
    } catch (seedErr) {
      logger.error('Demo seed check failed', { error: seedErr });
    }
  }

  scheduler.register('check-stale-assets',   5 * 60 * 1000, () => {
    new TelemetryIngestionService(dbContext).checkStaleAssets();
  });
  scheduler.register('calculate-soh',        10 * 60 * 1000, () => {
    new SohCalculationService(dbContext).calculateAllSoh();
  });
  scheduler.register('maintenance-checks',   5 * 60 * 1000, () => {
    // Run for each org in the database
    const orgs = dbContext.orgs.list();
    for (const org of orgs) {
      new PredictiveMaintenanceService(dbContext, org.id).runMaintenanceChecksForAllAssets();
    }
  });
  scheduler.register('update-risk-scores',   30 * 60 * 1000, () => {
    const orgs = dbContext.orgs.list();
    for (const org of orgs) {
      new RiskScoringService(dbContext, org.id).updateAllSupplierRiskScores();
    }
  });
  scheduler.register('correlation-analysis', 60 * 60 * 1000, () => {
    const orgs = dbContext.orgs.list();
    for (const org of orgs) {
      new CorrelationService(dbContext, org.id).runCorrelationAnalysis();
    }
  });

  scheduler.startAll();
  logger.info('⏰ Background tasks started');

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    scheduler.stopAll();
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000); // force-kill after 10s
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Surface unhandled rejections so they appear in logs
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });
}

startServer().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export default app;
