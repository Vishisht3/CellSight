import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { TelemetryData, TelemetryIngestInput } from '../../models/types';

export class TelemetryRepository {
  constructor(private db: Database.Database) {}

  create(input: TelemetryIngestInput): TelemetryData {
    const now = new Date().toISOString();
    const telemetry: TelemetryData = {
      id: uuidv4(),
      assetId: input.assetId,
      timestamp: input.timestamp || now,
      voltage: input.voltage,
      current: input.current,
      temperature: input.temperature,
      stateOfCharge: input.stateOfCharge,
      cycleCount: input.cycleCount,
      createdAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO telemetry_data (
        id, asset_id, timestamp, voltage, current, temperature,
        state_of_charge, cycle_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      telemetry.id,
      telemetry.assetId,
      telemetry.timestamp,
      telemetry.voltage,
      telemetry.current,
      telemetry.temperature,
      telemetry.stateOfCharge,
      telemetry.cycleCount,
      telemetry.createdAt
    );

    return telemetry;
  }

  findByAsset(assetId: string, limit = 100): TelemetryData[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, asset_id as assetId, timestamp, voltage, current, temperature,
        state_of_charge as stateOfCharge, cycle_count as cycleCount,
        created_at as createdAt
      FROM telemetry_data 
      WHERE asset_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(assetId, limit) as TelemetryData[];
  }

  findByAssetInRange(assetId: string, startDate: string, endDate: string): TelemetryData[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, asset_id as assetId, timestamp, voltage, current, temperature,
        state_of_charge as stateOfCharge, cycle_count as cycleCount,
        created_at as createdAt
      FROM telemetry_data 
      WHERE asset_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);

    return stmt.all(assetId, startDate, endDate) as TelemetryData[];
  }

  getLatestByAsset(assetId: string): TelemetryData | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, asset_id as assetId, timestamp, voltage, current, temperature,
        state_of_charge as stateOfCharge, cycle_count as cycleCount,
        created_at as createdAt
      FROM telemetry_data 
      WHERE asset_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    return stmt.get(assetId) as TelemetryData | undefined || null;
  }

  countByAsset(assetId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM telemetry_data 
      WHERE asset_id = ?
    `);

    const result = stmt.get(assetId) as { count: number };
    return result.count;
  }

  deleteOlderThan(date: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM telemetry_data 
      WHERE timestamp < ?
    `);

    const result = stmt.run(date);
    return result.changes;
  }
}
