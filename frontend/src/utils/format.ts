import { format, formatDistanceToNow, parseISO } from 'date-fns';
import type { AssetStatus, AlertSeverity, AlertType, SupplierTier, MaterialType, AlertSourceAgent } from '../types';

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy HH:mm');
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

export function formatSoh(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}%`;
}

export function formatRul(days: number | null, _cycles: number | null): string {
  if (days === null) return '—';
  if (days >= 365) return `~${Math.round(days / 365)}y`;
  if (days >= 30) return `~${Math.round(days / 30)}mo`;
  return `${days}d`;
}

export function formatRulFull(days: number | null, cycles: number | null): string {
  if (days === null) return 'Insufficient data';
  const d = days >= 365
    ? `~${Math.round(days / 365)} yr`
    : days >= 30
    ? `~${Math.round(days / 30)} mo`
    : `${days} days`;
  const c = cycles !== null ? ` / ${cycles.toLocaleString()} cycles` : '';
  return d + c;
}

export function formatRiskScore(score: number): string {
  return score.toFixed(0);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function formatDeviationPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// Label helpers

export const assetStatusLabel: Record<AssetStatus, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
  data_stale: 'Data Stale',
  insufficient_data: 'No Data',
};

export const alertSeverityLabel: Record<AlertSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

export const alertTypeLabel: Record<AlertType, string> = {
  thermal_event: 'Thermal Event',
  charge_pattern: 'Charge Pattern',
  soh_degradation: 'SoH Degradation',
  rul_threshold: 'RUL Threshold',
  concentration_risk: 'Concentration Risk',
  geopolitical_risk: 'Geopolitical Risk',
  quality_deviation: 'Quality Deviation',
  compliance_gap: 'Compliance Gap',
  field_to_source_correlation: 'Field↔Source',
};

export const sourceAgentLabel: Record<AlertSourceAgent, string> = {
  apm: 'Fleet APM',
  supply_chain: 'Supply Chain',
  correlation: 'Correlation',
};

export const tierLabel: Record<SupplierTier, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

export const materialLabel: Record<MaterialType, string> = {
  lithium: 'Lithium',
  cobalt: 'Cobalt',
  nickel: 'Nickel',
  graphite: 'Graphite',
  manganese: 'Manganese',
};

export const assetTypeLabel: Record<string, string> = {
  freight_truck: 'Freight Truck',
  mining_vehicle: 'Mining Vehicle',
  forklift: 'Forklift',
  construction_equipment: 'Construction',
};
