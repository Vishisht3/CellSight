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

    CREATE TABLE IF NOT EXISTS outbox_events (
      id             TEXT PRIMARY KEY,
      event_type     TEXT NOT NULL,
      payload        TEXT NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      created_at     TEXT NOT NULL,
      delivered_at   TEXT,
      attempts       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS production_batches (
      id                   TEXT PRIMARY KEY,
      batch_number         TEXT UNIQUE NOT NULL,
      cell_batch_id        TEXT NOT NULL,
      production_line      TEXT NOT NULL,
      start_time           TEXT NOT NULL,
      end_time             TEXT,
      target_quantity      INTEGER NOT NULL,
      produced_quantity    INTEGER NOT NULL DEFAULT 0,
      passed_quantity      INTEGER NOT NULL DEFAULT 0,
      failed_quantity      INTEGER NOT NULL DEFAULT 0,
      status               TEXT NOT NULL,
      organization_id      TEXT NOT NULL REFERENCES organizations(id),
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      FOREIGN KEY (cell_batch_id) REFERENCES cell_batches(id)
    );

    CREATE TABLE IF NOT EXISTS quality_inspections (
      id                    TEXT PRIMARY KEY,
      production_batch_id   TEXT NOT NULL,
      inspection_type       TEXT NOT NULL,
      inspection_timestamp  TEXT NOT NULL,
      defect_type           TEXT,
      defect_count          INTEGER NOT NULL DEFAULT 0,
      sample_size           INTEGER NOT NULL,
      passed                INTEGER NOT NULL,
      result                TEXT NOT NULL,
      inspector_id          TEXT,
      notes                 TEXT,
      organization_id       TEXT NOT NULL REFERENCES organizations(id),
      created_at            TEXT NOT NULL,
      FOREIGN KEY (production_batch_id) REFERENCES production_batches(id)
    );

    CREATE TABLE IF NOT EXISTS process_parameters (
      id                   TEXT PRIMARY KEY,
      production_batch_id  TEXT NOT NULL,
      parameter_name       TEXT NOT NULL,
      parameter_value      REAL NOT NULL,
      measurement_time     TEXT NOT NULL,
      unit                 TEXT NOT NULL,
      organization_id      TEXT NOT NULL REFERENCES organizations(id),
      created_at           TEXT NOT NULL,
      FOREIGN KEY (production_batch_id) REFERENCES production_batches(id)
    );

    CREATE TABLE IF NOT EXISTS spc_control_limits (
      id                TEXT PRIMARY KEY,
      parameter_name    TEXT UNIQUE NOT NULL,
      center_line       REAL NOT NULL,
      ucl               REAL NOT NULL,
      lcl               REAL NOT NULL,
      usl               REAL,
      lsl               REAL,
      last_updated      TEXT NOT NULL,
      organization_id   TEXT NOT NULL REFERENCES organizations(id),
      created_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_zero_targets (
      id                       TEXT PRIMARY KEY,
      target_year              INTEGER NOT NULL,
      scope1_target_tonnes     REAL NOT NULL,
      scope3_target_tonnes     REAL NOT NULL,
      total_target_tonnes      REAL NOT NULL,
      baseline_year            INTEGER NOT NULL,
      baseline_scope1_tonnes   REAL NOT NULL,
      baseline_scope3_tonnes   REAL NOT NULL,
      organization_id          TEXT NOT NULL REFERENCES organizations(id),
      created_at               TEXT NOT NULL,
      updated_at               TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emission_records (
      id                   TEXT PRIMARY KEY,
      asset_id             TEXT NOT NULL,
      record_date          TEXT NOT NULL,
      scope                INTEGER NOT NULL,
      category             TEXT NOT NULL,
      co2_tonnes           REAL NOT NULL,
      route                TEXT,
      distance_km          REAL,
      fuel_litres          REAL,
      kwh_consumed         REAL,
      calculation_method   TEXT NOT NULL,
      organization_id      TEXT NOT NULL REFERENCES organizations(id),
      created_at           TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_undelivered ON outbox_events(delivered_at) WHERE delivered_at IS NULL;

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
    CREATE INDEX IF NOT EXISTS idx_production_batches_org ON production_batches(organization_id);
    CREATE INDEX IF NOT EXISTS idx_quality_inspections_batch ON quality_inspections(production_batch_id);
    CREATE INDEX IF NOT EXISTS idx_process_parameters_batch ON process_parameters(production_batch_id);
    CREATE INDEX IF NOT EXISTS idx_emission_records_asset ON emission_records(asset_id);
    CREATE INDEX IF NOT EXISTS idx_emission_records_date ON emission_records(record_date);
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
  const now = new Date().toISOString();

  // Step 1: Create all tables (fresh DB or tables already exist — both safe)
  await db.execAsync(SCHEMA_SQL);

  // Step 2: Seed demo org row
  await db.execAsync(
    `INSERT INTO organizations (id, name, org_type, created_at)
     VALUES ('${DEMO_ORG_ID}', '${DEMO_ORG_NAME}', 'demo', '${now}')
     ON CONFLICT (id) DO NOTHING`
  );

  // Step 3: Migrate pre-existing rows that may lack organization_id
  // (ADD COLUMN IF NOT EXISTS is a no-op if the column already exists)
  const MIGRATION_SQL = `
    ALTER TABLE users         ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE suppliers     ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE material_lots ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE cell_batches  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE battery_packs ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE assets        ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE alerts        ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE process_parameters ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE spc_control_limits ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE net_zero_targets ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);
    ALTER TABLE emission_records ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

    UPDATE users         SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE suppliers     SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE material_lots SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE cell_batches  SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE battery_packs SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE assets        SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE alerts        SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE production_batches SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE quality_inspections SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE process_parameters SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE spc_control_limits SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE net_zero_targets SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;
    UPDATE emission_records SET organization_id = '${DEMO_ORG_ID}' WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_assets_org    ON assets(organization_id);
    CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_org    ON alerts(organization_id);
    CREATE INDEX IF NOT EXISTS idx_production_batches_org ON production_batches(organization_id);
    CREATE INDEX IF NOT EXISTS idx_quality_inspections_batch ON quality_inspections(production_batch_id);
    CREATE INDEX IF NOT EXISTS idx_process_parameters_batch ON process_parameters(production_batch_id);
    CREATE INDEX IF NOT EXISTS idx_emission_records_asset ON emission_records(asset_id);
    CREATE INDEX IF NOT EXISTS idx_emission_records_date ON emission_records(record_date);
  `;
  await db.execAsync(MIGRATION_SQL);

  console.log('✅ Database schema initialised');
}

export async function resetDatabase(db: Database | PgDatabase): Promise<void> {
  const tables = [
    'emission_records', 'net_zero_targets',
    'spc_control_limits', 'process_parameters', 'quality_inspections', 'production_batches',
    'outbox_events',
    'alerts', 'soh_history', 'telemetry_data', 'assets',
    'battery_packs', 'batch_material_links', 'cell_batches',
    'material_lots', 'suppliers', 'refresh_tokens', 'users', 'organizations',
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
