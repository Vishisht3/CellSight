interface SohGaugeProps {
  value: number | null;
}

export default function SohGauge({ value }: SohGaugeProps) {
  if (value === null) {
    return <span style={{ color: '#888', fontStyle: 'italic', fontSize: 11 }}>—</span>;
  }

  const pct = Math.min(100, Math.max(0, value));
  const barColor =
    pct >= 85 ? '#2a8a2a' :
    pct >= 80 ? '#b87000' :
                '#c00000';
  const trackColor =
    pct >= 85 ? '#d4edda' :
    pct >= 80 ? '#fff3cd' :
                '#f8d7da';
  const textColor =
    pct >= 85 ? '#155724' :
    pct >= 80 ? '#856404' :
                '#721c24';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
      <div style={{
        flex: 1,
        height: 12,
        background: trackColor,
        border: '1px inset #a0a0a0',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: `linear-gradient(to bottom, ${barColor}aa, ${barColor}ff)`,
          borderRight: `1px solid ${barColor}`,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 'bold', color: textColor, minWidth: 38, textAlign: 'right' }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}
