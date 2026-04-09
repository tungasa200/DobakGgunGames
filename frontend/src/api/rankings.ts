const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

export interface RankingEntry {
  id: number;
  name: string;
  level: string;
  time?: number;
  score?: number;
  attempts?: number;
  moves?: number;
  gameLevel?: number;
  createdAt: string;
}

export interface SubmitPayload {
  level: string;
  name: string;
  time?: number;
  score?: number;
  attempts?: number;
  moves?: number;
  gameLevel?: number;
  token: string;
  timestamp: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const rankingsApi = {
  getWeekly: (game: string, level: string) =>
    request<RankingEntry[]>(`/api/${game}/rankings?level=${level}`),

  getAlltimeBest: (game: string, level: string) =>
    request<RankingEntry | Record<string, never>>(`/api/${game}/rankings/alltime?level=${level}`),

  submit: (game: string, payload: SubmitPayload) =>
    request<RankingEntry>(`/api/${game}/rankings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
