import type { DbDriver } from '../driver';
import { v4 as uuidv4 } from 'uuid';
import { Asset, AssetCreateInput } from '../../models/types';
import { AssetStatus } from '../../config/constants';

const SELECT_COLS = `
  id, name, asset_type as assetType, battery_pack_id as batteryPackId,
  status, current_soh as currentSoh, soh_confidence as sohConfidence,
  predicted_rul_days as predictedRulDays, predicted_rul_cycles as predictedRulCycles,
  last_telemetry_at as lastTelemetryAt, total_cycles as totalCycles,
  organization_id as organizationId,
  created_at as createdAt, updated_at as updatedAt
`;

export class AssetRepository {
  constructor(private db: DbDriver) {}

  create(input: AssetCreateInput): Asset {
    const now = new Date().toISOString();
    const asset: Asset = {
      id: uuidv4(),
      name: input.name,
      assetType: input.assetType,
      batteryPackId: input.batteryPackId,
      status: AssetStatus.INSUFFICIENT_DATA,
      currentSoh: null,
      sohConfidence: null,
      predictedRulDays: null,
      predictedRulCycles: null,
      lastTelemetryAt: null,
      totalCycles: 0,
      organizationId: input.organizationId,
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO assets (
        id, name, asset_type, battery_pack_id, status,
        current_soh, soh_confidence, predicted_rul_days, predicted_rul_cycles,
        last_telemetry_at, total_cycles, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      asset.id, asset.name, asset.assetType, asset.batteryPackId, asset.status,
      asset.currentSoh, asset.sohConfidence, asset.predictedRulDays, asset.predictedRulCycles,
      asset.lastTelemetryAt, asset.totalCycles, asset.organizationId, asset.createdAt, asset.updatedAt
    );

    return asset;
  }

  findById(id: string): Asset | null {
    return this.db.prepare(`SELECT ${SELECT_COLS} FROM assets WHERE id = ?`).get(id) as Asset | null;
  }

  list(organizationId: string): Asset[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM assets WHERE organization_id = ? ORDER BY created_at DESC`
    ).all(organizationId) as Asset[];
  }

  listByStatus(status: AssetStatus, organizationId: string): Asset[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM assets WHERE status = ? AND organization_id = ? ORDER BY created_at DESC`
    ).all(status, organizationId) as Asset[];
  }

  listByBatteryPack(batteryPackId: string): Asset[] {
    return this.db.prepare(
      `SELECT ${SELECT_COLS} FROM assets WHERE battery_pack_id = ?`
    ).all(batteryPackId) as Asset[];
  }

  updateTelemetryTimestamp(id: string, timestamp: string, cycleCount: number): boolean {
    const result = this.db.prepare(`
      UPDATE assets SET last_telemetry_at = ?, total_cycles = ?, updated_at = ? WHERE id = ?
    `).run(timestamp, cycleCount, new Date().toISOString(), id);
    return result.changes > 0;
  }

  updateSohData(
    id: string, soh: number, confidence: number,
    rulDays: number | null, rulCycles: number | null
  ): boolean {
    const result = this.db.prepare(`
      UPDATE assets
      SET current_soh = ?, soh_confidence = ?,
          predicted_rul_days = ?, predicted_rul_cycles = ?, updated_at = ?
      WHERE id = ?
    `).run(soh, confidence, rulDays, rulCycles, new Date().toISOString(), id);
    return result.changes > 0;
  }

  updateStatus(id: string, status: AssetStatus): boolean {
    const result = this.db.prepare(
      `UPDATE assets SET status = ?, updated_at = ? WHERE id = ?`
    ).run(status, new Date().toISOString(), id);
    return result.changes > 0;
  }

  getFleetSummary(organizationId: string): {
    totalAssets: number;
    healthyAssets: number;
    watchAssets: number;
    criticalAssets: number;
    staleAssets: number;
    avgSoh: number;
  } {
    return this.db.prepare(`
      SELECT
        COUNT(*) as totalAssets,
        SUM(CASE WHEN status = 'healthy'            THEN 1 ELSE 0 END) as healthyAssets,
        SUM(CASE WHEN status = 'watch'              THEN 1 ELSE 0 END) as watchAssets,
        SUM(CASE WHEN status = 'critical'           THEN 1 ELSE 0 END) as criticalAssets,
        SUM(CASE WHEN status = 'data_stale'         THEN 1 ELSE 0 END) as staleAssets,
        AVG(CASE WHEN current_soh IS NOT NULL THEN current_soh END)    as avgSoh
      FROM assets
      WHERE organization_id = ?
    `).get(organizationId) as any;
  }
}
