#!/usr/bin/env ts-node
/**
 * CellSight Migration Script
 * ──────────────────────────
 * Exports all data from the local sql.js file-backed database and imports
 * it into a target PostgreSQL database, OR re-seeds the target from scratch.
 *
 * Usage:
 *
 *   # Full migration: sql.js → Postgres
 *   DATABASE_PATH=./data/cellsight.db \
 *   TARGET_DATABASE_URL=postgres://user:pass@host/cellsight \
 *   npx ts-node src/scripts/migrate.ts
 *
 *   # Seed only (empty Postgres, skip export step)
 *   TARGET_DATABASE_URL=postgres://user:pass@host/cellsight \
 *   SEED_ONLY=true \
 *   npx ts-node src/scripts/migrate.ts
 *
 * The script is idempotent: running it twice inserts rows with ON CONFLICT
 * DO NOTHING so existing rows are never overwritten.
 */

import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { Database as SqlJsDb } from '../database/sqlite-shim';
import { PgDatabase } from '../database/pg-adapter';
import { initializePgDatabase } from '../database/schema';
import { DemoDataGenerator } from './DemoDataGenerator';
import { getDatabaseContext, closeDatabaseContext } from '../database';
import { SohCalculationService } from '../services/apm/SohCalculationService';
import { RiskScoringService } from '../services/supply-chain/RiskScoringService';
import { AssetStatus } from '../config/constants';

const TARGET_URL  = process.env.TARGET_DATABASE_URL;
const SOURCE_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'cellsight.db');
const SEED_ONLY   = process.env.SEED_ONLY === 'true';

// ── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) { process.stdout.write(`[migrate] ${msg}\n`); }
function err(msg: string) { process.stderr.write(`[migrate] ERROR: ${msg}\n`); }

const TABLES = [
  'users', 'suppliers', 'material_lots', 'cell_batches',
  'batch_material_links', 'battery_packs', 'assets',
  'telemetry_data', 'soh_history', 'alerts', 'refresh_tokens',
];

// Build an INSERT … ON CONFLICT DO NOTHING for any row
function buildInsertSql(table: string, row: Record<string, unknown>): { sql: string; params: unknown[] } {
  const cols   = Object.keys(row);
  const values = Object.values(row);
  const placeholders = cols.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
    params: values,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function migrate() {
  if (!TARGET_URL) {
    err('TARGET_DATABASE_URL is required');
    process.exit(1);
  }

  log(`Target: ${TARGET_URL.replace(/:[^@]+@/, ':***@')}`);

  // 1. Connect to Postgres and initialise schema
  log('Connecting to target Postgres…');
  const pg = await PgDatabase.connect(TARGET_URL);
  await initializePgDatabase(pg);
  log('Schema ready');

  if (SEED_ONLY) {
    await seedPostgres(pg);
  } else {
    await exportFromSqlJs(pg);
  }

  pg.close();
  log('Migration complete ✅');
  process.exit(0);
}

// ── Export from sql.js → Postgres ─────────────────────────────────────────

async function exportFromSqlJs(pg: PgDatabase) {
  if (!(require('fs').existsSync(SOURCE_PATH))) {
    err(`Source database not found at ${SOURCE_PATH}. Run 'npm run seed:demo' first.`);
    process.exit(1);
  }

  log(`Source: ${SOURCE_PATH}`);
  const src = await SqlJsDb.open(SOURCE_PATH);

  let totalRows = 0;

  for (const table of TABLES) {
    const rows = src.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    if (rows.length === 0) {
      log(`  ${table}: (empty)`);
      continue;
    }

    let inserted = 0;
    for (const row of rows) {
      try {
        const { sql, params } = buildInsertSql(table, row);
        pg.prepare(sql).run(...params);
        inserted++;
      } catch (e: any) {
        // Log but continue — partial imports are recoverable
        err(`  ${table} row insert failed: ${e.message}`);
      }
    }

    log(`  ${table}: ${inserted}/${rows.length} rows migrated`);
    totalRows += inserted;
  }

  src.close();
  log(`Export complete — ${totalRows} total rows written to Postgres`);
}

// ── Seed fresh Postgres from DemoDataGenerator ────────────────────────────

async function seedPostgres(_pg: PgDatabase) {
  log('Seeding Postgres with demo data…');

  // Temporarily override getDatabaseContext to use the pg driver
  process.env.DATABASE_URL = TARGET_URL!;

  const ctx = await getDatabaseContext();

  const gen = new DemoDataGenerator(ctx);
  const stats = await gen.generate();

  // Clear stale flags then compute SoH + risk
  const assets = ctx.assets.list();
  for (const a of assets) ctx.assets.updateStatus(a.id, AssetStatus.INSUFFICIENT_DATA);

  const sohResult = new SohCalculationService(ctx).calculateAllSoh();
  log(`SoH: ${sohResult.calculated} calculated`);

  const riskResult = new RiskScoringService(ctx).updateAllSupplierRiskScores();
  log(`Risk: ${riskResult.updated} suppliers updated, ${riskResult.alertsCreated} alerts`);

  log(`Seeding complete — ${JSON.stringify(stats)}`);
  closeDatabaseContext();
}

migrate().catch(e => {
  err(e.message ?? String(e));
  process.exit(1);
});
