/**
 * seedPostgres.ts — standalone async seed for the Railway Postgres database.
 *
 * Usage (from Railway console or locally):
 *   DATABASE_URL=postgres://... npx ts-node src/scripts/seedPostgres.ts
 *   # or after build:
 *   DATABASE_URL=... node dist/scripts/seedPostgres.js
 *
 * This script uses pool.query() directly (fully async) so it does NOT block
 * the event loop. It is safe to run against a live Postgres instance.
 */

import dotenv from 'dotenv';
dotenv.config();

import { getDatabaseContext, closeDatabaseContext } from '../database';
import { DemoDataGenerator } from './DemoDataGenerator';
import { SohCalculationService } from '../services/apm/SohCalculationService';
import { RiskScoringService } from '../services/supply-chain/RiskScoringService';
import { DEMO_ORG_ID, AssetStatus } from '../config/constants';
import { resetDatabase } from '../database/schema';
import { PgDatabase } from '../database/pg-adapter';
import { logger } from '../utils/logger';

async function seed() {
  logger.info('=== CellSight Postgres Seed ===');

  const ctx = await getDatabaseContext();

  if (process.env.RESET === 'true') {
    logger.info('Resetting database...');
    await resetDatabase(ctx.db as PgDatabase);
  }

  const gen = new DemoDataGenerator(ctx);
  const stats = await gen.generate();
  logger.info('Generation complete', stats);

  // Reset asset statuses then run SoH + risk
  const { PgDatabase } = await import('../database/pg-adapter');
  let assetIds: string[] = [];
  if (ctx.db instanceof PgDatabase) {
    const rows = await ctx.db.queryAsync(`SELECT id FROM assets`) as Array<{ id: string }>;
    assetIds = rows.map(r => r.id);
  } else {
    assetIds = (ctx.db.prepare('SELECT id FROM assets').all() as Array<{ id: string }>).map(r => r.id);
  }
  for (const id of assetIds) ctx.assets.updateStatus(id, AssetStatus.INSUFFICIENT_DATA);

  const soh = new SohCalculationService(ctx).calculateAllSoh();
  logger.info('SoH', soh);

  const risk = new RiskScoringService(ctx, DEMO_ORG_ID).updateAllSupplierRiskScores();
  logger.info('Risk', risk);

  closeDatabaseContext();
  logger.info('=== Seed complete ===');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
