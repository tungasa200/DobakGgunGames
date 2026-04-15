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

export interface AppleEventPayload {
  t: number;
  cells: number[][];
}

export interface SubmitPayload {
  level: string;
  name: string;
  time?: number;
  score?: number;
  attempts?: number;
  moves?: number;
  gameLevel?: number;
  linesCleared?: number;
  events?: AppleEventPayload[];
  sessionId: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isPost = init?.method === 'POST';
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(isPost ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function startSession(game: string, level: string): Promise<string> {
  const res = await request<{ sessionId: string; startedAt: number; expiresAt: number }>(
    `/api/${game}/session/start`,
    { method: 'POST', body: JSON.stringify({ level }) }
  );
  return res.sessionId;
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

const weeklyCache = new Map<string, { data: RankingEntry[]; fetchedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function getCachedWeekly(game: string, level: string): Promise<RankingEntry[]> {
  const key = `${game}:${level}`;
  const cached = weeklyCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }
  const data = await rankingsApi.getWeekly(game, level);
  weeklyCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}
