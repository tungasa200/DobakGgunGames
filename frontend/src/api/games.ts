const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

// GameGuard가 이 응답을 기다리며 화면을 비워 두므로 멈춘 요청을 끊는다.
const STATUS_TIMEOUT_MS = 5000;

export interface GameStatusEntry {
  gameKey: string;
  active: boolean;
}

/** 게임 활성/비활성 상태를 { gameKey: active } 맵으로 반환 */
export async function fetchGameStatus(): Promise<Record<string, boolean>> {
  // AbortSignal.timeout이 없는 구형 브라우저도 쓰므로 직접 끊는다(D-26)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_ORIGIN}/api/games/status`, { signal: controller.signal });
    if (!res.ok) return {};
    const list: GameStatusEntry[] = await res.json();
    return Object.fromEntries(list.map(g => [g.gameKey, g.active]));
  } finally {
    clearTimeout(timer);
  }
}
