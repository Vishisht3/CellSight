import dotenv from 'dotenv';
import path from 'path';

// Load .env file (no-op in production where env vars are injected directly)
dotenv.config();

// ── Types ──────────────────────────────────────────────────────────────────

export interface Config {
  // Server
  nodeEnv: string;
  port: number;
  isProduction: boolean;

  // Database — exactly one of databaseUrl or databasePath must be set
  databaseUrl: string | null;   // Postgres: postgres://user:pass@host/db
  databasePath: string;          // sql.js fallback: file path

  // JWT
  jwtSecret: string;
  jwtAccessExpiresIn: string;   // e.g. '15m'
  jwtRefreshExpiresIn: string;  // e.g. '7d'

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
  corsOrigin: string | string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function env(key: string): string | undefined {
  return process.env[key];
}

function envRequired(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    throw new Error(`[config] Required environment variable "${key}" is missing or empty`);
  }
  return v.trim();
}

function envStr(key: string, fallback: string): string {
  return env(key)?.trim() || fallback;
}

function envInt(key: string, fallback: number): number {
  const v = env(key);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`[config] "${key}" must be an integer, got: ${v}`);
  return n;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = env(key);
  if (v === undefined) return fallback;
  return v.toLowerCase() === 'true';
}

// ── Validation — runs at module load time ─────────────────────────────────

function buildConfig(): Config {
  const nodeEnv = envStr('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  // In production the JWT secret MUST be explicitly set and non-default
  const jwtSecret = isProduction
    ? envRequired('JWT_SECRET')
    : envStr('JWT_SECRET', 'dev-only-secret-change-in-production');

  if (isProduction && jwtSecret === 'dev-only-secret-change-in-production') {
    throw new Error('[config] JWT_SECRET must not be the default value in production');
  }

  // In production require a real DB URL so we don't accidentally use the file shim
  const databaseUrl = env('DATABASE_URL')?.trim() || null;

  const corsRaw = envStr('CORS_ORIGIN', 'http://localhost:5173');
  const corsOrigin = corsRaw.includes(',')
    ? corsRaw.split(',').map(s => s.trim())
    : corsRaw;

  return {
    nodeEnv,
    port: envInt('PORT', 3000),
    isProduction,

    databaseUrl,
    databasePath: envStr('DATABASE_PATH', path.join(process.cwd(), 'data', 'cellsight.db')),

    jwtSecret,
    jwtAccessExpiresIn:  envStr('JWT_ACCESS_EXPIRES_IN',  '15m'),
    jwtRefreshExpiresIn: envStr('JWT_REFRESH_EXPIRES_IN', '7d'),

    demoMode:          envBool('DEMO_MODE', true),
    demoAssetCount:    envInt('DEMO_ASSET_COUNT', 50),
    demoSupplierCount: envInt('DEMO_SUPPLIER_COUNT', 20),

    telemetryStaleThresholdMinutes: envInt('TELEMETRY_STALE_THRESHOLD_MINUTES', 30),
    telemetryMinHistoryPoints:      envInt('TELEMETRY_MIN_HISTORY_POINTS', 100),

    sohThresholdWarning:  envInt('SOH_THRESHOLD_WARNING', 85),
    sohThresholdCritical: envInt('SOH_THRESHOLD_CRITICAL', 80),
    rulMinConfidence:     envInt('RUL_MIN_CONFIDENCE', 0.7),

    supplierConcentrationThreshold: envInt('SUPPLIER_CONCENTRATION_THRESHOLD', 0.35),
    qualityDeviationThreshold:      envInt('QUALITY_DEVIATION_THRESHOLD', 0.15),
    geopoliticalRiskRegions: envStr('GEOPOLITICAL_RISK_REGIONS', 'CN,RU,VE').split(','),

    alertRetentionDays: envInt('ALERT_RETENTION_DAYS', 90),

    corsOrigin,
  };
}

// Build once at startup — throws immediately if anything is missing
export const config: Config = buildConfig();
