const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface AppleSessionResponse {
  sessionId: string;
  startedAt: number;
  expiresAt: number;
  /** 서버가 생성한 10×17 보드. 각 값 1~9 */
  board: number[][];
}

/**
 * Phase 3 — 서버가 생성한 보드로 사과게임 세션 발급.
 * 클라이언트는 반환된 board 를 사용하고 randomApple() 생성 로직을 제거.
 */
export async function startAppleSession(): Promise<AppleSessionResponse> {
  return request<AppleSessionResponse>('/api/apple/session/start', {
    method: 'POST',
    body: JSON.stringify({ level: 'normal' }),
  });
}
