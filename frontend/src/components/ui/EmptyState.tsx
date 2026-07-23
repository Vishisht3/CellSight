import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 16px', textAlign: 'center',
    }}>
      {Icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 3,
          background: 'linear-gradient(to bottom, #e8f0fb, #c8d8ef)',
          border: '1px solid #7f9db9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 10, color: '#4a6a9a',
        }}>
          <Icon size={20} />
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 11, color: '#6a6a6a', maxWidth: 280 }}>{description}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
