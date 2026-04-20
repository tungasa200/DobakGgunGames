const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/admin`;

async function req<T>(url: string, token: string, options?: RequestInit): Promise<T> {
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

// ── 유저 관리 ──────────────────────────────────────────────

export interface AdminUser {
  id: number;
  email: string;
  nickname: string;
  role: 'USER' | 'ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'BANNED';
  provider: string | null;
  profileImage: string | null;
  createdAt: string;
}

export interface AdminUserPage {
  content: AdminUser[];
  hasNext: boolean;
  totalCount: number;
}

export const adminUserApi = {
  list: (token: string, params?: { search?: string; role?: string; status?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.role) q.set('role', params.role);
    if (params?.status) q.set('status', params.status);
    q.set('page', String(params?.page ?? 0));
    return req<AdminUserPage>(`${BASE}/users?${q}`, token);
  },
  changeRole: (token: string, id: number, role: string) =>
    req(`${BASE}/users/${id}/role`, token, { method: 'PATCH', body: JSON.stringify({ role }) }),
  changeStatus: (token: string, id: number, status: string) =>
    req(`${BASE}/users/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteUser: (token: string, id: number) =>
    req(`${BASE}/users/${id}`, token, { method: 'DELETE' }),
};

// ── 문의 관리 ──────────────────────────────────────────────

export interface AdminContact {
  id: number;
  userId: number;
  userNickname: string;
  category: string;
  subject: string;
  body: string;
  status: 'UNREAD' | 'READ' | 'REPLIED';
  reply: string | null;
  createdAt: string;
  repliedAt: string | null;
}

export interface AdminContactPage {
  content: AdminContact[];
  hasNext: boolean;
  totalCount: number;
}

export const adminContactApi = {
  list: (token: string, params?: { status?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    q.set('page', String(params?.page ?? 0));
    return req<AdminContactPage>(`${BASE}/contacts?${q}`, token);
  },
  get: (token: string, id: number) =>
    req<AdminContact>(`${BASE}/contacts/${id}`, token),
  reply: (token: string, id: number, reply: string) =>
    req(`${BASE}/contacts/${id}/reply`, token, { method: 'POST', body: JSON.stringify({ content: reply }) }),
  changeStatus: (token: string, id: number, status: string) =>
    req(`${BASE}/contacts/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (token: string, id: number) =>
    req(`${BASE}/contacts/${id}`, token, { method: 'DELETE' }),
};

// ── 랭킹 관리 ──────────────────────────────────────────────

export interface AdminRanking {
  id: number;
  nickname: string;
  score: number;
  createdAt: string;
  [key: string]: unknown;
}

export const adminRankingApi = {
  list: (token: string, game: string) =>
    req<{ content: AdminRanking[] }>(`${BASE}/rankings/${game}`, token).then(r => r.content),
  deleteOne: (token: string, game: string, id: number) =>
    req(`${BASE}/rankings/${game}/${id}`, token, { method: 'DELETE' }),
  deleteAll: (token: string, game: string) =>
    req(`${BASE}/rankings/${game}`, token, { method: 'DELETE' }),
};

// ── 패치노트 ───────────────────────────────────────────────

export interface AdminPatchNote {
  id: number;
  title: string;
  content: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export const adminPatchNoteApi = {
  list: (token: string) =>
    req<{ content: AdminPatchNote[] }>(`${BASE}/patch-notes`, token).then(r => r.content),
  create: (token: string, data: { title: string; content: string; version: string }) =>
    req<AdminPatchNote>(`${BASE}/patch-notes`, token, { method: 'POST', body: JSON.stringify(data) }),
  update: (token: string, id: number, data: { title: string; content: string; version: string }) =>
    req<AdminPatchNote>(`${BASE}/patch-notes/${id}`, token, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (token: string, id: number) =>
    req(`${BASE}/patch-notes/${id}`, token, { method: 'DELETE' }),
};

// ── IP 차단 ────────────────────────────────────────────────

export interface IpBan {
  id: number;
  ip: string;
  reason: string | null;
  bannedBy: number;
  bannedAt: string;
}

export const adminIpBanApi = {
  list: (token: string) =>
    req<IpBan[]>(`${BASE}/ip-bans`, token),
  ban: (token: string, ip: string, reason?: string) =>
    req<IpBan>(`${BASE}/ip-bans`, token, { method: 'POST', body: JSON.stringify({ ip, reason }) }),
  unban: (token: string, id: number) =>
    req(`${BASE}/ip-bans/${id}`, token, { method: 'DELETE' }),
};

// ── 통계 ───────────────────────────────────────────────────

export interface StatsSummary {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  bannedUsers: number;
  totalSessions: number;
  unreadContacts: number;
}

export const adminStatsApi = {
  summary: (token: string) =>
    req<StatsSummary>(`${BASE}/stats/summary`, token),
  sessions: (token: string, days = 30) =>
    req<{ date: string; count: number }[]>(`${BASE}/stats/sessions?days=${days}`, token),
  games: (token: string) =>
    req<{ game: string; count: number }[]>(`${BASE}/stats/games`, token),
};
