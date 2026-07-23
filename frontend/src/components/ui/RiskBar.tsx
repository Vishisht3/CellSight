interface RiskBarProps {
  value: number;   // 0–1
  label?: string;
  showPercent?: boolean;
}

export default function RiskBar({ value, label, showPercent = true }: RiskBarProps) {
  const pct = Math.min(1, Math.max(0, value)) * 100;
  const barColor =
    pct >= 60 ? '#c00000' :
    pct >= 30 ? '#b87000' :
                '#2a8a2a';

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2, color: '#4a4a4a' }}>
          <span>{label}</span>
          {showPercent && <span style={{ fontWeight: 'bold', color: barColor }}>{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div style={{
        width: '100%',
        height: 10,
        background: 'linear-gradient(to bottom, #d0d0d0, #f0f0f0)',
        border: '1px inset #a0a0a0',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: `linear-gradient(to bottom, ${barColor}99, ${barColor}ee)`,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}
