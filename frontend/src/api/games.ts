const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

export interface GameStatusEntry {
  gameKey: string;
  active: boolean;
}

/** 게임 활성/비활성 상태를 { gameKey: active } 맵으로 반환 */
export async function fetchGameStatus(): Promise<Record<string, boolean>> {
  const res = await fetch(`${API_ORIGIN}/api/games/status`);
  if (!res.ok) return {};
  const list: GameStatusEntry[] = await res.json();
  return Object.fromEntries(list.map(g => [g.gameKey, g.active]));
}
