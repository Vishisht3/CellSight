import { DatabaseContext } from '../../database';
import { TelemetryIngestInput } from '../../models/types';
import { telemetryIngestSchema } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';
import { AssetStatus } from '../../config/constants';
import { ZodError } from 'zod';

export class TelemetryIngestionService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Ingest telemetry data with validation
   * REQ-1: Validates payload, persists within 5 seconds, rejects invalid data
   */
  async ingest(input: TelemetryIngestInput): Promise<{
    success: boolean;
    telemetryId?: string;
    error?: string;
  }> {
    try {
      // Validate input
      const validated = telemetryIngestSchema.parse(input);

      // Check if asset exists
      const asset = this.dbContext.assets.findById(validated.assetId);
      if (!asset) {
        logger.warn('Telemetry rejected: asset not found', { assetId: validated.assetId });
        return {
          success: false,
          error: `Asset ${validated.assetId} not found`,
        };
      }

      // Persist telemetry data
      const telemetry = this.dbContext.telemetry.create(validated);

      // Update asset's last telemetry timestamp and cycle count
      this.dbContext.assets.updateTelemetryTimestamp(
        validated.assetId,
        telemetry.timestamp,
        validated.cycleCount
      );

      // Clear stale status if asset was marked as stale
      if (asset.status === AssetStatus.DATA_STALE) {
        this.dbContext.assets.updateStatus(validated.assetId, AssetStatus.INSUFFICIENT_DATA);
      }

      logger.info('Telemetry ingested successfully', {
        telemetryId: telemetry.id,
        assetId: validated.assetId,
      });

      return {
        success: true,
        telemetryId: telemetry.id,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        logger.warn('Telemetry rejected: validation failed', { error: errorMessage, input });
        return {
          success: false,
          error: `Validation failed: ${errorMessage}`,
        };
      }

      logger.error('Telemetry ingestion failed', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch ingest multiple telemetry records
   */
  async ingestBatch(inputs: TelemetryIngestInput[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    const results = await Promise.all(
      inputs.map((input, index) =>
        this.ingest(input).then((result) => ({ ...result, index }))
      )
    );

    const successCount = results.filter((r) => r.success).length;
    const failures = results.filter((r) => !r.success);

    return {
      successCount,
      failureCount: failures.length,
      errors: failures.map((f) => ({
        index: f.index,
        error: f.error || 'Unknown error',
      })),
    };
  }

  /**
   * Check for stale assets and mark them
   * REQ-1: Mark assets as stale if no telemetry received for 30+ minutes
   */
  checkStaleAssets(): number {
    const now = new Date();
    const thresholdMs = config.telemetryStaleThresholdMinutes * 60 * 1000;
    const staleThresholdDate = new Date(now.getTime() - thresholdMs).toISOString();

    const assets = this.dbContext.assets.list();
    let staleCount = 0;

    for (const asset of assets) {
      // Skip assets already marked as stale
      if (asset.status === AssetStatus.DATA_STALE) {
        continue;
      }

      // Check if asset has telemetry
      if (!asset.lastTelemetryAt) {
        continue;
      }

      // Check if telemetry is stale
      if (asset.lastTelemetryAt < staleThresholdDate) {
        this.dbContext.assets.updateStatus(asset.id, AssetStatus.DATA_STALE);
        staleCount++;
        logger.info('Asset marked as stale', {
          assetId: asset.id,
          assetName: asset.name,
          lastTelemetryAt: asset.lastTelemetryAt,
        });
      }
    }

    if (staleCount > 0) {
      logger.info(`Marked ${staleCount} asset(s) as stale`);
    }

    return staleCount;
  }

  /**
   * Get telemetry history for an asset
   */
  getTelemetryHistory(assetId: string, limit = 100) {
    const asset = this.dbContext.assets.findById(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    return this.dbContext.telemetry.findByAsset(assetId, limit);
  }

  /**
   * Get latest telemetry for an asset
   */
  getLatestTelemetry(assetId: string) {
    const asset = this.dbContext.assets.findById(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    return this.dbContext.telemetry.getLatestByAsset(assetId);
  }

  /**
   * Check if asset has sufficient telemetry history for SoH calculation
   */
  hasSufficientHistory(assetId: string): boolean {
    const count = this.dbContext.telemetry.countByAsset(assetId);
    return count >= config.telemetryMinHistoryPoints;
  }
}
