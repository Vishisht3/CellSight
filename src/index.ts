import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/environment';
import { getDatabaseContext } from './database';
import apiRoutes from './api/routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { scheduler } from './utils/scheduler';
import { TelemetryIngestionService } from './services/apm/TelemetryIngestionService';
import { SohCalculationService } from './services/apm/SohCalculationService';
import { PredictiveMaintenanceService } from './services/apm/PredictiveMaintenanceService';
import { RiskScoringService } from './services/supply-chain/RiskScoringService';
import { CorrelationService } from './services/correlation/CorrelationService';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/api', apiRoutes);
app.use(errorHandler);

async function startServer() {
  // Initialise DB before registering scheduled tasks
  const dbContext = await getDatabaseContext();
  logger.info('✅ Database initialised');

  // Scheduled background tasks
  scheduler.register('check-stale-assets',  5 * 60 * 1000, () => { new TelemetryIngestionService(dbContext).checkStaleAssets(); });
  scheduler.register('calculate-soh',       10 * 60 * 1000, () => { new SohCalculationService(dbContext).calculateAllSoh(); });
  scheduler.register('maintenance-checks',  5 * 60 * 1000, () => { new PredictiveMaintenanceService(dbContext).runMaintenanceChecksForAllAssets(); });
  scheduler.register('update-risk-scores',  30 * 60 * 1000, () => { new RiskScoringService(dbContext).updateAllSupplierRiskScores(); });
  scheduler.register('correlation-analysis',60 * 60 * 1000, () => { new CorrelationService(dbContext).runCorrelationAnalysis(); });

  const server = app.listen(config.port, () => {
    logger.info(`🚀 CellSight API running on http://localhost:${config.port}`);
    logger.info(`   Demo mode: ${config.demoMode ? 'enabled' : 'disabled'}`);
    scheduler.startAll();
    logger.info('⏰ Background tasks started');
  });

  process.on('SIGTERM', () => { scheduler.stopAll(); server.close(() => process.exit(0)); });
  process.on('SIGINT',  () => { scheduler.stopAll(); server.close(() => process.exit(0)); });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
