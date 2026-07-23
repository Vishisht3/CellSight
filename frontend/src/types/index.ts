// ===========================
// Auth
// ===========================

export type UserRole = 'admin' | 'fleet_manager' | 'supply_chain_manager';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthToken {
  token: string;
  user: User;
}

// ===========================
// Assets / APM
// ===========================

export type AssetStatus =
  | 'healthy'
  | 'watch'
  | 'critical'
  | 'data_stale'
  | 'insufficient_data';

export type AssetType =
  | 'freight_truck'
  | 'mining_vehicle'
  | 'forklift'
  | 'construction_equipment';

export interface Asset {
  id: string;
  name: string;
  assetType: AssetType;
  batteryPackId: string;
  status: AssetStatus;
  currentSoh: number | null;
  sohConfidence: number | null;
  predictedRulDays: number | null;
  predictedRulCycles: number | null;
  lastTelemetryAt: string | null;
  totalCycles: number;
  createdAt: string;
  updatedAt: string;
}

export interface FleetSummary {
  totalAssets: number;
  healthyAssets: number;
  watchAssets: number;
  criticalAssets: number;
  staleAssets: number;
  avgSoh: number;
  openAlerts: number;
}

export interface TelemetryData {
  id: string;
  assetId: string;
  timestamp: string;
  voltage: number;
  current: number;
  temperature: number;
  stateOfCharge: number;
  cycleCount: number;
  createdAt: string;
}

export interface SohHistory {
  id: string;
  assetId: string;
  sohValue: number;
  confidence: number;
  modelVersion: string;
  computedAt: string;
  dataPointsUsed: number;
}

// ===========================
// Supply Chain
// ===========================

export type SupplierTier = 'tier_1' | 'tier_2' | 'tier_3';
export type MaterialType = 'lithium' | 'cobalt' | 'nickel' | 'graphite' | 'manganese';

export interface Supplier {
  id: string;
  name: string;
  tier: SupplierTier;
  country: string;
  riskScore: number;
  concentrationRisk: number;
  geopoliticalRisk: number;
  qualityRisk: number;
  complianceRisk: number;
  certificationExpiry: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyChainSummary {
  totalSuppliers: number;
  highRiskSuppliers: number;
  avgRiskScore: number;
  totalMaterialLots: number;
  traceabilityStats: {
    totalAssets: number;
    assetsWithFullTrace: number;
    totalBatches: number;
    totalMaterialLots: number;
    totalSuppliers: number;
  };
}

export interface MaterialLot {
  id: string;
  lotNumber: string;
  materialType: MaterialType;
  supplierId: string;
  quantity: number;
  country: string;
  receivedAt: string;
  qualityScore: number | null;
  specificationMin: number | null;
  specificationMax: number | null;
  createdAt: string;
}

export interface CellBatch {
  id: string;
  batchNumber: string;
  manufacturerId: string;
  productionDate: string;
  quantity: number;
  createdAt: string;
}

export interface BatteryPack {
  id: string;
  packNumber: string;
  cellBatchId: string;
  assemblyDate: string;
  capacity: number;
  createdAt: string;
}

export interface AssetTrace {
  asset: Asset;
  batteryPack: BatteryPack;
  cellBatch: CellBatch;
  manufacturer: Supplier;
  materialLots: Array<MaterialLot & { supplier: Supplier }>;
}

// ===========================
// Alerts
// ===========================

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertSourceAgent = 'apm' | 'supply_chain' | 'correlation';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';
export type AlertType =
  | 'thermal_event'
  | 'charge_pattern'
  | 'soh_degradation'
  | 'rul_threshold'
  | 'concentration_risk'
  | 'geopolitical_risk'
  | 'quality_deviation'
  | 'compliance_gap'
  | 'field_to_source_correlation';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  sourceAgent: AlertSourceAgent;
  assetId: string | null;
  supplierId: string | null;
  cellBatchId: string | null;
  title: string;
  description: string;
  status: AlertStatus;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertCounts {
  open: number;
  acknowledged: number;
  resolved: number;
  total: number;
}

// ===========================
// Correlation
// ===========================

export interface BatchCorrelation {
  cellBatchId: string;
  batchNumber: string;
  assetCount: number;
  avgDegradationRate: number;
  fleetAvgDegradationRate: number;
  deviationPercent: number;
  sampleSize: number;
  confidence: number;
}

export interface SupplierCorrelation {
  supplierId: string;
  supplierName: string;
  assetCount: number;
  avgDegradationRate: number;
  fleetAvgDegradationRate: number;
  deviationPercent: number;
  sampleSize: number;
  confidence: number;
}
