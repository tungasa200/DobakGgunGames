const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

export type MbDifficulty = 'BEGINNER' | 'INTERMEDIATE';

export interface MbJoinResponse {
  roomId: string;
  playerId: string;
  isGuest: boolean;
  guestToken: string | null;
  status: string;
  playerCount: number;
  maxPlayers: number;
  designatedCell: { r: number; c: number };
  opponentNickname: string | null;
  difficulty: MbDifficulty;
  rows: number;
  cols: number;
  totalSafeCells: number;
}

/**
 * POST /api/minesweeper-battle/join
 * 지뢰찾기 배틀 방 참가 또는 신규 방 생성.
 */
export async function joinMinesweeperBattle(opts?: {
  guestToken?: string;
  nickname?: string;
  accessToken?: string | null;
  difficulty?: MbDifficulty;
}): Promise<MbJoinResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (opts?.accessToken) {
    headers['Authorization'] = `Bearer ${opts.accessToken}`;
  }

  const res = await fetch(`${API_ORIGIN}/api/minesweeper-battle/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      guestToken: opts?.guestToken ?? null,
      nickname: opts?.nickname ?? null,
      difficulty: opts?.difficulty ?? 'BEGINNER',
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const err = new Error(body.error ?? '배틀 참가에 실패했습니다') as Error & {
      status: number;
      code?: string;
    };
    err.status = res.status;
    err.code = body.error;
    throw err;
  }

  return (await res.json()) as MbJoinResponse;
}

// ── 방 목록 / 직접 생성 / 직접 입장 ─────────────────────────────────────────

export interface MbWaitingRoomInfo {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  hostNickname: string | null;
  createdAt: string | null;
  difficulty: MbDifficulty | null;
}

/** GET /api/minesweeper-battle/rooms/waiting */
export async function getMbWaitingRooms(): Promise<MbWaitingRoomInfo[]> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/minesweeper-battle/rooms/waiting`);
    if (!res.ok) return [];
    return res.json() as Promise<MbWaitingRoomInfo[]>;
  } catch {
    return [];
  }
}

/** POST /api/minesweeper-battle/create — 신규 방 직접 생성 */
export async function createMinesweeperBattle(opts?: {
  guestToken?: string;
  nickname?: string;
  accessToken?: string | null;
  difficulty?: MbDifficulty;
}): Promise<MbJoinResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;

  const res = await fetch(`${API_ORIGIN}/api/minesweeper-battle/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: opts?.guestToken ?? null, nickname: opts?.nickname ?? null, difficulty: opts?.difficulty ?? 'BEGINNER' }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const err = new Error(body.error ?? '방 생성에 실패했습니다') as Error & { status: number; code?: string };
    err.status = res.status;
    err.code = body.error;
    throw err;
  }
  return (await res.json()) as MbJoinResponse;
}

/** POST /api/minesweeper-battle/join/{roomId} — 특정 방 직접 입장 */
export async function joinMinesweeperBattleRoom(roomId: string, opts?: {
  guestToken?: string;
  nickname?: string;
  accessToken?: string | null;
}): Promise<MbJoinResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;

  const res = await fetch(`${API_ORIGIN}/api/minesweeper-battle/join/${encodeURIComponent(roomId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: opts?.guestToken ?? null, nickname: opts?.nickname ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const err = new Error(body.error ?? '방 입장에 실패했습니다') as Error & { status: number; code?: string };
    err.status = res.status;
    err.code = body.error;
    throw err;
  }
  return (await res.json()) as MbJoinResponse;
}

// ── localStorage 헬퍼 ────────────────────────────────────

const MB_JOIN_KEY = 'mbJoinInfo';
const MB_GUEST_TOKEN_KEY = 'mbGuestToken';

export interface MbStoredJoinInfo {
  roomId: string;
  playerId: string;
  isGuest: boolean;
  guestToken: string | null;
}

export function saveMbJoinInfo(info: MbStoredJoinInfo): void {
  try {
    localStorage.setItem(MB_JOIN_KEY, JSON.stringify(info));
    if (info.guestToken) {
      localStorage.setItem(MB_GUEST_TOKEN_KEY, info.guestToken);
    }
  } catch { /* quota 등 무시 */ }
}

export function getStoredMbJoinInfo(): MbStoredJoinInfo | null {
  try {
    const raw = localStorage.getItem(MB_JOIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MbStoredJoinInfo;
  } catch {
    return null;
  }
}

export function getStoredMbGuestToken(): string | null {
  try {
    return localStorage.getItem(MB_GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearMbJoinInfo(): void {
  try {
    localStorage.removeItem(MB_JOIN_KEY);
    localStorage.removeItem(MB_GUEST_TOKEN_KEY);
  } catch { /* 무시 */ }
}
