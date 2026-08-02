// User roles
export enum UserRole {
  ADMIN = 'admin',
  FLEET_MANAGER = 'fleet_manager',
  SUPPLY_CHAIN_MANAGER = 'supply_chain_manager',
}

// Organization types
export enum OrgType {
  FLEET_OPERATOR  = 'fleet_operator',
  EV_MANUFACTURER = 'ev_manufacturer',
  BOTH            = 'both',
  DEMO            = 'demo',
}

// Reserved demo organization
export const DEMO_ORG_ID   = 'demo-org-00000000-0000-0000-0000-000000000000';
export const DEMO_ORG_NAME = '__demo__';

// Asset status
export enum AssetStatus {
  HEALTHY = 'healthy',
  WATCH = 'watch',
  CRITICAL = 'critical',
  DATA_STALE = 'data_stale',
  INSUFFICIENT_DATA = 'insufficient_data',
}

// Alert severity
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

// Alert types
export enum AlertType {
  THERMAL_EVENT = 'thermal_event',
  CHARGE_PATTERN = 'charge_pattern',
  SOH_DEGRADATION = 'soh_degradation',
  RUL_THRESHOLD = 'rul_threshold',
  CONCENTRATION_RISK = 'concentration_risk',
  GEOPOLITICAL_RISK = 'geopolitical_risk',
  QUALITY_DEVIATION = 'quality_deviation',
  COMPLIANCE_GAP = 'compliance_gap',
  FIELD_TO_SOURCE_CORRELATION = 'field_to_source_correlation',
}

// Alert source agent
export enum AlertSourceAgent {
  APM = 'apm',
  SUPPLY_CHAIN = 'supply_chain',
  CORRELATION = 'correlation',
}

// Alert status
export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

// Temperature thresholds (in Celsius)
export const TEMP_MIN_SAFE = -10;
export const TEMP_MAX_SAFE = 45;

// Charge optimization
export const OPTIMAL_SOC_MIN = 20; // State of Charge percentage
export const OPTIMAL_SOC_MAX = 80;

// Model version for SoH calculations
export const SOH_MODEL_VERSION = '1.0.0';

// Supplier tiers
export enum SupplierTier {
  TIER_1 = 'tier_1', // Direct supplier
  TIER_2 = 'tier_2', // Component/cell manufacturer
  TIER_3 = 'tier_3', // Raw material supplier
}

// Material types
export enum MaterialType {
  LITHIUM = 'lithium',
  COBALT = 'cobalt',
  NICKEL = 'nickel',
  GRAPHITE = 'graphite',
  MANGANESE = 'manganese',
}

// Risk types
export enum RiskType {
  CONCENTRATION = 'concentration',
  GEOPOLITICAL = 'geopolitical',
  QUALITY = 'quality',
  COMPLIANCE = 'compliance',
}

// Asset types
export enum AssetType {
  FREIGHT_TRUCK = 'freight_truck',
  MINING_VEHICLE = 'mining_vehicle',
  FORKLIFT = 'forklift',
  CONSTRUCTION_EQUIPMENT = 'construction_equipment',
}
