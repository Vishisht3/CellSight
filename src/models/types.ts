import {
  UserRole,
  AssetStatus,
  AssetType,
  AlertSeverity,
  AlertType,
  AlertSourceAgent,
  AlertStatus,
  SupplierTier,
  MaterialType,
} from '../config/constants';

// ===========================
// User Models
// ===========================

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateInput {
  email: string;
  password?: string;
  role: UserRole;
  name: string;
}

export interface UserLoginInput {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

// ===========================
// Asset Models (APM)
// ===========================

export interface Asset {
  id: string;
  name: string;
  assetType: AssetType;
  batteryPackId: string;
  status: AssetStatus;
  currentSoh: number | null; // percentage
  sohConfidence: number | null; // 0-1
  predictedRulDays: number | null;
  predictedRulCycles: number | null;
  lastTelemetryAt: string | null;
  totalCycles: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetCreateInput {
  name: string;
  assetType: AssetType;
  batteryPackId: string;
}

// ===========================
// Telemetry Models
// ===========================

export interface TelemetryData {
  id: string;
  assetId: string;
  timestamp: string;
  voltage: number; // volts
  current: number; // amperes
  temperature: number; // celsius
  stateOfCharge: number; // percentage 0-100
  cycleCount: number;
  createdAt: string;
}

export interface TelemetryIngestInput {
  assetId: string;
  voltage: number;
  current: number;
  temperature: number;
  stateOfCharge: number;
  cycleCount: number;
  timestamp?: string; // optional, defaults to now
}

// ===========================
// SoH Models
// ===========================

export interface SohHistory {
  id: string;
  assetId: string;
  sohValue: number; // percentage
  confidence: number; // 0-1
  modelVersion: string;
  computedAt: string;
  dataPointsUsed: number;
}

export interface DegradationPrediction {
  assetId: string;
  currentSoh: number;
  predictedRulDays: number;
  predictedRulCycles: number;
  confidence: number;
  threshold: number;
  degradationRatePerCycle: number;
}

// ===========================
// Supply Chain Models
// ===========================

export interface Supplier {
  id: string;
  name: string;
  tier: SupplierTier;
  country: string;
  riskScore: number; // 0-100
  concentrationRisk: number; // 0-1
  geopoliticalRisk: number; // 0-1
  qualityRisk: number; // 0-1
  complianceRisk: number; // 0-1
  certificationExpiry: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierCreateInput {
  name: string;
  tier: SupplierTier;
  country: string;
  certificationExpiry?: string;
}

export interface MaterialLot {
  id: string;
  lotNumber: string;
  materialType: MaterialType;
  supplierId: string;
  quantity: number; // kg or units
  country: string;
  receivedAt: string;
  qualityScore: number | null; // 0-100
  specificationMin: number | null;
  specificationMax: number | null;
  createdAt: string;
}

export interface MaterialLotCreateInput {
  lotNumber: string;
  materialType: MaterialType;
  supplierId: string;
  quantity: number;
  country: string;
  receivedAt?: string;
  qualityScore?: number;
  specificationMin?: number;
  specificationMax?: number;
}

export interface CellBatch {
  id: string;
  batchNumber: string;
  manufacturerId: string; // supplier ID
  productionDate: string;
  quantity: number; // number of cells
  createdAt: string;
}

export interface CellBatchCreateInput {
  batchNumber: string;
  manufacturerId: string;
  productionDate?: string;
  quantity: number;
}

export interface BatteryPack {
  id: string;
  packNumber: string;
  cellBatchId: string;
  assemblyDate: string;
  capacity: number; // kWh
  createdAt: string;
}

export interface BatteryPackCreateInput {
  packNumber: string;
  cellBatchId: string;
  assemblyDate?: string;
  capacity: number;
}

// Traceability link between cell batches and material lots
export interface BatchMaterialLink {
  id: string;
  cellBatchId: string;
  materialLotId: string;
  createdAt: string;
}

// ===========================
// Alert Models
// ===========================

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
  metadata: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

export interface AlertCreateInput {
  type: AlertType;
  severity: AlertSeverity;
  sourceAgent: AlertSourceAgent;
  assetId?: string;
  supplierId?: string;
  cellBatchId?: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

// ===========================
// Correlation Models
// ===========================

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

// ===========================
// Traceability Models
// ===========================

export interface AssetTrace {
  asset: Asset;
  batteryPack: BatteryPack;
  cellBatch: CellBatch;
  manufacturer: Supplier;
  materialLots: Array<MaterialLot & { supplier: Supplier }>;
}

// ===========================
// Dashboard Models
// ===========================

export interface FleetSummary {
  totalAssets: number;
  healthyAssets: number;
  watchAssets: number;
  criticalAssets: number;
  staleAssets: number;
  avgSoh: number;
  openAlerts: number;
}

export interface SupplyChainSummary {
  totalSuppliers: number;
  highRiskSuppliers: number;
  totalMaterialLots: number;
  avgRiskScore: number;
  openRiskAlerts: number;
}
