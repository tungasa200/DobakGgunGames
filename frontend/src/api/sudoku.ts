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

export type SudokuDifficulty = 'easy' | 'normal' | 'hard';

export interface SudokuSessionResponse {
  sessionId: string;
  startedAt: number;
  expiresAt: number;
  puzzle: number[][];
  solution: number[][];
}

export async function startSudokuSession(difficulty: SudokuDifficulty): Promise<SudokuSessionResponse> {
  return request<SudokuSessionResponse>('/api/sudoku/session/start', {
    method: 'POST',
    body: JSON.stringify({ level: difficulty }),
  });
}
