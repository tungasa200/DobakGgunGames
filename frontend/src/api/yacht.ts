import type { YachtMatchResponse, YachtRoomResponse } from '../games/yacht/types/yacht.types';

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

/**
 * POST /api/yacht/match — 자동 매칭 진입점
 * JWT 로그인 필수 (비로그인 → 401)
 */
export async function postYachtMatch(token: string | null): Promise<YachtMatchOutcome> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_ORIGIN}/api/yacht/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
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
