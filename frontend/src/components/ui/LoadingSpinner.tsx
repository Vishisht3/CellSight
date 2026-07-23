interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullPage?: boolean;
  label?: string;
}

const sizeMap = { sm: 16, md: 28, lg: 40 };

export default function LoadingSpinner({ size = 'md', className, fullPage, label }: LoadingSpinnerProps) {
  const px = sizeMap[size];

  const spinner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} className={className}>
      <div style={{
        width: px,
        height: px,
        border: `${px <= 16 ? 2 : 3}px solid #b8cfe8`,
        borderTopColor: '#316ac5',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      {label && <span style={{ fontSize: 11, color: '#4a6a9a' }}>{label}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (fullPage) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {spinner}
      </div>
    );
  }
  return spinner;
}
