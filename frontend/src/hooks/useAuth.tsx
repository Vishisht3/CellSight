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
  logout: () => void;
  demoSwitch: (role: 'fleet' | 'supply' | 'maintenance') => Promise<void>;
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

  // isLoading: skip the network wait entirely if there's no cached token.
  // We only do silentRefresh when we have reason to believe a session exists.
  const [isLoading, setIsLoading] = useState(() => !!(authApi.getAccessToken() || authApi.getUser()));

  useEffect(() => {
    // If no in-memory token, don't hit the network — show login immediately.
    if (!token && !user) {
      setIsLoading(false);
      return;
    }
    // We have a cached token/user — validate silently in background.
    authApi.silentRefresh()
      .then(data => {
        setToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    // Clear state immediately — instant for the UI.
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
    // Revoke the cookie in the background — don't block on it.
    authApi.logout().catch(() => {/* silent */});
  }, [navigate]);

  const demoSwitch = useCallback(async (role: 'fleet' | 'supply' | 'maintenance') => {
    const emails: Record<string, string> = {
      fleet: 'fleet@cellsight.com',
      supply: 'supply@cellsight.com',
      maintenance: 'maintenance@cellsight.com',
    };
    // Set stub user immediately so the UI renders the right name/role at once.
    setUser(DEMO_USERS[role]);
    // Await the real login so the Bearer token is in place BEFORE the caller
    // navigates and data fetches fire. This prevents the 401 logout loop.
    const data = await authApi.login(emails[role], 'demo123');
    setToken(data.accessToken);
    setUser(data.user);
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
