import { Database } from '../sqlite-shim';
import { v4 as uuidv4 } from 'uuid';
import { SohHistory } from '../../models/types';

export class SohRepository {
  constructor(private db: Database) {}

  create(
    assetId: string,
    sohValue: number,
    confidence: number,
    modelVersion: string,
    dataPointsUsed: number
  ): SohHistory {
    const now = new Date().toISOString();
    const sohHistory: SohHistory = {
      id: uuidv4(),
      assetId,
      sohValue,
      confidence,
      modelVersion,
      computedAt: now,
      dataPointsUsed,
    };

    const stmt = this.db.prepare(`
      INSERT INTO soh_history (
        id, asset_id, soh_value, confidence, model_version, computed_at, data_points_used
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sohHistory.id,
      sohHistory.assetId,
      sohHistory.sohValue,
      sohHistory.confidence,
      sohHistory.modelVersion,
      sohHistory.computedAt,
      sohHistory.dataPointsUsed
    );

    return sohHistory;
  }

  findByAsset(assetId: string, limit = 100): SohHistory[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, asset_id as assetId, soh_value as sohValue, confidence,
        model_version as modelVersion, computed_at as computedAt,
        data_points_used as dataPointsUsed
      FROM soh_history 
      WHERE asset_id = ?
      ORDER BY computed_at DESC
      LIMIT ?
    `);

    return stmt.all(assetId, limit) as SohHistory[];
  }

  getLatestByAsset(assetId: string): SohHistory | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, asset_id as assetId, soh_value as sohValue, confidence,
        model_version as modelVersion, computed_at as computedAt,
        data_points_used as dataPointsUsed
      FROM soh_history 
      WHERE asset_id = ?
      ORDER BY computed_at DESC
      LIMIT 1
    `);

    return stmt.get(assetId) as SohHistory | undefined || null;
  }

  getAverageDegradationRate(assetId: string): number | null {
    const history = this.findByAsset(assetId, 1000);
    
    if (history.length < 2) {
      return null;
    }

    // Calculate degradation rate from oldest to newest
    const oldest = history[history.length - 1];
    const newest = history[0];
    
    const sohDelta = oldest.sohValue - newest.sohValue;
    const timeDelta = new Date(newest.computedAt).getTime() - new Date(oldest.computedAt).getTime();
    const daysDelta = timeDelta / (1000 * 60 * 60 * 24);
    
    if (daysDelta === 0) {
      return null;
    }

    // Return degradation rate per day
    return sohDelta / daysDelta;
  }
}
