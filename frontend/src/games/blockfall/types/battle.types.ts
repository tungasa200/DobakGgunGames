// ── 공통 타입 ──────────────────────────────────────────────

export type BattleRoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export type BattlePhase =
  | 'loading'
  | 'waiting'
  | 'countdown'
  | 'playing'
  | 'finished'
  | 'queued'
  | 'error';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

// ── WebSocket 이벤트 타입 ──────────────────────────────────

export type BattleEventType =
  | 'ROOM_STATE'
  | 'GAME_STARTED'
  | 'BOARD_UPDATE'
  | 'GARBAGE_ATTACK'
  | 'PLAYER_FINISHED'
  | 'GAME_RESULT'
  | 'QUEUE_POSITION'
  | 'PLAYER_LEFT'
  | 'MATCH_COUNTDOWN'
  | 'MATCH_COUNTDOWN_CANCELLED'
  | 'READY_STATE'
  | 'MY_GAME_STATE'
  | 'ERROR';

export interface BattleWsMessage<T = unknown> {
  type: BattleEventType;
  timestamp: string;
  payload: T;
}

// ── 플레이어 정보 ─────────────────────────────────────────

export interface BattlePlayer {
  id: string;
  nickname: string;
  isGuest: boolean;
}

// ── 서버 → 클라이언트 페이로드 ───────────────────────────

export interface RoomStatePayload {
  roomId: string;
  status: BattleRoomStatus;
  players: BattlePlayer[];
  queueCount: number;
}

export interface GameStartedPayload {
  roomId: string;
  players: BattlePlayer[];
  startAt: string;
}

export interface BoardUpdatePayload {
  playerId: string;
  board: number[][];
  score: number;
  lines: number;
  level: number;
}

export interface GarbageAttackPayload {
  targetPlayerId: string;
  lines: number;
  fromPlayerId: string;
}

export interface PlayerFinishedPayload {
  playerId: string;
  rank: number;
  score: number;
}

export interface BattleResultEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  isGuest: boolean;
}

export interface TopRankingEntry {
  rank: number;
  nickname: string;
  winCount: number;
}

export interface GameResultPayload {
  roomId: string;
  results: BattleResultEntry[];
  topRankings: TopRankingEntry[];
}

export interface QueuePositionPayload {
  position: number;
  totalInQueue: number;
}

export interface PlayerLeftPayload {
  playerId: string;
  nickname: string;
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

export interface BattleErrorPayload {
  type: 'ERROR';
  code: string;
  message: string;
}

// ── REST API 타입 ─────────────────────────────────────────

export interface BattleJoinRequest {
  guestToken?: string | null;
}

export interface BattleJoinResponse {
  roomId: string;
  status: BattleRoomStatus;
  playerCount: number;
  maxPlayers: number;
  queuePosition: number | null;
  isGuest: boolean;
  guestToken: string | null;
  playerId: string;
}

export interface BattleRankingEntry {
  rank: number;
  userId: number;
  nickname: string;
  winCount: number;
  totalGames: number;
  lastPlayedAt: string;
}

export interface BattleRankingResponse {
  topRankings: BattleRankingEntry[];
}

// ── 에러 타입 ─────────────────────────────────────────────

export interface BattleAlreadyInRoomError {
  error: 'ALREADY_IN_ROOM';
  roomId: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}

export interface ReadyStatePayload {
  readyCount: number;
  totalCount: number;
}

/**
 * MY_GAME_STATE — 새로고침/재연결한 본인에게만 도착하는 보드 스냅샷.
 * 서버가 200ms 주기로 캐싱한 마지막 BOARD_UPDATE 값.
 */
export interface MyGameStatePayload {
  playerId: string;
  board: number[][];
  score: number;
  lines: number;
  level: number;
  combo: number;
}

// ── 클라이언트 측 보드 상태 ───────────────────────────────

export interface PlayerBoardState {
  playerId: string;
  nickname: string;
  isGuest: boolean;
  board: number[][];
  score: number;
  lines: number;
  level: number;
  isEliminated: boolean;
  rank?: number;
}
