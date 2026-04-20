const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/patch-notes`;

export interface PatchNote {
  id: number;
  title: string;
  content: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다');
  return data as T;
}

export const patchNoteApi = {
  list: () => get<PatchNote[]>(BASE),
  get: (id: number) => get<PatchNote>(`${BASE}/${id}`),
};
