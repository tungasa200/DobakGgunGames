import { createContext, useContext, useState, useCallback } from 'react';
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
  const [state, setState] = useState<AuthState>(() => {
    // 페이지 로드 시 RT로 자동 복원은 필요시 별도 처리
    return { user: null, accessToken: null };
  });

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
