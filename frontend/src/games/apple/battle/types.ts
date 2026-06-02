export type AbBattlePhase = 'idle' | 'waiting' | 'matched' | 'countdown' | 'playing' | 'finished' | 'disconnected';

export type AbEventType =
  | 'MATCH_READY' | 'GAME_STARTED' | 'APPLE_REMOVED'
  | 'GAME_RESULT' | 'STATE_SNAPSHOT'
  | 'OPPONENT_DISCONNECTED' | 'OPPONENT_RECONNECTED'
  | 'REMATCH_REQUESTED' | 'REMATCH_DECLINED'
  | 'ERROR';

export interface AbPlayerInfo {
  playerId: string;
  nickname: string;
  isGuest: boolean;
}

export interface MatchReadyPayload {
  players: AbPlayerInfo[];
}

export interface GameStartedPayload {
  board: number[][];
  startedAt: string; // ISO8601
  durationMs: number; // 120000
}

export interface AppleRemovedPayload {
  playerId: string;
  cells: [number, number][]; // [[r, c], ...]
  scores: Record<string, number>; // { [playerId]: score }
}

export interface GameResultPayload {
  winnerId: string | null;
  scores: Record<string, number>;
  draw: boolean;
  reason: 'TIME_UP' | 'BOARD_CLEARED' | 'OPPONENT_LEFT';
}

export interface StateSnapshotPayload {
  status: string;
  board: (number | null)[][];
  scores: Record<string, number>;
  players: AbPlayerInfo[];
  gameStartedAt: string | null;
  gameElapsedMs: number | null;
}

export interface AbBattleState {
  phase: AbBattlePhase;
  roomId: string | null;
  myPlayerId: string | null;
  myNickname: string | null;
  opponentInfo: AbPlayerInfo | null;
  board: (number | null)[][] | null; // 공유 보드
  myScore: number;
  opponentScore: number;
  gameStartedAt: number | null; // ms timestamp
  result: GameResultPayload | null;
  errorMessage: string | null;
  reconnecting: boolean;
  myRematchRequested: boolean;
  opponentRematchRequested: boolean;
  countdownSec: number; // 3, 2, 1, 0
}

export type AbBattleAction =
  | { type: 'JOIN_REQUESTED'; roomId: string; playerId: string; nickname: string }
  | { type: 'MATCH_READY'; payload: MatchReadyPayload; myPlayerId: string }
  | { type: 'GAME_STARTED'; payload: GameStartedPayload }
  | { type: 'APPLE_REMOVED'; payload: AppleRemovedPayload; myPlayerId: string }
  | { type: 'GAME_RESULT'; payload: GameResultPayload }
  | { type: 'STATE_SNAPSHOT'; payload: StateSnapshotPayload; myPlayerId: string }
  | { type: 'OPPONENT_DISCONNECTED' }
  | { type: 'OPPONENT_RECONNECTED' }
  | { type: 'COUNTDOWN_TICK' }
  | { type: 'START_PLAYING' }
  | { type: 'ERROR'; message: string }
  | { type: 'MY_REMATCH_SENT' }
  | { type: 'REMATCH_REQUESTED' }
  | { type: 'REMATCH_DECLINED' }
  | { type: 'RESET' };
