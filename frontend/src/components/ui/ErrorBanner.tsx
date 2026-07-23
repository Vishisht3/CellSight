import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface ErrorBannerProps {
  message: string;
  dismissible?: boolean;
}

export default function ErrorBanner({ message, dismissible = true }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: '#f8d7da',
      border: '1px solid #e07070',
      borderRadius: 3,
      padding: '6px 10px',
      fontSize: 12,
      color: '#721c24',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
    }}>
      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: '#c00000' }} />
      <span style={{ flex: 1 }}>{message}</span>
      {dismissible && (
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00000', padding: 0, lineHeight: 1 }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}
