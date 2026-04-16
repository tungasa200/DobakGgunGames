const BASE = '/api/auth';

export interface AuthUser {
  id: number;
  nickname: string;
  profileImage: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다');
  return data as T;
}

export const authApi = {
  signup: (email: string, nickname: string, password: string) =>
    request<{ message: string }>(`${BASE}/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, nickname, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>(`${BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>(`${BASE}/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (accessToken: string) =>
    request<{ message: string }>(`${BASE}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  requestPasswordReset: (email: string) =>
    request<{ message: string }>(`${BASE}/password-reset`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  checkEmail: (email: string) =>
    request<{ taken: boolean }>(`${BASE}/check-email?email=${encodeURIComponent(email)}`),

  verifyEmail: (token: string) =>
    request<{ message: string }>(`${BASE}/verify?token=${encodeURIComponent(token)}`),

  confirmPasswordReset: (token: string, newPassword: string) =>
    request<{ message: string }>(`${BASE}/password-reset/confirm`, {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
};
