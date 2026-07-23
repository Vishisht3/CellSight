import Database from 'better-sqlite3';
import { initializeDatabase } from './schema';
import { UserRepository } from './repositories/UserRepository';
import { AssetRepository } from './repositories/AssetRepository';
import { TelemetryRepository } from './repositories/TelemetryRepository';
import { SupplierRepository } from './repositories/SupplierRepository';
import { MaterialRepository } from './repositories/MaterialRepository';
import { CellBatchRepository } from './repositories/CellBatchRepository';
import { AlertRepository } from './repositories/AlertRepository';
import { SohRepository } from './repositories/SohRepository';

export interface DatabaseContext {
  db: Database.Database;
  users: UserRepository;
  assets: AssetRepository;
  telemetry: TelemetryRepository;
  suppliers: SupplierRepository;
  materials: MaterialRepository;
  cellBatches: CellBatchRepository;
  alerts: AlertRepository;
  soh: SohRepository;
}

let dbContext: DatabaseContext | null = null;

export function getDatabaseContext(): DatabaseContext {
  if (!dbContext) {
    const db = initializeDatabase();
    
    dbContext = {
      db,
      users: new UserRepository(db),
      assets: new AssetRepository(db),
      telemetry: new TelemetryRepository(db),
      suppliers: new SupplierRepository(db),
      materials: new MaterialRepository(db),
      cellBatches: new CellBatchRepository(db),
      alerts: new AlertRepository(db),
      soh: new SohRepository(db),
    };
  }

  return dbContext;
}

export function closeDatabaseContext(): void {
  if (dbContext) {
    dbContext.db.close();
    dbContext = null;
  }
}
