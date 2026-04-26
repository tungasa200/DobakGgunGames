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
import { useNavigate } from 'react-router-dom';
import { rankingsApi, startSession } from '../../api/rankings';
import { containsProfanity } from '../../utils/profanity';
import { useAuth } from '../../context/AuthContext';
import { useAdminTest } from '../../context/AdminTestContext';
import { useBgm } from '../../hooks/useBgm';
import styles from './BlockfallInsaneBoard.module.css';

const BGM_DEFAULT_SRC = '/bgm/blockfall/blockfall_default.mp3';
const BGM_INSANE_SRC = '/bgm/blockfall/blockfall_insane.mp3';
const BGM_INSANE_PHASE2_SRC = '/bgm/blockfall/blockfall_insane_phase2.mp3';
const BGM_INSANE_PHASE3_SRC = '/bgm/blockfall/blockfall_insane_phase3.mp3';
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
  | 'SAND_BURST' | 'LIQUID_FLOOD' | 'EXPLODE' | 'FLOOR_DROP' | 'SIDE_EXPAND'
  | 'CONTROL_FREEZE' | 'PIECE_SHATTER' | 'RANDOM_LOCK' | 'SPIN_BLOCK'
  | 'DOUBLE_TROUBLE';

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
const INIT_VISIBLE_H = 21;
const BUFFER_H = 2;
const INIT_BOARD_H = INIT_VISIBLE_H + BUFFER_H; // 23 — 내부 데이터 기준 (visible + buffer)
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
  { id: 'SIDE_EXPAND',     name: '측면 붕괴',   emoji: '🧱',  duration: 0,     weight: 1,   type: 'physical',   mobileExcluded: true, sub: '즉발 — 보드 폭 확장 + 파편' },
  { id: 'CONTROL_FREEZE',  name: '조작 마비',   emoji: '🥶',  duration: 2000,  weight: 1,   type: 'disruptive', sub: '2초 동안 조작 불가' },
  { id: 'PIECE_SHATTER',   name: '블록 분해',   emoji: '🧨',  duration: 0,     weight: 1,   type: 'disruptive', sub: '즉발 — 현재 피스 분해' },
  { id: 'RANDOM_LOCK',     name: '강제 고정',   emoji: '🔒',  duration: 0,     weight: 1,   type: 'disruptive', sub: '즉발 — 현재 위치 고정' },
  { id: 'SPIN_BLOCK',      name: '자동 회전',   emoji: '🎡',  duration: -1,    weight: 1,   type: 'disruptive', sub: '피스 낙하 중 자동 회전' },
  { id: 'DOUBLE_TROUBLE',  name: '쌍둥이 피스', emoji: '👯',  duration: 0,     weight: 0.8, type: 'disruptive', sub: '즉발 — 다음 피스가 쌍둥이로 낙하' },
];

// HIGH flash 등급 이벤트
const HIGH_FLASH_EVENTS = new Set<EventId>(['EXPLODE', 'FLOOR_DROP', 'SIDE_EXPAND', 'CONTROL_FREEZE']);

// DOUBLE_TROUBLE — single piece matrix를 좌우 쌍둥이로 합성. gap=1 (1셀 간격).
// 합성 결과가 보드 폭을 초과하면 null 반환 → 호출측에서 twin 적용 스킵.
function buildTwinMatrix(single: Matrix, boardW: number, gap = 1): Matrix | null {
  const sw = single[0].length;
  const sh = single.length;
  const totalW = sw * 2 + gap;
  if (totalW > boardW) return null;
  const twin: Matrix = Array.from({ length: sh }, () => new Array(totalW).fill(0));
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      twin[y][x] = single[y][x];
      twin[y][x + sw + gap] = single[y][x];
    }
  }
  return twin;
}

// ===== 헬퍼 =====
function createMatrix(w: number, h: number): Matrix {
  return Array.from({ length: h }, () => new Array(w).fill(0));
}

// ===== 피스 정의 =====
function createStandardPiece(type: string): Matrix {
  // 표준 SRS spawn 형태 — 모든 표준 7블록의 spawn 셀이 buffer zone(2줄) 안에 들어옴
  const P: Record<string, Matrix> = {
    T: [[0,1,0],[1,1,1],[0,0,0]],
    O: [[2,2],[2,2]],
    L: [[0,0,3],[3,3,3],[0,0,0]],
    J: [[4,0,0],[4,4,4],[0,0,0]],
    I: [[0,0,0,0],[5,5,5,5],[0,0,0,0],[0,0,0,0]],
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
  { matrix: createInsanePiece('WIDE_I'),    weight: 1.2 },
  { matrix: createInsanePiece('DOT'),       weight: 1.5 },
  { matrix: createInsanePiece('DOMINO'),    weight: 1.5 },
  { matrix: createInsanePiece('MINI_L'),    weight: 1.5 },
  { matrix: createInsanePiece('X'),         weight: 1.5 },
  { matrix: createInsanePiece('BIG_O'),     weight: 1.5 },
  { matrix: createInsanePiece('THUMBS_UP'), weight: 1.5 },
  { matrix: createInsanePiece('MIDDLE'),    weight: 1 },
];


// PIECE_POOL 전체를 Fisher-Yates 셔플 → Matrix 배열 반환 (딥카피)
function shuffleInsaneBag(): Matrix[] {
  const pool = PIECE_POOL.map(e => e.matrix.map(row => [...row]));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// recent: 최근 스폰된 피스 인덱스 배열 (recent[0]=1번 전, recent[1]=2번 전)
// 히스토리에 있는 피스는 가중치에 패널티 적용 (1번 전 ×0.3, 2번 전 ×0.6)
function randomInsanePiece(recent: number[] = []): { matrix: Matrix; index: number } {
  const weights = PIECE_POOL.map((entry, i) => {
    let w = entry.weight;
    if (i === recent[0]) w *= 0.3;
    else if (i === recent[1]) w *= 0.6;
    return w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PIECE_POOL.length; i++) {
    r -= weights[i];
    if (r <= 0) return { matrix: PIECE_POOL[i].matrix.map(row => [...row]), index: i };
  }
  return { matrix: PIECE_POOL[0].matrix.map(row => [...row]), index: 0 };
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
  const navigate = useNavigate();

  // ===== BGM (normal / insane / insane-phase2 / insane-phase3 4단계) =====
  const defaultBgm = useBgm(BGM_DEFAULT_SRC, { volume: 0.4 });
  const insaneBgm = useBgm(BGM_INSANE_SRC, { volume: 0.4 });
  const phase2Bgm = useBgm(BGM_INSANE_PHASE2_SRC, { volume: 0.4 });
  const phase3Bgm = useBgm(BGM_INSANE_PHASE3_SRC, { volume: 0.4 });
  const activeBgmRef = useRef<'default' | 'insane' | 'phase2' | 'phase3'>('default');
  const toggleBgmMute = useCallback(() => {
    defaultBgm.toggleMute();
    insaneBgm.toggleMute();
    phase2Bgm.toggleMute();
    phase3Bgm.toggleMute();
  }, [defaultBgm, insaneBgm, phase2Bgm, phase3Bgm]);

  function handleVolumeChange(v: number) {
    defaultBgm.setVolume(v);
    insaneBgm.setVolume(v);
    phase2Bgm.setVolume(v);
    phase3Bgm.setVolume(v);
  }

  // ===== 캔버스 refs =====
  const boardRef        = useRef<HTMLCanvasElement>(null);
  const nextRef         = useRef<HTMLCanvasElement>(null);
  const holdRef         = useRef<HTMLCanvasElement>(null);
  const timerBarRef     = useRef<HTMLDivElement>(null);
  const flashOverlayRef = useRef<HTMLDivElement>(null);
  const mockBagRef      = useRef<HTMLCanvasElement>(null);

  // ===== 보드 크기 =====
  const boardW = useRef(INIT_BOARD_W);
  const boardH = useRef(INIT_BOARD_H);

  // ===== 게임 상태 refs =====
  const arena       = useRef<Matrix>(createMatrix(INIT_BOARD_W, INIT_BOARD_H));
  const particles   = useRef<Particle[]>([]);
  const player      = useRef<Player>({ pos: { x: 0, y: 0 }, matrix: null });
  const nextPiece      = useRef<Matrix | null>(null);
  const nextPieceIdx   = useRef<number>(0);
  const recentPieces   = useRef<number[]>([]); // 최근 스폰 인덱스 (최대 2개) — 인세인 페이즈 랜덤 모드에서만 사용
  const bagQueueRef    = useRef<Matrix[]>([]);  // 일반 페이즈 7-bag 큐
  const bagActiveRef   = useRef<boolean>(true); // true=bag 사용, false=랜덤 전환됨
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
  const activeEventDurInit = useRef(0); // 타이머바 비율 계산용 (레벨 스케일 적용된 초기값)
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
  const cleanseLineAccum  = useRef(0);  // 정화 누적 (5개당 라인 1개 크레딧 → 레벨 진행)
  const evSpinBlock     = useRef(false);
  const randomLockPending = useRef(false); // RANDOM_LOCK 대기 중 (조건 충족 시 발동)
  const evSpinTimer     = useRef(0);
  const evDoublePending = useRef(false);   // DOUBLE_TROUBLE 대기 — 다음 spawn에서 piece가 twin이 됨
  const evTwinSingle    = useRef<Matrix | null>(null); // 현재 piece가 twin이면 single 원본 저장 (회전용)

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

  // ===== Lv11 + 10000점 초과: 페이지 배경 눈 기믹 =====
  const showHorrorBgRef = useRef(false);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgAnimRef = useRef<number | null>(null);
  const bgMouseRef = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
  });
  type BgEye = { x: number; y: number; phase: number; nextBlink: number; closingStart: number; blinkDur: number };
  const bgEyesRef = useRef<BgEye[]>([]);

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
  const [showHorrorBg, setShowHorrorBg] = useState(false);
  const [bagVisible, setBagVisible] = useState(true); // 일반 페이즈 bag UI 표시 여부
  const [boardExpanded, setBoardExpanded] = useState(false); // SIDE_EXPAND 이벤트로 보드 폭이 확장된 상태
  const bagVisibleRef = useRef(true); // fireRandomEvent 내부에서 bagVisible 참조용
  // 보드 위에 띄우는 콤보/보너스 오버레이 (canvas 밖으로 잘리지 않도록 HTML로 표시)
  const [comboOverlay, setComboOverlay] = useState<{ text: string; key: number } | null>(null);
  const comboOverlayKey = useRef(0);
  const bannerExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 랭킹
  const [rankings, setRankings]       = useState<RankEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [alltimeBest, setAlltimeBest] = useState<RankEntry | null>(null);
  const [showRules, setShowRules]     = useState(false);
  const [displayCount, setDisplayCount] = useState(10);
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

  // Block Out 전용: piece의 buffer zone 안 셀만 충돌 검사.
  // visible 영역 셀이 막혀도 spawn 허용 → 사용자가 옆으로 빼낼 기회.
  // 비표준 인세인 블록(X, THUMBS_UP, MIDDLE)은 spawn 시 visible 영역까지 점유하지만
  // buffer 안 셀이 비어있다면 spawn 허용 (인세인 컨셉).
  function collideInBuffer(pos: { x: number; y: number }, matrix: Matrix): boolean {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] === 0) continue;
        const ay = y + pos.y;
        const ax = x + pos.x;
        if (ay >= BUFFER_H) continue; // buffer 밖은 제외
        if (ax < 0 || ax >= boardW.current) return true;
        if (ay < 0) continue;
        if ((arena.current[ay]?.[ax] ?? 0) !== 0) return true;
        if (hasSettledAt(ax, ay)) return true;
      }
    }
    return false;
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
    // Lv11 + 444,444점 초과: 페이지 배경 눈 기믹 발동
    if (gameLevelRef.current === 11 && scoreRef.current > 444444 && !showHorrorBgRef.current) {
      showHorrorBgRef.current = true;
      setShowHorrorBg(true);
    }
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
      let explosionCleansed = 0; // [Feature 1] 폭발 반경 내 죽은 블럭/샌드 제거 수
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R2) continue;
          const ex = Math.round(cx + dx), ey = Math.round(cy + dy);
          if (ey < 0 || ey >= boardH.current || ex < 0 || ex >= boardW.current) continue;
          if (arena.current[ey][ex] !== 0) {
            if (arena.current[ey][ex] === DEAD_COLOR) explosionCleansed++;
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
      // settled 파티클도 범위 내 제거 — 제거 전 DEAD 여부 카운트
      explosionCleansed += particles.current.filter(p => {
        if (p.state !== 'settled' || p.colorIndex !== DEAD_COLOR) return false;
        const dx = p.x - cx, dy = p.y - cy;
        return dx * dx + dy * dy <= R2;
      }).length;
      particles.current = particles.current.filter(p => {
        if (p.state !== 'settled') return true;
        const dx = p.x - cx, dy = p.y - cy;
        return dx * dx + dy * dy > R2;
      });
      recheckSettled();
      // [Feature 1] 폭발로 죽은 블럭/샌드를 처치했을 때 보너스
      if (explosionCleansed > 0) {
        const cleanseBonus = explosionCleansed * 30 * gameLevelRef.current;
        scoreRef.current += cleanseBonus;
        const text = `CLEANSE x${explosionCleansed}  +${cleanseBonus.toLocaleString()}`;
        comboText.current = text;
        comboAlpha.current = 2.0;
        setComboOverlay({ text, key: ++comboOverlayKey.current });
        // [Feature 1+] 정화 누적 → 라인 크레딧 → 레벨업 체크
        applyCleanseLineCredit(explosionCleansed);
        checkLevelUp();
        updateDisplay();
      }
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
    // [Feature 1] 클리어 과정에서 제거된 죽은 블럭/샌드 수집 (보너스용)
    let cleansedDead = 0; // 죽은 블럭(DEAD_COLOR 사각 + settled DEAD 샌드) 제거 수

    for (let y = boardH.current - 1; y > 0; y--) {
      if (!isRowFull(y)) continue;

      // 클리어 행에 맞닿은 위/아래 행의 죽은 블럭 제거
      for (const adjY of [y - 1, y + 1]) {
        if (adjY < 0 || adjY >= boardH.current) continue;
        for (let x = 0; x < boardW.current; x++) {
          if (arena.current[adjY]?.[x] === DEAD_COLOR) {
            arena.current[adjY][x] = 0;
            cleansedDead++;
          }
        }
      }
      const beforeLen = particles.current.length;
      particles.current = particles.current.filter(p =>
        !(p.state === 'settled' && p.colorIndex === DEAD_COLOR &&
          (Math.round(p.y) === y - 1 || Math.round(p.y) === y + 1))
      );
      cleansedDead += beforeLen - particles.current.length;

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
    // [Lv11 Phase 3 Ramp] Lv11에서 Phase 3(444,444)까지의 "grind 구간"(100k-400k)에만 점수 배수 적용.
    // 100k ×1.1 / 200k ×1.3 / 300k ×1.5 / 400k+ 기본(×1.0) — home stretch는 원래 난이도로 마무리.
    if (gameLevelRef.current === 11) {
      const s = scoreRef.current;
      const rampMul =
        s >= 400000 ? 1.0 :
        s >= 300000 ? 1.5 :
        s >= 200000 ? 1.3 :
        s >= 100000 ? 1.1 : 1.0;
      if (rampMul > 1.0) baseScore = Math.round(baseScore * rampMul);
    }

    comboCount.current++;
    const comboBonus = comboCount.current >= 2 ? 50 * (comboCount.current - 1) * gameLevelRef.current : 0;
    scoreRef.current += baseScore + comboBonus;
    linesRef.current += count;

    if (comboCount.current >= 2) {
      const text = `COMBO x${comboCount.current}  +${comboBonus.toLocaleString()}`;
      comboText.current = text;
      comboAlpha.current = 1.5;
      setComboOverlay({ text, key: ++comboOverlayKey.current });
    }
    // [Feature 1] 죽은 블럭/샌드 제거 보너스 — 라인 클리어 부수 효과로 처치 불가 요소를 치웠을 때 추가 점수
    if (cleansedDead > 0) {
      const cleanseBonus = cleansedDead * 30 * gameLevelRef.current;
      scoreRef.current += cleanseBonus;
      const text = `CLEANSE x${cleansedDead}  +${cleanseBonus.toLocaleString()}`;
      comboText.current = text;
      comboAlpha.current = 2.0;
      setComboOverlay({ text, key: ++comboOverlayKey.current });
      // [Feature 1+] 정화 누적 → 5개마다 라인 1개 크레딧 (레벨 진행 완화)
      applyCleanseLineCredit(cleansedDead);
    }
    checkLevelUp();
    updateDisplay();
  }

  // 정화 누적을 라인 크레딧으로 환산 (5개 = 1 라인)
  function applyCleanseLineCredit(cleansedCount: number) {
    cleanseLineAccum.current += cleansedCount;
    while (cleanseLineAccum.current >= 5) {
      cleanseLineAccum.current -= 5;
      linesRef.current += 1;
    }
  }

  // 레벨업 체크 + 진입 효과 (라인 클리어·정화 양쪽에서 호출)
  function checkLevelUp() {
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
    activeEventDurInit.current = 0;
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

      case 'DOUBLE_TROUBLE': {
        evDoublePending.current = true;
        triggerShake(10, 350);
        setBoardFilter('hue-rotate(60deg) saturate(1.6) brightness(1.15)', 450);
        break;
      }

      case 'SAND_BURST':
        evSandBurst.current = true;
        break;

      case 'LIQUID_FLOOD': {
        setBoardFilter('saturate(2.2) hue-rotate(15deg)', 500);
        const n = boardW.current + Math.floor(Math.random() * boardW.current * 5);
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

        // 리셋 시: 정착 파티클 제거 + 제거 수만큼 점수 부여 + 피스 위치 보정
        // — 보드 축소로 인해 collide()가 즉시 true를 반환해 게임오버 나는 현상 방지
        if (isReset) {
          const settledCount = particles.current.filter(p => p.state === 'settled').length;
          particles.current = particles.current.filter(p => p.state !== 'settled');
          if (settledCount > 0) {
            const bonus = settledCount * 10 * gameLevelRef.current;
            scoreRef.current += bonus;
            const text = `BONUS  +${bonus.toLocaleString()}`;
            comboText.current = text;
            comboAlpha.current = 2.0;
            setComboOverlay({ text, key: ++comboOverlayKey.current });
            updateDisplay();
          }
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

      case 'SIDE_EXPAND': {
        // 11 ↔ 15 토글 방식: 현재 기본 폭이면 확장(+4), 이미 확장 중이면 원복
        const isReset = boardW.current > INIT_BOARD_W;
        const TARGET_EXPAND_W = INIT_BOARD_W + 4; // 15

        if (isReset) {
          // 원복: 기본 폭으로
          boardW.current = INIT_BOARD_W;
          for (let y = 0; y < arena.current.length; y++) {
            arena.current[y] = arena.current[y].slice(0, INIT_BOARD_W);
          }
          // 늘어난 영역에 있던 정착 파티클 제거
          particles.current = particles.current.filter(p =>
            !(p.state === 'settled' && p.x >= INIT_BOARD_W)
          );
        } else {
          // 확장: bag 패널 자리로 한 번에 +4 열
          const addCols = TARGET_EXPAND_W - boardW.current;
          boardW.current = TARGET_EXPAND_W;
          for (let y = 0; y < arena.current.length; y++) {
            for (let i = 0; i < addCols; i++) arena.current[y].push(0);
          }
        }

        const canvas = boardRef.current;
        if (canvas) {
          canvas.width = boardW.current * CELL;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.scale(CELL, CELL);
        }

        triggerShake(isReset ? 18 : 8, isReset ? 600 : 300);
        setBoardFilter('hue-rotate(270deg) contrast(1.4) saturate(1.8)', 400);

        // 쌓인 블럭 전체 박살 (FLOOR_DROP과 동일한 파편 연출)
        for (let y = 0; y < boardH.current; y++) {
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
        if (isReset) {
          particles.current = particles.current.filter(p => p.state !== 'settled');
          if (player.current.matrix) {
            const pw = player.current.matrix[0].length;
            player.current.pos.x = Math.min(
              player.current.pos.x,
              Math.max(0, boardW.current - pw)
            );
          }
        }

        // bag 패널 자리 회수 여부를 React 렌더에 반영
        setBoardExpanded(boardW.current > INIT_BOARD_W);

        setTimeout(() => triggerShake(18, 800), 200);
        break;
      }

    }

    // 지속형 이벤트 관리
    if (def.duration > 0) {
      activeEventId.current = id;
      // Lv4부터 레벨당 10%씩 지속시간 감소, 최소 20% (난이도 완화)
      // Lv1-3: 100% / Lv4: 90% / ... / Lv10: 30% / Lv11: 20%
      const lv = gameLevelRef.current;
      const durMul = lv < 4 ? 1 : Math.max(0.2, 1 - (lv - 3) * 0.1);
      const scaledDur = def.duration * durMul;
      activeEventDur.current = scaledDur;
      activeEventDurInit.current = scaledDur;
    }
    if (def.duration === -1) {
      activeEventId.current = id;
      activeEventDur.current = -1;
      activeEventDurInit.current = -1;
    }
  }

  function fireRandomEvent() {
    const isMobile = isMobileRef.current;
    // Lv10+ 에서는 바닥 붕괴/측면 붕괴의 가중치를 대폭 낮춰 아주 낮은 확률로 발동
    // — 고레벨에서 shatter 기반 초기화 이벤트가 빈발하면 오히려 난이도가 하락하는 문제 완화
    const highLevel = gameLevelRef.current >= 10;
    // Lv9+ 에서는 조작 마비 제외 — 고속 낙하 구간에서 2초 조작 불가는 거의 즉사 수준
    const midHighLevel = gameLevelRef.current >= 9;
    // SIDE_EXPAND는 bag UI가 숨겨진 상태(인세인 페이즈 bag 소진 후)에서만 발동.
    // 확장 시 bag 패널 자리를 회수하므로, bag이 보이는 중에는 레이아웃 충돌 방지를 위해 제외.
    const bagHidden = !bagVisibleRef.current;
    const pool = EVENT_POOL.filter(e => {
      if (isMobile && e.mobileExcluded) return false;
      if (!bagHidden && e.id === 'SIDE_EXPAND') return false;
      if (midHighLevel && e.id === 'CONTROL_FREEZE') return false;
      return true;
    });
    // 가중치 보정:
    //  - Lv10+: FLOOR_DROP/SIDE_EXPAND → 0.1 (원래 1 대비 약 1/10)
    //  - Lv9+: RANDOM_LOCK → 0.5 (원래 1 대비 약 1/2, 고속 낙하 구간에서 원치 않은 고정 완화)
    const getWeight = (e: EventDef) => {
      if (highLevel && (e.id === 'FLOOR_DROP' || e.id === 'SIDE_EXPAND')) return 0.1;
      if (midHighLevel && e.id === 'RANDOM_LOCK') return 0.5;
      return e.weight;
    };
    const totalW = pool.reduce((s, e) => s + getWeight(e), 0);
    let r = Math.random() * totalW;
    for (const def of pool) {
      r -= getWeight(def);
      if (r <= 0) { fireEvent(def); return; }
    }
    fireEvent(pool[pool.length - 1]);
  }

  // ===== 피스 드로우: 일반 페이즈=bag, 인세인 페이즈 bag 소진 후=랜덤 =====
  function drawNext(): { matrix: Matrix; index: number } {
    if (bagActiveRef.current) {
      // 일반 페이즈: 미리보기 5칸이 비지 않도록 큐가 6개 미만이면 즉시 다음 bag을 이어 붙임.
      // 인세인 페이즈에서는 의도적으로 bag을 소진시켜 랜덤 전환을 유도하므로 미리 채우지 않음.
      if (themePhaseRef.current === 'normal' && bagQueueRef.current.length < 6) {
        bagQueueRef.current = bagQueueRef.current.concat(shuffleInsaneBag());
      }
      // bag이 비었으면
      if (bagQueueRef.current.length === 0) {
        if (themePhaseRef.current === 'normal') {
          // 일반 페이즈: bag 재충전 (위 미리채움이 동작했다면 여기 도달하지 않음)
          bagQueueRef.current = shuffleInsaneBag();
        } else {
          // 인세인 페이즈: bag 소진 → 랜덤 전환
          bagActiveRef.current = false;
          setBagVisible(false);
          bagVisibleRef.current = false;
          recentPieces.current = [];
          const r = randomInsanePiece([]);
          return { matrix: r.matrix, index: r.index };
        }
      }
      return { matrix: bagQueueRef.current.shift()!, index: -1 };
    } else {
      // 랜덤 모드 (인세인 페이즈)
      const r = randomInsanePiece(recentPieces.current);
      recentPieces.current = [r.index, ...recentPieces.current].slice(0, 2);
      return { matrix: r.matrix, index: r.index };
    }
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

    // 현재 피스 확정
    player.current.matrix = nextPiece.current ?? drawNext().matrix;
    // 다음 피스 미리 뽑기
    const next = drawNext();
    nextPiece.current = next.matrix;
    nextPieceIdx.current = next.index;

    // DOUBLE_TROUBLE — pending 상태면 현재 piece를 좌우 쌍둥이로 합성
    // 직전 piece의 twin 상태는 항상 리셋 (lockPiece 직후 호출되므로)
    evTwinSingle.current = null;
    if (evDoublePending.current) {
      const twinMx = buildTwinMatrix(player.current.matrix!, boardW.current, 1);
      if (twinMx) {
        evTwinSingle.current = player.current.matrix!.map(r => [...r]);
        player.current.matrix = twinMx;
      }
      evDoublePending.current = false;
    }

    const pm = player.current.matrix!;
    isPieceT.current = pm.some(row => row.includes(1));
    player.current.pos.y = 0;
    player.current.pos.x = (boardW.current / 2 | 0) - (pm[0].length / 2 | 0);

    // 스폰 위치에 정착한 파티클(모래·파편) 제거
    // — 이벤트 파편이 스폰존에 쌓여 의문의 게임오버가 나는 현상 방지
    // — 아레나 셀이 막힌 경우(진짜 게임오버)는 아래 collideInBuffer에서 판정
    const px = player.current.pos.x;
    const py = player.current.pos.y;
    particles.current = particles.current.filter(p => {
      if (p.state !== 'settled') return true;
      const rx = Math.round(p.x) - px;
      const ry = Math.round(p.y) - py;
      if (ry < 0 || ry >= pm.length || rx < 0 || rx >= pm[0].length) return true;
      return pm[ry][rx] === 0; // 피스 셀이 있는 위치의 파티클만 제거
    });

    // Block Out: buffer zone 안 spawn 셀이 막혀있으면 즉시 게임오버 (visible 영역 셀은 제외)
    if (collideInBuffer(player.current.pos, pm)) {
      doGameOver();
    }
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
    phase3Bgm.stop();
    activeBgmRef.current = 'default';
    setGameStatus('over');
    // Block Out 직후 spawn된 piece 잔존 방지 — null 처리해 draw에서 그려지지 않게
    player.current.matrix = null;
    isLanding.current = false;
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

    // ===== Buffer zone 반투명 박스 (vanish zone 시각 표시) =====
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, bw, BUFFER_H);
    ctx.restore();

    // ===== Block Out 위험 셀 X 마크 =====
    // nextPiece의 spawn 셀 표시. 인세인 비표준 블록은 visible 영역까지 X 확장 (5b 정책).
    // 위험 임계선: 보드 전체 최상단 블록이 buffer + 위 3줄 안일 때만 표시.
    const DANGER_LIMIT_Y = BUFFER_H + 3;
    let globalTopY = bh;
    findTopX: for (let y = 0; y < DANGER_LIMIT_Y && y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if ((arena.current[y]?.[x] ?? 0) !== 0) { globalTopY = y; break findTopX; }
      }
    }
    const nextMx = nextPiece.current;
    if (nextMx && globalTopY < DANGER_LIMIT_Y) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.95)';
      ctx.lineWidth = 0.13;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      const npx = (bw / 2 | 0) - (nextMx[0].length / 2 | 0);
      for (let ny = 0; ny < nextMx.length; ny++) {
        for (let nx = 0; nx < nextMx[ny].length; nx++) {
          if (nextMx[ny][nx] === 0) continue;
          const dx = nx + npx;
          const dy = ny;
          if (dx < 0 || dx >= bw || dy < 0 || dy >= bh) continue;
          if ((arena.current[dy]?.[dx] ?? 0) !== 0) continue; // 빈 칸에만
          if (hasSettledAt(dx, dy)) continue;
          ctx.beginPath();
          ctx.moveTo(dx + 0.25, dy + 0.25);
          ctx.lineTo(dx + 0.75, dy + 0.75);
          ctx.moveTo(dx + 0.75, dy + 0.25);
          ctx.lineTo(dx + 0.25, dy + 0.75);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // T-스핀 오버레이 — visible 영역 중앙에 표시 (buffer 보정)
    if (tspinAlpha.current > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tspinAlpha.current);
      ctx.font = 'bold 1.1px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.12;
      const tspinY = BUFFER_H + (bh - BUFFER_H) / 2 - 4;
      ctx.strokeText(tspinText.current, bw / 2, tspinY);
      ctx.fillStyle = '#ff6ec7';
      ctx.fillText(tspinText.current, bw / 2, tspinY);
      ctx.restore();
      tspinAlpha.current -= 0.025;
    }

    // 콤보/보너스 오버레이는 canvas 밖으로 잘리는 것을 방지하기 위해 HTML div 오버레이로 이동
    // (.comboOverlay + comboOverlayPop 애니메이션 참고)

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

    // BAG 패널 캔버스 — 일반 페이즈에서 bag 큐 앞 5개 미리보기
    // mockBagRef는 초기 scale 미설정 → setTransform으로 매 프레임 명시적 지정
    const bp = mockBagRef.current;
    if (bp) {
      const bctx = bp.getContext('2d');
      if (bctx) {
        bctx.setTransform(CELL, 0, 0, CELL, 0, 0); // 1단위 = CELL px
        bctx.fillStyle = themePhaseRef.current === 'normal' ? '#111827' : '#0a0a0a';
        bctx.fillRect(0, 0, 4, INIT_VISIBLE_H);
        if (bagActiveRef.current) {
          const remaining = bagQueueRef.current;
          const maxShow = 5; // 최대 5개 — INIT_VISIBLE_H/5=4.2셀, MIDDLE(4행) 수용 가능
          const slotH = INIT_VISIBLE_H / maxShow;
          for (let i = 0; i < Math.min(remaining.length, maxShow); i++) {
            const m = remaining[i];
            const ox = (4 - m[0].length) / 2;
            const oy = slotH * i + (slotH - m.length) / 2;
            m.forEach((row, ry) => row.forEach((val, rx) => {
              if (val !== 0) drawCell(bctx, rx + ox, ry + oy, val, 1);
            }));
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawCell(context: CanvasRenderingContext2D, x: number, y: number, colorIndex: number, alpha: number) {
    const saved = context.globalAlpha;
    context.globalAlpha *= alpha;
    const isDead = evColorGray.current || colorIndex === DEAD_COLOR;
    const palette = themePhaseRef.current === 'normal' ? COLORS_PRE_EVENT : COLORS;

    if (cosmicHorrorRef.current) {
      // Lv11 코스믹 호러: invert 상태에서 아주 살짝 밝게 그려 완전검정 대신 옅은 회색으로 보이게
      context.fillStyle = '#f0f0f0';
      context.fillRect(x, y, 1, 1);
      // 흐릿한 회색 테두리 (invert 후 어두운 윤곽)
      context.fillStyle = 'rgba(180,180,180,0.5)';
      context.fillRect(x, y, 1, 0.04);
      context.fillRect(x, y, 0.04, 1);
      context.fillRect(x, y + 0.96, 1, 0.04);
      context.fillRect(x + 0.96, y, 0.04, 1);
      // 실제로 죽은 블록(DEAD_COLOR)만 눈 없음 — COLOR_GRAY 이벤트 중에도 눈 유지
      if (colorIndex !== DEAD_COLOR) drawCosmicEye(context, x, y);
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

    // 깜빡임 진행도 (0=완전 열림, 1=완전 닫힘). 색맹 이벤트 중엔 강제 감김.
    const blink = evColorGray.current ? 1 : blinkRef.current.phase;
    const yScale = Math.max(1 - blink, 0.1); // 완전 감김 시 얇은 가로선

    // 흰자: yScale에 따라 위아래로 납작해지며 감김
    context.fillStyle = '#000000';
    context.beginPath();
    context.ellipse(cx, cy, eyeRadiusX, eyeRadiusY * yScale, 0, 0, Math.PI * 2);
    context.fill();

    // 반 이상 감겼으면 홍채/동공 숨김 (모양 깨짐 방지)
    if (blink > 0.35) return;

    // 홍채 (밝은 청록으로 그리면 invert 후 검붉은색 #800000)
    const irisX = cx + nx * gazeOffsetX;
    const irisY = cy + ny * gazeOffsetY;
    context.fillStyle = '#7fffff';
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
    if (activeEventId.current && activeEventDur.current > 0 && activeEventDurInit.current > 0) {
      activeEventDur.current -= dt;
      const def = EVENT_POOL.find(e => e.id === activeEventId.current);
      if (def && def.duration > 0 && timerBarRef.current) {
        timerBarRef.current.style.width = `${Math.max(0, activeEventDur.current / activeEventDurInit.current) * 100}%`;
      }
      if (activeEventDur.current <= 0) {
        // [Feature 3] 이벤트 생존 보너스 — 지속형 이벤트를 자연 종료까지 버텼을 때 추가 점수
        // 보너스는 이벤트 스케일된 지속시간(초)에 비례: 50 × 초 × 레벨
        const survivedSec = Math.max(1, Math.round(activeEventDurInit.current / 1000));
        const survivalBonus = 50 * survivedSec * gameLevelRef.current;
        scoreRef.current += survivalBonus;
        // 오버레이 표시는 주석 처리 — 점수만 조용히 지급
        // const text = `EVENT SURVIVED  +${survivalBonus.toLocaleString()}`;
        // comboText.current = text;
        // comboAlpha.current = 2.0;
        // setComboOverlay({ text, key: ++comboOverlayKey.current });
        updateDisplay();
        clearActiveEvent();
      }
    }

    // 이벤트 쿨다운
    eventCooldown.current -= dt;
    if (eventCooldown.current <= 0) {
      fireRandomEvent();
      eventCooldown.current = getEventInterval(gameLevelRef.current);
    }

    // RANDOM_LOCK 대기 — 피스가 중앙 상단 구간을 벗어나는 순간 발동.
    // 단, buffer zone 안에선 lock하지 않음 (사용자 결정 2.b: visible로 끌어내릴 때까지 대기).
    if (randomLockPending.current && player.current.matrix) {
      const pm = player.current.matrix;
      const cx = player.current.pos.x + pm[0].length / 2;
      const inHorizCenter = cx >= Math.floor(boardW.current / 3) && cx <= Math.floor(boardW.current * 2 / 3);
      const inTopQuarter  = player.current.pos.y < Math.floor(boardH.current / 4);
      // piece의 모든 채워진 셀이 visible 영역(y >= BUFFER_H)에 들어왔는지 확인
      let allInVisible = true;
      outerVis: for (let y = 0; y < pm.length; y++) {
        for (let x = 0; x < pm[y].length; x++) {
          if (pm[y][x] !== 0 && (y + player.current.pos.y) < BUFFER_H) { allInVisible = false; break outerVis; }
        }
      }
      if ((!inHorizCenter || !inTopQuarter) && allInVisible) {
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

    // Twin 모드: original을 회전 → twin 재조립 → 중심 보정 → kick
    if (evTwinSingle.current) {
      const original = evTwinSingle.current;
      const posX = player.current.pos.x;
      const oldTwin = player.current.matrix!;
      const oldOriginal = original.map(r => [...r]);
      rotateMatrix(original, dir);
      const newTwin = buildTwinMatrix(original, boardW.current, 1);
      if (!newTwin) {
        // 회전 후 보드 폭 초과 → 회전 취소
        original.length = 0;
        oldOriginal.forEach(r => original.push(r));
        return;
      }
      const oldW = oldTwin[0].length;
      const newW = newTwin[0].length;
      player.current.matrix = newTwin;
      player.current.pos.x = posX + Math.floor((oldW - newW) / 2);
      // 좌우 kick
      let offset = 1;
      while (collide(player.current.pos, player.current.matrix!)) {
        player.current.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (Math.abs(offset) > player.current.matrix![0].length) {
          // kick 실패 → 전체 원복
          original.length = 0;
          oldOriginal.forEach(r => original.push(r));
          player.current.matrix = oldTwin;
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
      return;
    }

    const posX = player.current.pos.x;
    const posY = player.current.pos.y;
    const mtx = player.current.matrix!;
    const isWideI = mtx.some(row => row.some(c => c === 8));
    const prevW = mtx[0].length;
    const prevH = mtx.length;
    let offset = 1;
    rotateMatrix(mtx, dir);
    if (isWideI) {
      const newW = mtx[0].length;
      const newH = mtx.length;
      player.current.pos.x += Math.floor((prevW - newW) / 2);
      player.current.pos.y += Math.floor((prevH - newH) / 2);
    }
    while (collide(player.current.pos, player.current.matrix!)) {
      player.current.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > player.current.matrix![0].length) {
        rotateMatrix(player.current.matrix!, -dir);
        player.current.pos.x = posX;
        if (isWideI) player.current.pos.y = posY;
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
    // Twin 피스는 hold 불가 — single matrix만 hold하면 twin 상태 추적이 깨짐
    if (evTwinSingle.current) return;
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
    // 배경 눈 기믹 초기화
    showHorrorBgRef.current = false;
    setShowHorrorBg(false);
    bgEyesRef.current = [];

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
    cleanseLineAccum.current = 0;
    setBoardExpanded(false);
    randomLockPending.current = false;
    evDoublePending.current = false;
    evTwinSingle.current = null;
    eventCooldown.current = getEventInterval(1);

    const sp = DROP_SPEEDS[level];
    dropInterval.current = sp[0];
    player.current.matrix = null;
    recentPieces.current = [];
    // bag 초기화 (일반 페이즈 시작)
    bagQueueRef.current = shuffleInsaneBag();
    bagActiveRef.current = true;
    setBagVisible(true);
    bagVisibleRef.current = true;
    // 첫 next 피스를 bag에서 뽑아 설정 (playerReset이 이것을 current로 사용)
    const firstBagDraw = drawNext();
    nextPiece.current = firstBagDraw.matrix;
    nextPieceIdx.current = firstBagDraw.index;
    playerReset();
    updateDisplay();
    setGameStatus('playing');
    lastTime.current = 0;
    animId.current = requestAnimationFrame(gameLoop);
    insaneBgm.stop();
    phase2Bgm.stop();
    phase3Bgm.stop();
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
      const current = activeBgmRef.current === 'phase3' ? phase3Bgm
                    : activeBgmRef.current === 'phase2' ? phase2Bgm
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
  }, [draw, gameLoop, defaultBgm, insaneBgm, phase2Bgm, phase3Bgm]);

  // ===== 테마 전환 시 BGM 교체 (일반 → 인세인) =====
  useEffect(() => {
    if (themePhase !== 'insane') return;
    // 이미 phase2/3 재생 중이면 유지
    if (activeBgmRef.current === 'phase2' || activeBgmRef.current === 'phase3') return;
    defaultBgm.stop();
    insaneBgm.play();
    activeBgmRef.current = 'insane';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themePhase]);

  // ===== 레벨 9 이상 & 인세인 페이즈 → phase2 BGM 교체 =====
  useEffect(() => {
    if (gameLevel < PHASE2_LEVEL_THRESHOLD) return;
    if (themePhaseRef.current !== 'insane') return;
    if (activeBgmRef.current === 'phase2' || activeBgmRef.current === 'phase3') return;
    defaultBgm.stop();
    insaneBgm.stop();
    phase2Bgm.play();
    activeBgmRef.current = 'phase2';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameLevel]);

  // ===== Lv11 + 444,444점 초과 → phase3 BGM 교체 =====
  useEffect(() => {
    if (!showHorrorBg) return;
    if (activeBgmRef.current === 'phase3') return;
    defaultBgm.stop();
    insaneBgm.stop();
    phase2Bgm.stop();
    phase3Bgm.play();
    activeBgmRef.current = 'phase3';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHorrorBg]);

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
    let sx = 0, sy = 0, st = 0;
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
        playerRotate(1);
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
      if (bgAnimRef.current) cancelAnimationFrame(bgAnimRef.current);
      flashTimerIds.current.forEach(id => clearTimeout(id));
      // BUG-02: 배너 퇴장 타이머 누수 방지
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (bannerExitTimerRef.current) clearTimeout(bannerExitTimerRef.current);
      // Lv9 색상반전 언마운트 시 원복
      document.documentElement.style.filter = '';
    };
  }, []);

  // ===== 마우스 추적 (배경 눈 시선) =====
  useEffect(() => {
    function onMove(e: MouseEvent) { bgMouseRef.current = { x: e.clientX, y: e.clientY }; }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // ===== 배경 눈 기믹 애니메이션 =====
  useEffect(() => {
    if (!showHorrorBg) {
      if (bgAnimRef.current) { cancelAnimationFrame(bgAnimRef.current); bgAnimRef.current = null; }
      return;
    }

    const canvas = bgCanvasRef.current;
    if (!canvas) return;

    // 뷰포트 맞춤
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width  = vw;
    canvas.height = vh;

    // 눈 격자 배치 (체크무늬 오프셋)
    const SPACING_X = 78;
    const SPACING_Y = 66;
    const cols = Math.ceil(vw / SPACING_X) + 2;
    const rows = Math.ceil(vh / SPACING_Y) + 2;
    const now = performance.now();
    const eyes: BgEye[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        eyes.push({
          x: c * SPACING_X + (r % 2) * (SPACING_X / 2) - SPACING_X / 2,
          y: r * SPACING_Y - SPACING_Y / 2,
          phase: 0,
          nextBlink: now + 4000 + Math.random() * 12000,
          closingStart: 0,
          blinkDur: 400 + Math.random() * 600,
        });
      }
    }
    bgEyesRef.current = eyes;

    // 눈 크기 (px)
    const RX = 17, RY = 9, IRIS_R = 6, PUPIL_R = 2.5, GAZE_X = 6, GAZE_Y = 3;

    function frame(time: number) {
      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      const tx = bgMouseRef.current.x;
      const ty = bgMouseRef.current.y;

      // ===== 크로매틱 글리치 오프셋 (CSS chromaticGlitch 와 동일한 4-스텝 패턴) =====
      // 페이지가 invert(1) 상태이므로: red→화면에서 teal, cyan→화면에서 red
      const GLITCH_CYCLE = 120; // ms
      const gStep = Math.floor((time % GLITCH_CYCLE) / (GLITCH_CYCLE / 4));
      const GR = ([ [3, 0], [-2, 1], [1, -2], [-3, -1] ] as const)[gStep];
      const GC = ([ [-3, 0], [2, -1], [-1, 2], [3, 1] ] as const)[gStep];

      for (const eye of bgEyesRef.current) {
        // 깜빡임 업데이트 — 눈마다 개별 blinkDur 사용
        if (eye.closingStart > 0) {
          const el = time - eye.closingStart;
          if (el >= eye.blinkDur) {
            eye.phase = 0;
            eye.closingStart = 0;
            eye.nextBlink = time + 6000 + Math.random() * 14000;
          } else {
            const half = eye.blinkDur / 2;
            eye.phase = el < half ? el / half : 1 - (el - half) / half;
          }
        } else if (eye.nextBlink > 0 && time >= eye.nextBlink) {
          eye.closingStart = time;
        }

        const yScale = Math.max(1 - eye.phase, 0.05);

        // 시선 방향
        const dx = tx - eye.x, dy = ty - eye.y;
        const len = Math.hypot(dx, dy);
        const nx = len > 1 ? dx / len : 0;
        const ny = len > 1 ? dy / len : 0;
        const irisX = eye.x + nx * GAZE_X;
        const irisY = eye.y + ny * GAZE_Y;

        // 크로매틱 프린지 (흰자 뒤에 red/cyan 번짐)
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = 'rgba(255,0,85,1)';
        ctx.beginPath();
        ctx.ellipse(eye.x + GR[0], eye.y + GR[1], RX, RY * yScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,255,255,1)';
        ctx.beginPath();
        ctx.ellipse(eye.x + GC[0], eye.y + GC[1], RX, RY * yScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 흰자: 흰색(#ffffff)으로 그림 → 페이지 invert → 검정
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y, RX, RY * yScale, 0, 0, Math.PI * 2);
        ctx.fill();

        if (eye.phase > 0.35) continue;

        // 홍채: #800000(진한빨강)으로 그림 → 페이지 invert → #7fffff(청록)
        ctx.fillStyle = '#800000';
        ctx.beginPath();
        ctx.arc(irisX, irisY, IRIS_R, 0, Math.PI * 2);
        ctx.fill();

        // 동공: 흰색(#ffffff)으로 그림 → 페이지 invert → 검정
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(irisX, irisY, PUPIL_R, 0, Math.PI * 2);
        ctx.fill();
      }

      bgAnimRef.current = requestAnimationFrame(frame);
    }

    bgAnimRef.current = requestAnimationFrame(frame);
    return () => {
      if (bgAnimRef.current) { cancelAnimationFrame(bgAnimRef.current); bgAnimRef.current = null; }
    };
  }, [showHorrorBg]);

  // ===== 랭킹 (A: hard 고정) =====
  async function loadRanking() {
    setRankLoading(true);
    setDisplayCount(10);
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

  const INSANE_LEVELS: { value: 'easy' | 'normal' | 'hard'; label: string }[] = [
    { value: 'easy',   label: '쉬움' },
    { value: 'normal', label: '보통' },
    { value: 'hard',   label: '어려움' },
  ];

  function handleDifficultyChange(lv: 'easy' | 'normal' | 'hard') {
    navigate('/blockfall', { state: { initDifficulty: lv } });
  }

  // 보드 헤더는 모든 페이즈에서 'INSANE' 고정 (over 시점에만 'YOU DIED')
  const statusText = gameStatus === 'over' ? 'YOU DIED' : 'INSANE';

  // I: 랭킹 행 클래스 판별
  const g = gameLevel >= 10 ? styles.chromaticGlitch : ''; // 글리치 단축 변수

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
    <>
    {/* 배경 눈 기믹 캔버스 — fixed, 게임 영역 뒤에 렌더링 */}
    {showHorrorBg && (
      <canvas
        ref={bgCanvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    )}
    <div className={styles.wrap} data-theme={themePhase} style={{ position: 'relative', zIndex: 1 }}>
      {/* 난이도 버튼 — 일반 페이즈: 일반 모드와 동일 UI + 인세인 active, 인세인 페이즈: 텍스트 변경 기믹 */}
      <div className={styles.diffRow}>
        {themePhase === 'insane' ? (
          <>
            {INSANE_LEVELS.map(lv => (
              <span key={lv.value} className={`${styles.diffBtn} ${styles.diffBtnInsanePhase} ${g}`}>
                 INSANE
              </span>
            ))}
            <span className={`${styles.diffBtn} ${styles.diffBtnInsanePhase} ${styles.diffBtnInsaneActive} ${g}`}>
               INSANE
            </span>
          </>
        ) : (
          <>
            {INSANE_LEVELS.map(lv => (
              <button
                key={lv.value}
                className={`${styles.diffBtn} ${g}`}
                onClick={() => handleDifficultyChange(lv.value)}
              >
                {lv.label}
              </button>
            ))}
            <button className={`${styles.diffBtn} ${styles.insaneActiveDiffBtn} ${g}`} disabled>
              🔥 인세인
            </button>
          </>
        )}
      </div>

      {/* 상단 infoBar 제거 — 점수/줄/레벨/콤보는 사이드패널 하단으로 이동 (TETR.IO 스타일) */}

      {/* 이벤트 타이머 바 */}
      <div className={`${styles.eventTimerBar} ${g}`}>
        <div ref={timerBarRef} className={styles.eventTimerFill} style={{ width: '0%' }} />
      </div>

      {sessionFailed && gameStatus === 'playing' && (
        <div className={styles.sessionFailBanner}>네트워크 오류로 이 게임은 랭킹에 등록되지 않습니다</div>
      )}

      {/* 게임 영역 */}
      <div className={styles.gameArea}>
        <div className={styles.sidePanel}>
          <div className={`${styles.sideBox} ${g}`}>
            <div className={styles.sideTitle}>NEXT</div>
            <canvas ref={nextRef} width={4 * CELL} height={4 * CELL} className={styles.miniCanvas} />
          </div>
          <div className={`${styles.sideBox} ${g}`}>
            <div className={styles.sideTitle}>HOLD</div>
            <canvas ref={holdRef} width={4 * CELL} height={4 * CELL} className={styles.miniCanvas} />
          </div>

          {/* 스탯 영역 — Lv≥10 시 영역 글리치가 아닌 텍스트별 RGB 분리 글리치 적용 */}
          <div className={`${styles.statsArea} ${gameLevel >= 10 ? styles.chromaticTextGlitch : ''}`}>
            <div className={styles.statRow}>
              <div className={styles.statLabel}>SCORE</div>
              <div className={styles.statValue}>{score.toLocaleString()}</div>
            </div>
            <div className={styles.statRow}>
              <div className={styles.statLabel}>LINES</div>
              <div className={styles.statValue}>{lines}</div>
            </div>
            <div className={styles.statRow}>
              <div className={styles.statLabel}>LEVEL</div>
              <div className={styles.statValue}>{gameLevel}</div>
            </div>
            <div className={styles.statRow}>
              <div className={styles.statLabel}>COMBO</div>
              <div className={`${styles.statValue} ${combo >= 2 ? styles.statCombo : ''}`}>
                {combo >= 2 ? `x${combo}` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* 보드 박스 — 흰 박스와 동일 구조, 인세인 다크 테마 */}
        <div className={`${styles.boardBox} ${g}`}>
          <div className={`${styles.boardStatusLine} ${gameStatus === 'over' ? styles.boardStatusOver : gameStatus === 'idle' ? styles.boardStatusIdle : ''}`}>
            {statusText}
          </div>
          <div className={styles.boardWrapper}>
            <canvas
              ref={boardRef}
              width={INIT_BOARD_W * CELL}
              height={INIT_BOARD_H * CELL}
              className={styles.board}
            />
            {/* E: Flash Overlay */}
            <div ref={flashOverlayRef} className={styles.flashOverlay} />
            {gameStatus === 'paused' && <div className={styles.pauseOverlay}>PAUSE</div>}
            {comboOverlay && (
              <div
                key={comboOverlay.key}
                className={styles.comboOverlay}
                onAnimationEnd={() => setComboOverlay(null)}
              >
                {comboOverlay.text}
              </div>
            )}
          </div>
        </div>

        {/* BAG 패널 — 일반 페이즈에서 bag 큐 미리보기, 인세인 페이즈 bag 소진 후 내부만 숨김.
            평소에는 레이아웃 폭(132px)을 항상 유지하여 gameArea 너비를 655px로 고정.
            SIDE_EXPAND 이벤트로 보드가 확장된 경우에는 패널 자체를 제거해
            확장된 board가 이 자리를 차지하도록 함. */}
        {!boardExpanded && (
          <div className={styles.bagPanel}>
            {bagVisible && (
              <div className={`${styles.sideBox} ${g}`}>
                <div className={styles.sideTitle}>BAG</div>
                <canvas
                  ref={mockBagRef}
                  width={4 * CELL}
                  height={INIT_VISIBLE_H * CELL}
                  className={styles.bagPanelCanvas}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className={styles.controls}>
        <button
          className={`${styles.startBtn} ${g}`}
          onClick={(e) => { e.currentTarget.blur(); startGame(); }}
        >
          {gameStatus === 'idle' ? '▶ 시작' : '↺ 다시하기'}
        </button>
        <button
          className={`${styles.pauseBtn} ${g}`}
          disabled={gameStatus !== 'playing' && gameStatus !== 'paused'}
          onClick={togglePause}
        >
          {gameStatus === 'paused' ? '▶ 계속' : '⏸ 일시정지'}
        </button>
        <div className={`${styles.bgmControl} ${g}`}>
          <button
            className={styles.bgmMuteBtn}
            onClick={toggleBgmMute}
            aria-label={defaultBgm.muted ? '음소거 해제' : '음소거'}
          >
            {defaultBgm.muted ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(defaultBgm.volume * 100)}
            onChange={e => handleVolumeChange(Number(e.target.value) / 100)}
            className={styles.bgmSlider}
            aria-label="BGM 볼륨"
          />
        </div>
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
                : rankings.slice(0, displayCount).map((r, i) => (
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
              {rankings.length > displayCount && (
                <tr>
                  <td colSpan={5} style={{ padding: '10px', textAlign: 'center', background: '#1a0a0a' }}>
                    <button
                      type="button"
                      onClick={() => setDisplayCount(c => c + 10)}
                      style={{
                        padding: '6px 24px', cursor: 'pointer',
                        background: '#1a1a1a', border: '1px solid #ff6b6b',
                        borderRadius: '4px', color: '#ff6b6b',
                        fontSize: '13px', fontWeight: 600,
                      }}
                    >
                      더보기
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 게임 오버 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3> INSANE — 게임 오버</h3>
            <p>최종 점수: <strong>{score.toLocaleString()}점</strong> (레벨 {gameLevel}, {lines}줄)</p>
            <input className={styles.nameInput} type="text" placeholder="이름을 입력하세요"
              value={playerName}
              onChange={e => { setPlayerName(e.target.value); setNameBanned(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus maxLength={50} />
            <p className={styles.ipNotice}>어뷰징 방지를 위해 IP 주소가 수집됩니다.</p>
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
    </>
  );
}
