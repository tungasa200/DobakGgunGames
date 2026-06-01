import { useState, useEffect, useRef, useCallback } from 'react';
import { connectBattle } from '../lib/battleStompClient';
import type { BattleStompClientHandle } from '../lib/battleStompClient';
import type {
  BattleJoinResponse,
  BattleRankingResponse,
  RoomStatePayload,
  GameStartedPayload,
  BoardUpdatePayload,
  GarbageAttackPayload,
  PlayerFinishedPayload,
  GameResultPayload,
  QueuePositionPayload,
  PlayerLeftPayload,
  MatchCountdownPayload,
  MatchCountdownCancelledPayload,
  ReadyStatePayload,
  MyGameStatePayload,
  ConnectionStatus,
} from '../games/blockfall/types/battle.types';

const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

const GUEST_TOKEN_KEY = 'battleGuestToken';
const JOIN_INFO_KEY = 'battleJoinInfo';

// ── REST API 함수들 ──────────────────────────────────────

export interface BattleRoomStatus {
  activeRooms: number;
  activePlayers: number;
}

export async function getBattleRoomStatus(): Promise<BattleRoomStatus | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/blockfall-battle/rooms/status`);
    if (!res.ok) return null;
    return res.json() as Promise<BattleRoomStatus>;
  } catch {
    return null;
  }
}

export async function joinBattle(
  accessToken: string | null,
  guestToken?: string | null,
): Promise<BattleJoinResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_ORIGIN}/api/blockfall-battle/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: guestToken ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; roomId?: string };
    const err = new Error(body.error ?? '배틀 참가에 실패했습니다') as Error & {
      status: number;
      code?: string;
      roomId?: string;
    };
    err.status = res.status;
    err.code = body.error;
    err.roomId = body.roomId;
    throw err;
  }

  const data = (await res.json()) as BattleJoinResponse;

  // 게스트 토큰 저장
  if (data.guestToken) {
    sessionStorage.setItem(GUEST_TOKEN_KEY, data.guestToken);
  }

  return data;
}

// ── 방 목록 / 직접 생성 / 직접 입장 ─────────────────────────────────────────

export interface BattleWaitingRoomInfo {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  hostNickname: string | null;
  createdAt: string | null;
}

/** GET /api/blockfall-battle/rooms/waiting */
export async function getBattleWaitingRooms(): Promise<BattleWaitingRoomInfo[]> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/blockfall-battle/rooms/waiting`);
    if (!res.ok) return [];
    return res.json() as Promise<BattleWaitingRoomInfo[]>;
  } catch {
    return [];
  }
}

/** POST /api/blockfall-battle/create — 신규 방 직접 생성 */
export async function createBattle(
  accessToken: string | null,
  guestToken?: string | null,
): Promise<BattleJoinResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_ORIGIN}/api/blockfall-battle/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: guestToken ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; roomId?: string };
    const err = new Error(body.error ?? '방 생성에 실패했습니다') as Error & { status: number; code?: string; roomId?: string };
    err.status = res.status;
    err.code = body.error;
    err.roomId = body.roomId;
    throw err;
  }

  const data = (await res.json()) as BattleJoinResponse;
  if (data.guestToken) sessionStorage.setItem(GUEST_TOKEN_KEY, data.guestToken);
  return data;
}

/** POST /api/blockfall-battle/join/{roomId} — 특정 방 직접 입장 */
export async function joinBattleRoom(
  roomId: string,
  accessToken: string | null,
  guestToken?: string | null,
): Promise<BattleJoinResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_ORIGIN}/api/blockfall-battle/join/${encodeURIComponent(roomId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestToken: guestToken ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; roomId?: string };
    const err = new Error(body.error ?? '방 입장에 실패했습니다') as Error & { status: number; code?: string; roomId?: string };
    err.status = res.status;
    err.code = body.error;
    err.roomId = body.roomId;
    throw err;
  }

  const data = (await res.json()) as BattleJoinResponse;
  if (data.guestToken) sessionStorage.setItem(GUEST_TOKEN_KEY, data.guestToken);
  return data;
}

export async function getBattleRankings(): Promise<BattleRankingResponse> {
  const res = await fetch(`${API_ORIGIN}/api/blockfall-battle/rankings`);
  if (!res.ok) {
    throw new Error('랭킹 조회에 실패했습니다');
  }
  return (await res.json()) as BattleRankingResponse;
}

export function getStoredGuestToken(): string | null {
  return sessionStorage.getItem(GUEST_TOKEN_KEY);
}

export function clearGuestToken(): void {
  sessionStorage.removeItem(GUEST_TOKEN_KEY);
}

/** 매칭 성공 시 joinInfo를 sessionStorage에 저장 (리프레시 재연결용). */
export function saveJoinInfo(info: BattleJoinResponse): void {
  sessionStorage.setItem(JOIN_INFO_KEY, JSON.stringify(info));
}

/** 저장된 joinInfo 복원. 없거나 파싱 실패 시 null. */
export function getStoredJoinInfo(): BattleJoinResponse | null {
  const raw = sessionStorage.getItem(JOIN_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BattleJoinResponse;
  } catch {
    return null;
  }
}

/** 명시적 이탈 시 joinInfo + guestToken 모두 정리. */
export function clearJoinInfo(): void {
  sessionStorage.removeItem(JOIN_INFO_KEY);
  sessionStorage.removeItem(GUEST_TOKEN_KEY);
}

// ── useBattleWebSocket 훅 ────────────────────────────────

export interface BattleWebSocketState {
  roomState: RoomStatePayload | null;
  gameStarted: GameStartedPayload | null;
  boardUpdates: Map<string, BoardUpdatePayload>;
  garbagePending: number;
  playerFinished: Map<string, PlayerFinishedPayload>;
  playerLeft: PlayerLeftPayload | null;
  gameResult: GameResultPayload | null;
  queuePosition: QueuePositionPayload | null;
  countdown: number;
  readyState: ReadyStatePayload | null;
  myGameState: MyGameStatePayload | null;
  wsStatus: ConnectionStatus;
}

export interface UseBattleWebSocketReturn extends BattleWebSocketState {
  sendBoardState: (board: number[][], score: number, lines: number, level: number, combo: number) => void;
  sendComboAttack: (combo: number, targetPlayerId?: string | null) => void;
  sendPlayerFinished: () => void;
  sendLeave: () => void;
  sendPlayerReady: () => void;
}

export function useBattleWebSocket(
  roomId: string,
  playerId: string,
  authParam: string,
  isGuest: boolean,
  enabled: boolean,
): UseBattleWebSocketReturn {
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [gameStarted, setGameStarted] = useState<GameStartedPayload | null>(null);
  const [boardUpdates, setBoardUpdates] = useState<Map<string, BoardUpdatePayload>>(new Map());
  const [garbagePending, setGarbagePending] = useState(0);
  const [playerFinished, setPlayerFinished] = useState<Map<string, PlayerFinishedPayload>>(new Map());
  const [playerLeft, setPlayerLeft] = useState<PlayerLeftPayload | null>(null);
  const [gameResult, setGameResult] = useState<GameResultPayload | null>(null);
  const [queuePosition, setQueuePosition] = useState<QueuePositionPayload | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [readyState, setReadyState] = useState<ReadyStatePayload | null>(null);
  const [myGameState, setMyGameState] = useState<MyGameStatePayload | null>(null);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('connecting');

  const clientRef = useRef<BattleStompClientHandle | null>(null);

  const handleRoomState = useCallback((payload: RoomStatePayload) => {
    setRoomState(payload);
  }, []);

  const handleGameStarted = useCallback((payload: GameStartedPayload) => {
    setGameStarted(payload);
    setGarbagePending(0);
    setPlayerFinished(new Map());
    setGameResult(null);
    setCountdown(0);
    // 새 라운드 시작 — 이전 라운드의 본인 스냅샷 캐시 제거
    setMyGameState(null);
  }, []);

  const handleBoardUpdate = useCallback((payload: BoardUpdatePayload) => {
    setBoardUpdates((prev) => {
      const next = new Map(prev);
      next.set(payload.playerId, payload);
      return next;
    });
  }, []);

  const handleGarbageAttack = useCallback((payload: GarbageAttackPayload) => {
    if (payload.targetPlayerId === playerId) {
      setGarbagePending((prev) => Math.min(prev + payload.lines, 8));
    }
  }, [playerId]);

  const handlePlayerFinished = useCallback((payload: PlayerFinishedPayload) => {
    setPlayerFinished((prev) => {
      const next = new Map(prev);
      next.set(payload.playerId, payload);
      return next;
    });
  }, []);

  const handleGameResult = useCallback((payload: GameResultPayload) => {
    setGameResult(payload);
  }, []);

  const handleQueuePosition = useCallback((payload: QueuePositionPayload) => {
    setQueuePosition(payload);
  }, []);

  const handlePlayerLeft = useCallback((payload: PlayerLeftPayload) => {
    setPlayerLeft(payload);
  }, []);

  const handleMatchCountdown = useCallback((payload: MatchCountdownPayload) => {
    setCountdown(payload.secondsRemaining);
  }, []);

  const handleMatchCountdownCancelled = useCallback((_payload: MatchCountdownCancelledPayload) => {
    setCountdown(0);
  }, []);

  const handleReadyState = useCallback((payload: ReadyStatePayload) => {
    setReadyState(payload);
  }, []);

  const handleMyGameState = useCallback((payload: MyGameStatePayload) => {
    setMyGameState(payload);
  }, []);

  const handleError = useCallback((code: string, message: string) => {
    console.warn(`[BattleWS] Error ${code}: ${message}`);
  }, []);

  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setWsStatus(status);
  }, []);

  useEffect(() => {
    if (!enabled || !roomId || !playerId || !authParam) return;

    const handle = connectBattle(roomId, playerId, authParam, isGuest, {
      onRoomState: handleRoomState,
      onGameStarted: handleGameStarted,
      onBoardUpdate: handleBoardUpdate,
      onGarbageAttack: handleGarbageAttack,
      onPlayerFinished: handlePlayerFinished,
      onGameResult: handleGameResult,
      onQueuePosition: handleQueuePosition,
      onPlayerLeft: handlePlayerLeft,
      onMatchCountdown: handleMatchCountdown,
      onMatchCountdownCancelled: handleMatchCountdownCancelled,
      onReadyState: handleReadyState,
      onMyGameState: handleMyGameState,
      onError: handleError,
      onStatusChange: handleStatusChange,
    });

    clientRef.current = handle;

    return () => {
      handle.disconnect();
      clientRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, playerId, authParam, isGuest]);

  const sendBoardState = useCallback(
    (board: number[][], score: number, lines: number, level: number, combo: number) => {
      clientRef.current?.sendBoardState(board, score, lines, level, combo);
    },
    [],
  );

  const sendComboAttack = useCallback(
    (combo: number, targetPlayerId?: string | null) => {
      clientRef.current?.sendComboAttack(combo, targetPlayerId);
    },
    [],
  );

  const sendPlayerFinished = useCallback(() => {
    clientRef.current?.sendPlayerFinished();
  }, []);

  const sendLeave = useCallback(() => {
    clientRef.current?.sendLeave();
  }, []);

  const sendPlayerReady = useCallback(() => {
    clientRef.current?.sendPlayerReady();
  }, []);

  return {
    roomState,
    gameStarted,
    boardUpdates,
    garbagePending,
    playerFinished,
    playerLeft,
    gameResult,
    queuePosition,
    countdown,
    readyState,
    myGameState,
    wsStatus,
    sendBoardState,
    sendComboAttack,
    sendPlayerFinished,
    sendLeave,
    sendPlayerReady,
  };
}
