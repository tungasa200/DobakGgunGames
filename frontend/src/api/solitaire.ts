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

export interface MovesBatchResponse {
  moves: number;
  elapsed: number;
}

/** 이동 수 배치를 서버에 전송 (500ms 디바운스는 호출 측에서 적용) */
export async function sendMovesBatch(sessionId: string, count: number): Promise<MovesBatchResponse> {
  return request<MovesBatchResponse>('/api/solitaire/moves-batch', {
    method: 'POST',
    body: JSON.stringify({ sessionId, count }),
  });
}
