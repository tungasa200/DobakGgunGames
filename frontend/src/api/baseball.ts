const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface BaseballSessionResponse {
  sessionId: string;
  startedAt: number;
  expiresAt: number;
  digitCount: number;
}

export interface GuessResult {
  strikes: number;
  balls: number;
  attempts: number;
  won: boolean;
  gameOver: boolean;
  elapsed: number;
  answer: string | null;  // gameOver 시에만 공개
}

/** 숫자야구 전용 세션 시작 — 서버에서 정답을 생성하고 digitCount 반환 */
export async function startBaseballSession(level: string): Promise<BaseballSessionResponse> {
  return request<BaseballSessionResponse>('/api/baseball/session/start', {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

/** 서버에 추측값 제출 */
export async function submitGuess(sessionId: string, guess: string): Promise<GuessResult> {
  return request<GuessResult>('/api/baseball/guess', {
    method: 'POST',
    body: JSON.stringify({ sessionId, guess }),
  });
}
