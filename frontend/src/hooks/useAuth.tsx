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
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('cs_user');
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('cs_token')
  );
  const [isLoading, setIsLoading] = useState(!!token && !user);

  // Validate stored token on mount
  useEffect(() => {
    if (token && !user) {
      setIsLoading(true);
      authApi
        .me()
        .then((fetchedUser) => {
          setUser(fetchedUser);
          localStorage.setItem('cs_user', JSON.stringify(fetchedUser));
        })
        .catch(() => {
          // Token invalid — clear everything
          localStorage.removeItem('cs_token');
          localStorage.removeItem('cs_user');
          setToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const authToken = await authApi.login(email, password);
      localStorage.setItem('cs_token', authToken.token);
      localStorage.setItem('cs_user', JSON.stringify(authToken.user));
      setToken(authToken.token);
      setUser(authToken.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
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
