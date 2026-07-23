import { Bell, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  alertCount?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function Navbar({
  title,
  subtitle,
  actions,
  alertCount,
  onRefresh,
  refreshing,
}: NavbarProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(to bottom, #dce6f5 0%, #c4d8ef 50%, #b0c8e8 100%)',
        borderBottom: '2px solid #7f9db9',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        padding: '0 12px',
        height: 42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Left: title */}
      <div className="flex items-center gap-3">
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#0a246a', lineHeight: 1.2 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 10, color: '#4a6a9a', lineHeight: 1.2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Right: actions + refresh + alerts */}
      <div className="flex items-center gap-2">
        {actions}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="win-btn"
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}

        <Link
          to="/alerts"
          title="View alerts"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'linear-gradient(to bottom, #f4f2ec, #dbd8cc)',
            border: '1px solid #7f9db9',
            borderRadius: 3,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
            color: '#316ac5',
            textDecoration: 'none',
          }}
        >
          <Bell size={14} />
          {alertCount != null && alertCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                background: '#c00000',
                color: '#fff',
                fontSize: 9,
                fontWeight: 'bold',
                minWidth: 14,
                height: 14,
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #900000',
                padding: '0 2px',
              }}
            >
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
