import type { MatchResponse, AlreadyInRoomError } from '../games/online-rps/types/rps.types';

const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

export interface MatchResult {
  ok: true;
  data: MatchResponse;
}

export interface MatchAlreadyInRoom {
  ok: false;
  alreadyInRoom: true;
  roomId: string;
}

export interface MatchError {
  ok: false;
  alreadyInRoom: false;
  status: number;
  error: string;
}

export type MatchOutcome = MatchResult | MatchAlreadyInRoom | MatchError;

export async function postMatch(token: string): Promise<MatchOutcome> {
  const res = await fetch(`${API_ORIGIN}/api/rps/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (res.ok) {
    const data = (await res.json()) as MatchResponse;
    return { ok: true, data };
  }

  const body = await res.json().catch(() => ({})) as Partial<AlreadyInRoomError & { error: string }>;

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
