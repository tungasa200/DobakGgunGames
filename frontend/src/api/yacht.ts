import type {
  DiceType,
  YachtMatchResponse,
  YachtRankingResponse,
  YachtRoomResponse,
  YachtRoomStatusByMode,
} from '../games/yacht/types/yacht.types';

const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

// --- Match 결과 타입 ---

export interface YachtMatchResult {
  ok: true;
  data: YachtMatchResponse;
}

export interface YachtMatchAlreadyInRoom {
  ok: false;
  alreadyInRoom: true;
  roomId: string;
}

export interface YachtMatchError {
  ok: false;
  alreadyInRoom: false;
  status: number;
  error: string;
}

export type YachtMatchOutcome = YachtMatchResult | YachtMatchAlreadyInRoom | YachtMatchError;

/** 하위 호환용 단일 모드 방 상태 타입 */
export interface YachtRoomStatus {
  activeRooms: number;
  activePlayers: number;
}

/**
 * GET /api/yacht/rooms/status — 모드별 분리 응답
 * 백엔드가 { D6: {...}, D8: {...} } 구조를 반환함
 */
export async function getYachtRoomStatus(): Promise<YachtRoomStatusByMode | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/yacht/rooms/status`);
    if (!res.ok) return null;
    return res.json() as Promise<YachtRoomStatusByMode>;
  } catch {
    return null;
  }
}

/**
 * POST /api/yacht/match — 자동 매칭 진입점
 * JWT 로그인 필수 (비로그인 → 401)
 * diceType 필수 ("D6" | "D8")
 */
export async function postYachtMatch(
  token: string | null,
  diceType: DiceType,
): Promise<YachtMatchOutcome> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_ORIGIN}/api/yacht/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ diceType }),
  });

  if (res.ok) {
    const data = (await res.json()) as YachtMatchResponse;
    return { ok: true, data };
  }

  const body = await res.json().catch(() => ({})) as Partial<{ error: string; roomId: string }>;

  if (res.status === 409 && body.error === 'ALREADY_IN_ROOM' && body.roomId) {
    return { ok: false, alreadyInRoom: true, roomId: body.roomId };
  }

  return {
    ok: false,
    alreadyInRoom: false,
    status: res.status,
    error: body.error ?? '매칭 요청에 실패했습니다',
  };
}

/** GET /api/yacht/rankings — 모드별 분리 응답 */
export async function getYachtRankings(): Promise<YachtRankingResponse | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/yacht/rankings`);
    if (!res.ok) return null;
    return res.json() as Promise<YachtRankingResponse>;
  } catch {
    return null;
  }
}

/**
 * GET /api/yacht/room/{roomId} — 방 스냅샷 조회
 */
export async function getYachtRoom(roomId: string, token: string | null): Promise<YachtRoomResponse | null> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_ORIGIN}/api/yacht/room/${encodeURIComponent(roomId)}`, { headers });

  if (res.ok) {
    return (await res.json()) as YachtRoomResponse;
  }
  return null;
}
