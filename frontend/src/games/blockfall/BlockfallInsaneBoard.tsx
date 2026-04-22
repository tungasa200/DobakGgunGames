/**
 * BlockfallInsaneBoard — 블록폴 인세인 모드 전면 개편 (2026-04-22)
 * - 난이도 선택 UI 제거, hard 고정
 * - Camera Shake (canvas ctx.translate 방식)
 * - CSS filter 색 왜곡
 * - Flash Overlay 경고
 * - 대형 배너 (.insaneBannerOverlay > .insaneBannerBox)
 * - BOARD_TILT 버그 수정 (매 틱 vx 증분 지속)
 * - BOUNCE_WALLS 재구현 (초기 vx ±1.5 부여)
 * - 파티클 수치 전반 강화
 * - 랭킹 UI 개편 (INSANE 전용, 단일 탭)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { rankingsApi, startSession } from '../../api/rankings';
import { containsProfanity } from '../../utils/profanity';
import { useAuth } from '../../context/AuthContext';
import { useAdminTest } from '../../context/AdminTestContext';
import { useBgm } from '../../hooks/useBgm';
import styles from './BlockfallInsaneBoard.module.css';

const BGM_DEFAULT_SRC = '/bgm/blockfall/blockfall_default.mp3';
const BGM_INSANE_SRC = '/bgm/blockfall/blockfall_insane.mp3';
const BGM_INSANE_PHASE2_SRC = '/bgm/blockfall/blockfall_insane_phase2.mp3';
const PHASE2_LEVEL_THRESHOLD = 9;

// ===== 타입 =====
type Matrix = number[][];
interface Player { pos: { x: number; y: number }; matrix: Matrix | null }
type GameStatus = 'idle' | 'playing' | 'paused' | 'over';

interface SandParticle {
  type: 'sand';
  x: number;       // 정수 (셀 단위)
  y: number;
  vx: number;
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
  | 'SAND_BURST' | 'LIQUID_FLOOD' | 'EXPLODE' | 'FLOOR_DROP'
  | 'CONTROL_FREEZE' | 'PIECE_SHATTER' | 'RANDOM_LOCK' | 'SPIN_BLOCK';

interface EventDef {
  id: EventId;
  name: string;
  emoji: string;
  duration: number;   // ms. 0 = 즉발
  weight: number;
  type: 'visual' | 'physical' | 'disruptive';
  mobileExcluded?: boolean;
  sub?: string;       // 배너 부제목
}

// ===== 상수 =====
const INIT_BOARD_W = 11;
const INIT_BOARD_H = 21;
const CELL = 30;

// B: 파티클 수치 상수 — 강화
const SAND_TICK_INTERVAL = 45;    // ms (60→45)
const SAND_BATCH_SIZE    = 35;    // (25→35)
const SHATTER_GRAVITY    = 0.08;  // (0.06→0.08)
const SHATTER_DAMPING    = 0.60;  // (0.50→0.60)
const SHATTER_MIN_SPEED  = 0.03;  // (0.04→0.03)

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
  '#eeeeee', // 16: 죽은 블럭 (DEAD)
];

// 죽은 블럭 색상 인덱스 — 물리적으로 자리를 차지하지만 라인 클리어 불가
const DEAD_COLOR = 16;

// 첫 이벤트 발동 전 — 일반 블록폴 색상 팔레트
const COLORS_PRE_EVENT: (string | null)[] = [
  null,
  '#ffaa0d', // 1: T
  '#f4b0c6', // 2: O
  '#ABEE62', // 3: L
  '#0DC2FF', // 4: J
  '#F7597C', // 5: I
  '#FFE138', // 6: S
  '#CA41D9', // 7: Z
  '#67e8f9', // 8: WIDE-I
  '#ff6b35', // 9: DOT
  '#4ecdc4', // 10: DOMINO
  '#a8ff78', // 11: MINI-L
  '#ffd6e0', // 12: X
  '#c3a6ff', // 13: BIG-O
  '#ffe66d', // 14: THUMBS-UP
  '#ff8b94', // 15: MIDDLE
  '#eeeeee', // 16: DEAD
];

// A: hard 고정
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
  { id: 'FLIP_H',          name: '좌우 반전',   emoji: '↔️',  duration: 8000,  weight: 1.2, type: 'visual',     mobileExcluded: true, sub: '8초 동안 좌우 반전' },
  { id: 'FLIP_V',          name: '상하 반전',   emoji: '↕️',  duration: 6000,  weight: 1.2, type: 'visual',     mobileExcluded: true, sub: '6초 동안 상하 반전' },
  { id: 'DARK_SPOTLIGHT',  name: '암전',        emoji: '🔦',  duration: 10000, weight: 1,   type: 'visual',     sub: '10초 동안 스포트라이트' },
  { id: 'INVISIBLE_PIECE', name: '투명 블록',   emoji: '👻',  duration: 6000,  weight: 1,   type: 'visual',     sub: '6초 동안 피스 투명' },
  { id: 'COLOR_GRAY',      name: '색맹 모드',   emoji: '🩶',  duration: 8000,  weight: 1,   type: 'visual',     sub: '8초 동안 색상 소멸' },
  { id: 'SAND_BURST',      name: '모래 폭발',   emoji: '💨',  duration: 0,     weight: 1,   type: 'physical',   sub: '즉발 — 다음 고정 시 적용' },
  { id: 'LIQUID_FLOOD',    name: '모래 홍수',   emoji: '🌊',  duration: 0,     weight: 1,   type: 'physical',   sub: '즉발 — 상단 모래 유입' },
  { id: 'EXPLODE',         name: '폭발',        emoji: '💥',  duration: 0,     weight: 1,   type: 'physical',   sub: '블록 고정 시 — 반경 9칸 폭발' },
  { id: 'FLOOR_DROP',      name: '바닥 붕괴',   emoji: '🕳️', duration: 0,     weight: 1,   type: 'physical',   mobileExcluded: true, sub: '즉발 — 바닥 확장 + 파편' },
  { id: 'CONTROL_FREEZE',  name: '조작 마비',   emoji: '🥶',  duration: 2000,  weight: 1,   type: 'disruptive', sub: '2초 동안 조작 불가' },
  { id: 'PIECE_SHATTER',   name: '블록 분해',   emoji: '🧨',  duration: 0,     weight: 1,   type: 'disruptive', sub: '즉발 — 현재 피스 분해' },
  { id: 'RANDOM_LOCK',     name: '강제 고정',   emoji: '🔒',  duration: 0,     weight: 1,   type: 'disruptive', sub: '즉발 — 현재 위치 고정' },
  { id: 'SPIN_BLOCK',      name: '자동 회전',   emoji: '🎡',  duration: -1,    weight: 1,   type: 'disruptive', sub: '피스 낙하 중 자동 회전' },
];

// HIGH flash 등급 이벤트
const HIGH_FLASH_EVENTS = new Set<EventId>(['EXPLODE', 'FLOOR_DROP', 'CONTROL_FREEZE']);

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
    THUMBS_UP:  [[0,14],[14,14],[14,14]],
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
  const rows = matrix.length;
  const cols = matrix[0].length;
  let rotated: Matrix;
  if (dir > 0) {
    // 시계 방향 90° — 비정방 행렬 지원
    rotated = Array.from({ length: cols }, (_, x) =>
      Array.from({ length: rows }, (_, y) => matrix[rows - 1 - y][x])
    );
  } else {
    // 반시계 방향 90°
    rotated = Array.from({ length: cols }, (_, x) =>
      Array.from({ length: rows }, (_, y) => matrix[y][cols - 1 - x])
    );
  }
  matrix.length = 0;
  rotated.forEach(row => matrix.push(row));
}

function getEventInterval(level: number): number {
  // 레벨1: 20초, 레벨11: 3초, 선형 감소
  return Math.max(3000, 20000 - (level - 1) * 1700);
}

type RankEntry = { id: number; name: string; score: number; gameLevel?: number; createdAt: string };

interface InsaneBoardProps {
  onThemeChange?: (phase: 'normal' | 'insane') => void;
}

// ===== 컴포넌트 =====
export default function BlockfallInsaneBoard({ onThemeChange }: InsaneBoardProps) {
  const { user } = useAuth();

  // ===== BGM (normal / insane / insane-phase2 3단계) =====
  const defaultBgm = useBgm(BGM_DEFAULT_SRC, { volume: 0.4 });
  const insaneBgm = useBgm(BGM_INSANE_SRC, { volume: 0.4 });
  const phase2Bgm = useBgm(BGM_INSANE_PHASE2_SRC, { volume: 0.4 });
  const activeBgmRef = useRef<'default' | 'insane' | 'phase2'>('default');
  const toggleBgmMute = useCallback(() => {
    defaultBgm.toggleMute();
    insaneBgm.toggleMute();
    phase2Bgm.toggleMute();
  }, [defaultBgm, insaneBgm, phase2Bgm]);

  // ===== 캔버스 refs =====
  const boardRef        = useRef<HTMLCanvasElement>(null);
  const nextRef         = useRef<HTMLCanvasElement>(null);
  const holdRef         = useRef<HTMLCanvasElement>(null);
  const timerBarRef     = useRef<HTMLDivElement>(null);
  const flashOverlayRef = useRef<HTMLDivElement>(null);

  // ===== 보드 크기 =====
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

  // A: hard 고정 — currentLevelRef는 항상 'hard'
  const currentLevelRef = useRef<string>('hard');

  // Sand 물리 틱 타이머
  const sandTickCounter = useRef(0);

  // ===== 이벤트 시스템 refs =====
  const activeEventId   = useRef<EventId | null>(null);
  const activeEventDur  = useRef(0);
  const eventCooldown   = useRef(20000);

  // 시각 이벤트 플래그
  const evFlipH         = useRef(false);
  const evFlipV         = useRef(false);
  const evDarkSpot      = useRef(false);
  const evInvisible     = useRef(false);
  const evColorGray     = useRef(false);
  // 물리/방해 이벤트 플래그
  const evSandBurst       = useRef(false);
  const evExplodePending  = useRef(false);
  const evControlFreeze   = useRef(false);
  const floorDropCount    = useRef(0);  // FLOOR_DROP 발동 횟수 (3의 배수: 원복)
  const evSpinBlock     = useRef(false);
  const randomLockPending = useRef(false); // RANDOM_LOCK 대기 중 (조건 충족 시 발동)
  const evSpinTimer     = useRef(0);

  // 모바일 판정
  const isMobileRef = useRef(navigator.maxTouchPoints > 0);

  // 세션
  const sessionIdRef      = useRef('');
  const sessionFailedRef  = useRef(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  // ===== C: Camera Shake ref =====
  const shakeRef = useRef({ amplitude: 0, duration: 0, total: 0, elapsed: 0 });

  // ===== 테마 페이즈 (게임 전/첫 이벤트 전 = 'normal', 첫 이벤트 발동 후 = 'insane') =====
  const firstEventFiredRef = useRef(false);
  const themePhaseRef = useRef<'normal' | 'insane'>('normal');
  const [themePhase, setThemePhase] = useState<'normal' | 'insane'>('normal');

  // ===== Lv9 색상반전 =====
  const invertActiveRef = useRef(false);

  function applyInvert() {
    if (invertActiveRef.current) return;
    invertActiveRef.current = true;
    document.documentElement.style.filter = 'invert(1)';
  }

  function removeInvert() {
    if (!invertActiveRef.current) return;
    invertActiveRef.current = false;
    document.documentElement.style.filter = '';
  }

  // ===== Lv11 코스믹 호러 (블록 검정 + 추적하는 눈) =====
  const cosmicHorrorRef = useRef(false);
  // blinkPhase: 0(완전 열림) ~ 1(완전 닫힘). nextStartTime은 ms timestamp(performance.now)
  const blinkRef = useRef<{ phase: number; nextStartTime: number; closingStartTime: number }>({
    phase: 0,
    nextStartTime: 0,
    closingStartTime: 0,
  });

  // ===== D: Filter ref =====
  const filterRef = useRef({ fadeMs: 0, fadeTotalMs: 0 });

  // ===== E: Flash 타이머 ids (정리용) =====
  const flashTimerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ===== prefers-reduced-motion =====
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // ===== React 상태 =====
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [score, setScore]       = useState(0);
  const [gameLevel, setGameLevel] = useState(1);
  const [lines, setLines]       = useState(0);
  const [combo, setCombo]       = useState(0);
  const bannerExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 랭킹
  const [rankings, setRankings]       = useState<RankEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [alltimeBest, setAlltimeBest] = useState<RankEntry | null>(null);
  const [showRules, setShowRules]     = useState(false);
  // 제출 성공 후 반환된 id (본인 행 판별)
  const submittedIdRef = useRef<number | null>(null);

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

  // ===== C: triggerShake =====
  function triggerShake(amplitudePx: number, durationMs: number) {
    if (prefersReducedMotion.current) return;
    if (amplitudePx <= shakeRef.current.amplitude) return;
    const capped = Math.min(amplitudePx, 20);
    shakeRef.current = { amplitude: capped, duration: durationMs, total: durationMs, elapsed: 0 };
  }

  // ===== D: setBoardFilter =====
  function setBoardFilter(filterValue: string, fadeMs: number) {
    if (prefersReducedMotion.current) return;
    if (evColorGray.current) return; // COLOR_GRAY 중 무시
    const canvas = boardRef.current;
    if (canvas) canvas.style.filter = filterValue;
    filterRef.current = { fadeMs, fadeTotalMs: fadeMs };
  }

  function clearBoardFilter() {
    const canvas = boardRef.current;
    if (!canvas) return;
    if (evColorGray.current) {
      canvas.style.filter = 'grayscale(1) contrast(1.3)';
    } else {
      canvas.style.filter = 'none';
    }
    filterRef.current = { fadeMs: 0, fadeTotalMs: 0 };
  }

  // ===== E: scheduleFlash =====
  function scheduleFlash(eventId: EventId) {
    const overlay = flashOverlayRef.current;
    if (!overlay) return;
    const isHigh = HIGH_FLASH_EVENTS.has(eventId);

    // 타이머 ID 저장 (cleanup용)
    const ids: ReturnType<typeof setTimeout>[] = [];

    if (isHigh) {
      // T=-350ms: 붉은 테두리 fade in 시작
      ids.push(setTimeout(() => {
        overlay.style.boxShadow = 'inset 0 0 0 4px rgba(255, 45, 85, 0)';
      }, 0));
      ids.push(setTimeout(() => {
        overlay.style.boxShadow = 'inset 0 0 0 4px rgba(255, 45, 85, 1)';
      }, 150));
      // T=0ms (이벤트 발동): 흰 배경
      ids.push(setTimeout(() => {
        overlay.style.background = 'rgba(255, 255, 255, 0.18)';
        overlay.style.boxShadow  = 'inset 0 0 0 4px rgba(255, 45, 85, 1)';
      }, 350));
      // T=+100ms: 흰 배경 제거 + 테두리 fade out 시작
      ids.push(setTimeout(() => {
        overlay.style.background = 'transparent';
        overlay.style.boxShadow  = 'inset 0 0 0 4px rgba(255, 45, 85, 0.5)';
      }, 450));
      ids.push(setTimeout(() => {
        overlay.style.boxShadow = 'inset 0 0 0 4px rgba(255, 45, 85, 0)';
      }, 650));
    } else {
      // LOW: T=-200ms 붉은 테두리
      ids.push(setTimeout(() => {
        overlay.style.boxShadow = 'inset 0 0 0 4px rgba(255, 45, 85, 0)';
      }, 0));
      ids.push(setTimeout(() => {
        overlay.style.boxShadow = 'inset 0 0 0 4px rgba(255, 45, 85, 1)';
      }, 150));
      // T=0ms 이벤트 발동
      ids.push(setTimeout(() => {
        overlay.style.boxShadow = 'inset 0 0 0 4px rgba(255, 45, 85, 0.6)';
      }, 200));
      // T=+150ms 소멸
      ids.push(setTimeout(() => {
        overlay.style.boxShadow = 'inset 0 0 0 4px rgba(255, 45, 85, 0)';
      }, 350));
    }

    flashTimerIds.current.push(...ids);
  }

  // ===== 파티클 헬퍼 =====
  function hasSettledAt(x: number, y: number): boolean {
    const ix = Math.round(x), iy = Math.round(y);
    return particles.current.some(p => p.state === 'settled' && Math.round(p.x) === ix && Math.round(p.y) === iy);
  }

  function isEmptyForSand(x: number, y: number): boolean {
    if (x < 0 || x >= boardW.current || y < 0 || y >= boardH.current) return false;
    if (arena.current[y]?.[x] !== 0) return false;
    if (hasSettledAt(x, y)) return false;
    // 낙하 중인 피스 셀도 장애물로 처리 — 모래가 피스 위에 정착하면 의문의 게임오버 발생
    const pm = player.current.matrix;
    if (pm) {
      const rx = x - player.current.pos.x;
      const ry = y - player.current.pos.y;
      if (ry >= 0 && ry < pm.length && rx >= 0 && rx < pm[ry].length && pm[ry][rx] !== 0) return false;
    }
    return true;
  }

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

  // ===== 충돌 판정 =====
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
    // COLOR_GRAY 중에는 모든 블럭이 죽은 블럭 취급 → 클리어 불가
    if (evColorGray.current) return false;
    for (let x = 0; x < boardW.current; x++) {
      const val = arena.current[y]?.[x] ?? 0;
      // 아레나에 죽은 블럭이 있으면 이 줄은 클리어 불가
      if (val === DEAD_COLOR) return false;
      // 아레나가 살아있는 블럭으로 채워진 경우 다음 칸으로
      if (val !== 0) continue;
      // val === 0: 정착 파티클 확인
      const settled = particles.current.find(
        p => p.state === 'settled' && Math.round(p.x) === x && Math.round(p.y) === y
      );
      if (!settled) return false;            // 빈 칸 → 줄 미완성
      if (settled.colorIndex === DEAD_COLOR) return false; // 죽은 파티클 → 클리어 불가
    }
    return true;
  }

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

  // SAND_BURST / EXPLODE — 고정 시 특수 처리
  function mergePieceIntoBoard() {
    if (evSandBurst.current) {
      triggerShake(10, 400);  // 고정 시 진동
      player.current.matrix!.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            particles.current.push({
              type: 'sand',
              x: x + player.current.pos.x,
              y: y + player.current.pos.y,
              vx: Math.random() * 3 - 1.5,
              vy: Math.random() * -0.8,
              colorIndex: DEAD_COLOR,  // 모래폭발은 죽은 블럭
              state: 'moving',
            });
          }
        });
      });
      evSandBurst.current = false;
    } else if (evExplodePending.current) {
      // 피스를 먼저 보드에 합성한 뒤 피스 중심 기준 직경 9칸(반경 4.5) 폭발
      mergeInto();
      const pm = player.current.matrix!;
      const cx = player.current.pos.x + pm[0].length / 2;
      const cy = player.current.pos.y + pm.length / 2;
      const R = 4;          // 루프 범위: ±4
      const R2 = 4.5 * 4.5; // 직경 9 = 반경 4.5, r²=20.25
      triggerShake(18, 700);  // 고정 시 진동
      setBoardFilter('hue-rotate(90deg) contrast(1.6) brightness(1.3)', 500);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R2) continue;
          const ex = Math.round(cx + dx), ey = Math.round(cy + dy);
          if (ey < 0 || ey >= boardH.current || ex < 0 || ex >= boardW.current) continue;
          if (arena.current[ey][ex] !== 0) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            particles.current.push({
              type: 'shatter', x: ex, y: ey,
              vx: (dx / (dist + 0.01)) * (Math.random() * 4 + 1.5),
              vy: (dy / (dist + 0.01)) * (Math.random() * 3 + 0.5) - 1,
              colorIndex: arena.current[ey][ex],
              bounces: 3,
              state: 'flying',
            });
            arena.current[ey][ex] = 0;
          }
        }
      }
      // settled 파티클도 범위 내 제거
      particles.current = particles.current.filter(p => {
        if (p.state !== 'settled') return true;
        const dx = p.x - cx, dy = p.y - cy;
        return dx * dx + dy * dy > R2;
      });
      recheckSettled();
      evExplodePending.current = false;
    } else {
      mergeInto();
    }
  }

  // ===== G: Sand 물리 시뮬레이션 (BOARD_TILT 재구현 포함) =====
  function simulateSand() {
    const parts = particles.current;
    let processed = 0;

    for (let i = 0; i < parts.length && processed < SAND_BATCH_SIZE; i++) {
      const p = parts[i];
      if (p.type !== 'sand' || p.state !== 'moving') continue;
      processed++;

      const x = p.x, y = p.y;

      p.vx *= 0.7;

      // 1. 아래로 낙하
      if (isEmptyForSand(x, y + 1)) {
        p.y = y + 1;
        p.vy = Math.min(p.vy + 1, 4); // B: 최대 낙하속도 3→4
        continue;
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

  }

  function simulateShatter() {
    for (const p of particles.current) {
      if (p.type !== 'shatter' || p.state !== 'flying') continue;

      p.vy += SHATTER_GRAVITY;
      let nx = p.x + p.vx;
      const ny = p.y + p.vy;

      // 벽 충돌
      if (nx < 0) { nx = 0; p.vx = Math.abs(p.vx) * SHATTER_DAMPING; }
      else if (nx >= boardW.current) { nx = boardW.current - 1; p.vx = -Math.abs(p.vx) * SHATTER_DAMPING; }

      const iy = Math.floor(ny);
      const ix = Math.round(nx);
      const hitFloor = ny >= boardH.current - 1;
      const pm = player.current.matrix;
      const hitPiece = pm != null && (() => {
        const rx = ix - player.current.pos.x, ry = iy - player.current.pos.y;
        return ry >= 0 && ry < pm.length && rx >= 0 && rx < pm[ry].length && pm[ry][rx] !== 0;
      })();
      const hitSolid = !hitFloor && ((arena.current[iy]?.[ix] ?? 0) !== 0 || hitPiece);

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

  // ===== 줄 클리어 =====
  function arenaSweepInsane(tspin: 'full' | 'mini' | null, eventActive: boolean, fromLock = false) {
    let count = 0;

    for (let y = boardH.current - 1; y > 0; y--) {
      if (!isRowFull(y)) continue;

      const row = arena.current.splice(y, 1)[0].fill(0);
      arena.current.unshift(row);

      particles.current = particles.current.filter(p =>
        !(p.state === 'settled' && Math.round(p.y) === y)
      );

      for (const p of particles.current) {
        if (p.y < y) p.y += 1;
      }

      y++;
      count++;
    }

    recheckSettled();

    if (count <= 0) {
      if (fromLock) comboCount.current = 0;
      return;
    }

    // 라인 클리어 shake
    if (count >= 4) {
      triggerShake(12, 500);
    } else if (count >= 2) {
      triggerShake(6, 300);
    } else {
      triggerShake(3, 150);
    }
    // 이벤트 활성 중 보너스 shake
    if (eventActive && count >= 1) {
      triggerShake(Math.min(18, 6 * count * 1.5), 300 * 1.3);
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
      // Lv9 진입: 1회 진동(인세인 진입과 동일) + 전체 화면 색상반전
      if (gameLevelRef.current === 9) {
        triggerShake(15, 600);
        applyInvert();
      }
      // Lv11 진입: 코스믹 호러 발동 (모든 블록 검정 + 추적하는 눈)
      if (gameLevelRef.current === 11 && !cosmicHorrorRef.current) {
        cosmicHorrorRef.current = true;
        triggerShake(20, 900);
        const now = performance.now();
        blinkRef.current = {
          phase: 0,
          closingStartTime: 0,
          nextStartTime: now + 5000 + Math.random() * 5000,
        };
      }
    }
    updateDisplay();
  }

  // ===== 이벤트 시스템 =====
  function clearActiveEvent() {
    const id = activeEventId.current;
    if (!id) return;
    evFlipH.current = false;
    evFlipV.current = false;
    evDarkSpot.current = false;
    evInvisible.current = false;
    evColorGray.current = false;
    evControlFreeze.current = false;
    if (id === 'SPIN_BLOCK') evSpinBlock.current = false;

    // COLOR_GRAY 종료 — 모든 죽은 블럭(아레나 + 파티클)을 랜덤 생존 색으로 부활
    if (id === 'COLOR_GRAY') {
      for (let y = 0; y < boardH.current; y++) {
        for (let x = 0; x < boardW.current; x++) {
          if (arena.current[y][x] === DEAD_COLOR) {
            arena.current[y][x] = Math.floor(Math.random() * 15) + 1;
          }
        }
      }
      for (const p of particles.current) {
        if (p.colorIndex === DEAD_COLOR) {
          p.colorIndex = Math.floor(Math.random() * 15) + 1;
        }
      }
    }

    // 필터 복원
    clearBoardFilter();

    activeEventId.current = null;
    activeEventDur.current = 0;
  }

  function fireEvent(def: EventDef) {
    // 첫 이벤트 발동 시 인세인 테마로 전환
    if (!firstEventFiredRef.current) {
      firstEventFiredRef.current = true;
      themePhaseRef.current = 'insane';
      setThemePhase('insane');
      onThemeChange?.('insane');
      triggerShake(15, 600);
    }

    if (activeEventId.current && def.duration > 0) clearActiveEvent();

    const id = def.id;

    // E: 경고 Flash 스케줄 (이벤트 발동 전 미리 호출)
    scheduleFlash(id);

    // D: 이벤트별 CSS filter 적용
    switch (id) {
      case 'FLIP_H':
        evFlipH.current = true;
        if (!prefersReducedMotion.current) {
          const c = boardRef.current; if (c) c.style.filter = 'hue-rotate(180deg)';
        }
        triggerShake(12, 500);
        break;
      case 'FLIP_V':
        evFlipV.current = true;
        if (!prefersReducedMotion.current) {
          const c = boardRef.current; if (c) c.style.filter = 'invert(1) contrast(1.5)';
        }
        triggerShake(12, 500);
        break;
      case 'DARK_SPOTLIGHT':
        evDarkSpot.current = true;
        if (!prefersReducedMotion.current) {
          const c = boardRef.current; if (c) c.style.filter = 'brightness(0.7)';
        }
        break;
      case 'INVISIBLE_PIECE': evInvisible.current = true; break;
      case 'COLOR_GRAY':
        evColorGray.current = true;
        if (!prefersReducedMotion.current) {
          const c = boardRef.current; if (c) c.style.filter = 'grayscale(1) contrast(1.3)';
        }
        break;
      case 'CONTROL_FREEZE':
        evControlFreeze.current = true;
        setBoardFilter('hue-rotate(180deg) saturate(0.7) brightness(1.1)', 2000);
        break;
      case 'SPIN_BLOCK': evSpinBlock.current = true; evSpinTimer.current = 0; break;

      case 'SAND_BURST':
        evSandBurst.current = true;
        break;

      case 'LIQUID_FLOOD': {
        setBoardFilter('saturate(2.2) hue-rotate(15deg)', 500);
        const n = boardW.current * 6;
        for (let i = 0; i < n; i++) {
          const x = Math.floor(Math.random() * boardW.current);
          const y = Math.floor(Math.random() * 3);
          particles.current.push({
            type: 'sand', x, y,
            vx: Math.random() * 3 - 1.5,
            vy: Math.random() * -0.8,
            colorIndex: DEAD_COLOR,  // 모래홍수는 죽은 블럭
            state: 'moving',
          });
        }
        break;
      }

      case 'EXPLODE': {
        // 블록 고정 시 발동 — pending 세팅
        evExplodePending.current = true;
        break;
      }

      case 'PIECE_SHATTER': {
        triggerShake(8, 250);
        setBoardFilter('brightness(1.3)', 200);
        if (player.current.matrix) {
          player.current.matrix.forEach((row, y) => {
            row.forEach((val, x) => {
              if (val !== 0) {
                // B: 초기 vx/vy 부여
                particles.current.push({
                  type: 'sand',
                  x: x + player.current.pos.x,
                  y: y + player.current.pos.y,
                  vx: Math.random() * 3 - 1.5,
                  vy: Math.random() * -0.8,
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
        // 중앙 상단 구간이면 대기, 벗어나는 순간 발동
        randomLockPending.current = true;
        break;
      }

      case 'FLOOR_DROP': {
        floorDropCount.current += 1;
        const isReset = floorDropCount.current % 3 === 0;
        const addRows = 6;
        const prevH = boardH.current;

        if (isReset) {
          // 3번째마다: 보드 높이 원복
          boardH.current = INIT_BOARD_H;
          // 늘어난 빈 행 제거 (아래부터)
          arena.current.splice(INIT_BOARD_H);
        } else {
          // 1·2번째: 보드 아래에 빈 행 추가
          boardH.current += addRows;
          for (let i = 0; i < addRows; i++) arena.current.push(new Array(boardW.current).fill(0));
        }

        const canvas = boardRef.current;
        if (canvas) {
          canvas.height = boardH.current * CELL;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.scale(CELL, CELL);
        }

        triggerShake(isReset ? 18 : 8, isReset ? 600 : 300);
        setBoardFilter('hue-rotate(180deg) contrast(1.4) saturate(1.8)', 400);

        // 쌓인 블럭 전체 박살
        const scanH = Math.min(prevH, boardH.current);
        for (let y = 0; y < scanH; y++) {
          for (let x = 0; x < boardW.current; x++) {
            if (arena.current[y]?.[x] !== 0 && arena.current[y]?.[x] != null) {
              particles.current.push({
                type: 'shatter', x, y,
                vx: Math.random() * 5 - 2.5,
                vy: 0.5,
                colorIndex: arena.current[y][x],
                bounces: 5,
                state: 'flying',
              });
              arena.current[y][x] = 0;
            }
          }
        }

        // 리셋 시: 정착 파티클 제거 + 피스 위치 보정
        // — 보드 축소로 인해 collide()가 즉시 true를 반환해 게임오버 나는 현상 방지
        if (isReset) {
          particles.current = particles.current.filter(p => p.state !== 'settled');
          if (player.current.matrix) {
            const ph = player.current.matrix.length;
            player.current.pos.y = Math.min(
              player.current.pos.y,
              Math.max(0, boardH.current - ph)
            );
          }
        }

        setTimeout(() => triggerShake(18, 800), 200);
        break;
      }

    }

    // 지속형 이벤트 관리
    if (def.duration > 0) {
      activeEventId.current = id;
      activeEventDur.current = def.duration;
    }
    if (def.duration === -1) {
      activeEventId.current = id;
      activeEventDur.current = -1;
    }
  }

  function fireRandomEvent() {
    const isMobile = isMobileRef.current;
    // Lv10+ 에서는 색맹/바닥붕괴 제외 — 고레벨 빈발 시 오히려 난이도 하락
    const highLevel = gameLevelRef.current >= 10;
    const pool = EVENT_POOL.filter(e => {
      if (isMobile && e.mobileExcluded) return false;
      if (highLevel && (e.id === 'COLOR_GRAY' || e.id === 'FLOOR_DROP')) return false;
      return true;
    });
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
    evSpinBlock.current = false;
    randomLockPending.current = false;
    if (activeEventId.current === 'SPIN_BLOCK') clearActiveEvent();

    player.current.matrix = nextPiece.current ?? randomInsanePiece();
    nextPiece.current = randomInsanePiece();
    isPieceT.current = player.current.matrix.some(row => row.includes(1));
    player.current.pos.y = 0;
    player.current.pos.x = (boardW.current / 2 | 0) - (player.current.matrix[0].length / 2 | 0);

    // 스폰 위치에 정착한 파티클(모래·파편) 제거
    // — 이벤트 파편이 스폰존에 쌓여 의문의 게임오버가 나는 현상 방지
    // — 아레나 셀이 막힌 경우(진짜 게임오버)는 collide에서 별도 판정
    const pm = player.current.matrix;
    const px = player.current.pos.x;
    const py = player.current.pos.y;
    particles.current = particles.current.filter(p => {
      if (p.state !== 'settled') return true;
      const rx = Math.round(p.x) - px;
      const ry = Math.round(p.y) - py;
      if (ry < 0 || ry >= pm.length || rx < 0 || rx >= pm[0].length) return true;
      return pm[ry][rx] === 0; // 피스 셀이 있는 위치의 파티클만 제거
    });
  }

  function clearParticlesOnPiece() {
    const pm = player.current.matrix;
    if (!pm) return;
    const px = player.current.pos.x, py = player.current.pos.y;
    particles.current = particles.current.filter(p => {
      if (p.state !== 'settled') return true;
      const rx = Math.round(p.x) - px, ry = Math.round(p.y) - py;
      if (ry < 0 || ry >= pm.length || rx < 0 || rx >= pm[ry].length) return true;
      return pm[ry][rx] === 0;
    });
  }

  function lockPieceImmediate() {
    if (!player.current.matrix) return;
    clearParticlesOnPiece();
    if (collidePlayer()) { doGameOver(); return; }
    mergePieceIntoBoard();
    playerReset();
    arenaSweepInsane(null, activeEventId.current !== null, true);
    isLanding.current = false;
    lockCounter.current = 0;
  }

  function lockPiece() {
    if (!player.current.matrix) return;
    clearParticlesOnPiece();
    if (collidePlayer()) { doGameOver(); return; }

    const tspin = detectTspin();

    mergePieceIntoBoard();
    playerReset();
    arenaSweepInsane(tspin, activeEventId.current !== null, true);
    isLanding.current = false;
    lockCounter.current = 0;

  }

  // ===== 게임 오버 =====
  function doGameOver() {
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
    clearActiveEvent();
    defaultBgm.stop();
    insaneBgm.stop();
    phase2Bgm.stop();
    activeBgmRef.current = 'default';
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

    // C: Camera Shake — draw() 맨 앞 ctx.save() 직후 translate 적용
    if (shakeRef.current.duration > 0) {
      const amp = shakeRef.current.amplitude
        * Math.pow(shakeRef.current.duration / shakeRef.current.total, 0.7);
      const t = shakeRef.current.elapsed;
      ctx.translate(
        (amp * Math.sin(t * 0.06)) / CELL,
        (amp * 0.4 * Math.sin(t * 0.09 + Math.PI / 4)) / CELL
      );
    }

    // 시각 이벤트 반전 변환
    if (evFlipH.current) {
      ctx.translate(bw, 0);
      ctx.scale(-1, 1);
    }
    if (evFlipV.current) {
      ctx.translate(0, bh);
      ctx.scale(1, -1);
    }

    // === Layer 1: 배경 + 그리드 ===
    const preEvent = themePhaseRef.current === 'normal';
    ctx.fillStyle = preEvent ? '#111827' : '#0a0a0a';
    ctx.fillRect(0, 0, bw, bh);
    ctx.strokeStyle = preEvent ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.05)';
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
      drawCell(ctx, Math.round(p.x), Math.round(p.y), p.colorIndex, 0.90); // B: 0.85→0.90
    }

    // === Layer 4: moving sand ===
    for (const p of particles.current) {
      if (p.type !== 'sand' || p.state !== 'moving') continue;
      // B: sand 잔상 (속도 클 때만)
      const speed = Math.abs(p.vx) + Math.abs(p.vy);
      if (speed > 1.5) {
        drawCell(ctx, p.x - p.vx * 0.8, p.y - p.vy * 0.8, p.colorIndex, 0.20);
      }
      drawCell(ctx, p.x, p.y, p.colorIndex, 0.75); // B: 0.6→0.75
    }

    // === Layer 5: flying shatter (실수 좌표, motion blur) ===
    for (const p of particles.current) {
      if (p.type !== 'shatter' || p.state !== 'flying') continue;
      // B: 잔상 거리 1.5→2.5, 잔상 alpha 0.25→0.35
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 0.1) {
        drawCell(ctx, p.x - p.vx * 2.5, p.y - p.vy * 2.5, p.colorIndex, 0.35);
      }
      const energy = Math.max(0, p.bounces / 5);
      drawCell(ctx, p.x, p.y, p.colorIndex, 0.7 + energy * 0.3); // B: 0.6+e*0.4 → 0.7+e*0.3
    }

    // === Layer 6: 낙하 피스 ===
    const pm = player.current.matrix;
    if (pm && !evInvisible.current) {
      pm.forEach((row, y) => row.forEach((val, x) => {
        if (val !== 0) drawCell(ctx, x + player.current.pos.x, y + player.current.pos.y, val, 1);
      }));
    }

    // === Layer 7: 이벤트 오버레이 ===
    if (evDarkSpot.current && pm) {
      const px = (player.current.pos.x + pm[0].length / 2);
      const py = (player.current.pos.y + pm.length / 2);
      // B: 반경 6→3
      const gradient = ctx.createRadialGradient(px, py, 0.5, px, py, 3);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.98)');  // B: 0.95→0.98
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

    ctx.restore();

    // NEXT / HOLD 캔버스
    const nc = nextRef.current;
    if (nc) {
      const nctx = nc.getContext('2d');
      if (nctx) {
        nctx.fillStyle = themePhaseRef.current === 'normal' ? '#111827' : '#0a0a0a';
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
        hctx.fillStyle = themePhaseRef.current === 'normal' ? '#111827' : '#0a0a0a';
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
  }, []);

  function drawCell(context: CanvasRenderingContext2D, x: number, y: number, colorIndex: number, alpha: number) {
    const saved = context.globalAlpha;
    context.globalAlpha *= alpha;
    const isDead = evColorGray.current || colorIndex === DEAD_COLOR;
    const palette = themePhaseRef.current === 'normal' ? COLORS_PRE_EVENT : COLORS;

    if (cosmicHorrorRef.current) {
      // Lv11 코스믹 호러: 화면 전체 invert 상태에서 흰색으로 그리면 검정으로 보임
      context.fillStyle = '#ffffff';
      context.fillRect(x, y, 1, 1);
      // 흐릿한 회색 테두리 (invert 후 어두운 윤곽)
      context.fillStyle = 'rgba(180,180,180,0.5)';
      context.fillRect(x, y, 1, 0.04);
      context.fillRect(x, y, 0.04, 1);
      context.fillRect(x, y + 0.96, 1, 0.04);
      context.fillRect(x + 0.96, y, 0.04, 1);
      drawCosmicEye(context, x, y);
      context.globalAlpha = saved;
      return;
    }

    context.fillStyle = isDead ? '#eeeeee' : (palette[colorIndex] ?? '#ccc');
    context.fillRect(x, y, 1, 1);
    if (isDead) {
      // 죽은 블럭: 어두운 테두리만, 하이라이트 없음
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(x, y + 0.93, 1, 0.07);
      context.fillRect(x + 0.93, y, 0.07, 1);
      context.fillStyle = 'rgba(0,0,0,0.12)';
      context.fillRect(x, y, 1, 0.07);
      context.fillRect(x, y, 0.07, 1);
    } else {
      context.fillStyle = 'rgba(255,255,255,0.28)';
      context.fillRect(x, y, 1, 0.07);
      context.fillRect(x, y, 0.07, 1);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(x, y + 0.93, 1, 0.07);
      context.fillRect(x + 0.93, y, 0.07, 1);
    }
    context.globalAlpha = saved;
  }

  // Lv11 코스믹 호러: 셀 중앙에 떨어지는 블록을 응시하는 눈 그리기
  function drawCosmicEye(context: CanvasRenderingContext2D, cellX: number, cellY: number) {
    // 시선 추적 대상: 현재 떨어지는 블록의 중심
    const m = player.current.matrix;
    let targetX: number, targetY: number;
    if (m) {
      targetX = player.current.pos.x + m[0].length / 2;
      targetY = player.current.pos.y + m.length / 2;
    } else {
      targetX = cellX + 0.5;
      targetY = cellY + 0.5;
    }
    const cx = cellX + 0.5;
    const cy = cellY + 0.5;
    const dx = targetX - cx;
    const dy = targetY - cy;
    const len = Math.hypot(dx, dy);
    const nx = len > 0.0001 ? dx / len : 0;
    const ny = len > 0.0001 ? dy / len : 0;

    // 아몬드형 흰자 (수평으로 길쭉)
    const eyeRadiusX = 0.26;
    const eyeRadiusY = 0.14;
    const irisRadius = 0.1;    // 빨간 홍채
    const pupilRadius = 0.04;  // 검은 동공
    const gazeOffsetX = 0.11;
    const gazeOffsetY = 0.045;

    // 깜빡임 진행도 (0=완전 열림, 1=완전 닫힘)
    const blink = blinkRef.current.phase;
    const yScale = Math.max(1 - blink, 0.1); // 완전 감김 시 얇은 가로선

    // 흰자: yScale에 따라 위아래로 납작해지며 감김
    context.fillStyle = '#000000';
    context.beginPath();
    context.ellipse(cx, cy, eyeRadiusX, eyeRadiusY * yScale, 0, 0, Math.PI * 2);
    context.fill();

    // 반 이상 감겼으면 홍채/동공 숨김 (모양 깨짐 방지)
    if (blink > 0.35) return;

    // 홍채 (청록으로 그리면 invert 후 빨강으로 빛남)
    const irisX = cx + nx * gazeOffsetX;
    const irisY = cy + ny * gazeOffsetY;
    context.fillStyle = '#00ffff';
    context.beginPath();
    context.arc(irisX, irisY, irisRadius, 0, Math.PI * 2);
    context.fill();

    // 동공 (흰색으로 그리면 invert 후 검정)
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(irisX, irisY, pupilRadius, 0, Math.PI * 2);
    context.fill();
  }

  // ===== 게임 루프 =====
  const gameLoop = useCallback((time: number) => {
    if (lastTime.current === 0) {
      lastTime.current = time;
      animId.current = requestAnimationFrame(gameLoop);
      return;
    }
    const dt = time - lastTime.current;
    lastTime.current = time;
    if (dt <= 0) { animId.current = requestAnimationFrame(gameLoop); return; }

    // Lv11 코스믹 호러: 깜빡임 타이머
    if (cosmicHorrorRef.current) {
      const BLINK_DURATION = 280; // 닫힘+열림 합산 ms
      const b = blinkRef.current;
      if (b.closingStartTime > 0) {
        const elapsed = time - b.closingStartTime;
        if (elapsed >= BLINK_DURATION) {
          b.phase = 0;
          b.closingStartTime = 0;
          b.nextStartTime = time + 5000 + Math.random() * 5000;
        } else {
          // 0 → 1 → 0 (닫혔다 열림) 삼각파
          const half = BLINK_DURATION / 2;
          b.phase = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
        }
      } else if (time >= b.nextStartTime && b.nextStartTime > 0) {
        b.closingStartTime = time;
      }
    }

    // C: shake 타이머 업데이트
    if (shakeRef.current.duration > 0) {
      shakeRef.current.duration -= dt;
      shakeRef.current.elapsed  += dt;
      if (shakeRef.current.duration <= 0) {
        shakeRef.current.amplitude = 0;
        shakeRef.current.duration  = 0;
      }
    }

    // D: filter fadeMs 타이머
    if (filterRef.current.fadeMs > 0) {
      filterRef.current.fadeMs -= dt;
      if (filterRef.current.fadeMs <= 0) {
        clearBoardFilter();
      }
    }

    // Sand 물리 틱
    sandTickCounter.current += dt;
    if (sandTickCounter.current >= SAND_TICK_INTERVAL) {
      sandTickCounter.current = 0;
      simulateSand();
      arenaSweepInsane(null, activeEventId.current !== null);
    }

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

    // 이벤트 쿨다운
    eventCooldown.current -= dt;
    if (eventCooldown.current <= 0) {
      fireRandomEvent();
      eventCooldown.current = getEventInterval(gameLevelRef.current);
    }

    // RANDOM_LOCK 대기 — 피스가 중앙 상단 구간을 벗어나는 순간 발동
    if (randomLockPending.current && player.current.matrix) {
      const pm = player.current.matrix;
      const cx = player.current.pos.x + pm[0].length / 2;
      const inHorizCenter = cx >= Math.floor(boardW.current / 3) && cx <= Math.floor(boardW.current * 2 / 3);
      const inTopQuarter  = player.current.pos.y < Math.floor(boardH.current / 4);
      if (!inHorizCenter || !inTopQuarter) {
        randomLockPending.current = false;
        triggerShake(7, 300);
        lockPieceImmediate();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ===== 게임 시작 (A: hard 고정) =====
  const startGame = useCallback(() => {
    const level = 'hard';
    currentLevelRef.current = level;
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }

    // flash 타이머 정리
    if (bannerExitTimerRef.current) clearTimeout(bannerExitTimerRef.current);
    flashTimerIds.current.forEach(id => clearTimeout(id));
    flashTimerIds.current = [];

    // filter 초기화
    const canvas = boardRef.current;
    if (canvas) canvas.style.filter = 'none';
    filterRef.current = { fadeMs: 0, fadeTotalMs: 0 };

    // shake 초기화
    shakeRef.current = { amplitude: 0, duration: 0, total: 0, elapsed: 0 };

    // flash overlay 초기화
    const overlay = flashOverlayRef.current;
    if (overlay) {
      overlay.style.boxShadow = '';
      overlay.style.background = 'transparent';
    }

    // 보드 크기 초기화
    boardW.current = INIT_BOARD_W;
    boardH.current = INIT_BOARD_H;

    if (canvas) {
      if (canvas.width !== INIT_BOARD_W * CELL) canvas.width = INIT_BOARD_W * CELL;
      if (canvas.height !== INIT_BOARD_H * CELL) canvas.height = INIT_BOARD_H * CELL;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(CELL, CELL); }
    }

    // Lv9 색상반전 초기화
    removeInvert();
    // Lv11 코스믹 호러 초기화
    cosmicHorrorRef.current = false;
    blinkRef.current = { phase: 0, nextStartTime: 0, closingStartTime: 0 };

    // 테마 초기화
    firstEventFiredRef.current = false;
    themePhaseRef.current = 'normal';
    setThemePhase('normal');
    onThemeChange?.('normal');

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

    clearActiveEvent();
    evSandBurst.current = false;
    evExplodePending.current = false;
    evControlFreeze.current = false;
    floorDropCount.current = 0;
    randomLockPending.current = false;
    eventCooldown.current = getEventInterval(1);

    const sp = DROP_SPEEDS[level];
    dropInterval.current = sp[0];
    player.current.matrix = null;
    nextPiece.current = randomInsanePiece();
    playerReset();
    updateDisplay();
    setGameStatus('playing');
    lastTime.current = 0;
    animId.current = requestAnimationFrame(gameLoop);
    insaneBgm.stop();
    phase2Bgm.stop();
    defaultBgm.play();
    activeBgmRef.current = 'default';
    submittedIdRef.current = null;

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
      const current = activeBgmRef.current === 'phase2' ? phase2Bgm
                    : activeBgmRef.current === 'insane' ? insaneBgm
                    : defaultBgm;
      if (prev === 'playing') {
        if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
        draw();
        current.pause();
        return 'paused';
      } else if (prev === 'paused') {
        lastTime.current = 0;
        animId.current = requestAnimationFrame(gameLoop);
        current.resume();
        return 'playing';
      }
      return prev;
    });
  }, [draw, gameLoop, defaultBgm, insaneBgm, phase2Bgm]);

  // ===== 테마 전환 시 BGM 교체 (일반 → 인세인) =====
  useEffect(() => {
    if (themePhase !== 'insane') return;
    // 이미 phase2 재생 중이면 유지
    if (activeBgmRef.current === 'phase2') return;
    defaultBgm.stop();
    insaneBgm.play();
    activeBgmRef.current = 'insane';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themePhase]);

  // ===== 레벨 9 이상 & 인세인 페이즈 → phase2 BGM 교체 =====
  useEffect(() => {
    if (gameLevel < PHASE2_LEVEL_THRESHOLD) return;
    if (themePhaseRef.current !== 'insane') return;
    if (activeBgmRef.current === 'phase2') return;
    defaultBgm.stop();
    insaneBgm.stop();
    phase2Bgm.play();
    activeBgmRef.current = 'phase2';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameLevel]);

  // ===== 키보드 =====
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const status = gameStatus;
      if (status !== 'playing' && status !== 'paused') return;
      if (status === 'paused' && (e.key === 'p' || e.key === 'P')) { togglePause(); return; }
      if (status !== 'playing') return;
      if (evSpinBlock.current) {
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
    return () => {
      if (animId.current) cancelAnimationFrame(animId.current);
      flashTimerIds.current.forEach(id => clearTimeout(id));
      // BUG-02: 배너 퇴장 타이머 누수 방지
      if (bannerExitTimerRef.current) clearTimeout(bannerExitTimerRef.current);
      // Lv9 색상반전 언마운트 시 원복
      document.documentElement.style.filter = '';
    };
  }, []);

  // ===== 랭킹 (A: hard 고정) =====
  async function loadRanking() {
    setRankLoading(true);
    try { setRankings(await rankingsApi.getWeekly('blockfall-insane', 'hard') as RankEntry[]); }
    catch { setRankings([]); }
    finally { setRankLoading(false); }
  }
  async function loadAlltime() {
    try {
      const data = await rankingsApi.getAlltimeBest('blockfall-insane', 'hard');
      setAlltimeBest(data && (data as RankEntry).id ? data as RankEntry : null);
    } catch { setAlltimeBest(null); }
  }
  useEffect(() => { loadRanking(); loadAlltime(); }, []); // mount once

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false); setSubmitState('loading');
    try {
      const result = await rankingsApi.submit('blockfall-insane', {
        level: 'hard', name, score: scoreRef.current,
        gameLevel: gameLevelRef.current, linesCleared: linesRef.current,
        sessionId: sessionIdRef.current,
      });
      // 제출 성공 후 id 저장 (본인 행 판별)
      if (result && typeof (result as RankEntry).id === 'number') {
        submittedIdRef.current = (result as RankEntry).id;
      } else {
        submittedIdRef.current = null;
      }
      setModalOpen(false); setPlayerName(''); setSubmitState('idle');
      loadRanking(); loadAlltime();
    } catch { setSubmitState('error'); }
  }

  const statusText =
    gameStatus === 'idle'   ? '▶ 시작 버튼을 눌러주세요' :
    gameStatus === 'paused' ? 'PAUSE' :
    gameStatus === 'over'   ? 'GAME OVER' : '';

  // I: 랭킹 행 클래스 판별
  function getRankRowClass(r: RankEntry, idx: number): string {
    const isMine = submittedIdRef.current !== null
      ? r.id === submittedIdRef.current
      : r.name === playerName && playerName !== '';
    if (isMine) return styles.rankRowMine;
    if (idx === 0) return styles.rankRow1st;
    if (idx === 1) return styles.rankRow2nd;
    if (idx === 2) return styles.rankRow3rd;
    return '';
  }

  return (
    <div className={styles.wrap} data-theme={themePhase}>
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

        {/* F: .boardWrapper 신규 래퍼 */}
        <div className={`${styles.boardWrapper} ${gameLevel >= 10 ? styles.chromaticGlitch : ''}`}>
          <canvas
            ref={boardRef}
            width={INIT_BOARD_W * CELL}
            height={INIT_BOARD_H * CELL}
            className={styles.board}
          />
          {/* E: Flash Overlay */}
          <div ref={flashOverlayRef} className={styles.flashOverlay} />
        </div>
      </div>

      {/* 버튼 */}
      <div className={styles.controls}>
        <button
          className={styles.startBtn}
          onClick={(e) => { e.currentTarget.blur(); startGame(); }}
        >
          {gameStatus === 'idle' ? '▶ 시작' : '↺ 다시하기'}
        </button>
        <button className={styles.pauseBtn}
          disabled={gameStatus !== 'playing' && gameStatus !== 'paused'}
          onClick={togglePause}>
          {gameStatus === 'paused' ? '▶ 계속' : '⏸ 일시정지'}
        </button>
        <button className={styles.pauseBtn}
          onClick={toggleBgmMute}
          aria-label={defaultBgm.muted ? 'BGM 음소거 해제' : 'BGM 음소거'}
          title={defaultBgm.muted ? 'BGM 음소거 해제' : 'BGM 음소거'}>
          {defaultBgm.muted ? '🔇 BGM' : '🔊 BGM'}
        </button>
      </div>

      {/* 이벤트 수동 테스트 패널 — 어드민 전용 */}
      {user?.role === 'ADMIN' && <button
        className={`${styles.debugToggle} ${showDebug ? styles.debugToggleOpen : ''}`}
        onClick={() => setShowDebug(v => !v)}
      >
        🧪 이벤트 수동 테스트 {showDebug ? '▲' : '▼'}
      </button>}
      {user?.role === 'ADMIN' && showDebug && (
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

      {/* I: 랭킹 — INSANE 전용 단일 탭 */}
      <div className={styles.rankSection}>
        <h3 className={styles.insaneRankTitle}>
          <span className={styles.insaneWord}>INSANE</span> RANK
        </h3>
        {!showRules && alltimeBest && (
          <div className={styles.alltimeBanner}>
            <span className={styles.atLabel}>👑 역대 1위</span>
            <span className={styles.atContent}>
              {alltimeBest.name} · {(alltimeBest.score ?? 0).toLocaleString()}점 · Lv.{alltimeBest.gameLevel ?? 1} · {new Date(alltimeBest.createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
        )}
        {/* A: 단일 룰 탭만 */}
        <div className={styles.rankTabs}>
          <button
            className={`${styles.rankTab} ${!showRules ? styles.rankTabActive : ''}`}
            onClick={() => setShowRules(false)}
          >주간 랭킹</button>
          <button
            className={`${styles.rankTab} ${showRules ? styles.rankTabActive : ''}`}
            onClick={() => setShowRules(true)}
          >룰</button>
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
                  <tr
                    key={r.id}
                    className={getRankRowClass(r, i)}
                    style={{ animation: `${styles.rankRowSlideIn ?? 'rankRowSlideIn'} 0.3s ease-out ${i * 40}ms both` }}
                  >
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
