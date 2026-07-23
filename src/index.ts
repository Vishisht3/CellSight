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

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// API Routes
app.use('/api', apiRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Initialize database
const dbContext = getDatabaseContext();
logger.info('Database initialized');

// Register scheduled tasks
function registerScheduledTasks() {
  // Check for stale assets every 5 minutes
  scheduler.register(
    'check-stale-assets',
    5 * 60 * 1000,
    () => {
      const telemetryService = new TelemetryIngestionService(dbContext);
      telemetryService.checkStaleAssets();
    }
  );

  // Calculate SoH for all assets every 10 minutes
  scheduler.register(
    'calculate-soh',
    10 * 60 * 1000,
    () => {
      const sohService = new SohCalculationService(dbContext);
      sohService.calculateAllSoh();
    }
  );

  // Run maintenance checks every 5 minutes
  scheduler.register(
    'maintenance-checks',
    5 * 60 * 1000,
    () => {
      const maintenanceService = new PredictiveMaintenanceService(dbContext);
      maintenanceService.runMaintenanceChecksForAllAssets();
    }
  );

  // Update supplier risk scores every 30 minutes
  scheduler.register(
    'update-risk-scores',
    30 * 60 * 1000,
    () => {
      const riskService = new RiskScoringService(dbContext);
      riskService.updateAllSupplierRiskScores();
    }
  );

  // Run correlation analysis every 60 minutes
  scheduler.register(
    'correlation-analysis',
    60 * 60 * 1000,
    () => {
      const correlationService = new CorrelationService(dbContext);
      correlationService.runCorrelationAnalysis();
    }
  );

  logger.info('Scheduled tasks registered');
}

// Start server
function startServer() {
  const server = app.listen(config.port, () => {
    logger.info(`CellSight API server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Demo mode: ${config.demoMode ? 'enabled' : 'disabled'}`);
    
    // Start scheduled tasks
    registerScheduledTasks();
    scheduler.startAll();
    logger.info('Background tasks started');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    scheduler.stopAll();
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    scheduler.stopAll();
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });

  return server;
}

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
