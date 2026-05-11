export type DiceType = 'D6' | 'D8';

export type ScoreKey =
  | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
  | 'sevens' | 'eights'
  | 'choice' | 'fourOfAKind' | 'fullHouse' | 'littleStraight' | 'bigStraight' | 'yacht';

// D6 전용 키 (12개)
export const SCORE_KEYS_D6: ScoreKey[] = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'choice', 'fourOfAKind', 'fullHouse', 'littleStraight', 'bigStraight', 'yacht',
];

// D8 전용 키 (14개)
export const SCORE_KEYS_D8: ScoreKey[] = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights',
  'choice', 'fourOfAKind', 'fullHouse', 'littleStraight', 'bigStraight', 'yacht',
];

export const SCORE_KEYS_BY_MODE: Record<DiceType, ScoreKey[]> = {
  D6: SCORE_KEYS_D6,
  D8: SCORE_KEYS_D8,
};

// 하위 호환: 기존 코드가 SCORE_KEYS를 참조하는 경우 D6 기본값
export const SCORE_KEYS: ScoreKey[] = SCORE_KEYS_D6;

export const UPPER_SCORE_KEYS_D6: ScoreKey[] = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
];

export const UPPER_SCORE_KEYS_D8: ScoreKey[] = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights',
];

export const UPPER_SCORE_KEYS_BY_MODE: Record<DiceType, ScoreKey[]> = {
  D6: UPPER_SCORE_KEYS_D6,
  D8: UPPER_SCORE_KEYS_D8,
};

// 하위 호환
export const UPPER_SCORE_KEYS: ScoreKey[] = UPPER_SCORE_KEYS_D6;

export const LOWER_SCORE_KEYS: ScoreKey[] = [
  'choice', 'fourOfAKind', 'fullHouse', 'littleStraight', 'bigStraight', 'yacht',
];

export const UPPER_BONUS_THRESHOLD_BY_MODE: Record<DiceType, number> = {
  D6: 63,
  D8: 103, // 희생 전략 포함 D6 동등 난이도 (z≈1.80) 기준 하향 조정
};

/**
 * 턴당 최대 굴림 횟수.
 * D8는 면당 적중률(1/8)이 D6(1/6) 대비 낮아 1회 더 부여.
 * 1주사위 적중률: D6 3롤 ≈ 42.1% / D8 4롤 ≈ 41.4% — 거의 동등.
 */
export const MAX_ROLLS_BY_MODE: Record<DiceType, number> = {
  D6: 3,
  D8: 4,
};

export const SCORE_LABELS: Record<ScoreKey, string> = {
  ones: '원',
  twos: '투',
  threes: '쓰리',
  fours: '포',
  fives: '파이브',
  sixes: '식스',
  sevens: '세븐',
  eights: '에이트',
  choice: '초이스',
  fourOfAKind: '포카인드',
  fullHouse: '풀하우스',
  littleStraight: '리틀 스트레이트',
  bigStraight: '빅 스트레이트',
  yacht: '야추',
};

// 모바일 약자
export const SCORE_LABELS_SHORT: Record<ScoreKey, string> = {
  ones: '1',
  twos: '2',
  threes: '3',
  fours: '4',
  fives: '5',
  sixes: '6',
  sevens: '7',
  eights: '8',
  choice: 'Choice',
  fourOfAKind: '4-Kind',
  fullHouse: 'F.House',
  littleStraight: 'L.Str',
  bigStraight: 'B.Str',
  yacht: 'Yacht',
};

// 서버 scoreKey enum 값 → 내부 ScoreKey 매핑
export const SERVER_KEY_MAP: Record<string, ScoreKey> = {
  ONES: 'ones',
  TWOS: 'twos',
  THREES: 'threes',
  FOURS: 'fours',
  FIVES: 'fives',
  SIXES: 'sixes',
  SEVENS: 'sevens',
  EIGHTS: 'eights',
  CHOICE: 'choice',
  FOUR_OF_A_KIND: 'fourOfAKind',
  FULL_HOUSE: 'fullHouse',
  LITTLE_STRAIGHT: 'littleStraight',
  BIG_STRAIGHT: 'bigStraight',
  YACHT: 'yacht',
};

// 내부 ScoreKey → 서버 enum 값
export const CLIENT_KEY_MAP: Record<ScoreKey, string> = {
  ones: 'ONES',
  twos: 'TWOS',
  threes: 'THREES',
  fours: 'FOURS',
  fives: 'FIVES',
  sixes: 'SIXES',
  sevens: 'SEVENS',
  eights: 'EIGHTS',
  choice: 'CHOICE',
  fourOfAKind: 'FOUR_OF_A_KIND',
  fullHouse: 'FULL_HOUSE',
  littleStraight: 'LITTLE_STRAIGHT',
  bigStraight: 'BIG_STRAIGHT',
  yacht: 'YACHT',
};

export interface Participant {
  userId: number;
  nickname: string;
  profileImageUrl?: string | null;
  ready: boolean;
  isHost: boolean;
  /** 게임 중 합류한 관전자. WAITING/FINISHED에서는 false. */
  isSpectator?: boolean;
  /** 재접속 유예 중 (게임 진행 중 연결 끊김) */
  isReconnecting?: boolean;
}

export interface PlayerScore {
  userId: number;
  scores: Partial<Record<ScoreKey, number>>;
  upperTotal: number;
  bonusEarned: boolean;
  grandTotal: number;
}

export type YachtPhase =
  | 'idle'
  | 'matching'
  | 'connecting'
  | 'waiting'
  | 'playing'
  | 'result'
  | 'error';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export type WsEventType =
  | 'ROOM_STATE'
  | 'GAME_STARTED'
  | 'TURN_STATE'
  | 'ROLL_RESULT'
  | 'SCORE_RECORDED'
  | 'TURN_CHANGED'
  | 'GAME_OVER'
  | 'PLAYER_LEFT'
  | 'ROOM_CLOSED'
  | 'MATCH_COUNTDOWN'
  | 'MATCH_COUNTDOWN_CANCELLED'
  | 'PLAYER_RECONNECTING'
  | 'PLAYER_RETURNED'
  | 'KICK_VOTE'
  | 'CHAT';

export interface WsMessage<T = unknown> {
  type: WsEventType;
  timestamp: string;
  payload: T;
}

export interface RoomStatePayload {
  roomId: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  diceType?: DiceType;
  hostUserId: number;
  maxPlayers: number;
  participants: Participant[];
}

export interface GameStartedPayload {
  roomId: string;
  diceType?: DiceType;
  turnOrder: number[];
  currentTurnUserId: number;
  rollsLeft: number;
  totalRounds: number;
}

export interface TurnStatePayload {
  roomId: string;
  currentTurnUserId: number;
  rollsLeft: number;
  dice: number[] | null;
  keptIndices: number[];
  turnDeadlineAt?: string;
}

export interface RollResultPayload {
  currentTurnUserId: number;
  dice: number[];
  keptIndices: number[];
  rollsLeft: number;
}

export interface ScoreRecordedPayload {
  userId: number;
  scoreKey: string; // 서버에서 UPPER_CASE로 옴
  score: number;
  upperTotal: number;
  bonusEarned: boolean;
  grandTotal: number;
}

export interface TurnChangedPayload {
  previousTurnUserId: number;
  currentTurnUserId: number;
  rollsLeft: number;
  roundNum: number;
}

export interface RankEntry {
  rank: number;
  userId: number;
  nickname: string;
  grandTotal: number;
  isWinner: boolean;
}

export interface GameOverPayload {
  roomId: string;
  rankings: RankEntry[];
}

export interface PlayerLeftPayload {
  roomId: string;
  userId: number;
  nickname: string;
  reason: 'LEAVE' | 'DISCONNECT' | 'KICK';
}

export interface RoomClosedPayload {
  roomId: string;
  reason: 'EMPTY' | 'INSUFFICIENT_PLAYERS';
}

export interface PlayerReconnectingPayload {
  userId: number;
  nickname: string;
}

export interface PlayerReturnedPayload {
  userId: number;
  nickname: string;
}

export interface KickVotePayload {
  targetUserId: number;
  targetNickname: string;
  voteCount: number;
  requiredCount: number;
  /** null=진행 중, true=통과(퇴출), false=미통과 */
  passed: boolean | null;
}

export interface WsErrorPayload {
  code: string;
  message?: string;
}

export interface ChatPayload {
  userId: number;
  nickname: string;
  profileImageUrl?: string | null;
  message: string;
}

// REST API 응답 타입
export interface YachtRankingEntry {
  rank: number;
  userId: number;
  nickname: string;
  winCount: number;
  totalScore: number;
  playedCount: number;
}

/** d8 도입 이후 모드별 분리 응답 */
export interface YachtRankingResponse {
  D6: YachtRankingEntry[];
  D8: YachtRankingEntry[];
}

export interface YachtMatchResponse {
  roomId: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  diceType: DiceType;
  playerCount: number;
  maxPlayers: number;
  created: boolean;
  /** 진행 중인 방에 관전자로 입장한 경우 true */
  joinedAsSpectator?: boolean;
}

/** 서버 스냅샷의 점수판 항목 — 키는 서버 enum(UPPER_CASE), 미기록은 null */
export interface YachtScoreboardSnapshot {
  userId: number;
  scores: Record<string, number | null>;
  upperTotal: number;
  bonusEarned: boolean;
  grandTotal: number;
}

export interface YachtRoomResponse {
  roomId: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  diceType: DiceType;
  hostUserId: number;
  maxPlayers: number;
  currentTurnUserId?: number | null;
  turnOrder?: number[] | null;
  roundIndex?: number;
  participants: Participant[];
  scoreboard?: YachtScoreboardSnapshot[];
  currentDice?: number[];
  currentKeptIndices?: number[];
  currentRollsLeft?: number;
}

/** GET /api/yacht/rooms/status 응답 — 모드별 분리 */
export interface YachtRoomStatusByMode {
  D6: { activeRooms: number; activePlayers: number } | null;
  D8: { activeRooms: number; activePlayers: number } | null;
}
