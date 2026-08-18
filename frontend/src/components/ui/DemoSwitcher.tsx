/**
 * DemoSwitcher
 * Fixed to top-centre so it never overlaps table content.
 * Awaits real JWT before navigating — prevents 401 logout loop.
 */
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const ROLES = [
  { key: 'fleet'       as const, label: 'Fleet Manager', color: '#2563eb', dest: '/fleet' },
  { key: 'supply'      as const, label: 'Supply Chain',  color: '#7c3aed', dest: '/supply-chain' },
  { key: 'maintenance' as const, label: 'Maintenance',   color: '#0891b2', dest: '/maintenance' },
];

export default function DemoSwitcher() {
  const { user, demoSwitch } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<string | null>(null);

  async function handleSwitch(role: 'fleet' | 'supply' | 'maintenance', dest: string) {
    if (switching) return;
    setSwitching(role);
    try {
      await demoSwitch(role);
      navigate(dest, { replace: true });
    } catch {
      // swallow — user can retry
    } finally {
      setSwitching(null);
    }
  }

  const activeKey = user?.email?.startsWith('fleet') ? 'fleet'
    : user?.email?.startsWith('supply') ? 'supply'
    : user?.email?.startsWith('maintenance') ? 'maintenance'
    : null;

  return (
    <div style={{
      position: 'fixed',
      top: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 6,
      padding: '4px 8px',
      boxShadow: '0 2px 12px rgba(0,0,0,.5)',
      fontFamily: "'Inter',system-ui,sans-serif",
      pointerEvents: 'auto',
    }}>
      <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginRight: 2 }}>
        Demo
      </span>
      {ROLES.map(r => {
        const isActive = activeKey === r.key;
        const isThis = switching === r.key;
        return (
          <button
            key={r.key}
            onClick={() => handleSwitch(r.key, r.dest)}
            disabled={switching !== null}
            style={{
              background: isActive ? r.color : 'transparent',
              color: isActive ? '#fff' : '#94a3b8',
              border: `1px solid ${isActive ? r.color : '#334155'}`,
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 10,
              fontWeight: 600,
              cursor: switching ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              opacity: switching && !isThis ? 0.4 : 1,
              transition: 'opacity .1s',
            }}
          >
            {isThis ? 'Signing in...' : r.label}
          </button>
        );
      })}
    </div>
  );
}
