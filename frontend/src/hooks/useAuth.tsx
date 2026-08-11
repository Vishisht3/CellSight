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
  hasRole: (...roles: UserRole[]) => boolean;
}

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

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user, isLoading, login, logout, hasRole }}
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
