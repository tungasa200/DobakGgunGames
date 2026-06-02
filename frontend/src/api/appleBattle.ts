const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

export interface AbJoinResponse {
  roomId: string;
  playerId: string;
  isGuest: boolean;
  guestToken: string | null;
  status: string;
  playerCount: number;
  maxPlayers: number;
  opponentNickname: string | null;
}

export interface AbWaitingRoomInfo {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  hostNickname: string | null;
  createdAt: string | null;
}

/**
 * POST /api/apple-battle/join
 * 사과게임 배틀 방 참가 또는 신규 방 생성.
 */
export async function joinAppleBattle(opts?: {
  guestToken?: string;
  nickname?: string;
  accessToken?: string | null;
}): Promise<AbJoinResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts?.accessToken) {
    headers['Authorization'] = `Bearer ${opts.accessToken}`;
  }

  const res = await fetch(`${API_ORIGIN}/api/apple-battle/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      guestToken: opts?.guestToken ?? null,
      nickname: opts?.nickname ?? null,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; roomId?: string; playerId?: string };
    const err = new Error(body.error ?? '배틀 참가에 실패했습니다') as Error & {
      status: number;
      code?: string;
      roomId?: string;
      playerId?: string;
    };
    err.status = res.status;
    err.code = body.error;
    err.roomId = body.roomId;
    err.playerId = body.playerId;
    throw err;
  }

  return (await res.json()) as AbJoinResponse;
}

/**
 * POST /api/apple-battle/create
 * 신규 방 직접 생성.
 */
export async function createAppleBattle(opts?: {
  guestToken?: string;
  nickname?: string;
  accessToken?: string | null;
}): Promise<AbJoinResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;

  const res = await fetch(`${API_ORIGIN}/api/apple-battle/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: opts?.guestToken ?? null, nickname: opts?.nickname ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; roomId?: string; playerId?: string };
    const err = new Error(body.error ?? '방 생성에 실패했습니다') as Error & {
      status: number;
      code?: string;
      roomId?: string;
      playerId?: string;
    };
    err.status = res.status;
    err.code = body.error;
    err.roomId = body.roomId;
    err.playerId = body.playerId;
    throw err;
  }
  return (await res.json()) as AbJoinResponse;
}

/**
 * POST /api/apple-battle/join/{roomId}
 * 특정 방 직접 입장.
 */
export async function joinAppleBattleRoom(
  roomId: string,
  opts?: {
    guestToken?: string;
    nickname?: string;
    accessToken?: string | null;
  },
): Promise<AbJoinResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;

  const res = await fetch(`${API_ORIGIN}/api/apple-battle/join/${encodeURIComponent(roomId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: opts?.guestToken ?? null, nickname: opts?.nickname ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; roomId?: string; playerId?: string };
    const err = new Error(body.error ?? '방 입장에 실패했습니다') as Error & {
      status: number;
      code?: string;
      roomId?: string;
      playerId?: string;
    };
    err.status = res.status;
    err.code = body.error;
    err.roomId = body.roomId;
    err.playerId = body.playerId;
    throw err;
  }
  return (await res.json()) as AbJoinResponse;
}

/**
 * GET /api/apple-battle/rooms/waiting
 */
export async function getAbWaitingRooms(): Promise<AbWaitingRoomInfo[]> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/apple-battle/rooms/waiting`);
    if (!res.ok) return [];
    return res.json() as Promise<AbWaitingRoomInfo[]>;
  } catch {
    return [];
  }
}

/**
 * POST /api/apple-battle/room/{roomId}/cancel
 * WebSocket 연결 전 취소 시 REST 폴백으로 방을 정리한다.
 */
export async function cancelAppleBattle(
  roomId: string,
  opts?: { guestToken?: string | null; accessToken?: string | null },
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;

  await fetch(`${API_ORIGIN}/api/apple-battle/room/${roomId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: opts?.guestToken ?? null }),
  }).catch(() => { /* 네트워크 에러 무시 */ });
}

// ── localStorage 헬퍼 ────────────────────────────────────

const AB_JOIN_KEY = 'abJoinInfo';
const AB_GUEST_TOKEN_KEY = 'abGuestToken';

export interface AbStoredJoinInfo {
  roomId: string;
  playerId: string;
  isGuest: boolean;
  guestToken: string | null;
}

export function saveAbJoinInfo(info: AbStoredJoinInfo): void {
  try {
    localStorage.setItem(AB_JOIN_KEY, JSON.stringify(info));
    if (info.guestToken) {
      localStorage.setItem(AB_GUEST_TOKEN_KEY, info.guestToken);
    }
  } catch { /* quota 등 무시 */ }
}

export function getStoredAbJoinInfo(): AbStoredJoinInfo | null {
  try {
    const raw = localStorage.getItem(AB_JOIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AbStoredJoinInfo;
  } catch {
    return null;
  }
}

export function getStoredAbGuestToken(): string | null {
  try {
    return localStorage.getItem(AB_GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAbJoinInfo(): void {
  try {
    localStorage.removeItem(AB_JOIN_KEY);
    localStorage.removeItem(AB_GUEST_TOKEN_KEY);
  } catch { /* 무시 */ }
}
