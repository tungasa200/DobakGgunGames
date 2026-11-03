const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

/** 서버 판정 API의 { error: 코드, message } 응답. code가 없으면 네트워크 오류 등 코드 없는 실패다. */
export class GamePlayError extends Error {
  readonly code: string | undefined;

  constructor(code: string | undefined, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new GamePlayError(body.error, body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type SudokuDifficulty = 'easy' | 'normal' | 'hard';

export interface SudokuSessionResponse {
  sessionId: string;
  startedAt: number;
  expiresAt: number;
  puzzle: number[][];
}

export interface SudokuHintResponse {
  row: number;
  col: number;
  value: number;
  hintsLeft: number;
}

export interface SudokuCompleteResponse {
  cleared: boolean;
  clearTimeMs: number;
}

export async function startSudokuSession(difficulty: SudokuDifficulty): Promise<SudokuSessionResponse> {
  return request<SudokuSessionResponse>('/api/sudoku/session/start', {
    method: 'POST',
    body: JSON.stringify({ level: difficulty }),
  });
}

/** 호출할 때마다 힌트 횟수가 차감되므로 자동 재시도하지 않는다. */
export async function requestSudokuHint(sessionId: string, row: number, col: number): Promise<SudokuHintResponse> {
  return request<SudokuHintResponse>(`/api/sudoku/session/${sessionId}/hint`, {
    method: 'POST',
    body: JSON.stringify({ row, col }),
  });
}

/** 멱등하다. 성공 뒤 다시 불러도 처음 기록을 돌려준다. 그래서 시간 초과 뒤 '다시 확인'해도 안전하다. */
export async function completeSudoku(sessionId: string, board: number[][]): Promise<SudokuCompleteResponse> {
  // AbortSignal.timeout이 없는 구형 브라우저도 쓰므로 직접 끊는다(D-26)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request<SudokuCompleteResponse>(`/api/sudoku/session/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ board }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
