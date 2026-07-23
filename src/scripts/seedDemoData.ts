import { getDatabaseContext, closeDatabaseContext } from '../database';
import { resetDatabase } from '../database/schema';
import { DemoDataGenerator } from './DemoDataGenerator';
import { logger } from '../utils/logger';

async function seedDemoData() {
  try {
    logger.info('=== CellSight Demo Data Seeding ===');

    const dbContext = getDatabaseContext();

    // Reset database
    logger.info('Resetting database...');
    resetDatabase(dbContext.db);

    // Generate demo data
    const generator = new DemoDataGenerator(dbContext);
    const stats = await generator.generate();

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
    logger.info('  Admin: admin@cellsight.com / demo123');
    logger.info('  Fleet Manager: fleet@cellsight.com / demo123');
    logger.info('  Supply Chain Manager: supply@cellsight.com / demo123');
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
