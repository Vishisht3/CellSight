import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config/environment';
import fs from 'fs';

export function initializeDatabase(): Database.Database {
  // Ensure data directory exists
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(config.databasePath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  createTables(db);
  
  return db;
}

function createTables(db: Database.Database): void {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Suppliers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      country TEXT NOT NULL,
      risk_score REAL NOT NULL DEFAULT 0,
      concentration_risk REAL NOT NULL DEFAULT 0,
      geopolitical_risk REAL NOT NULL DEFAULT 0,
      quality_risk REAL NOT NULL DEFAULT 0,
      compliance_risk REAL NOT NULL DEFAULT 0,
      certification_expiry TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Material lots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS material_lots (
      id TEXT PRIMARY KEY,
      lot_number TEXT UNIQUE NOT NULL,
      material_type TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      country TEXT NOT NULL,
      received_at TEXT NOT NULL,
      quality_score REAL,
      specification_min REAL,
      specification_max REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);

  // Cell batches table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cell_batches (
      id TEXT PRIMARY KEY,
      batch_number TEXT UNIQUE NOT NULL,
      manufacturer_id TEXT NOT NULL,
      production_date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (manufacturer_id) REFERENCES suppliers(id)
    )
  `);

  // Batch-material link table (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_material_links (
      id TEXT PRIMARY KEY,
      cell_batch_id TEXT NOT NULL,
      material_lot_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (cell_batch_id) REFERENCES cell_batches(id),
      FOREIGN KEY (material_lot_id) REFERENCES material_lots(id),
      UNIQUE(cell_batch_id, material_lot_id)
    )
  `);

  // Battery packs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS battery_packs (
      id TEXT PRIMARY KEY,
      pack_number TEXT UNIQUE NOT NULL,
      cell_batch_id TEXT NOT NULL,
      assembly_date TEXT NOT NULL,
      capacity REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (cell_batch_id) REFERENCES cell_batches(id)
    )
  `);

  // Assets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      battery_pack_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_soh REAL,
      soh_confidence REAL,
      predicted_rul_days INTEGER,
      predicted_rul_cycles INTEGER,
      last_telemetry_at TEXT,
      total_cycles INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (battery_pack_id) REFERENCES battery_packs(id)
    )
  `);

  // Telemetry data table
  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry_data (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      voltage REAL NOT NULL,
      current REAL NOT NULL,
      temperature REAL NOT NULL,
      state_of_charge REAL NOT NULL,
      cycle_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    )
  `);

  // SoH history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS soh_history (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      soh_value REAL NOT NULL,
      confidence REAL NOT NULL,
      model_version TEXT NOT NULL,
      computed_at TEXT NOT NULL,
      data_points_used INTEGER NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    )
  `);

  // Alerts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      source_agent TEXT NOT NULL,
      asset_id TEXT,
      supplier_id TEXT,
      cell_batch_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      metadata TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (cell_batch_id) REFERENCES cell_batches(id),
      FOREIGN KEY (acknowledged_by) REFERENCES users(id),
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_asset_timestamp 
    ON telemetry_data(asset_id, timestamp DESC);
    
    CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp 
    ON telemetry_data(timestamp DESC);
    
    CREATE INDEX IF NOT EXISTS idx_soh_history_asset 
    ON soh_history(asset_id, computed_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_alerts_status 
    ON alerts(status, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_alerts_asset 
    ON alerts(asset_id, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_alerts_supplier 
    ON alerts(supplier_id, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_material_lots_supplier 
    ON material_lots(supplier_id);
    
    CREATE INDEX IF NOT EXISTS idx_assets_status 
    ON assets(status);
    
    CREATE INDEX IF NOT EXISTS idx_assets_battery_pack 
    ON assets(battery_pack_id);
  `);

  console.log('✅ Database schema initialized');
}

export function resetDatabase(db: Database.Database): void {
  const tables = [
    'alerts',
    'soh_history',
    'telemetry_data',
    'assets',
    'battery_packs',
    'batch_material_links',
    'cell_batches',
    'material_lots',
    'suppliers',
    'users',
  ];

  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  }

  createTables(db);
  console.log('✅ Database reset complete');
}
