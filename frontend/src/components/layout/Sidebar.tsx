import { NavLink, useNavigate } from 'react-router-dom';
import {
  Truck, PackageSearch, Bell, GitMerge, LogOut,
  Zap, Map, Wrench,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/fleet',         label: 'Fleet Health',      icon: <Truck size={14} />,        roles: ['fleet_manager'] },
  { to: '/readiness',     label: 'Replacement Plan',  icon: <Map size={14} />,          roles: ['fleet_manager'] },
  { to: '/maintenance',   label: 'Work Orders',       icon: <Wrench size={14} />,       roles: ['fleet_manager'] },
  { to: '/supply-chain',  label: 'Supplier Portal',   icon: <PackageSearch size={14} />,roles: ['supply_chain_manager'] },
  { to: '/alerts',        label: 'Alerts',            icon: <Bell size={14} /> },
  { to: '/correlation',   label: 'Field Claims',      icon: <GitMerge size={14} />,     roles: ['fleet_manager','supply_chain_manager'] },
];

export default function Sidebar() {
  const { user, logout, hasRole, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (isAuthenticated && hasRole(...(item.roles as any[])))
  );

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 178,
        background: 'linear-gradient(to bottom, #1b4da0 0%, #0a246a 40%, #061640 100%)',
        borderRight: '2px solid #0a246a',
        boxShadow: '2px 0 6px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Branding ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e5cbf 0%, #0a246a 60%, #051030 100%)',
          borderBottom: '1px solid #3a6abf',
          padding: '14px 12px 10px',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            style={{
              background: 'linear-gradient(135deg, #5090e0, #2255b4)',
              border: '1px solid #7fb3e0',
              borderRadius: 3,
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <Zap size={14} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }}>
              CellSight
            </div>
            <div style={{ color: '#a0c0f0', fontSize: 9, letterSpacing: 0.3 }}>
              SUPPLIER PORTAL
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2">
        <div style={{ padding: '4px 8px 2px', fontSize: 9, color: '#7090c0', letterSpacing: 1, fontWeight: 'bold', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 10px',
              margin: '1px 4px',
              borderRadius: 2,
              fontSize: 12,
              fontFamily: 'Tahoma, Arial, sans-serif',
              color: isActive ? '#fff' : '#c0d8f8',
              background: isActive
                ? 'linear-gradient(to right, #316ac5, #1a4a9c)'
                : 'transparent',
              border: isActive ? '1px solid #4a7fd4' : '1px solid transparent',
              boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
              textDecoration: 'none',
              cursor: 'pointer',
            })}
          >
            <span style={{ opacity: 0.9, flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontSize: 11 }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div style={{ borderTop: '1px solid #2a4a8a', padding: '8px 10px' }}>
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 24, height: 24, borderRadius: 2,
                background: 'linear-gradient(135deg, #4a7fd4, #2255b4)',
                border: '1px solid #7fb3e0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', fontWeight: 'bold', flexShrink: 0,
              }}
            >
              {user.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ color: '#e0ecff', fontSize: 11, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ color: '#7090c0', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.role?.replace(/_/g, ' ')}
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              style={{ color: '#7090c0', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
              onMouseOver={e => (e.currentTarget.style.color = '#c0d8f8')}
              onMouseOut={e => (e.currentTarget.style.color = '#7090c0')}
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="win-btn w-full"
            style={{ justifyContent: 'center', fontSize: 11 }}
          >
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
