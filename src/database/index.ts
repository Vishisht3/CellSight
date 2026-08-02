import { config } from '../config/environment';
import type { DbDriver } from './driver';
import { initializeDatabase, initializePgDatabase } from './schema';
import { PgDatabase } from './pg-adapter';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { UserRepository } from './repositories/UserRepository';
import { AssetRepository } from './repositories/AssetRepository';
import { TelemetryRepository } from './repositories/TelemetryRepository';
import { SupplierRepository } from './repositories/SupplierRepository';
import { MaterialRepository } from './repositories/MaterialRepository';
import { CellBatchRepository } from './repositories/CellBatchRepository';
import { AlertRepository } from './repositories/AlertRepository';
import { SohRepository } from './repositories/SohRepository';

export type AnyDatabase = DbDriver;

export interface DatabaseContext {
  db: DbDriver;
  orgs: OrganizationRepository;
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

export async function getDatabaseContext(): Promise<DatabaseContext> {
  if (dbContext) return dbContext;

  let db: DbDriver;

  if (config.databaseUrl) {
    const pg = await PgDatabase.connect(config.databaseUrl);
    await initializePgDatabase(pg);
    db = pg;
  } else {
    db = await initializeDatabase();
  }

  dbContext = {
    db,
    orgs:        new OrganizationRepository(db),
    users:       new UserRepository(db),
    assets:      new AssetRepository(db),
    telemetry:   new TelemetryRepository(db),
    suppliers:   new SupplierRepository(db),
    materials:   new MaterialRepository(db),
    cellBatches: new CellBatchRepository(db),
    alerts:      new AlertRepository(db),
    soh:         new SohRepository(db),
  };

  return dbContext;
}

export function closeDatabaseContext(): void {
  if (dbContext) {
    dbContext.db.close();
    dbContext = null;
  }
}
