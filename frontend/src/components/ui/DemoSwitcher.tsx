/**
 * DemoSwitcher
 *
 * A floating pill visible only during demos. Clicking a role button
 * switches the active user instantly — no login screen, no server wait.
 * The real auth token is refreshed in the background so API calls keep working.
 */
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const ROLES = [
  { key: 'fleet',       label: 'Fleet Manager',       color: '#2563eb' },
  { key: 'supply',      label: 'Supply Chain',         color: '#7c3aed' },
  { key: 'maintenance', label: 'Maintenance',          color: '#0891b2' },
] as const;

export default function DemoSwitcher() {
  const { user, demoSwitch } = useAuth();
  const navigate = useNavigate();

  function handleSwitch(role: 'fleet' | 'supply' | 'maintenance') {
    demoSwitch(role);
    navigate('/', { replace: true });
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 8,
      padding: '6px 10px',
      boxShadow: '0 4px 20px rgba(0,0,0,.5)',
      fontFamily: "'Inter',system-ui,sans-serif",
    }}>
      <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginRight: 4 }}>
        DEMO
      </span>
      {ROLES.map(r => {
        const active = user?.email?.startsWith(r.key === 'fleet' ? 'fleet' : r.key === 'supply' ? 'supply' : 'maintenance');
        return (
          <button
            key={r.key}
            onClick={() => handleSwitch(r.key)}
            style={{
              background: active ? r.color : 'transparent',
              color: active ? '#fff' : '#94a3b8',
              border: `1px solid ${active ? r.color : '#334155'}`,
              borderRadius: 5,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all .1s',
              fontFamily: 'inherit',
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
