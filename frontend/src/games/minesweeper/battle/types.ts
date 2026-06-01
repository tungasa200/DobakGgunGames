export type BattlePhase = 'idle' | 'waiting' | 'ready' | 'playing' | 'finished' | 'disconnected';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE';

export type MbEventType =
  | 'MATCH_READY' | 'GAME_STARTED' | 'PROGRESS_UPDATE'
  | 'GAME_RESULT' | 'STATE_SNAPSHOT' | 'FIRST_CLICK_CONFIRMED'
  | 'OPPONENT_DISCONNECTED' | 'OPPONENT_RECONNECTED'
  | 'REMATCH_REQUESTED' | 'REMATCH_DECLINED'
  | 'ERROR';

export interface DesignatedCell { r: number; c: number; }
export interface PlayerInfo { playerId: string; nickname: string; isGuest: boolean; }

export interface MatchReadyPayload {
  roomId: string;
  designatedCell: DesignatedCell;
  players: PlayerInfo[];
  opponentNickname: string;
  firstClickTimeoutMs: number;
  rows: number;
  cols: number;
  totalSafeCells: number;
  difficulty: Difficulty;
}

export interface GameStartedPayload {
  roomId: string;
  playerId: string;
  adjMines: number[][];
  serverStartAt: string;
  serverStartAtMillis: number;
  rows: number;
  cols: number;
  totalSafeCells: number;
  difficulty: Difficulty;
}

export interface ProgressUpdatePayload {
  playerId: string;
  revealedCount: number;
  totalSafeCells: number;
  progressPercent: number;
}

export interface PlayerResult {
  playerId: string;
  nickname: string;
  outcome: 'WIN' | 'LOSE';
  elapsedMs: number;
  elapsedSeconds: number;
  endReason: string;
}

export interface GameResultPayload {
  roomId: string;
  winnerId: string;
  reason: string;
  results: PlayerResult[];
  finishedAt: string;
}

export interface ProgressInfo { revealedCount: number; progressPercent: number; }

export interface StateSnapshotPayload {
  roomId: string;
  roomStatus: string;
  players: PlayerInfo[];
  adjMines: number[][] | null;
  serverStartAtMillis: number | null;
  myFirstClickConfirmed: boolean;
  opponentFirstClickConfirmed: boolean;
  myProgress: ProgressInfo;
  opponentProgress: ProgressInfo;
  rows: number;
  cols: number;
  totalSafeCells: number;
  difficulty: Difficulty;
  designatedCell?: { r: number; c: number } | null;
}

export interface BattleState {
  phase: BattlePhase;
  roomId: string | null;
  myPlayerId: string | null;
  myNickname: string | null;
  opponentNickname: string | null;
  designatedCell: DesignatedCell | null;
  adjMines: number[][] | null;
  serverStartAtMillis: number | null;
  myFirstClickConfirmed: boolean;
  opponentFirstClickConfirmed: boolean;
  myProgress: ProgressInfo;
  opponentProgress: ProgressInfo;
  myElapsedMs: number;
  result: GameResultPayload | null;
  errorMessage: string | null;
  reconnecting: boolean;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  totalSafeCells: number;
  myRematchRequested: boolean;
  opponentRematchRequested: boolean;
}

export type BattleAction =
  | { type: 'JOIN_REQUESTED'; roomId: string; playerId: string; nickname: string }
  | { type: 'MATCH_READY'; payload: MatchReadyPayload; myPlayerId: string }
  | { type: 'FIRST_CLICK_SENT' }
  | { type: 'OPPONENT_FIRST_CLICK_CONFIRMED' }
  | { type: 'GAME_STARTED'; payload: GameStartedPayload }
  | { type: 'PROGRESS_UPDATE'; payload: ProgressUpdatePayload }
  | { type: 'GAME_RESULT'; payload: GameResultPayload }
  | { type: 'STATE_SNAPSHOT'; payload: StateSnapshotPayload; myPlayerId: string }
  | { type: 'OPPONENT_DISCONNECTED' }
  | { type: 'OPPONENT_RECONNECTED' }
  | { type: 'SET_ELAPSED'; elapsedMs: number }
  | { type: 'ERROR'; message: string }
  | { type: 'MY_REMATCH_SENT' }
  | { type: 'REMATCH_REQUESTED' }
  | { type: 'REMATCH_DECLINED' }
  | { type: 'RESET' };

// 셀 타입 (배틀 전용)
export type BattleCellMark = 'none' | 'flag' | 'question';

export interface BattleCell {
  isMine: boolean;
  isRevealed: boolean;
  mark: BattleCellMark;
  adjCount: number; // 인접 지뢰 수 (0~8), isMine인 경우 0
}
