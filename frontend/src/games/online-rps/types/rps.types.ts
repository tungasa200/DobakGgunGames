// ── 공통 타입 ──────────────────────────────────────────────

export type RpsChoice = 'ROCK' | 'PAPER' | 'SCISSORS';
export type RpsResult = 'WIN' | 'LOSS' | 'DRAW';
export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export type RpsPhase =
  | 'idle'
  | 'matching'
  | 'connecting'
  | 'waiting'
  | 'countdown'
  | 'playing'
  | 'result'
  | 'error';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

// ── 이벤트 타입 ─────────────────────────────────────────────

export type RpsEventType =
  | 'ROOM_STATE'
  | 'MATCH_COUNTDOWN'
  | 'MATCH_COUNTDOWN_CANCELLED'
  | 'GAME_STARTED'
  | 'ROUND_RESULT'
  | 'PLAYER_LEFT'
  | 'HOST_CHANGED'
  | 'ROOM_CLOSED';

export interface RpsWsMessage<T = unknown> {
  type: RpsEventType;
  timestamp: string;
  payload: T;
}

// ── 페이로드 타입 ────────────────────────────────────────────

export interface RpsParticipant {
  userId: number;
  nickname: string;
  isHost: boolean;
  winRate?: number | null;
}

export interface RoomStatePayload {
  roomId: string;
  name: string;
  status: RoomStatus;
  hostUserId: number;
  maxPlayers: number;
  participants: RpsParticipant[];
}

export interface MatchCountdownPayload {
  roomId: string;
  secondsRemaining: number;
  startAt: string;
}

export interface MatchCountdownCancelledPayload {
  roomId: string;
  reason: string;
}

export interface GameStartedPayload {
  roomId: string;
  roundNum: number;
  deadlineAt: string;
  timeoutSeconds: number;
  participantUserIds: number[];
}

export interface RoundPlayerResult {
  userId: number;
  nickname: string;
  choice: RpsChoice;
  autoPicked: boolean;
  result: RpsResult;
  winRate?: number | null;
}

export interface RoundResultPayload {
  roomId: string;
  roundNum: number;
  results: RoundPlayerResult[];
}

export interface PlayerLeftPayload {
  roomId: string;
  userId: number;
  nickname: string;
  reason: 'LEAVE' | 'DISCONNECT' | 'KICKED';
}

export interface HostChangedPayload {
  roomId: string;
  newHostUserId: number;
  newHostNickname: string;
}

export interface RoomClosedPayload {
  roomId: string;
  reason: 'EMPTY' | 'HOST_LEFT_ALONE';
}

// ── REST API 타입 ────────────────────────────────────────────

export interface MatchResponse {
  roomId: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  created: boolean;
  guestToken?: string; // 비로그인 사용자에게만 반환
}

export interface AlreadyInRoomError {
  error: 'ALREADY_IN_ROOM';
  roomId: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}
