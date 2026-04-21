/**
 * BlockfallInsaneBoard — 블록폴 인세인 모드 (Full Implementation)
 * STEP 1: 페이지 신설 ✓
 * STEP 2: 이중 레이어 엔진 (arena + particles) ✓
 * STEP 3: Sand 물리 시뮬레이션 + SAND_BURST ✓
 * STEP 4: 이벤트 프레임워크 ✓
 * STEP 5: 모든 이벤트 구현 ✓
 * STEP 6: 확장 블록 ✓
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { rankingsApi, startSession } from '../../api/rankings';
import { containsProfanity } from '../../utils/profanity';
import { useAuth } from '../../context/AuthContext';
import { useAdminTest } from '../../context/AdminTestContext';
import styles from './BlockfallInsaneBoard.module.css';

// ===== 타입 =====
type Matrix = number[][];
interface Player { pos: { x: number; y: number }; matrix: Matrix | null }
type Level = 'easy' | 'normal' | 'hard';
type GameStatus = 'idle' | 'playing' | 'paused' | 'over';

interface SandParticle {
  type: 'sand';
  x: number;       // 정수 (셀 단위)
  y: number;
  vx: number;      // 0 기본, VORTEX/BOUNCE_WALLS에서 사용
  vy: number;
  colorIndex: number;
  state: 'moving' | 'settled';
}

interface ShatterParticle {
  type: 'shatter';
  x: number;       // 실수 (서브셀)
  y: number;
  vx: number;
  vy: number;
  colorIndex: number;
  bounces: number;
  state: 'flying' | 'settled';
}

type Particle = SandParticle | ShatterParticle;

type EventId =
  | 'FLIP_H' | 'FLIP_V' | 'DARK_SPOTLIGHT' | 'INVISIBLE_PIECE' | 'COLOR_GRAY'
  | 'SAND_BURST' | 'FULL_SAND' | 'LIQUID_FLOOD' | 'EXPLODE' | 'VORTEX'
  | 'BOUNCE_WALLS' | 'FLOOR_DROP'
  | 'CONTROL_FREEZE' | 'PIECE_SHATTER' | 'RANDOM_LOCK' | 'BOARD_TILT' | 'SPIN_BLOCK'
  | 'BOARD_EXPAND';

interface EventDef {
  id: EventId;
  name: string;
  emoji: string;
  duration: number;   // ms. 0 = 즉발
  weight: number;
  mobileExcluded?: boolean;
}

// ===== 상수 =====
const INIT_BOARD_W = 11;
const INIT_BOARD_H = 21;
const CELL = 30;

const SAND_TICK_INTERVAL = 60;   // ms — sand 물리 틱 간격
const SAND_BATCH_SIZE    = 25;   // 틱당 최대 처리 파티클 수 (FULL_SAND 프레임 드랍 방지)
const SHATTER_GRAVITY    = 0.06; // cells/frame²
const SHATTER_DAMPING    = 0.50;
const SHATTER_MIN_SPEED  = 0.04;

// 인세인 모드 색상
const COLORS: (string | null)[] = [
  null,
  '#ff9f0a', // 1: T
  '#ff6b9d', // 2: O
  '#30d158', // 3: L
  '#0a84ff', // 4: J
  '#ff375f', // 5: I
  '#ffd60a', // 6: S
  '#bf5af2', // 7: Z
  '#67e8f9', // 8: WIDE-I
  '#ff6b35', // 9: DOT
  '#4ecdc4', // 10: DOMINO
  '#a8ff78', // 11: MINI-L
  '#ffd6e0', // 12: X
  '#c3a6ff', // 13: BIG-O
  '#ffe66d', // 14: THUMBS-UP
  '#ff8b94', // 15: MIDDLE
];

const DROP_SPEEDS: Record<string, number[]> = {
  easy:   [800, 690, 600, 520, 450, 390, 340, 300, 265, 235, 210],
  normal: [400, 340, 290, 248, 213, 183, 158, 137, 119, 104,  91],
  hard:   [180, 150, 125, 105,  88,  74,  63,  53,  45,  38,  32],
};

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = { full: [400, 800, 1200, 1600], mini: [100, 200, 400] };
const T_FRONT_CORNERS = [[0, 1], [1, 3], [2, 3], [0, 2]];
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;

// ===== 이벤트 풀 =====
const EVENT_POOL: EventDef[] = [
  { id: 'FLIP_H',          name: '좌우 반전',        emoji: '↔️',  duration: 8000,  weight: 1,   mobileExcluded: true },
  { id: 'FLIP_V',          name: '상하 반전',        emoji: '↕️',  duration: 6000,  weight: 1,   mobileExcluded: true },
  { id: 'DARK_SPOTLIGHT',  name: '암전',             emoji: '🔦',  duration: 10000, weight: 1 },
  { id: 'INVISIBLE_PIECE', name: '투명 블록',        emoji: '👻',  duration: 6000,  weight: 1 },
  { id: 'COLOR_GRAY',      name: '색맹 모드',        emoji: '🩶',  duration: 8000,  weight: 1 },
  { id: 'SAND_BURST',      name: '모래 폭발',        emoji: '💨',  duration: 0,     weight: 1 },
  { id: 'FULL_SAND',       name: '대혼돈',           emoji: '🌪️', duration: 0,     weight: 0.5 },
  { id: 'LIQUID_FLOOD',    name: '모래 홍수',        emoji: '🌊',  duration: 0,     weight: 1 },
  { id: 'EXPLODE',         name: '폭발',             emoji: '💥',  duration: 0,     weight: 1 },
  { id: 'VORTEX',          name: '소용돌이',         emoji: '🌀',  duration: 8000,  weight: 1 },
  { id: 'BOUNCE_WALLS',    name: '탄성 벽',          emoji: '🏓',  duration: 8000,  weight: 1 },
  { id: 'FLOOR_DROP',      name: '바닥 붕괴',        emoji: '🕳️', duration: 0,     weight: 1,   mobileExcluded: true },
  { id: 'CONTROL_FREEZE',  name: '조작 마비',        emoji: '🥶',  duration: 2000,  weight: 1 },
  { id: 'PIECE_SHATTER',   name: '블록 분해',        emoji: '🧨',  duration: 0,     weight: 1 },
  { id: 'RANDOM_LOCK',     name: '강제 고정',        emoji: '🔒',  duration: 0,     weight: 1 },
  { id: 'BOARD_TILT',      name: '기울기',           emoji: '📐',  duration: 6000,  weight: 1 },
  { id: 'SPIN_BLOCK',      name: '자동 회전',        emoji: '🌀',  duration: -1,    weight: 1 },  // -1 = piece 낙하 종료까지
  { id: 'BOARD_EXPAND',    name: '보드 확장',        emoji: '📏',  duration: 0,     weight: 0.7 },
];

// ===== 헬퍼 =====
function createMatrix(w: number, h: number): Matrix {
  return Array.from({ length: h }, () => new Array(w).fill(0));
}

// ===== 피스 정의 =====
function createStandardPiece(type: string): Matrix {
  const P: Record<string, Matrix> = {
    T: [[0,1,0],[1,1,1],[0,0,0]],
    O: [[2,2],[2,2]],
    L: [[0,3,0],[0,3,0],[0,3,3]],
    J: [[0,4,0],[0,4,0],[4,4,0]],
    I: [[0,5,0,0],[0,5,0,0],[0,5,0,0],[0,5,0,0]],
    S: [[0,6,6],[6,6,0],[0,0,0]],
    Z: [[7,7,0],[0,7,7],[0,0,0]],
  };
  return P[type].map(row => [...row]);
}

function createInsanePiece(type: string): Matrix {
  const P: Record<string, Matrix> = {
    WIDE_I:     [[8,8,8,8,8,8]],
    DOT:        [[9]],
    DOMINO:     [[10,10]],
    MINI_L:     [[11,0],[11,11]],
    X:          [[0,12,0],[12,12,12],[0,12,0]],
    BIG_O:      [[13,13,13],[13,13,13]],
    THUMBS_UP:  [[0,0,14],[0,0,14],[14,14,14],[14,14,14]],
    MIDDLE:     [[0,15,0],[0,15,0],[15,15,15],[15,15,15]],
  };
  return P[type].map(row => [...row]);
}

type PieceEntry = { matrix: Matrix; weight: number };
const PIECE_POOL: PieceEntry[] = [
  ...['T','O','L','J','I','S','Z'].map(t => ({ matrix: createStandardPiece(t), weight: 1 })),
  { matrix: createInsanePiece('WIDE_I'),    weight: 1.5 },
  { matrix: createInsanePiece('DOT'),       weight: 1.5 },
  { matrix: createInsanePiece('DOMINO'),    weight: 1.5 },
  { matrix: createInsanePiece('MINI_L'),    weight: 1.5 },
  { matrix: createInsanePiece('X'),         weight: 1.5 },
  { matrix: createInsanePiece('BIG_O'),     weight: 1.5 },
  { matrix: createInsanePiece('THUMBS_UP'), weight: 1.5 },
  { matrix: createInsanePiece('MIDDLE'),    weight: 1.5 },
];
const TOTAL_PIECE_WEIGHT = PIECE_POOL.reduce((s, p) => s + p.weight, 0);

function randomInsanePiece(): Matrix {
  let r = Math.random() * TOTAL_PIECE_WEIGHT;
  for (const entry of PIECE_POOL) {
    r -= entry.weight;
    if (r <= 0) return entry.matrix.map(row => [...row]);
  }
  return PIECE_POOL[0].matrix.map(row => [...row]);
}

function rotateMatrix(matrix: Matrix, dir: number) {
  for (let y = 0; y < matrix.length; y++)
    for (let x = 0; x < y; x++)
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

// 이벤트 간격 계산 (레벨별)
function getEventInterval(level: number): number {
  if (level >= 11) return 0; // 매 lock 시 발동
  return Math.max(1000, 30000 - (level - 1) * 2600);
}

type RankEntry = { id: number; name: string; score: number; gameLevel?: number; createdAt: string };

// ===== 컴포넌트 =====
export default function BlockfallInsaneBoard() {
  const { user } = useAuth();

  // ===== 캔버스 refs =====
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef  = useRef<HTMLCanvasElement>(null);
  const holdRef  = useRef<HTMLCanvasElement>(null);
  const timerBarRef = useRef<HTMLDivElement>(null);

  // ===== 보드 크기 (동적) =====
  const boardW = useRef(INIT_BOARD_W);
  const boardH = useRef(INIT_BOARD_H);

  // ===== 게임 상태 refs =====
  const arena       = useRef<Matrix>(createMatrix(INIT_BOARD_W, INIT_BOARD_H));
  const particles   = useRef<Particle[]>([]);
  const player      = useRef<Player>({ pos: { x: 0, y: 0 }, matrix: null });
  const nextPiece   = useRef<Matrix | null>(null);
  const holdPiece   = useRef<Matrix | null>(null);
  const holdUsed    = useRef(false);
  const scoreRef    = useRef(0);
  const gameLevelRef = useRef(1);
  const linesRef    = useRef(0);
  const comboCount  = useRef(0);
  const comboText   = useRef('');
  const comboAlpha  = useRef(0);
  const tspinText   = useRef('');
  const tspinAlpha  = useRef(0);
  const dropCounter = useRef(0);
  const dropInterval = useRef(400);
  const lastTime    = useRef(0);
  const animId      = useRef<number | null>(null);
  const isLanding   = useRef(false);
  const lockCounter = useRef(0);
  const lockResets  = useRef(0);
  const lastActionRot = useRef(false);
  const tPieceRot   = useRef(0);
  const isPieceT    = useRef(false);
  const holdPieceIsT = useRef(false);
  const holdPieceRot = useRef(0);
  const currentLevelRef = useRef<Level>('normal');

  // Sand 물리 틱 타이머
  const sandTickCounter = useRef(0);

  // ===== 이벤트 시스템 refs =====
  const activeEventId   = useRef<EventId | null>(null);
  const activeEventDur  = useRef(0);   // 지속 이벤트 남은 시간(ms)
  const eventCooldown   = useRef(30000); // 다음 이벤트까지 대기 시간

  // 시각 이벤트 플래그
  const evFlipH         = useRef(false);
  const evFlipV         = useRef(false);
  const evDarkSpot      = useRef(false);
  const evInvisible     = useRef(false);
  const evColorGray     = useRef(false);
  // 물리/방해 이벤트 플래그
  const evSandBurst     = useRef(false);  // 다음 lock 시 sand로 변환
  const evVortex        = useRef(false);
  const evBounceWalls   = useRef(false);
  const evControlFreeze = useRef(false);
  const evSpinBlock     = useRef(false);
  const evSpinTimer     = useRef(0);

  // 모바일 판정 (게임 시작 시 1회)
  const isMobileRef = useRef(navigator.maxTouchPoints > 0);

  // 세션
  const sessionIdRef      = useRef('');
  const sessionFailedRef  = useRef(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  // ===== React 상태 =====
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [score, setScore]       = useState(0);
  const [gameLevel, setGameLevel] = useState(1);
  const [lines, setLines]       = useState(0);
  const [combo, setCombo]       = useState(0);
  const [difficulty, setDifficulty] = useState<Level>('normal');
  const [eventBanner, setEventBanner] = useState<{ name: string; emoji: string } | null>(null);

  // 랭킹
  const [rankLevel, setRankLevel]     = useState<Level>('normal');
  const [rankings, setRankings]       = useState<RankEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [alltimeBest, setAlltimeBest] = useState<RankEntry | null>(null);
  const [showRules, setShowRules]     = useState(false);

  // 모달
  const [showDebug, setShowDebug]       = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [playerName, setPlayerName]     = useState('');
  const [submitState, setSubmitState]   = useState<'idle' | 'loading' | 'error'>('idle');
  const [nameBanned, setNameBanned]     = useState(false);

  useEffect(() => {
    if (modalOpen) setPlayerName(user?.nickname ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  // ===== 파티클 헬퍼 =====
  function hasSettledAt(x: number, y: number): boolean {
    const ix = Math.round(x), iy = Math.round(y);
    return particles.current.some(p => p.state === 'settled' && Math.round(p.x) === ix && Math.round(p.y) === iy);
  }

  function isEmptyForSand(x: number, y: number): boolean {
    if (x < 0 || x >= boardW.current || y < 0 || y >= boardH.current) return false;
    if (arena.current[y]?.[x] !== 0) return false;
    if (hasSettledAt(x, y)) return false;
    return true;
  }

  // settled 파티클이 지지 없이 떠 있으면 다시 moving으로 전환
  function recheckSettled() {
    for (const p of particles.current) {
      if (p.state !== 'settled') continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const by = y + 1;
      if (by >= boardH.current) continue;
      const solidBelow = (arena.current[by]?.[x] ?? 0) !== 0;
      if (!solidBelow && !hasSettledAt(x, by)) {
        if (p.type === 'sand') { p.state = 'moving'; p.vy = 0; }
        else if (p.type === 'shatter') { p.state = 'flying'; }
      }
    }
  }

  // ===== 충돌 판정 (낙하 피스 기준) =====
  function collide(pos: { x: number; y: number }, matrix: Matrix): boolean {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] === 0) continue;
        const nx = x + pos.x, ny = y + pos.y;
        if (nx < 0 || nx >= boardW.current || ny >= boardH.current) return true;
        if (ny < 0) continue;
        if ((arena.current[ny]?.[nx] ?? 0) !== 0) return true;
        if (hasSettledAt(nx, ny)) return true;
      }
    }
    return false;
  }

  function collidePlayer(): boolean {
    return collide(player.current.pos, player.current.matrix!);
  }

  function isOnGround(): boolean {
    return collide({ x: player.current.pos.x, y: player.current.pos.y + 1 }, player.current.matrix!);
  }

  // ===== 라인 클리어 판정 =====
  function isRowFull(y: number): boolean {
    for (let x = 0; x < boardW.current; x++) {
      if ((arena.current[y]?.[x] ?? 0) === 0 && !hasSettledAt(x, y)) return false;
    }
    return true;
  }

  // ===== 보조 =====
  function isCornerBlocked(bx: number, by: number): boolean {
    if (bx < 0 || bx >= boardW.current || by >= boardH.current) return true;
    if (by < 0) return false;
    return (arena.current[by]?.[bx] ?? 0) !== 0;
  }

  function detectTspin(): 'full' | 'mini' | null {
    if (!isPieceT.current || !lastActionRot.current) return null;
    const px = player.current.pos.x, py = player.current.pos.y;
    const corners = [[px,py],[px+2,py],[px,py+2],[px+2,py+2]];
    const blocked = corners.map(([cx,cy]) => isCornerBlocked(cx, cy));
    if (blocked.filter(Boolean).length < 3) return null;
    const front = T_FRONT_CORNERS[tPieceRot.current];
    return front.filter(i => blocked[i]).length === 2 ? 'full' : 'mini';
  }

  function updateDisplay() {
    setScore(scoreRef.current);
    setGameLevel(gameLevelRef.current);
    setLines(linesRef.current);
    setCombo(comboCount.current);
  }

  function mergeInto() {
    player.current.matrix!.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) arena.current[y + player.current.pos.y][x + player.current.pos.x] = val;
      });
    });
  }

  // SAND_BURST 여부를 고려한 피스 고정 — lockPiece / playerHardDrop / lockPieceImmediate 공통 사용
  function mergePieceIntoBoard() {
    if (evSandBurst.current) {
      player.current.matrix!.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            particles.current.push({
              type: 'sand',
              x: x + player.current.pos.x,
              y: y + player.current.pos.y,
              vx: 0, vy: 0,
              colorIndex: val,
              state: 'moving',
            });
          }
        });
      });
      evSandBurst.current = false;
    } else {
      mergeInto();
    }
  }

  // ===== Sand 물리 시뮬레이션 =====
  function simulateSand() {
    const parts = particles.current;
    let processed = 0;

    // SandParticle physics (셀 단위 정수 이동)
    for (let i = 0; i < parts.length && processed < SAND_BATCH_SIZE; i++) {
      const p = parts[i];
      if (p.type !== 'sand' || p.state !== 'moving') continue;
      processed++;

      const x = p.x, y = p.y;

      // VORTEX: 중심 방향으로 수평 힘 추가
      if (evVortex.current) {
        const cx = boardW.current / 2;
        p.vx = (p.vx + (x < cx ? 0.3 : -0.3)) * 0.8;
      } else {
        p.vx *= 0.7;
      }

      const nx = Math.round(x + p.vx);

      // 1. 아래로 낙하
      if (isEmptyForSand(x, y + 1)) {
        p.y = y + 1;
        p.vy = Math.min(p.vy + 1, 3);
        continue;
      }

      // BOUNCE_WALLS: 벽 충돌 시 vx 반전
      if (evBounceWalls.current && !isEmptyForSand(x, y + 1)) {
        if (nx !== x && isEmptyForSand(nx, y)) {
          p.x = nx;
          p.vx *= -0.8;
          continue;
        }
      }

      // 2. 좌하 / 우하 대각선 이동
      const goLeft  = isEmptyForSand(x - 1, y + 1);
      const goRight = isEmptyForSand(x + 1, y + 1);
      if (goLeft && goRight) {
        p.x = Math.random() < 0.5 ? x - 1 : x + 1;
        p.y = y + 1;
      } else if (goLeft) {
        p.x = x - 1; p.y = y + 1;
      } else if (goRight) {
        p.x = x + 1; p.y = y + 1;
      } else {
        // 3. 모두 막힘 → settled
        p.state = 'settled';
        p.vx = 0; p.vy = 0;
      }
    }

    // ShatterParticle physics (실수 좌표, 매 게임루프 프레임에서 처리)
    // (아래 simulateShatter에서 별도 처리)
  }

  function simulateShatter() {
    for (const p of particles.current) {
      if (p.type !== 'shatter' || p.state !== 'flying') continue;

      p.vy += SHATTER_GRAVITY;
      let nx = p.x + p.vx;
      let ny = p.y + p.vy;

      // 벽 충돌
      if (nx < 0) { nx = 0; p.vx = Math.abs(p.vx) * SHATTER_DAMPING; }
      else if (nx >= boardW.current) { nx = boardW.current - 1; p.vx = -Math.abs(p.vx) * SHATTER_DAMPING; }

      // 바닥 or solid 충돌
      const iy = Math.floor(ny);
      const ix = Math.round(nx);
      const hitFloor = ny >= boardH.current - 1;
      const hitSolid = !hitFloor && (arena.current[iy]?.[ix] ?? 0) !== 0;

      if (hitFloor || hitSolid) {
        if (p.bounces <= 0 || (Math.abs(p.vy) < SHATTER_MIN_SPEED && Math.abs(p.vx) < SHATTER_MIN_SPEED)) {
          p.x = Math.round(nx);
          p.y = hitFloor ? boardH.current - 1 : Math.floor(p.y);
          p.state = 'settled';
        } else {
          p.vy = -p.vy * SHATTER_DAMPING;
          p.vx = (Math.random() - 0.5) * 2;
          p.bounces--;
          p.x = nx;
          p.y = hitFloor ? boardH.current - 1 - 0.01 : p.y;
        }
      } else {
        p.x = nx;
        p.y = ny;
      }
    }
  }

  // ===== 줄 클리어 (arena + settled particles 합산) =====
  // fromLock=true 일 때만 클리어 없으면 콤보 리셋
  // sand 틱에서 호출 시 fromLock=false → 콤보를 리셋하지 않음
  function arenaSweepInsane(tspin: 'full' | 'mini' | null, eventActive: boolean, fromLock = false) {
    let count = 0;

    for (let y = boardH.current - 1; y > 0; y--) {
      if (!isRowFull(y)) continue;

      // arena 행 제거
      const row = arena.current.splice(y, 1)[0].fill(0);
      arena.current.unshift(row);

      // settled 파티클 제거
      particles.current = particles.current.filter(p =>
        !(p.state === 'settled' && Math.round(p.y) === y)
      );

      // 위쪽 파티클 y +1 (아래 행이 제거됐으므로)
      for (const p of particles.current) {
        if (p.y < y) p.y += 1;
      }

      y++; // 같은 인덱스 재검사
      count++;
    }

    // settled 파티클 중 지지 없는 것 다시 낙하
    recheckSettled();

    if (count <= 0) {
      // 피스 고정 시에만 콤보 리셋 — sand 틱에서는 리셋 금지
      if (fromLock) comboCount.current = 0;
      return;
    }

    let baseScore = 0;
    if (tspin) {
      const tbl = tspin === 'full' ? TSPIN_SCORES.full : TSPIN_SCORES.mini;
      baseScore = tbl[Math.min(count, tbl.length - 1)] * gameLevelRef.current;
      const label = tspin === 'mini' ? 'T-SPIN MINI'
        : count === 1 ? 'T-SPIN SINGLE'
        : count === 2 ? 'T-SPIN DOUBLE' : 'T-SPIN TRIPLE';
      tspinText.current = `${label}  +${baseScore.toLocaleString()}`;
      tspinAlpha.current = 2.0;
    } else {
      baseScore = (LINE_SCORES[count] ?? LINE_SCORES[4]) * gameLevelRef.current;
    }

    // 이벤트 활성 중 2배 보너스
    if (eventActive) baseScore *= 2;

    comboCount.current++;
    const comboBonus = comboCount.current >= 2 ? 50 * (comboCount.current - 1) * gameLevelRef.current : 0;
    scoreRef.current += baseScore + comboBonus;
    linesRef.current += count;

    if (comboCount.current >= 2) {
      comboText.current = `COMBO x${comboCount.current}  +${comboBonus.toLocaleString()}`;
      comboAlpha.current = 1.5;
    }
    const newLv = Math.min(Math.floor(linesRef.current / 10) + 1, 11);
    if (newLv > gameLevelRef.current) {
      gameLevelRef.current = newLv;
      const sp = DROP_SPEEDS[currentLevelRef.current];
      dropInterval.current = sp[Math.min(gameLevelRef.current - 1, sp.length - 1)];
    }
    updateDisplay();
  }

  // ===== 이벤트 시스템 =====
  function clearActiveEvent() {
    const id = activeEventId.current;
    if (!id) return;
    // onEnd: 상태 복원
    evFlipH.current = false;
    evFlipV.current = false;
    evDarkSpot.current = false;
    evInvisible.current = false;
    evColorGray.current = false;
    evVortex.current = false;
    evBounceWalls.current = false;
    evControlFreeze.current = false;
    if (id === 'SPIN_BLOCK') evSpinBlock.current = false;
    if (id === 'BOARD_TILT') {
      // settled → moving 초기화는 이미 적용됐으므로 추가 처리 없음
    }
    activeEventId.current = null;
    activeEventDur.current = 0;
    setEventBanner(null);
  }

  function fireEvent(def: EventDef) {
    // 지속형 이벤트면 현재 이벤트 종료 후 새 이벤트 시작
    if (activeEventId.current && def.duration > 0) clearActiveEvent();

    const id = def.id;

    // onStart
    switch (id) {
      case 'FLIP_H':          evFlipH.current = true; break;
      case 'FLIP_V':          evFlipV.current = true; break;
      case 'DARK_SPOTLIGHT':  evDarkSpot.current = true; break;
      case 'INVISIBLE_PIECE': evInvisible.current = true; break;
      case 'COLOR_GRAY':      evColorGray.current = true; break;
      case 'VORTEX': {
        evVortex.current = true;
        // 스펙: settled 파티클도 일시적으로 moving으로 전환
        for (const p of particles.current) {
          if (p.state === 'settled' && p.type === 'sand') {
            p.state = 'moving';
            p.vy = 0;
          }
        }
        break;
      }
      case 'BOUNCE_WALLS':    evBounceWalls.current = true; break;
      case 'CONTROL_FREEZE':  evControlFreeze.current = true; break;
      case 'SPIN_BLOCK':      evSpinBlock.current = true; evSpinTimer.current = 0; break;

      case 'SAND_BURST':      evSandBurst.current = true; break;

      case 'FULL_SAND': {
        // 보드 전체 solid → sand(moving)
        for (let y = 0; y < boardH.current; y++) {
          for (let x = 0; x < boardW.current; x++) {
            if (arena.current[y][x] !== 0) {
              particles.current.push({ type: 'sand', x, y, vx: 0, vy: 0, colorIndex: arena.current[y][x], state: 'moving' });
              arena.current[y][x] = 0;
            }
          }
        }
        break;
      }

      case 'LIQUID_FLOOD': {
        // 상단에서 sand N개 생성
        const n = boardW.current * 2;
        for (let i = 0; i < n; i++) {
          const x = Math.floor(Math.random() * boardW.current);
          particles.current.push({ type: 'sand', x, y: 0, vx: 0, vy: 0, colorIndex: (Math.floor(Math.random() * 7) + 1), state: 'moving' });
        }
        break;
      }

      case 'EXPLODE': {
        // 랜덤 위치 폭발, 반경 2 solid 제거
        const cx = Math.floor(Math.random() * boardW.current);
        const cy = Math.floor(boardH.current * 0.4 + Math.random() * boardH.current * 0.4);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx * dx + dy * dy <= 4) {
              const ex = cx + dx, ey = cy + dy;
              if (ey >= 0 && ey < boardH.current && ex >= 0 && ex < boardW.current) {
                arena.current[ey][ex] = 0;
              }
            }
          }
        }
        // 폭발 범위 settled 파티클 제거
        particles.current = particles.current.filter(p => {
          if (p.state !== 'settled') return true;
          const dx = Math.round(p.x) - cx, dy = Math.round(p.y) - cy;
          return dx * dx + dy * dy > 4;
        });
        recheckSettled();
        break;
      }

      case 'PIECE_SHATTER': {
        // 현재 피스 → sand particles
        if (player.current.matrix) {
          player.current.matrix.forEach((row, y) => {
            row.forEach((val, x) => {
              if (val !== 0) {
                particles.current.push({
                  type: 'sand',
                  x: x + player.current.pos.x,
                  y: y + player.current.pos.y,
                  vx: 0, vy: 0,
                  colorIndex: val,
                  state: 'moving',
                });
              }
            });
          });
        }
        playerReset();
        break;
      }

      case 'RANDOM_LOCK': {
        // 현재 피스 강제 고정
        lockPieceImmediate();
        break;
      }

      case 'BOARD_TILT': {
        // settled → moving, vx 한쪽으로
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (const p of particles.current) {
          if (p.state === 'settled' && p.type === 'sand') {
            p.state = 'moving';
            p.vx = dir * (0.5 + Math.random() * 0.5);
            p.vy = 0;
          } else if (p.state === 'settled' && p.type === 'shatter') {
            p.state = 'flying';
            p.vx = dir * (0.5 + Math.random());
            p.vy = 0;
          }
        }
        break;
      }

      case 'FLOOR_DROP': {
        // 보드 하단 확장 + 블록 ShatterParticle로 변환
        const addRows = 4;
        boardH.current += addRows;
        for (let i = 0; i < addRows; i++) arena.current.push(new Array(boardW.current).fill(0));

        // canvas 높이 업데이트, ctx scale 재적용
        const canvas = boardRef.current;
        if (canvas) {
          canvas.height = boardH.current * CELL;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.scale(CELL, CELL);
        }

        // 모든 arena 블록 → ShatterParticle
        for (let y = 0; y < boardH.current - addRows; y++) {
          for (let x = 0; x < boardW.current; x++) {
            if (arena.current[y][x] !== 0) {
              particles.current.push({
                type: 'shatter', x, y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: 0.1,
                colorIndex: arena.current[y][x],
                bounces: 3,
                state: 'flying',
              });
              arena.current[y][x] = 0;
            }
          }
        }
        break;
      }

      case 'BOARD_EXPAND': {
        // 보드 좌우로 1칸씩 확장 (총 +2)
        boardW.current += 2;
        for (let y = 0; y < boardH.current; y++) {
          arena.current[y].unshift(0);
          arena.current[y].push(0);
        }
        // 파티클 x 좌표 +1 (왼쪽으로 1칸 생겼으므로)
        for (const p of particles.current) { p.x += 1; }
        // 현재 피스 x 조정
        if (player.current.matrix) player.current.pos.x += 1;

        // canvas 너비 업데이트
        const canvas = boardRef.current;
        if (canvas) {
          canvas.width = boardW.current * CELL;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.scale(CELL, CELL);
        }
        break;
      }
    }

    // 지속형 이벤트 관리
    if (def.duration > 0) {
      activeEventId.current = id;
      activeEventDur.current = def.duration;
    }
    // SPIN_BLOCK은 duration=-1, 피스 락 시 해제
    if (def.duration === -1) {
      activeEventId.current = id;
      activeEventDur.current = -1;
    }

    setEventBanner({ name: def.name, emoji: def.emoji });
    if (def.duration > 0) {
      setTimeout(() => setEventBanner(null), Math.min(def.duration, 2000));
    } else {
      setTimeout(() => setEventBanner(null), 2000);
    }
  }

  function fireRandomEvent() {
    const isMobile = isMobileRef.current;
    const pool = EVENT_POOL.filter(e => !isMobile || !e.mobileExcluded);
    const totalW = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalW;
    for (const def of pool) {
      r -= def.weight;
      if (r <= 0) { fireEvent(def); return; }
    }
    fireEvent(pool[pool.length - 1]);
  }

  // ===== 플레이어 리셋 =====
  function playerReset() {
    holdUsed.current = false;
    isLanding.current = false;
    lockCounter.current = 0;
    lockResets.current = 0;
    lastActionRot.current = false;
    tPieceRot.current = 0;
    evSpinBlock.current = false; // SPIN_BLOCK 해제
    if (activeEventId.current === 'SPIN_BLOCK') clearActiveEvent();

    player.current.matrix = nextPiece.current ?? randomInsanePiece();
    nextPiece.current = randomInsanePiece();
    isPieceT.current = player.current.matrix.some(row => row.includes(1));
    player.current.pos.y = 0;
    player.current.pos.x = (boardW.current / 2 | 0) - (player.current.matrix[0].length / 2 | 0);
  }

  // ===== 블록 고정 (즉발 이벤트 전용 — 점수 계산 없이 강제 고정) =====
  function lockPieceImmediate() {
    if (!player.current.matrix) return;
    if (collidePlayer()) { doGameOver(); return; }
    mergePieceIntoBoard();
    playerReset();
    arenaSweepInsane(null, activeEventId.current !== null, true);
    isLanding.current = false;
    lockCounter.current = 0;
  }

  // ===== 블록 고정 =====
  function lockPiece() {
    if (!player.current.matrix) return;
    if (collidePlayer()) { doGameOver(); return; }

    const tspin = detectTspin();

    mergePieceIntoBoard();
    playerReset();
    arenaSweepInsane(tspin, activeEventId.current !== null, true);
    isLanding.current = false;
    lockCounter.current = 0;

    // 레벨 11: 매 lock 시 이벤트 발동
    if (gameLevelRef.current >= 11) {
      fireRandomEvent();
    }
  }

  // ===== 게임 오버 =====
  function doGameOver() {
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
    clearActiveEvent();
    setGameStatus('over');
    draw();
    if (!sessionFailedRef.current) setTimeout(() => setModalOpen(true), 100);
  }

  // 어드민 강제 클리어
  const { register } = useAdminTest();
  const forceClearRef = useRef<() => void>(() => {});
  forceClearRef.current = async () => {
    try {
      const id = await startSession('blockfall-insane', currentLevelRef.current);
      sessionIdRef.current = id;
    } catch { /* ignore */ }
    setModalOpen(true);
  };
  useEffect(() => {
    register(() => forceClearRef.current());
    return () => register(() => {});
  }, [register]);

  // ===== 캔버스 그리기 =====
  const draw = useCallback(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bw = boardW.current, bh = boardH.current;

    ctx.save();

    // 시각 이벤트: 반전 변환
    if (evFlipH.current) {
      ctx.translate(bw, 0);
      ctx.scale(-1, 1);
    }
    if (evFlipV.current) {
      ctx.translate(0, bh);
      ctx.scale(1, -1);
    }

    // === Layer 1: 배경 + 그리드 ===
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.02;
    for (let x = 1; x < bw; x++) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, bh); ctx.stroke();
    }
    for (let y = 1; y < bh; y++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bw, y); ctx.stroke();
    }

    // === Layer 2: arena solid ===
    arena.current.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) drawCell(ctx, x, y, val, 1.0);
      });
    });

    // === Layer 3: settled sand/shatter ===
    for (const p of particles.current) {
      if (p.state !== 'settled') continue;
      drawCell(ctx, Math.round(p.x), Math.round(p.y), p.colorIndex, 0.85);
    }

    // === Layer 4: moving sand ===
    for (const p of particles.current) {
      if (p.type !== 'sand' || p.state !== 'moving') continue;
      drawCell(ctx, p.x, p.y, p.colorIndex, 0.6);
    }

    // === Layer 5: flying shatter (실수 좌표, motion blur) ===
    for (const p of particles.current) {
      if (p.type !== 'shatter' || p.state !== 'flying') continue;
      // 잔상
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 0.1) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        drawCell(ctx, p.x - p.vx * 1.5, p.y - p.vy * 1.5, p.colorIndex, 0.25);
        ctx.restore();
      }
      const energy = Math.max(0, p.bounces / 3);
      drawCell(ctx, p.x, p.y, p.colorIndex, 0.6 + energy * 0.4);
    }

    // === Layer 6: 낙하 피스 (고스트 + 현재) ===
    const pm = player.current.matrix;
    if (pm && !evInvisible.current) {
      // 고스트 (easy)
      if (currentLevelRef.current === 'easy') {
        let gy = player.current.pos.y;
        while (!collide({ x: player.current.pos.x, y: gy + 1 }, pm)) gy++;
        if (gy > player.current.pos.y) {
          ctx.globalAlpha = 0.22;
          pm.forEach((row, y) => row.forEach((val, x) => {
            if (val !== 0) drawCell(ctx, x + player.current.pos.x, y + gy, val, 1);
          }));
          ctx.globalAlpha = 1.0;
        }
      }
      pm.forEach((row, y) => row.forEach((val, x) => {
        if (val !== 0) drawCell(ctx, x + player.current.pos.x, y + player.current.pos.y, val, 1);
      }));
    }

    // === Layer 7: 이벤트 오버레이 ===
    if (evDarkSpot.current && pm) {
      const px = (player.current.pos.x + pm[0].length / 2);
      const py = (player.current.pos.y + pm.length / 2);
      const gradient = ctx.createRadialGradient(px, py, 1.5, px, py, 6);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, bw, bh);
    }

    // T-스핀 오버레이
    if (tspinAlpha.current > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tspinAlpha.current);
      ctx.font = 'bold 1.1px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.12;
      ctx.strokeText(tspinText.current, bw / 2, bh / 2 - 4);
      ctx.fillStyle = '#ff6ec7';
      ctx.fillText(tspinText.current, bw / 2, bh / 2 - 4);
      ctx.restore();
      tspinAlpha.current -= 0.025;
    }

    // 콤보 오버레이
    if (comboAlpha.current > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, comboAlpha.current);
      ctx.font = 'bold 1.2px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.12;
      ctx.strokeText(comboText.current, bw / 2, bh / 2 - 2);
      ctx.fillStyle = '#ffd60a';
      ctx.fillText(comboText.current, bw / 2, bh / 2 - 2);
      ctx.restore();
      comboAlpha.current -= 0.025;
    }

    ctx.restore(); // visual event transforms 복원

    // NEXT / HOLD 캔버스
    const nc = nextRef.current;
    if (nc) {
      const nctx = nc.getContext('2d');
      if (nctx) {
        nctx.fillStyle = '#0a0a0a';
        nctx.fillRect(0, 0, 4, 4);
        if (nextPiece.current) {
          const m = nextPiece.current;
          const ox = Math.floor((4 - m[0].length) / 2);
          const oy = Math.floor((4 - m.length) / 2);
          m.forEach((row, y) => row.forEach((val, x) => {
            if (val !== 0) drawCell(nctx, x + ox, y + oy, val, 1);
          }));
        }
      }
    }
    const hc = holdRef.current;
    if (hc) {
      const hctx = hc.getContext('2d');
      if (hctx) {
        hctx.fillStyle = '#0a0a0a';
        hctx.fillRect(0, 0, 4, 4);
        if (holdPiece.current) {
          hctx.globalAlpha = holdUsed.current ? 0.4 : 1.0;
          const m = holdPiece.current;
          const ox = Math.floor((4 - m[0].length) / 2);
          const oy = Math.floor((4 - m.length) / 2);
          m.forEach((row, y) => row.forEach((val, x) => {
            if (val !== 0) drawCell(hctx, x + ox, y + oy, val, 1);
          }));
          hctx.globalAlpha = 1.0;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawCell(context: CanvasRenderingContext2D, x: number, y: number, colorIndex: number, alpha: number) {
    const saved = context.globalAlpha;
    context.globalAlpha *= alpha;
    if (evColorGray.current) {
      context.fillStyle = '#EEEEEE';
    } else {
      context.fillStyle = COLORS[colorIndex] ?? '#ccc';
    }
    context.fillRect(x, y, 1, 1);
    context.fillStyle = 'rgba(255,255,255,0.28)';
    context.fillRect(x, y, 1, 0.07);
    context.fillRect(x, y, 0.07, 1);
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.fillRect(x, y + 0.93, 1, 0.07);
    context.fillRect(x + 0.93, y, 0.07, 1);
    context.globalAlpha = saved;
  }

  // ===== 게임 루프 =====
  const gameLoop = useCallback((time: number) => {
    // 첫 프레임(lastTime=0) 또는 탭 전환 후 복귀 시 큰 dt가 발생하면
    // 이벤트 즉시 발동·낙하 점프 방지를 위해 해당 프레임은 스킵
    if (lastTime.current === 0) {
      lastTime.current = time;
      animId.current = requestAnimationFrame(gameLoop);
      return;
    }
    const dt = time - lastTime.current;
    lastTime.current = time;
    if (dt <= 0) { animId.current = requestAnimationFrame(gameLoop); return; }

    // Sand 물리 틱
    sandTickCounter.current += dt;
    if (sandTickCounter.current >= SAND_TICK_INTERVAL) {
      sandTickCounter.current = 0;
      simulateSand();
      // sand settling 후 라인 클리어 재검사
      arenaSweepInsane(null, activeEventId.current !== null);
    }

    // ShatterParticle 매 프레임 처리
    simulateShatter();

    // 지속형 이벤트 타이머
    if (activeEventId.current && activeEventDur.current > 0) {
      activeEventDur.current -= dt;
      const def = EVENT_POOL.find(e => e.id === activeEventId.current);
      if (def && def.duration > 0 && timerBarRef.current) {
        timerBarRef.current.style.width = `${Math.max(0, activeEventDur.current / def.duration) * 100}%`;
      }
      if (activeEventDur.current <= 0) clearActiveEvent();
    }

    // 이벤트 쿨다운 (레벨 11 미만)
    if (gameLevelRef.current < 11) {
      eventCooldown.current -= dt;
      if (eventCooldown.current <= 0) {
        fireRandomEvent();
        eventCooldown.current = getEventInterval(gameLevelRef.current);
      }
    }

    // SPIN_BLOCK 자동 회전
    if (evSpinBlock.current) {
      evSpinTimer.current += dt;
      if (evSpinTimer.current >= 300) {
        evSpinTimer.current = 0;
        playerRotate(1);
      }
    }

    // 낙하 피스 로직
    if (isLanding.current) {
      lockCounter.current += dt;
      if (lockCounter.current >= LOCK_DELAY) {
        lockPiece();
        if (animId.current === null) return;
      }
    }

    dropCounter.current += dt;
    if (dropCounter.current > dropInterval.current) {
      player.current.pos.y++;
      if (collide(player.current.pos, player.current.matrix!)) {
        player.current.pos.y--;
        if (!isLanding.current) { isLanding.current = true; lockCounter.current = 0; }
      } else {
        isLanding.current = false;
        lockCounter.current = 0;
      }
      dropCounter.current = 0;
      updateDisplay();
    }

    draw();
    animId.current = requestAnimationFrame(gameLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  // ===== 컨트롤 =====
  const playerMove = useCallback((dir: number) => {
    if (evControlFreeze.current) return;
    player.current.pos.x += dir;
    if (collide(player.current.pos, player.current.matrix!)) {
      player.current.pos.x -= dir;
    } else {
      lastActionRot.current = false;
      if (isLanding.current) {
        if (lockResets.current < MAX_LOCK_RESETS) { lockCounter.current = 0; lockResets.current++; }
        if (!isOnGround()) isLanding.current = false;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerDrop = useCallback((isSoft = false) => {
    if (evControlFreeze.current) return;
    player.current.pos.y++;
    if (collide(player.current.pos, player.current.matrix!)) {
      player.current.pos.y--;
      if (!isLanding.current) { isLanding.current = true; lockCounter.current = 0; }
    } else {
      isLanding.current = false;
      lockCounter.current = 0;
    }
    if (isSoft) scoreRef.current++;
    dropCounter.current = 0;
    updateDisplay();
  }, []);

  const playerHardDrop = useCallback(() => {
    if (evControlFreeze.current) return;
    let gy = player.current.pos.y;
    while (!collide({ x: player.current.pos.x, y: gy + 1 }, player.current.matrix!)) gy++;
    if (collide({ x: player.current.pos.x, y: gy }, player.current.matrix!)) {
      doGameOver(); return;
    }
    scoreRef.current += (gy - player.current.pos.y) * 2;
    player.current.pos.y = gy;
    const tspin = detectTspin();
    lastActionRot.current = false;
    mergePieceIntoBoard();
    playerReset();
    arenaSweepInsane(tspin, activeEventId.current !== null, true);
    dropCounter.current = 0;
    updateDisplay();
    if (gameLevelRef.current >= 11) fireRandomEvent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerRotate = useCallback((dir: number) => {
    if (evControlFreeze.current) return;
    const posX = player.current.pos.x;
    let offset = 1;
    rotateMatrix(player.current.matrix!, dir);
    while (collide(player.current.pos, player.current.matrix!)) {
      player.current.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > player.current.matrix![0].length) {
        rotateMatrix(player.current.matrix!, -dir);
        player.current.pos.x = posX;
        return;
      }
    }
    lastActionRot.current = true;
    if (isPieceT.current) tPieceRot.current = (tPieceRot.current + (dir > 0 ? 1 : 3)) % 4;
    if (isLanding.current) {
      if (lockResets.current < MAX_LOCK_RESETS) { lockCounter.current = 0; lockResets.current++; }
      if (!isOnGround()) isLanding.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerHold = useCallback(() => {
    if (evControlFreeze.current) return;
    if (holdUsed.current) return;
    holdUsed.current = true;
    if (!holdPiece.current) {
      holdPiece.current = player.current.matrix;
      holdPieceIsT.current = isPieceT.current;
      holdPieceRot.current = tPieceRot.current;
      playerReset();
    } else {
      const tmp = holdPiece.current;
      const tmpIsT = holdPieceIsT.current;
      const tmpRot = holdPieceRot.current;
      holdPiece.current = player.current.matrix;
      holdPieceIsT.current = isPieceT.current;
      holdPieceRot.current = tPieceRot.current;
      player.current.matrix = tmp;
      isPieceT.current = tmpIsT;
      tPieceRot.current = tmpRot;
      lastActionRot.current = false;
      player.current.pos.y = 0;
      player.current.pos.x = (boardW.current / 2 | 0) - (tmp[0].length / 2 | 0);
      isLanding.current = false; lockCounter.current = 0; lockResets.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 게임 시작 =====
  const startGame = useCallback((lv?: Level) => {
    const level = lv ?? currentLevelRef.current;
    currentLevelRef.current = level;
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }

    // 보드 크기 초기화
    boardW.current = INIT_BOARD_W;
    boardH.current = INIT_BOARD_H;

    // canvas 크기 초기화
    const canvas = boardRef.current;
    if (canvas) {
      if (canvas.width !== INIT_BOARD_W * CELL) canvas.width = INIT_BOARD_W * CELL;
      if (canvas.height !== INIT_BOARD_H * CELL) canvas.height = INIT_BOARD_H * CELL;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(CELL, CELL); }
    }

    arena.current = createMatrix(INIT_BOARD_W, INIT_BOARD_H);
    particles.current = [];
    scoreRef.current = 0; gameLevelRef.current = 1;
    linesRef.current = 0; comboCount.current = 0;
    comboAlpha.current = 0; tspinAlpha.current = 0;
    lastActionRot.current = false; tPieceRot.current = 0;
    isPieceT.current = false; holdPieceIsT.current = false; holdPieceRot.current = 0;
    dropCounter.current = 0; sandTickCounter.current = 0;
    holdPiece.current = null; holdUsed.current = false;
    isLanding.current = false; lockCounter.current = 0; lockResets.current = 0;

    // 이벤트 초기화
    clearActiveEvent();
    evSandBurst.current = false;
    evControlFreeze.current = false;
    eventCooldown.current = getEventInterval(1);

    const sp = DROP_SPEEDS[level];
    dropInterval.current = sp[0];
    player.current.matrix = null;
    nextPiece.current = randomInsanePiece();
    playerReset();
    updateDisplay();
    setGameStatus('playing');
    setEventBanner(null);
    lastTime.current = 0;
    animId.current = requestAnimationFrame(gameLoop);

    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const id = await startSession('blockfall-insane', level);
          sessionIdRef.current = id;
          sessionFailedRef.current = false;
          setSessionFailed(false);
          return;
        } catch {
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }
      }
      sessionIdRef.current = '';
      sessionFailedRef.current = true;
      setSessionFailed(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameLoop]);

  // ===== 일시정지 =====
  const togglePause = useCallback(() => {
    setGameStatus(prev => {
      if (prev === 'playing') {
        if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
        draw();
        return 'paused';
      } else if (prev === 'paused') {
        lastTime.current = 0;
        animId.current = requestAnimationFrame(gameLoop);
        return 'playing';
      }
      return prev;
    });
  }, [draw, gameLoop]);

  // ===== 키보드 =====
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const status = gameStatus;
      if (status !== 'playing' && status !== 'paused') return;
      if (status === 'paused' && (e.key === 'p' || e.key === 'P')) { togglePause(); return; }
      if (status !== 'playing') return;
      if (evSpinBlock.current) {
        // SPIN_BLOCK: 좌우만 허용
        if (e.key === 'ArrowLeft')  { e.preventDefault(); playerMove(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); playerMove(1); }
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); playerMove(-1); break;
        case 'ArrowRight': e.preventDefault(); playerMove(1);  break;
        case 'ArrowDown':  e.preventDefault(); playerDrop(true); break;
        case 'ArrowUp':    e.preventDefault(); if (!e.repeat) playerRotate(1); break;
        case ' ':          e.preventDefault(); playerHardDrop(); break;
        case 'Shift':      e.preventDefault(); playerHold(); break;
        case 'p': case 'P': togglePause(); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStatus, playerMove, playerDrop, playerRotate, playerHardDrop, playerHold, togglePause]);

  // ===== 캔버스 초기화 =====
  useEffect(() => {
    const canvas = boardRef.current;
    const nc = nextRef.current;
    const hc = holdRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) ctx.scale(CELL, CELL); }
    if (nc)     { const ctx = nc.getContext('2d');     if (ctx) ctx.scale(CELL, CELL); }
    if (hc)     { const ctx = hc.getContext('2d');     if (ctx) ctx.scale(CELL, CELL); }
    arena.current = createMatrix(INIT_BOARD_W, INIT_BOARD_H);
    draw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 터치 =====
  useEffect(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    let sx = 0, sy = 0, st = 0, lastTap = 0;
    function onStart(e: TouchEvent) {
      e.preventDefault();
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }
    function onEnd(e: TouchEvent) {
      e.preventDefault();
      if (gameStatus !== 'playing') return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      const dt = Date.now() - st;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 15 && ay < 15 && dt < 250) {
        const now = Date.now();
        if (now - lastTap < 300) playerHardDrop();
        else playerRotate(1);
        lastTap = now;
      } else if (ax > ay && ax > 20) {
        playerMove(dx > 0 ? 1 : -1);
      } else if (ay > ax && dy > 40) {
        playerHardDrop();
      }
    }
    function onMove(e: TouchEvent) { e.preventDefault(); }
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove,  { passive: false });
    canvas.addEventListener('touchend', onEnd,   { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [gameStatus, playerMove, playerRotate, playerHardDrop]);

  // ===== 언마운트 =====
  useEffect(() => {
    return () => { if (animId.current) cancelAnimationFrame(animId.current); };
  }, []);

  // ===== 랭킹 =====
  async function loadRanking(lv: Level) {
    setRankLoading(true);
    try { setRankings(await rankingsApi.getWeekly('blockfall-insane', lv) as RankEntry[]); }
    catch { setRankings([]); }
    finally { setRankLoading(false); }
  }
  async function loadAlltime(lv: Level) {
    try {
      const data = await rankingsApi.getAlltimeBest('blockfall-insane', lv);
      setAlltimeBest(data && (data as RankEntry).id ? data as RankEntry : null);
    } catch { setAlltimeBest(null); }
  }
  useEffect(() => { loadRanking('normal'); loadAlltime('normal'); }, []); // eslint-disable-line

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false); setSubmitState('loading');
    try {
      await rankingsApi.submit('blockfall-insane', {
        level: difficulty, name, score: scoreRef.current,
        gameLevel: gameLevelRef.current, linesCleared: linesRef.current,
        sessionId: sessionIdRef.current,
      });
      setModalOpen(false); setPlayerName(''); setSubmitState('idle');
      loadRanking(difficulty); loadAlltime(difficulty);
    } catch { setSubmitState('error'); }
  }

  function handleDifficultyChange(lv: Level) {
    setDifficulty(lv); currentLevelRef.current = lv;
    if (gameStatus === 'playing' || gameStatus === 'over') startGame(lv);
  }

  function handleRankTabChange(lv: Level) {
    setRankLevel(lv); loadRanking(lv); loadAlltime(lv); setShowRules(false);
  }

  const statusText =
    gameStatus === 'idle'   ? '▶ 시작 버튼을 눌러주세요' :
    gameStatus === 'paused' ? 'PAUSE' :
    gameStatus === 'over'   ? 'GAME OVER' : '';

  const LEVELS: { value: Level; label: string }[] = [
    { value: 'easy', label: '쉬움' },
    { value: 'normal', label: '보통' },
    { value: 'hard', label: '어려움' },
  ];

  return (
    <div className={styles.wrap}>
      {/* 난이도 */}
      <div className={styles.diffRow}>
        {LEVELS.map(lv => (
          <button key={lv.value}
            className={`${styles.diffBtn} ${difficulty === lv.value ? styles.diffActive : ''}`}
            onClick={() => handleDifficultyChange(lv.value)}>
            {lv.label}
          </button>
        ))}
      </div>

      {/* 상태 바 */}
      <div className={styles.infoBar}>
        <div className={styles.infoItem}><div className={styles.infoLabel}>점수</div><div className={styles.infoValue}>{score.toLocaleString()}</div></div>
        <div className={styles.infoItem}><div className={styles.infoLabel}>레벨</div><div className={styles.infoValue}>{gameLevel}</div></div>
        <div className={styles.infoItem}><div className={styles.infoLabel}>줄</div><div className={styles.infoValue}>{lines}</div></div>
        <div className={styles.infoItem}><div className={styles.infoLabel}>콤보</div>
          <div className={styles.infoValue} style={{ color: combo >= 2 ? '#ff6b00' : undefined }}>{combo >= 2 ? `x${combo}` : '-'}</div>
        </div>
      </div>

      {statusText && <div className={`${styles.status} ${gameStatus === 'over' ? styles.statusOver : ''}`}>{statusText}</div>}

      {/* 이벤트 배너 */}
      {eventBanner && (
        <div className={styles.eventBanner}>{eventBanner.emoji} {eventBanner.name}!</div>
      )}

      {/* 이벤트 타이머 바 */}
      <div className={styles.eventTimerBar}>
        <div ref={timerBarRef} className={styles.eventTimerFill} style={{ width: '0%' }} />
      </div>

      {sessionFailed && gameStatus === 'playing' && (
        <div className={styles.sessionFailBanner}>네트워크 오류로 이 게임은 랭킹에 등록되지 않습니다</div>
      )}

      {/* 게임 영역 */}
      <div className={styles.gameArea}>
        <div className={styles.sidePanel}>
          <div className={styles.sideBox}>
            <div className={styles.sideTitle}>NEXT</div>
            <canvas ref={nextRef} width={4 * CELL} height={4 * CELL} className={styles.miniCanvas} />
          </div>
          <div className={styles.sideBox}>
            <div className={styles.sideTitle}>HOLD</div>
            <canvas ref={holdRef} width={4 * CELL} height={4 * CELL} className={styles.miniCanvas} />
          </div>
          <div className={`${styles.sideBox} ${styles.hintsBox}`}>
            <div className={styles.sideTitle}>키</div>
            <div className={styles.hints}>
              ← → 이동<br />↑ 회전<br />↓ 내리기<br />Space 급강하<br />Shift 홀드<br />P 일시정지
            </div>
          </div>
        </div>
        <canvas ref={boardRef} width={INIT_BOARD_W * CELL} height={INIT_BOARD_H * CELL} className={styles.board} />
      </div>

      {/* 버튼 */}
      <div className={styles.controls}>
        <button className={styles.startBtn} onClick={() => startGame()}>
          {gameStatus === 'idle' ? '▶ 시작' : '↺ 다시하기'}
        </button>
        <button className={styles.pauseBtn}
          disabled={gameStatus !== 'playing' && gameStatus !== 'paused'}
          onClick={togglePause}>
          {gameStatus === 'paused' ? '▶ 계속' : '⏸ 일시정지'}
        </button>
      </div>

      {/* 이벤트 수동 테스트 패널 */}
      <button
        className={`${styles.debugToggle} ${showDebug ? styles.debugToggleOpen : ''}`}
        onClick={() => setShowDebug(v => !v)}
      >
        🧪 이벤트 수동 테스트 {showDebug ? '▲' : '▼'}
      </button>
      {showDebug && (
        <div className={styles.debugPanel}>
          <div className={styles.debugGrid}>
            {EVENT_POOL.map(def => (
              <button
                key={def.id}
                className={styles.debugEventBtn}
                disabled={gameStatus !== 'playing'}
                onClick={() => fireEvent(def)}
                title={def.id}
              >
                {def.emoji}<br />{def.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 모바일 버튼 */}
      <div className={styles.mobileControls}>
        <div className={styles.mobileRow}>
          <button className={styles.mobileBtn} style={{ width: 80, fontSize: '0.75em' }}
            onClick={() => { if (gameStatus === 'playing') playerHold(); }}>HOLD</button>
          <button className={styles.mobileBtn}
            onClick={() => { if (gameStatus === 'playing') playerRotate(1); }}>↺</button>
        </div>
        <div className={styles.mobileRow}>
          <button className={styles.mobileBtn} onClick={() => { if (gameStatus === 'playing') playerMove(-1); }}>←</button>
          <button className={styles.mobileBtn} onClick={() => { if (gameStatus === 'playing') playerDrop(true); }}>↓</button>
          <button className={styles.mobileBtn} onClick={() => { if (gameStatus === 'playing') playerMove(1); }}>→</button>
        </div>
        <div className={styles.mobileRow}>
          <button className={`${styles.mobileBtn} ${styles.mobileDrop}`}
            onClick={() => { if (gameStatus === 'playing') playerHardDrop(); }}>급강하</button>
        </div>
      </div>

      {/* 랭킹 */}
      <div className={styles.rankSection}>
        <h3 className={styles.rankTitle}>주간 RANK — INSANE</h3>
        {!showRules && alltimeBest && (
          <div className={styles.alltimeBanner}>
            <span className={styles.atLabel}>👑 역대 1위</span>
            <span className={styles.atContent}>
              {alltimeBest.name} · {(alltimeBest.score ?? 0).toLocaleString()}점 · Lv.{alltimeBest.gameLevel ?? 1} · {new Date(alltimeBest.createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
        )}
        <div className={styles.rankTabs}>
          {LEVELS.map(lv => (
            <button key={lv.value}
              className={`${styles.rankTab} ${rankLevel === lv.value && !showRules ? styles.rankTabActive : ''}`}
              onClick={() => handleRankTabChange(lv.value)}>{lv.label}</button>
          ))}
          <button className={`${styles.rankTab} ${showRules ? styles.rankTabActive : ''}`}
            onClick={() => setShowRules(true)}>룰</button>
        </div>
        {showRules ? (
          <div className={styles.rulesPanel}>
            <h4>조작법</h4>
            <ul>
              <li>← → 방향키: 좌우 이동</li>
              <li>↑ 방향키: 회전</li>
              <li>↓ 방향키: 빠른 낙하 (+1점)</li>
              <li>Space / 더블탭: 급강하 (+2점/칸)</li>
              <li>Shift / HOLD: 블록 홀드 (블록당 1회)</li>
              <li>P: 일시정지</li>
            </ul>
            <h4>인세인 이벤트</h4>
            <ul>
              <li>레벨이 높을수록 이벤트 발동 간격 감소</li>
              <li>레벨 11: 매 블록 고정 시 이벤트 발동</li>
              <li>이벤트 활성 중 라인 클리어 시 점수 2배</li>
              <li>Sand 연쇄 클리어 시 콤보 보너스 적용</li>
            </ul>
            <h4>점수 계산</h4>
            <ul>
              <li>1줄: 100 × 레벨, 2줄: 300, 3줄: 500, 4줄: 800</li>
              <li>콤보: 50 × (콤보-1) × 레벨</li>
            </ul>
          </div>
        ) : rankLoading ? (
          <p className={styles.placeholder}>불러오는 중...</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>순위</th><th>이름</th><th>점수</th><th>레벨</th><th>날짜</th></tr></thead>
            <tbody>
              {rankings.length === 0
                ? <tr><td colSpan={5} className={styles.placeholder}>기록 없음</td></tr>
                : rankings.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td><td>{r.name}</td>
                    <td>{(r.score ?? 0).toLocaleString()}점</td>
                    <td>Lv.{r.gameLevel ?? 1}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      {/* 게임 오버 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>🔥 INSANE — 게임 오버</h3>
            <p>최종 점수: <strong>{score.toLocaleString()}점</strong> (레벨 {gameLevel}, {lines}줄)</p>
            <input className={styles.nameInput} type="text" placeholder="이름을 입력하세요"
              value={playerName}
              onChange={e => { setPlayerName(e.target.value); setNameBanned(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus maxLength={50} />
            <p className={styles.ipNotice}>랭킹 등록 시 어뷰징 방지를 위해 IP 주소가 수집됩니다.</p>
            {nameBanned && <p className={styles.hint}>사용할 수 없는 닉네임입니다.</p>}
            {submitState === 'error' && <p className={styles.hint}>등록 실패. 다시 시도해 주세요.</p>}
            <div className={styles.modalBtns}>
              <button className={styles.primaryBtn} disabled={submitState === 'loading'} onClick={handleSubmitRanking}>
                {submitState === 'loading' ? '등록 중...' : '랭킹 등록'}
              </button>
              <button className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>건너뛰기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
