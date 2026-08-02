import { getDatabaseContext, closeDatabaseContext } from '../database';
import { resetDatabase } from '../database/schema';
import { DemoDataGenerator } from './DemoDataGenerator';
import { SohCalculationService } from '../services/apm/SohCalculationService';
import { RiskScoringService } from '../services/supply-chain/RiskScoringService';
import { DEMO_ORG_ID, AssetStatus } from '../config/constants';
import { logger } from '../utils/logger';

async function seedDemoData() {
  try {
    logger.info('=== CellSight Demo Data Seeding ===');

    const dbContext = await getDatabaseContext();

    logger.info('Resetting database...');
    await resetDatabase(dbContext.db as import('../database/sqlite-shim').Database);

    // Generate all demo data
    const generator = new DemoDataGenerator(dbContext);
    const stats = await generator.generate();

    // ── Post-seed: ensure all assets are not stale so SoH can compute ──
    const assets = dbContext.db.prepare('SELECT id FROM assets').all() as Array<{ id: string }>;
    for (const asset of assets) {
      dbContext.assets.updateStatus(asset.id, AssetStatus.INSUFFICIENT_DATA);
    }

    // ── Run SoH calculation immediately so dashboard shows real values ──
    logger.info('Running initial SoH calculations...');
    const sohSvc = new SohCalculationService(dbContext);
    const sohResult = sohSvc.calculateAllSoh();
    logger.info(`SoH: ${sohResult.calculated} calculated, ${sohResult.skipped} skipped`);

    // ── Update supplier risk scores ──
    logger.info('Updating supplier risk scores...');
    const riskSvc = new RiskScoringService(dbContext, DEMO_ORG_ID);
    const riskResult = riskSvc.updateAllSupplierRiskScores();
    logger.info(`Risk scores: ${riskResult.updated} updated, ${riskResult.alertsCreated} alerts created`);

    logger.info('=== Demo Data Summary ===');
    logger.info(`Users: ${stats.users}`);
    logger.info(`Suppliers: ${stats.suppliers}`);
    logger.info(`Material Lots: ${stats.materialLots}`);
    logger.info(`Cell Batches: ${stats.cellBatches}`);
    logger.info(`Battery Packs: ${stats.batteryPacks}`);
    logger.info(`Assets: ${stats.assets}`);
    logger.info(`Telemetry Records: ${stats.telemetryRecords}`);
    logger.info('');
    logger.info('Demo credentials:');
    logger.info('  Admin:            admin@cellsight.com  / demo123');
    logger.info('  Fleet Manager:    fleet@cellsight.com  / demo123');
    logger.info('  Supply Chain Mgr: supply@cellsight.com / demo123');
    logger.info('');
    logger.info('✅ Demo data seeding complete!');

    closeDatabaseContext();
    process.exit(0);
  } catch (error) {
    logger.error('Demo data seeding failed', { error });
    process.exit(1);
  }
}

seedDemoData();
