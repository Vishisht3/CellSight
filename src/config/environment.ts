import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export interface Config {
  // Server
  nodeEnv: string;
  port: number;
  
  // Database
  databasePath: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
  
  // Demo Mode
  demoMode: boolean;
  demoAssetCount: number;
  demoSupplierCount: number;
  
  // Telemetry
  telemetryStaleThresholdMinutes: number;
  telemetryMinHistoryPoints: number;
  
  // SoH & Degradation
  sohThresholdWarning: number;
  sohThresholdCritical: number;
  rulMinConfidence: number;
  
  // Risk Scoring
  supplierConcentrationThreshold: number;
  qualityDeviationThreshold: number;
  geopoliticalRiskRegions: string[];
  
  // Alerts
  alertRetentionDays: number;
  
  // CORS
  corsOrigin: string;
}

function getEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvVarAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvVarAsBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const config: Config = {
  // Server
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: getEnvVarAsNumber('PORT', 3000),
  
  // Database
  databasePath: getEnvVar('DATABASE_PATH', path.join(process.cwd(), 'data', 'cellsight.db')),
  
  // JWT
  jwtSecret: getEnvVar('JWT_SECRET', 'default-secret-change-in-production'),
  jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
  
  // Demo Mode
  demoMode: getEnvVarAsBoolean('DEMO_MODE', true),
  demoAssetCount: getEnvVarAsNumber('DEMO_ASSET_COUNT', 50),
  demoSupplierCount: getEnvVarAsNumber('DEMO_SUPPLIER_COUNT', 20),
  
  // Telemetry
  telemetryStaleThresholdMinutes: getEnvVarAsNumber('TELEMETRY_STALE_THRESHOLD_MINUTES', 30),
  telemetryMinHistoryPoints: getEnvVarAsNumber('TELEMETRY_MIN_HISTORY_POINTS', 100),
  
  // SoH & Degradation
  sohThresholdWarning: getEnvVarAsNumber('SOH_THRESHOLD_WARNING', 85),
  sohThresholdCritical: getEnvVarAsNumber('SOH_THRESHOLD_CRITICAL', 80),
  rulMinConfidence: getEnvVarAsNumber('RUL_MIN_CONFIDENCE', 0.7),
  
  // Risk Scoring
  supplierConcentrationThreshold: getEnvVarAsNumber('SUPPLIER_CONCENTRATION_THRESHOLD', 0.35),
  qualityDeviationThreshold: getEnvVarAsNumber('QUALITY_DEVIATION_THRESHOLD', 0.15),
  geopoliticalRiskRegions: getEnvVar('GEOPOLITICAL_RISK_REGIONS', 'CN,RU,VE').split(','),
  
  // Alerts
  alertRetentionDays: getEnvVarAsNumber('ALERT_RETENTION_DAYS', 90),
  
  // CORS
  corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
};
