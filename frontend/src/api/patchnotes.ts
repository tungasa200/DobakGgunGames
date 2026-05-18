const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/patch-notes`;

export type PatchNoteGame =
  | 'ALL' | 'COMMON' | 'MINESWEEPER' | 'BASEBALL' | 'BLOCKFALL' | 'SOLITAIRE' | 'APPLE' | 'SUDOKU' | 'YACHT';

export interface PatchNote {
  id: number;
  title: string;
  content: string;
  version: string;
  game: PatchNoteGame;
  createdAt: string;
  updatedAt: string;
}

export interface PatchNoteListResult {
  content: PatchNote[];
  hasNext: boolean;
  totalCount: number;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다');
  return data as T;
}

export const patchNoteApi = {
  list: (game?: PatchNoteGame, page = 0, size = 10) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (game) params.set('game', game);
    return get<PatchNoteListResult>(`${BASE}?${params}`);
  },
  get: (id: number) => get<PatchNote>(`${BASE}/${id}`),
};
