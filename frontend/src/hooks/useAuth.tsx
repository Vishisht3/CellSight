import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
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
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('cs_user');
      return stored ? (JSON.parse(stored) as User) : null;
    } catch { return null; }
  });

  // Access token is the one we expose to the rest of the app
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('cs_access_token')
  );

  const [isLoading, setIsLoading] = useState(!!(token && !user));

  // On mount: if we have a stored token but no user, validate via /auth/me
  useEffect(() => {
    if (token && !user) {
      setIsLoading(true);
      authApi.me()
        .then(fetchedUser => {
          setUser(fetchedUser);
          localStorage.setItem('cs_user', JSON.stringify(fetchedUser));
        })
        .catch(() => {
          // Token invalid or expired and refresh also failed — clear state
          localStorage.removeItem('cs_access_token');
          localStorage.removeItem('cs_refresh_token');
          localStorage.removeItem('cs_user');
          setToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // authApi.login persists both tokens to localStorage
      const data = await authApi.login(email, password);
      setToken(data.accessToken);
      setUser(data.user);
      localStorage.setItem('cs_user', JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // authApi.logout calls /auth/logout (revokes refresh token) then clears localStorage
    await authApi.logout();
    setToken(null);
    setUser(null);
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
