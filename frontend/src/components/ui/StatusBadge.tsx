import type { AssetStatus, AlertSeverity, AlertStatus as AlertStatusType } from '../../types';
import { assetStatusLabel, alertSeverityLabel } from '../../utils/format';

// ─── Asset Status ─────────────────────────────────────────────────────────────

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const cls: Record<AssetStatus, string> = {
    healthy:          'badge-green',
    watch:            'badge-yellow',
    critical:         'badge-red',
    data_stale:       'badge-gray',
    insufficient_data:'badge-gray',
  };
  return <span className={cls[status]}>{assetStatusLabel[status]}</span>;
}

// ─── Alert Severity ───────────────────────────────────────────────────────────

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const cls: Record<AlertSeverity, string> = {
    info:     'badge-blue',
    warning:  'badge-yellow',
    critical: 'badge-red',
  };
  return (
    <span className={cls[severity]} style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
      {alertSeverityLabel[severity]}
    </span>
  );
}

// ─── Alert Status ─────────────────────────────────────────────────────────────

export function AlertStatusBadge({ status }: { status: AlertStatusType }) {
  const labels: Record<AlertStatusType, string> = {
    open:         'Open',
    acknowledged: 'Acknowledged',
    resolved:     'Resolved',
  };
  const cls: Record<AlertStatusType, string> = {
    open:         'badge-red',
    acknowledged: 'badge-yellow',
    resolved:     'badge-green',
  };
  return <span className={cls[status]}>{labels[status]}</span>;
}

// ─── Risk Score ───────────────────────────────────────────────────────────────

export function RiskBadge({ score }: { score: number }) {
  const cls   = score >= 60 ? 'badge-red' : score >= 35 ? 'badge-yellow' : 'badge-green';
  const label = score >= 60 ? 'HIGH' : score >= 35 ? 'MED' : 'LOW';
  return <span className={cls}>{label} ({score.toFixed(0)})</span>;
}
