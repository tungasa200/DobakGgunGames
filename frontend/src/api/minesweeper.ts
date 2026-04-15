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

export interface MinesweeperSessionResponse {
  sessionId: string;
  startedAt: number;
  expiresAt: number;
  /** adjMines[r][c]: -1 = 지뢰, 0~8 = 인접 지뢰 수 */
  adjMines: number[][];
}

/**
 * Phase 3 — 서버가 지뢰 배치를 생성한 지뢰찾기 세션 발급.
 * firstClick 좌표를 함께 전달하면 서버가 해당 셀과 인접 8칸에 지뢰를 배치하지 않음.
 */
export async function startMinesweeperSession(
  level: string,
  firstClick?: { r: number; c: number },
): Promise<MinesweeperSessionResponse> {
  return request<MinesweeperSessionResponse>('/api/minesweeper/session/start', {
    method: 'POST',
    body: JSON.stringify({
      level,
      firstClickR: firstClick?.r,
      firstClickC: firstClick?.c,
    }),
  });
}
