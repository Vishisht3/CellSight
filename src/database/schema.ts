import path from 'path';
import { config } from '../config/environment';
import { DEMO_ORG_ID, DEMO_ORG_NAME } from '../config/constants';
import { Database } from './sqlite-shim';
import { PgDatabase } from './pg-adapter';

// ── sql.js (local) ────────────────────────────────────────────────────────

export async function initializeDatabase(): Promise<Database> {
  const dbPath = path.resolve(config.databasePath);
  const db = await Database.open(dbPath);
  await createTables(db);
  return db;
}

// ── Postgres (hosted) ─────────────────────────────────────────────────────

export async function initializePgDatabase(db: PgDatabase): Promise<void> {
  await createTablesPg(db);
}

// ── Shared DDL ────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS organizations (
      id         TEXT PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      org_type   TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,
      role            TEXT NOT NULL,
      name            TEXT NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      tier             TEXT NOT NULL,
      country          TEXT NOT NULL,
      risk_score       REAL NOT NULL DEFAULT 0,
      concentration_risk REAL NOT NULL DEFAULT 0,
      geopolitical_risk  REAL NOT NULL DEFAULT 0,
      quality_risk       REAL NOT NULL DEFAULT 0,
      compliance_risk    REAL NOT NULL DEFAULT 0,
      certification_expiry TEXT,
      organization_id  TEXT NOT NULL REFERENCES organizations(id),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_lots (
      id                TEXT PRIMARY KEY,
      lot_number        TEXT UNIQUE NOT NULL,
      material_type     TEXT NOT NULL,
      supplier_id       TEXT NOT NULL,
      quantity          REAL NOT NULL,
      country           TEXT NOT NULL,
      received_at       TEXT NOT NULL,
      quality_score     REAL,
      specification_min REAL,
      specification_max REAL,
      organization_id   TEXT NOT NULL REFERENCES organizations(id),
      created_at        TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS cell_batches (
      id              TEXT PRIMARY KEY,
      batch_number    TEXT UNIQUE NOT NULL,
      manufacturer_id TEXT NOT NULL,
      production_date TEXT NOT NULL,
      quantity        INTEGER NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      created_at      TEXT NOT NULL,
      FOREIGN KEY (manufacturer_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS batch_material_links (
      id              TEXT PRIMARY KEY,
      cell_batch_id   TEXT NOT NULL,
      material_lot_id TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      FOREIGN KEY (cell_batch_id)   REFERENCES cell_batches(id),
      FOREIGN KEY (material_lot_id) REFERENCES material_lots(id),
      UNIQUE(cell_batch_id, material_lot_id)
    );

    CREATE TABLE IF NOT EXISTS battery_packs (
      id              TEXT PRIMARY KEY,
      pack_number     TEXT UNIQUE NOT NULL,
      cell_batch_id   TEXT NOT NULL,
      assembly_date   TEXT NOT NULL,
      capacity        REAL NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      created_at      TEXT NOT NULL,
      FOREIGN KEY (cell_batch_id) REFERENCES cell_batches(id)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL,
      asset_type           TEXT NOT NULL,
      battery_pack_id      TEXT NOT NULL,
      status               TEXT NOT NULL,
      current_soh          REAL,
      soh_confidence       REAL,
      predicted_rul_days   INTEGER,
      predicted_rul_cycles INTEGER,
      last_telemetry_at    TEXT,
      total_cycles         INTEGER NOT NULL DEFAULT 0,
      organization_id      TEXT NOT NULL REFERENCES organizations(id),
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      FOREIGN KEY (battery_pack_id) REFERENCES battery_packs(id)
    );

    CREATE TABLE IF NOT EXISTS telemetry_data (
      id              TEXT PRIMARY KEY,
      asset_id        TEXT NOT NULL,
      timestamp       TEXT NOT NULL,
      voltage         REAL NOT NULL,
      current         REAL NOT NULL,
      temperature     REAL NOT NULL,
      state_of_charge REAL NOT NULL,
      cycle_count     INTEGER NOT NULL,
      created_at      TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS soh_history (
      id               TEXT PRIMARY KEY,
      asset_id         TEXT NOT NULL,
      soh_value        REAL NOT NULL,
      confidence       REAL NOT NULL,
      model_version    TEXT NOT NULL,
      computed_at      TEXT NOT NULL,
      data_points_used INTEGER NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id              TEXT PRIMARY KEY,
      type            TEXT NOT NULL,
      severity        TEXT NOT NULL,
      source_agent    TEXT NOT NULL,
      asset_id        TEXT,
      supplier_id     TEXT,
      cell_batch_id   TEXT,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      status          TEXT NOT NULL,
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      resolved_by     TEXT,
      resolved_at     TEXT,
      metadata        TEXT NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      family     TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_asset       ON telemetry_data(asset_id);
    CREATE INDEX IF NOT EXISTS idx_soh_asset             ON soh_history(asset_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_status         ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_asset          ON alerts(asset_id);
    CREATE INDEX IF NOT EXISTS idx_assets_status         ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_org            ON assets(organization_id);
    CREATE INDEX IF NOT EXISTS idx_suppliers_org         ON suppliers(organization_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_org            ON alerts(organization_id);
`;

// Seed the demo org row — idempotent
const DEMO_ORG_SQL = (now: string) =>
  `INSERT OR IGNORE INTO organizations (id, name, org_type, created_at) VALUES ('${DEMO_ORG_ID}', '${DEMO_ORG_NAME}', 'demo', '${now}')`;

/** SQLite — synchronous exec is fine (in-memory, no network) */
async function createTables(db: Database): Promise<void> {
  db.exec(SCHEMA_SQL);
  db.exec(DEMO_ORG_SQL(new Date().toISOString()));
  console.log('✅ Database schema initialised');
}

/** Postgres — use execAsync so the event loop stays free during startup */
async function createTablesPg(db: PgDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  // Postgres uses INSERT ... ON CONFLICT DO NOTHING instead of INSERT OR IGNORE
  const pgDemoSql = `INSERT INTO organizations (id, name, org_type, created_at) VALUES ('${DEMO_ORG_ID}', '${DEMO_ORG_NAME}', 'demo', '${new Date().toISOString()}') ON CONFLICT (id) DO NOTHING`;
  await db.execAsync(pgDemoSql);
  console.log('✅ Database schema initialised');
}

export async function resetDatabase(db: Database | PgDatabase): Promise<void> {
  const tables = [
    'alerts', 'soh_history', 'telemetry_data', 'assets',
    'battery_packs', 'batch_material_links', 'cell_batches',
    'material_lots', 'suppliers', 'users', 'organizations',
  ];
  if (db instanceof PgDatabase) {
    for (const t of tables) {
      await db.execAsync(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    await createTablesPg(db);
  } else {
    for (const t of tables) {
      db.exec(`DROP TABLE IF EXISTS ${t}`);
    }
    await createTables(db);
  }
  console.log('✅ Database reset complete');
}
