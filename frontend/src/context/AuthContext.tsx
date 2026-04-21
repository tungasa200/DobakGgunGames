import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { AuthUser } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY_RT = 'dbg_rt';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null });
  const [initialized, setInitialized] = useState(false);

  // 페이지 로드 시 localStorage의 RT로 세션 복원
  useEffect(() => {
    const rt = localStorage.getItem(STORAGE_KEY_RT);
    if (!rt) {
      setInitialized(true);
      return;
    }
    authApi.refresh(rt)
      .then(res => {
        localStorage.setItem(STORAGE_KEY_RT, res.refreshToken);
        setState({ user: res.user, accessToken: res.accessToken });
      })
      .catch(() => {
        // RT 만료 또는 유효하지 않으면 제거
        localStorage.removeItem(STORAGE_KEY_RT);
      })
      .finally(() => {
        setInitialized(true);
      });
  }, []);

  const setAuth = useCallback((user: AuthUser, accessToken: string, refreshToken: string) => {
    localStorage.setItem(STORAGE_KEY_RT, refreshToken);
    setState({ user, accessToken });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setAuth(res.user, res.accessToken, res.refreshToken);
  }, [setAuth]);

  const logout = useCallback(async () => {
    if (state.accessToken) {
      await authApi.logout(state.accessToken).catch(() => {});
    }
    localStorage.removeItem(STORAGE_KEY_RT);
    setState({ user: null, accessToken: null });
  }, [state.accessToken]);

  if (!initialized) return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0' }} />
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
