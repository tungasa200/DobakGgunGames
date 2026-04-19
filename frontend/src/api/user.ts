const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/users/me`;

export interface UserProfile {
  id: number;
  email: string;
  nickname: string;
  profileImage: string | null;
  role: string;
  provider: string | null;
}

async function request<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다');
  return data as T;
}

export const userApi = {
  getProfile: (token: string) =>
    request<UserProfile>(BASE, token),

  updateNickname: (token: string, nickname: string) =>
    request<UserProfile>(BASE, token, {
      method: 'PATCH',
      body: JSON.stringify({ nickname }),
    }),

  uploadProfileImage: async (token: string, file: File): Promise<UserProfile> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/profile-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '업로드에 실패했습니다');
    return data as UserProfile;
  },

  deleteProfileImage: (token: string) =>
    request<UserProfile>(`${BASE}/profile-image`, token, { method: 'DELETE' }),
};
