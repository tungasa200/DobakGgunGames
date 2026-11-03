export const GAME_DISABLED_CODE = 'GAME_DISABLED';

const CLOSED_MESSAGE = '현재 점검 중인 게임입니다.\n이용에 불편을 드려 죄송합니다.';
// 세션 시작은 1초 간격으로 3번까지 재시도하므로 그 재시도까지 덮는다.
const REPEAT_WINDOW_MS = 5000;

let leaveGame: (() => void) | null = null;
let lastClosedAt = 0;

export function setLeaveGameHandler(handler: (() => void) | null) {
  leaveGame = handler;
}

/** 세션 시작 재시도 루프가 멈춰야 하는 실패인지 본다. 안내와 홈 이동은 fetch 가로채기가 이미 했다. */
export function isGameDisabledError(e: unknown) {
  return (e as { code?: string } | null)?.code === GAME_DISABLED_CODE;
}

/** 점검 안내 후 홈으로 보낸다. 동시에 온 요청이 안내를 겹쳐 띄우지 않게 하되, 이동은 항상 한다. */
export function closeDisabledGame() {
  if (Date.now() - lastClosedAt >= REPEAT_WINDOW_MS) {
    alert(CLOSED_MESSAGE);
    lastClosedAt = Date.now();
  }
  leaveGame?.();
}

/**
 * 게임 API 래퍼가 파일마다 따로 있어 fetch 한 곳에서 503 GAME_DISABLED를 잡는다.
 * 야추 매칭은 Redis 락 실패에도 503을 쓰므로 상태 코드가 아니라 코드값으로 구분한다.
 */
export function installGameDisabledFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);
    if (res.status === 503) {
      const body: unknown = await res.clone().json().catch(() => null);
      if ((body as { code?: string } | null)?.code === GAME_DISABLED_CODE) closeDisabledGame();
    }
    return res;
  };
}
