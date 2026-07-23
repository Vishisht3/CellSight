interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const variantBorder: Record<string, string> = {
  default: '#7f9db9',
  success: '#82c891',
  warning: '#f0ad4e',
  danger:  '#e07070',
  info:    '#7fb3e0',
};
const variantValueColor: Record<string, string> = {
  default: '#1a1a1a',
  success: '#155724',
  warning: '#856404',
  danger:  '#721c24',
  info:    '#004085',
};
const variantBg: Record<string, string> = {
  default: '#f0f4f8',
  success: '#d4edda',
  warning: '#fff3cd',
  danger:  '#f8d7da',
  info:    '#cce5ff',
};

export default function StatCard({
  label,
  value,
  subValue,
  icon,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={className}
      style={{
        background: variantBg[variant],
        border: `1px solid ${variantBorder[variant]}`,
        borderRadius: 3,
        padding: '8px 12px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 1px 1px 3px rgba(0,0,0,0.2)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {icon && (
          <div style={{ color: variantValueColor[variant], marginTop: 2, flexShrink: 0, opacity: 0.75 }}>
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.8, color: '#4a6a9a', marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: variantValueColor[variant], lineHeight: 1 }}>
            {value}
          </div>
          {subValue && (
            <div style={{ fontSize: 10, color: '#6a6a6a', marginTop: 2 }}>
              {subValue}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
