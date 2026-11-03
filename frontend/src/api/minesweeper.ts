const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const TIMEOUT_MS = 10_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // 503 킬스위치는 code, 서버 판정 API는 error에 코드값을 담는다
      const { error, code } = body as { error?: string; code?: string };
      throw Object.assign(new Error(error ?? `HTTP ${res.status}`), { code: code ?? error });
    }
    return await (res.json() as Promise<T>);
  } finally {
    clearTimeout(timer);
  }
}

export type CellPosition = [r: number, c: number];

export interface RevealedCell {
  r: number;
  c: number;
  /** 주변 지뢰 수 */
  n: number;
}

export type MinesweeperPlayStatus = 'PLAYING' | 'WON' | 'LOST';

export interface MinesweeperPlayUpdate {
  status: MinesweeperPlayStatus;
  revealed: RevealedCell[];
  /** LOST일 때만 온다 */
  mines?: number[][] | null;
  /** WON일 때만 온다 */
  clearTimeMs?: number | null;
}

export interface MinesweeperStartResponse extends MinesweeperPlayUpdate {
  sessionId: string;
}

/** 서버 판정 세션을 시작한다. 첫 칸은 서버가 안전을 보장하고 시작 응답에 열린 칸이 담긴다. */
export async function startMinesweeperSession(
  level: string,
  firstClick: { r: number; c: number },
): Promise<MinesweeperStartResponse> {
  return request<MinesweeperStartResponse>('/api/minesweeper/session/start', {
    method: 'POST',
    body: JSON.stringify({
      level,
      firstClickR: firstClick.r,
      firstClickC: firstClick.c,
      protocol: 2,
    }),
  });
}

/** 같은 칸을 다시 보내도 판은 바뀌지 않는다. 응답에는 새로 열린 칸만 담긴다. */
export async function revealMinesweeperCells(
  sessionId: string,
  cells: CellPosition[],
  flags: CellPosition[],
): Promise<MinesweeperPlayUpdate> {
  return request<MinesweeperPlayUpdate>(`/api/minesweeper/session/${sessionId}/reveal`, {
    method: 'POST',
    body: JSON.stringify({ cells, flags }),
  });
}

/** 잠금 없이 읽으므로 진행 중인 reveal 응답을 기다린 뒤 부른다. */
export async function getMinesweeperState(sessionId: string): Promise<MinesweeperPlayUpdate> {
  return request<MinesweeperPlayUpdate>(`/api/minesweeper/session/${sessionId}/state`);
}
