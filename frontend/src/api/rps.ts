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

export interface RpsRoomStatus {
  waitingRooms: number;
  playingRooms: number;
  activeRooms: number;
}

export async function getRpsRoomStatus(): Promise<RpsRoomStatus | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/rps/rooms/status`);
    if (!res.ok) return null;
    return res.json() as Promise<RpsRoomStatus>;
  } catch {
    return null;
  }
}

export async function postMatch(token?: string | null, guestToken?: string | null): Promise<MatchOutcome> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_ORIGIN}/api/rps/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify(guestToken ? { guestToken } : {}),
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
