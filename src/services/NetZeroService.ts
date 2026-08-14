/**
 * NetZeroService
 *
 * Net Zero Progress & Carbon Intelligence Tracker
 * ────────────────────────────────────────────────
 * Tracks fleet electrification progress against organizational net-zero
 * commitments, quantifies Scope 1 and Scope 3 emission reductions per
 * route and asset class, and identifies highest-impact next electrification
 * priorities based on both carbon and operational criteria.
 *
 * Key capabilities:
 * • Scope 1/3 emission tracking — quantifies CO₂ reductions from fleet electrification
 * • Net-zero target tracking — compares actual vs target emissions by year
 * • Priority identification — ranks remaining ICE assets by carbon impact
 * • Route-level analysis — shows emission reduction per route/distance
 */

import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';

export interface NetZeroTarget {
  id: string;
  targetYear: number;
  scope1TargetTonnes: number;
  scope3TargetTonnes: number;
  totalTargetTonnes: number;
  baselineYear: number;
  baselineScope1Tonnes: number;
  baselineScope3Tonnes: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmissionRecord {
  id: string;
  assetId: string;
  recordDate: string;
  scope: 1 | 3;
  category: string;
  co2Tonnes: number;
  route: string | null;
  distanceKm: number | null;
  fuelLitres: number | null;
  kwhConsumed: number | null;
  calculationMethod: string;
  organizationId: string;
  createdAt: string;
}

export interface NetZeroProgress {
  targetYear: number;
  baseline: {
    year: number;
    scope1Tonnes: number;
    scope3Tonnes: number;
    totalTonnes: number;
  };
  target: {
    scope1Tonnes: number;
    scope3Tonnes: number;
    totalTonnes: number;
  };
  current: {
    scope1Tonnes: number;
    scope3Tonnes: number;
    totalTonnes: number;
  };
  progress: {
    scope1PercentReduction: number;
    scope3PercentReduction: number;
    totalPercentReduction: number;
    scope1RemainingTonnes: number;
    scope3RemainingTonnes: number;
    totalRemainingTonnes: number;
  };
}

export interface ElectrificationPriority {
  assetId: string;
  assetName: string;
  assetType: string;
  currentAnnualCo2Tonnes: number;
  potentialAnnualReduction: number;
  readinessScore: number;
  evRecommendation: string | null;
  estimatedCostSaving: number | null;
  priority: 'high' | 'medium' | 'low';
  route: string | null;
}

export interface RouteEmissionAnalysis {
  route: string;
  totalDistanceKm: number;
  totalCo2Tonnes: number;
  co2PerKm: number;
  assetCount: number;
  evCount: number;
  iceCount: number;
  potentialReduction: number;
}

export class NetZeroService {
  constructor(private dbContext: DatabaseContext, private organizationId: string) {}

  // ── Net Zero Target Management ─────────────────────────────────────────

  /**
   * Gets the current net-zero target for the organization
   */
  getNetZeroTarget(): NetZeroTarget | null {
    const query = `
      SELECT * FROM net_zero_targets
      WHERE organization_id = ?
      ORDER BY target_year DESC
      LIMIT 1
    `;
    const row = this.dbContext.db.prepare(query).get(this.organizationId);
    return row ? (row as NetZeroTarget) : null;
  }

  // ── Emission Tracking ──────────────────────────────────────────────────

  /**
   * Calculates current emissions from all assets in the fleet
   * Returns cumulative Scope 1 and Scope 3 for the current year
   */
  getCurrentEmissions(): { scope1Tonnes: number; scope3Tonnes: number; totalTonnes: number } {
    const currentYear = new Date().getFullYear();
    const query = `
      SELECT
        scope,
        SUM(co2_tonnes) as total_co2
      FROM emission_records
      WHERE organization_id = ?
        AND strftime('%Y', record_date) = ?
      GROUP BY scope
    `;

    const rows = this.dbContext.db.prepare(query).all(this.organizationId, currentYear.toString()) as any[];

    let scope1Tonnes = 0;
    let scope3Tonnes = 0;

    for (const row of rows) {
      if (row.scope === 1) scope1Tonnes = row.total_co2;
      if (row.scope === 3) scope3Tonnes = row.total_co2;
    }

    return {
      scope1Tonnes,
      scope3Tonnes,
      totalTonnes: scope1Tonnes + scope3Tonnes,
    };
  }

  /**
   * Gets full net-zero progress including baseline, target, and current emissions
   */
  getNetZeroProgress(): NetZeroProgress | null {
    const target = this.getNetZeroTarget();
    if (!target) return null;

    const current = this.getCurrentEmissions();

    const scope1Reduction = target.baselineScope1Tonnes - current.scope1Tonnes;
    const scope3Reduction = target.baselineScope3Tonnes - current.scope3Tonnes;
    const totalReduction = scope1Reduction + scope3Reduction;

    const scope1PercentReduction = (scope1Reduction / target.baselineScope1Tonnes) * 100;
    const scope3PercentReduction = (scope3Reduction / target.baselineScope3Tonnes) * 100;
    const totalPercentReduction =
      (totalReduction / (target.baselineScope1Tonnes + target.baselineScope3Tonnes)) * 100;

    return {
      targetYear: target.targetYear,
      baseline: {
        year: target.baselineYear,
        scope1Tonnes: target.baselineScope1Tonnes,
        scope3Tonnes: target.baselineScope3Tonnes,
        totalTonnes: target.baselineScope1Tonnes + target.baselineScope3Tonnes,
      },
      target: {
        scope1Tonnes: target.scope1TargetTonnes,
        scope3Tonnes: target.scope3TargetTonnes,
        totalTonnes: target.totalTargetTonnes,
      },
      current: current,
      progress: {
        scope1PercentReduction,
        scope3PercentReduction,
        totalPercentReduction,
        scope1RemainingTonnes: current.scope1Tonnes - target.scope1TargetTonnes,
        scope3RemainingTonnes: current.scope3Tonnes - target.scope3TargetTonnes,
        totalRemainingTonnes: current.totalTonnes - target.totalTargetTonnes,
      },
    };
  }

  // ── Electrification Priorities ─────────────────────────────────────────

  /**
   * Identifies highest-impact electrification priorities
   * Ranks remaining ICE assets by annual CO₂ emissions and readiness score
   */
  getElectrificationPriorities(): ElectrificationPriority[] {
    const currentYear = new Date().getFullYear();

    // Get all ICE (non-EV) assets with their annual emissions
    const query = `
      SELECT
        a.id as asset_id,
        a.name as asset_name,
        a.asset_type,
        SUM(e.co2_tonnes) as annual_co2,
        e.route,
        COUNT(DISTINCT e.record_date) as record_count
      FROM assets a
      LEFT JOIN emission_records e ON a.id = e.asset_id
        AND strftime('%Y', e.record_date) = ?
        AND e.scope = 1
      WHERE a.organization_id = ?
        AND a.asset_type NOT LIKE '%EV%'
        AND a.asset_type NOT LIKE '%Electric%'
      GROUP BY a.id
      HAVING annual_co2 > 0
      ORDER BY annual_co2 DESC
      LIMIT 50
    `;

    const rows = this.dbContext.db.prepare(query).all(currentYear.toString(), this.organizationId) as any[];

    return rows.map((row) => {
      const currentAnnualCo2 = row.annual_co2;

      // Estimate potential reduction (85-95% for full electrification, accounting for grid emissions)
      const potentialAnnualReduction = currentAnnualCo2 * 0.9;

      // Simple readiness heuristic — could be enhanced with actual readiness data
      let readinessScore = 70; // Base score
      if (row.asset_type.includes('Truck')) readinessScore = 85;
      if (row.asset_type.includes('Forklift')) readinessScore = 95;
      if (row.asset_type.includes('Mining')) readinessScore = 45;

      let priority: 'high' | 'medium' | 'low';
      if (currentAnnualCo2 > 50 && readinessScore >= 70) priority = 'high';
      else if (currentAnnualCo2 > 20 || readinessScore >= 70) priority = 'medium';
      else priority = 'low';

      // EV recommendation mapping
      let evRecommendation: string | null = null;
      if (row.asset_type.includes('Freight')) evRecommendation = 'Volvo FH Electric';
      if (row.asset_type.includes('Forklift')) evRecommendation = 'Toyota BT Levio';
      if (row.asset_type.includes('Mining')) evRecommendation = 'Komatsu 930E EV';

      // Estimate cost saving (diesel @ £1.50/L vs electricity @ £0.15/kWh)
      const estimatedCostSaving = currentAnnualCo2 > 0 ? currentAnnualCo2 * 300 : null; // Rough heuristic

      return {
        assetId: row.asset_id,
        assetName: row.asset_name,
        assetType: row.asset_type,
        currentAnnualCo2Tonnes: currentAnnualCo2,
        potentialAnnualReduction,
        readinessScore,
        evRecommendation,
        estimatedCostSaving,
        priority,
        route: row.route,
      };
    });
  }

  /**
   * Analyzes emissions by route to identify high-carbon routes
   * suitable for targeted electrification
   */
  getRouteEmissionAnalysis(): RouteEmissionAnalysis[] {
    const currentYear = new Date().getFullYear();

    const query = `
      SELECT
        e.route,
        SUM(e.distance_km) as total_distance,
        SUM(e.co2_tonnes) as total_co2,
        COUNT(DISTINCT e.asset_id) as asset_count
      FROM emission_records e
      WHERE e.organization_id = ?
        AND e.route IS NOT NULL
        AND strftime('%Y', e.record_date) = ?
      GROUP BY e.route
      HAVING total_co2 > 0
      ORDER BY total_co2 DESC
    `;

    const rows = this.dbContext.db.prepare(query).all(this.organizationId, currentYear.toString()) as any[];

    return rows.map((row: any) => {
      const co2PerKm = row.total_distance > 0 ? row.total_co2 / row.total_distance : 0;

      // Count EV vs ICE assets on this route
      const assetQuery = `
        SELECT
          COUNT(DISTINCT CASE WHEN a.asset_type LIKE '%EV%' OR a.asset_type LIKE '%Electric%' THEN a.id END) as ev_count,
          COUNT(DISTINCT CASE WHEN a.asset_type NOT LIKE '%EV%' AND a.asset_type NOT LIKE '%Electric%' THEN a.id END) as ice_count
        FROM emission_records e
        INNER JOIN assets a ON e.asset_id = a.id
        WHERE e.route = ?
          AND e.organization_id = ?
          AND strftime('%Y', e.record_date) = ?
      `;

      const assetCounts = this.dbContext.db.prepare(assetQuery).get(
        row.route,
        this.organizationId,
        currentYear.toString(),
      ) as any;

      // Estimate potential reduction if all ICE assets on this route were electrified
      const potentialReduction = row.total_co2 * 0.9 * (assetCounts.ice_count / row.asset_count);

      return {
        route: row.route,
        totalDistanceKm: row.total_distance,
        totalCo2Tonnes: row.total_co2,
        co2PerKm,
        assetCount: row.asset_count,
        evCount: assetCounts.ev_count || 0,
        iceCount: assetCounts.ice_count || 0,
        potentialReduction,
      };
    });
  }

  /**
   * Records a new emission entry for an asset
   * Used for both historical tracking and ongoing monitoring
   */
  recordEmission(input: {
    assetId: string;
    recordDate: string;
    scope: 1 | 3;
    category: string;
    co2Tonnes: number;
    route?: string;
    distanceKm?: number;
    fuelLitres?: number;
    kwhConsumed?: number;
    calculationMethod: string;
  }): EmissionRecord {
    const id = `emission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const query = `
      INSERT INTO emission_records (
        id, asset_id, record_date, scope, category, co2_tonnes,
        route, distance_km, fuel_litres, kwh_consumed, calculation_method,
        organization_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.dbContext.db.prepare(query).run(
      id,
      input.assetId,
      input.recordDate,
      input.scope,
      input.category,
      input.co2Tonnes,
      input.route || null,
      input.distanceKm || null,
      input.fuelLitres || null,
      input.kwhConsumed || null,
      input.calculationMethod,
      this.organizationId,
      now
    );

    logger.info('Emission recorded', {
      assetId: input.assetId,
      scope: input.scope,
      co2Tonnes: input.co2Tonnes,
      recordDate: input.recordDate,
    });

    return { id, ...input, organizationId: this.organizationId, createdAt: now } as EmissionRecord;
  }

  /**
   * Generates a monthly net-zero progress report
   * Compares current month emissions to baseline and target trajectory
   */
  getMonthlyProgressReport(): any {
    const progress = this.getNetZeroProgress();
    if (!progress) return null;

    const priorities = this.getElectrificationPriorities();
    const routes = this.getRouteEmissionAnalysis();

    // Calculate trajectory — are we on track?
    const yearsElapsed = new Date().getFullYear() - progress.baseline.year;
    const yearsToTarget = progress.targetYear - progress.baseline.year;
    const expectedProgress = (yearsElapsed / yearsToTarget) * 100;
    const actualProgress = progress.progress.totalPercentReduction;
    const onTrack = actualProgress >= expectedProgress * 0.9; // Within 10% of expected

    return {
      progress,
      onTrack,
      expectedProgressPercent: expectedProgress,
      actualProgressPercent: actualProgress,
      highPriorityAssets: priorities.filter((p) => p.priority === 'high'),
      topCarbonRoutes: routes.slice(0, 5),
      summary: {
        totalReductionAchieved: progress.baseline.totalTonnes - progress.current.totalTonnes,
        totalReductionRemaining: progress.current.totalTonnes - progress.target.totalTonnes,
        percentComplete: ((progress.baseline.totalTonnes - progress.current.totalTonnes) / (progress.baseline.totalTonnes - progress.target.totalTonnes)) * 100,
      },
    };
  }
}
