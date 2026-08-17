import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import type { User, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  demoSwitch: (role: 'fleet' | 'supply' | 'maintenance') => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

// Hardcoded demo user stubs — match the seeded DB rows exactly.
// demoSwitch sets these instantly with zero network round-trip.
const DEMO_ORG_ID = 'demo-org-00000000-0000-0000-0000-000000000000';
const DEMO_USERS: Record<'fleet' | 'supply' | 'maintenance', User> = {
  fleet: {
    id: 'demo-fleet-user',
    email: 'fleet@cellsight.com',
    name: 'Jordan Lee, Fleet Operations',
    role: 'fleet_manager',
    organizationId: DEMO_ORG_ID,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  supply: {
    id: 'demo-supply-user',
    email: 'supply@cellsight.com',
    name: 'Elena Ruiz, Supplier Quality',
    role: 'supply_chain_manager',
    organizationId: DEMO_ORG_ID,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  maintenance: {
    id: 'demo-maintenance-user',
    email: 'maintenance@cellsight.com',
    name: 'Maya Patel, Maintenance Planner',
    role: 'fleet_manager',
    organizationId: DEMO_ORG_ID,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Access token lives in module memory only — not localStorage.
  // The httpOnly refresh token cookie is invisible to JS and managed by the browser.
  const [user, setUser] = useState<User | null>(() => authApi.getUser());
  const [token, setToken] = useState<string | null>(() => authApi.getAccessToken());
  const navigate = useNavigate();

  // isLoading is true on first mount: we do not know if the httpOnly cookie
  // is present until we attempt a silent refresh.
  const [isLoading, setIsLoading] = useState(true);

  // On mount: attempt a silent token refresh.
  // If the httpOnly cookie is present and valid, this succeeds and restores the
  // session without requiring the user to log in again.
  // If it fails (no cookie, expired, revoked), the user sees the login screen.
  useEffect(() => {
    // If we already have a valid in-memory token, just validate it.
    if (token && user) {
      setIsLoading(false);
      return;
    }

    // Try a silent refresh (uses the httpOnly cookie automatically).
    authApi.silentRefresh()
      .then(data => {
        setToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        // No valid session — user must log in.
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, password);
      setToken(data.accessToken);
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // authApi.logout() hits the backend to revoke the refresh cookie, then
    // clears in-memory tokens. We navigate via React Router so there is no
    // hard reload and no risk of silentRefresh firing immediately after.
    await authApi.logout();
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const demoSwitch = useCallback((role: 'fleet' | 'supply' | 'maintenance') => {
    // Instantly swap user context with no server call.
    // The real API token is kept so existing requests still work — we only
    // swap the user object so the UI re-renders immediately for the new role.
    setUser(DEMO_USERS[role]);
    // Fire a real login in the background to get a proper token + cookie,
    // but don't block the UI on it.
    const emails: Record<string, string> = {
      fleet: 'fleet@cellsight.com',
      supply: 'supply@cellsight.com',
      maintenance: 'maintenance@cellsight.com',
    };
    authApi.login(emails[role], 'demo123')
      .then(data => { setToken(data.accessToken); setUser(data.user); })
      .catch(() => { /* silent — UI is already showing the right role */ });
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user, isLoading, login, logout, demoSwitch, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
