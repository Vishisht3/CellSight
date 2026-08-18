/**
 * DemoSwitcher — always visible, even on login page.
 * Awaits real token before navigating so data fetches never fire with no auth.
 */
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const ROLES = [
  { key: 'fleet'        as const, label: 'Fleet Manager', color: '#2563eb', dest: '/fleet' },
  { key: 'supply'       as const, label: 'Supply Chain',  color: '#7c3aed', dest: '/supply-chain' },
  { key: 'maintenance'  as const, label: 'Maintenance',   color: '#0891b2', dest: '/maintenance' },
];

export default function DemoSwitcher() {
  const { user, demoSwitch } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<string | null>(null);

  async function handleSwitch(role: 'fleet' | 'supply' | 'maintenance', dest: string) {
    if (switching) return;
    setSwitching(role);
    try {
      await demoSwitch(role);   // waits for real JWT before returning
      navigate(dest, { replace: true });
    } catch {
      // Railway might be cold — try normal login as fallback
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
      bottom: 20,
      right: 20,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: '#0f172a',
      border: '1.5px solid #3b82f6',
      borderRadius: 10,
      padding: '8px 12px',
      boxShadow: '0 4px 24px rgba(37,99,235,.4)',
      fontFamily: "'Inter',system-ui,sans-serif",
    }}>
      <span style={{
        fontSize: 9, color: '#3b82f6', fontWeight: 800,
        letterSpacing: 1, textTransform: 'uppercase', marginRight: 4,
      }}>
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
              background: isActive ? r.color : 'rgba(255,255,255,.06)',
              color: isActive ? '#fff' : '#94a3b8',
              border: `1px solid ${isActive ? r.color : '#334155'}`,
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: switching ? 'wait' : 'pointer',
              transition: 'all .1s',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              opacity: switching && !isThis ? 0.45 : 1,
            }}
          >
            {isThis ? 'Signing in...' : r.label}
          </button>
        );
      })}
    </div>
  );
}
