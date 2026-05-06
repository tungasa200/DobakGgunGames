import { useCallback, useEffect, useRef, useState } from 'react';
import './blockfall-battle.css';
import OpponentBoard from './OpponentBoard';

// ── 상수 ──────────────────────────────────────────────────
const BOARD_W = 11;
const VISIBLE_H = 21;
const BUFFER_H = 2;
const BOARD_H = VISIBLE_H + BUFFER_H;
const CELL = 30;        // 일반 BlockfallBoard.tsx 와 동일
const CELL_MINI = 16;   // NEXT 미리보기 셀
const CELL_OPP = 14;    // 상대 보드 셀
const NEXT_QUEUE_SIZE = 5;
const NEXT_DISPLAY_COUNT = 5;  // NEXT 패널에 보여줄 슬롯 수 (1 next + 4 future)
const NEXT_SLOT_H_CELLS = 3.5; // 슬롯 높이 (mini-cell 단위) — 일반 모드 BAG_SLOT_H 와 동일 비율
const NEXT_PANEL_H_PX = NEXT_DISPLAY_COUNT * NEXT_SLOT_H_CELLS * CELL_MINI; // 17.5 * 16 = 280
const MAX_OPP_SLOTS = 4; // 5인 최대 — 나를 제외한 상대 슬롯 수

// 내 보드 섹션의 자연 크기 — 모바일 scale 계산에 사용
const MY_SECTION_W = BOARD_W * CELL + 76 + 76; // 482px (left panel + canvas + right panel)
const MY_SECTION_H = BOARD_H * CELL + 50;       // ~740px (canvas + header + borders + padding)

const COLORS_NORMAL: (string | null)[] = [
  null,
  '#ffaa0d',
  '#f4b0c6',
  '#ABEE62',
  '#0DC2FF',
  '#46e37b',
  '#FFE138',
  '#CA41D9',
  '#ff88ff', // 8: rainbow
  '#888888', // 9: garbage
];

type Matrix = number[][];

function createMatrix(w: number, h: number): Matrix {
  return Array.from({ length: h }, () => new Array(w).fill(0));
}

function createPiece(type: string): Matrix {
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

function shuffleBag(): string[] {
  const bag = [...'TOLJISZ'];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function collide(arena: Matrix, pos: { x: number; y: number }, matrix: Matrix): boolean {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (
        matrix[y][x] !== 0 &&
        (arena[y + pos.y] === undefined || arena[y + pos.y][x + pos.x] !== 0)
      ) {
        return true;
      }
    }
  }
  return false;
}

function collideInBuffer(arena: Matrix, pos: { x: number; y: number }, matrix: Matrix): boolean {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x] !== 0 && y + pos.y < BUFFER_H) {
        if (arena[y + pos.y] === undefined || arena[y + pos.y][x + pos.x] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function mergeInto(arena: Matrix, pos: { x: number; y: number }, matrix: Matrix) {
  matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) arena[y + pos.y][x + pos.x] = val;
    });
  });
}

function rotateMatrix(matrix: Matrix, dir: number) {
  for (let y = 0; y < matrix.length; y++)
    for (let x = 0; x < y; x++)
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

// ── 드롭 속도 ──────────────────────────────────────────
// 일반 모드의 normal 과 hard 의 중간(평균) 속도 — 배틀의 가비지 압박 보정
const DROP_SPEEDS = [290, 245, 208, 177, 151, 129, 111, 95, 82, 71, 62];
const LINE_SCORES = [0, 100, 300, 500, 800];

const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;

// ── NEXT 미니 캔버스 draw 헬퍼 ──────────────────────────
function drawMiniCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  cell: number,
) {
  const px = x * cell;
  const py = y * cell;
  if (colorIndex === 8) {
    const hue = (Date.now() / 500 * 60 + x * 36 + y * 18) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
  } else {
    ctx.fillStyle = COLORS_NORMAL[colorIndex] ?? '#ccc';
  }
  ctx.fillRect(px, py, cell, cell);
  const hi = Math.round(cell * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(px, py, cell, hi);
  ctx.fillRect(px, py, hi, cell);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px, py + cell - hi, cell, hi);
  ctx.fillRect(px + cell - hi, py, hi, cell);
}

function drawMiniCanvas(
  canvas: HTMLCanvasElement,
  matrix: Matrix | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!matrix) return;
  const gridSize = 4;
  const ox = Math.floor((gridSize - matrix[0].length) / 2);
  const oy = Math.floor((gridSize - matrix.length) / 2);
  matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) drawMiniCell(ctx, x + ox, y + oy, val, CELL_MINI);
    });
  });
}

// 5 슬롯을 단일 캔버스에 세로로 쌓아 그림 — 일반 모드 BAG 패널과 동일 컨셉
function drawNextStack(canvas: HTMLCanvasElement, queue: (Matrix | null)[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gridW = 4;
  for (let i = 0; i < NEXT_DISPLAY_COUNT; i++) {
    const matrix = queue[i];
    if (!matrix) continue;
    const ox = (gridW - matrix[0].length) / 2;
    const oy = i * NEXT_SLOT_H_CELLS + (NEXT_SLOT_H_CELLS - matrix.length) / 2;
    matrix.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) drawMiniCell(ctx, x + ox, y + oy, val, CELL_MINI);
      });
    });
  }
}

// ── 클라이언트 측 새로고침 복원 (HOLD/bag/nextQueue) ─────
// 서버는 board/score 만 보관하므로, HOLD 와 7-bag 시퀀스는 sessionStorage 로 보조 복원.
const CLIENT_STATE_KEY = 'blockfall_battle_clientstate';

interface ClientStateSnapshot {
  holdPiece: Matrix | null;
  bag: string[];
  bagIdx: number;
  nextQueue: Matrix[];
}

function saveClientState(snap: ClientStateSnapshot) {
  try {
    sessionStorage.setItem(CLIENT_STATE_KEY, JSON.stringify(snap));
  } catch { /* quota / private mode — 무시 */ }
}

function loadClientState(): ClientStateSnapshot | null {
  try {
    const raw = sessionStorage.getItem(CLIENT_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientStateSnapshot;
    // 최소 형식 검증 — 변조/오래된 데이터 방어
    if (!Array.isArray(parsed.bag) || !Array.isArray(parsed.nextQueue)) return null;
    if (typeof parsed.bagIdx !== 'number') return null;
    return parsed;
  } catch { return null; }
}

function clearClientState() {
  try { sessionStorage.removeItem(CLIENT_STATE_KEY); } catch { /* ignore */ }
}

// ── Props ──────────────────────────────────────────────

export interface PlayerInfo {
  id: string;
  nickname: string;
  isGuest: boolean;
}

export interface OpponentBoardData {
  board: number[][];
  score: number;
  lines: number;
  level: number;
}

/**
 * 새로고침 복원용 초기 상태.
 * - board/score/lines/level/combo 는 서버 캐시(MY_GAME_STATE)에서 전달.
 * - HOLD/bag/nextQueue 는 sessionStorage 에서 자체 복원.
 */
export interface BattleInitialState {
  board: number[][];
  score: number;
  lines: number;
  level: number;
  combo: number;
}

interface BlockfallBattleBoardProps {
  players: PlayerInfo[];
  myPlayerId: string;
  opponents: Map<string, OpponentBoardData>;
  eliminatedPlayers: Map<string, { rank: number }>;
  garbagePending: number;
  onGameOver: (score: number) => void;
  onBlockOut: () => void;
  onBoardChange: (board: number[][], score: number, lines: number, level: number, combo: number) => void;
  onComboAttack: (combo: number) => void;
  onGarbageConsumed: () => void;
  isPlaying: boolean;
  isPractice?: boolean;
  /** 새로고침/재연결 시 서버에서 받은 본인 보드 스냅샷 — 있으면 fresh init 대신 복원 */
  initialState?: BattleInitialState | null;
}

export default function BlockfallBattleBoard({
  players,
  myPlayerId,
  opponents,
  eliminatedPlayers,
  garbagePending,
  onGameOver,
  onBlockOut,
  onBoardChange,
  onComboAttack,
  onGarbageConsumed,
  isPlaying,
  isPractice = false,
  initialState = null,
}: BlockfallBattleBoardProps) {
  const boardRef = useRef<HTMLCanvasElement>(null);

  // 우측 NEXT 단일 캔버스 — 5 슬롯 세로 스택 (맨 위가 다음 블록, 그 아래가 4개 future)
  const nextStackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // HOLD 캔버스
  const holdCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── 게임 상태 refs ──────────────────────────────────
  const arena = useRef<Matrix>(createMatrix(BOARD_W, BOARD_H));
  const playerPos = useRef({ x: 0, y: 0 });
  const playerMatrix = useRef<Matrix | null>(null);
  // 7-bag 5개 미리보기 큐
  const nextQueue = useRef<Matrix[]>([]);
  const bagRef = useRef<string[]>([]);
  const bagIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const levelRef = useRef(1);
  const comboCount = useRef(0);
  const dropCounter = useRef(0);
  const dropInterval = useRef(DROP_SPEEDS[0]);
  const lastTime = useRef(0);
  const animId = useRef<number | null>(null);
  const isLanding = useRef(false);
  const lockCounter = useRef(0);
  const lockResets = useRef(0);
  const isGameOver = useRef(false);
  const garbagePendingRef = useRef(0);
  const boardChangeThrottle = useRef(0);

  // HOLD 상태 refs
  const holdPiece = useRef<Matrix | null>(null);
  const holdUsed = useRef(false);

  // React state (UI 표시용)
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [garbageFlash, setGarbageFlash] = useState(false);
  // holdActive: CSS 클래스 적용용 (holdUsed.current의 React state 사본)
  const [holdActive, setHoldActive] = useState(false);

  // 모바일 스케일 — 뷰포트 600px 이하에서 내 보드를 축소
  const [mobileScale, setMobileScale] = useState(1.0);

  // garbage pending 동기화
  useEffect(() => {
    if (garbagePending > garbagePendingRef.current && !isGameOver.current) {
      setGarbageFlash(true);
      setTimeout(() => setGarbageFlash(false), 300);
    }
    garbagePendingRef.current = garbagePending;
  }, [garbagePending]);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth <= 600) {
        const available = window.innerWidth - 16; // 8px padding × 2 (.battle-content on mobile)
        setMobileScale(Math.min(1, available / MY_SECTION_W));
      } else {
        setMobileScale(1);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const drawCell = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
  ) => {
    const px = x * CELL;
    const py = y * CELL;

    if (colorIndex === 8) {
      const hue = (Date.now() / 500 * 60 + x * 36 + y * 18) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
    } else {
      ctx.fillStyle = COLORS_NORMAL[colorIndex] ?? '#ccc';
    }
    ctx.fillRect(px, py, CELL, CELL);
    const hi = Math.round(CELL * 0.07);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(px, py, CELL, hi);
    ctx.fillRect(px, py, hi, CELL);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(px, py + CELL - hi, CELL, hi);
    ctx.fillRect(px + CELL - hi, py, hi, CELL);
  }, []);

  const draw = useCallback(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, BOARD_W * CELL, BOARD_H * CELL);

    // 그리드
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 1; x < BOARD_W; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, BOARD_H * CELL); ctx.stroke();
    }
    for (let y = 1; y < BOARD_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(BOARD_W * CELL, y * CELL); ctx.stroke();
    }

    // 쌓인 블록
    arena.current.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) drawCell(ctx, x, y, val);
      });
    });

    // 고스트
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (pm) {
      let gy = pp.y;
      while (!collide(arena.current, { x: pp.x, y: gy + 1 }, pm)) gy++;
      if (gy > pp.y) {
        ctx.globalAlpha = 0.2;
        pm.forEach((row, y) => {
          row.forEach((val, x) => {
            if (val !== 0) drawCell(ctx, x + pp.x, y + gy, val);
          });
        });
        ctx.globalAlpha = 1.0;
      }

      // 현재 피스
      pm.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) drawCell(ctx, x + pp.x, y + pp.y, val);
        });
      });
    }

    // buffer zone 표시 (일반 모드와 동일한 반투명 흰색 오버레이)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, BOARD_W * CELL, BUFFER_H * CELL);
    ctx.restore();

    // ===== Block Out 위험 셀 X 마크 (일반 모드 BlockfallBoard.tsx 와 동일 로직) =====
    // 다음 블록(nextQueue[0])의 buffer zone 안 spawn 셀만 X로 표시.
    // 위험 임계선: 보드 전체 최상단 블록이 buffer + 위 3줄 안(y < 5)에 있을 때만 표시.
    const DANGER_LIMIT_Y = BUFFER_H + 3;
    let globalTopY = BOARD_H;
    findTop: for (let y = 0; y < DANGER_LIMIT_Y && y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        if (arena.current[y][x] !== 0) { globalTopY = y; break findTop; }
      }
    }
    const next = nextQueue.current[0];
    if (next && globalTopY < DANGER_LIMIT_Y) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.95)';
      ctx.lineWidth = CELL * 0.13;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      const npx = (BOARD_W / 2 | 0) - (next[0].length / 2 | 0);
      for (let ny = 0; ny < next.length; ny++) {
        if (ny >= BUFFER_H) break;
        for (let nx = 0; nx < next[ny].length; nx++) {
          if (next[ny][nx] === 0) continue;
          const dx = nx + npx;
          const dy = ny;
          if (!arena.current[dy] || arena.current[dy][dx] !== 0) continue;
          const cx = dx * CELL;
          const cy = dy * CELL;
          ctx.beginPath();
          ctx.moveTo(cx + CELL * 0.25, cy + CELL * 0.25);
          ctx.lineTo(cx + CELL * 0.75, cy + CELL * 0.75);
          ctx.moveTo(cx + CELL * 0.75, cy + CELL * 0.25);
          ctx.lineTo(cx + CELL * 0.25, cy + CELL * 0.75);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 우측 NEXT 단일 캔버스 — 5 슬롯 세로 스택 (맨 위가 다음 블록)
    if (nextStackCanvasRef.current) {
      drawNextStack(nextStackCanvasRef.current, nextQueue.current);
    }

    // HOLD 캔버스 갱신
    if (holdCanvasRef.current) {
      const hctx = holdCanvasRef.current.getContext('2d');
      if (hctx) {
        hctx.save();
        hctx.globalAlpha = holdUsed.current ? 0.35 : 1.0;
        drawMiniCanvas(holdCanvasRef.current, holdPiece.current);
        hctx.restore();
      }
    }
  }, [drawCell]);

  const updateDisplay = useCallback(() => {
    setScore(scoreRef.current);
    setLines(linesRef.current);
    setLevel(levelRef.current);
    setCombo(comboCount.current);
  }, []);

  const getBoardSnapshot = useCallback((): number[][] => {
    return arena.current.map(row => [...row]);
  }, []);

  const drawFromBag = useCallback((): Matrix => {
    if (bagRef.current.length - bagIdxRef.current < 7) {
      bagRef.current = bagRef.current.slice(bagIdxRef.current).concat(shuffleBag());
      bagIdxRef.current = 0;
    }
    return createPiece(bagRef.current[bagIdxRef.current++]);
  }, []);

  // isPractice ref — 클로저에서 최신값 참조
  const isPracticeRef = useRef(isPractice);
  useEffect(() => { isPracticeRef.current = isPractice; }, [isPractice]);

  const doGameOver = useCallback(() => {
    if (isGameOver.current) return;

    if (isPracticeRef.current) {
      // 연습 모드: 1.5초 후 자동 재시작
      isGameOver.current = true;
      if (animId.current) {
        cancelAnimationFrame(animId.current);
        animId.current = null;
      }
      playerMatrix.current = null;
      draw();

      setTimeout(() => {
        // 컴포넌트가 unmount 됐으면 스킵
        if (isGameOver.current === false) return;

        // 재초기화
        isGameOver.current = false;
        arena.current = createMatrix(BOARD_W, BOARD_H);
        scoreRef.current = 0;
        linesRef.current = 0;
        levelRef.current = 1;
        comboCount.current = 0;
        dropCounter.current = 0;
        dropInterval.current = DROP_SPEEDS[0];
        isLanding.current = false;
        lockCounter.current = 0;
        lockResets.current = 0;
        garbagePendingRef.current = 0;
        holdPiece.current = null;
        holdUsed.current = false;
        setHoldActive(false);

        bagRef.current = shuffleBag();
        bagIdxRef.current = 0;
        nextQueue.current = [];
        for (let i = 0; i < NEXT_QUEUE_SIZE; i++) {
          nextQueue.current.push(drawFromBag());
        }
        // playerReset은 nextQueue에서 shift해서 쓰므로 직접 처리
        isLanding.current = false;
        lockCounter.current = 0;
        lockResets.current = 0;
        holdUsed.current = false;
        setHoldActive(false);
        playerMatrix.current = nextQueue.current.shift() ?? drawFromBag();
        nextQueue.current.push(drawFromBag());
        playerPos.current.y = 0;
        playerPos.current.x = (BOARD_W / 2 | 0) - ((playerMatrix.current[0].length / 2) | 0);

        updateDisplay();
        lastTime.current = 0;
        // gameLoop는 아래에서 재귀 등록되므로 직접 호출
        animId.current = requestAnimationFrame((time) => {
          lastTime.current = time;
          draw();
          // gameLoop ref를 통해 루프 재시작
          gameLoopRef.current(time);
        });
      }, 1500);
      return;
    }

    isGameOver.current = true;
    if (animId.current) {
      cancelAnimationFrame(animId.current);
      animId.current = null;
    }
    playerMatrix.current = null;
    draw();
    // 본인 게임 종료 — 새로고침 복원 캐시 정리
    clearClientState();
    onBlockOut();
    onGameOver(scoreRef.current);
  }, [draw, drawFromBag, onBlockOut, onGameOver, updateDisplay]);

  // 새로고침 복원용 — HOLD/bag/nextQueue 상태를 sessionStorage 에 저장.
  // 실제 배틀(연습 X) 중에만 동작.
  const persistClientState = useCallback(() => {
    if (isGameOver.current) return;
    if (isPracticeRef.current) return;
    saveClientState({
      holdPiece: holdPiece.current,
      bag: bagRef.current,
      bagIdx: bagIdxRef.current,
      nextQueue: nextQueue.current,
    });
  }, []);

  const playerReset = useCallback(() => {
    isLanding.current = false;
    lockCounter.current = 0;
    lockResets.current = 0;
    holdUsed.current = false;
    setHoldActive(false);
    // 큐에서 현재 피스 꺼내고, 큐 보충
    playerMatrix.current = nextQueue.current.shift() ?? drawFromBag();
    nextQueue.current.push(drawFromBag());
    playerPos.current.y = 0;
    playerPos.current.x = (BOARD_W / 2 | 0) - ((playerMatrix.current[0].length / 2) | 0);

    persistClientState();

    if (collideInBuffer(arena.current, playerPos.current, playerMatrix.current)) {
      doGameOver();
    }
  }, [doGameOver, drawFromBag, persistClientState]);

  // HOLD 기능
  const playerHold = useCallback(() => {
    if (holdUsed.current) return;
    if (isGameOver.current) return;
    if (!playerMatrix.current) return;

    holdUsed.current = true;
    setHoldActive(true);

    if (!holdPiece.current) {
      // 홀드에 아무것도 없음: 현재 피스를 홀드, 큐에서 다음 피스 가져옴
      holdPiece.current = playerMatrix.current;
      playerMatrix.current = nextQueue.current.shift() ?? drawFromBag();
      nextQueue.current.push(drawFromBag());
    } else {
      // 홀드에 피스 있음: 현재 피스와 교체
      const tmp = holdPiece.current;
      holdPiece.current = playerMatrix.current;
      playerMatrix.current = tmp;
    }

    // 새 피스 위치 초기화
    playerPos.current.y = 0;
    playerPos.current.x = (BOARD_W / 2 | 0) - ((playerMatrix.current[0].length / 2) | 0);

    // 랜딩/락 상태 리셋
    isLanding.current = false;
    lockCounter.current = 0;
    lockResets.current = 0;

    persistClientState();

    if (collideInBuffer(arena.current, playerPos.current, playerMatrix.current)) {
      doGameOver();
    }
  }, [doGameOver, drawFromBag, persistClientState]);

  // Garbage line 적용 (piece lock 시점에 호출)
  const applyGarbage = useCallback((lines: number) => {
    if (isPracticeRef.current || lines <= 0) return;
    const holeX = Math.floor(Math.random() * BOARD_W);
    for (let i = 0; i < lines; i++) {
      arena.current.shift();
      const garbageLine = new Array(BOARD_W).fill(9);
      garbageLine[holeX] = 0;
      arena.current.push(garbageLine);
    }
    if (playerMatrix.current && collideInBuffer(arena.current, playerPos.current, playerMatrix.current)) {
      doGameOver();
    }
    onGarbageConsumed();
  }, [doGameOver, onGarbageConsumed]);

  const arenaSweep = useCallback(() => {
    let count = 0;
    for (let y = arena.current.length - 1; y > 0; y--) {
      if (arena.current[y].every(v => v !== 0)) {
        const row = arena.current.splice(y, 1)[0].fill(0);
        arena.current.unshift(row);
        y++;
        count++;
      }
    }
    if (count > 0) {
      comboCount.current++;
      const base = (LINE_SCORES[count] ?? LINE_SCORES[4]) * levelRef.current;
      const comboBonus = comboCount.current >= 2 ? 50 * (comboCount.current - 1) * levelRef.current : 0;
      scoreRef.current += base + comboBonus;
      linesRef.current += count;
      const newLv = Math.min(Math.floor(linesRef.current / 10) + 1, 11);
      if (newLv > levelRef.current) {
        levelRef.current = newLv;
        dropInterval.current = DROP_SPEEDS[Math.min(newLv - 1, DROP_SPEEDS.length - 1)];
      }
      // 콤보 공격 발동 (2콤보 이상, 연습 모드 제외)
      if (comboCount.current >= 2 && !isPracticeRef.current) {
        onComboAttack(comboCount.current);
      }
    } else {
      comboCount.current = 0;
    }
    updateDisplay();
  }, [onComboAttack, updateDisplay]);

  const lockPiece = useCallback(() => {
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (!pm) return;

    if (collide(arena.current, pp, pm)) {
      doGameOver();
      return;
    }

    mergeInto(arena.current, pp, pm);
    playerReset();
    arenaSweep();

    // garbage 적용 (lock 시점, 연습 모드 제외)
    const pending = garbagePendingRef.current;
    if (pending > 0) {
      applyGarbage(pending);
    }

    isLanding.current = false;
    lockCounter.current = 0;

    // 보드 상태 전송 (연습 모드 제외, 200ms throttle)
    if (!isPracticeRef.current) {
      const now = Date.now();
      if (now - boardChangeThrottle.current >= 200) {
        boardChangeThrottle.current = now;
        onBoardChange(getBoardSnapshot(), scoreRef.current, linesRef.current, levelRef.current, comboCount.current);
      }
    }
  }, [applyGarbage, arenaSweep, doGameOver, getBoardSnapshot, onBoardChange, playerReset]);

  // ── 개별 게임 액션 — 키보드·터치 공용 ───────────────────
  const doMoveLeft = useCallback(() => {
    if (isGameOver.current) return;
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (!pm) return;
    pp.x--;
    if (collide(arena.current, pp, pm)) pp.x++;
    else if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
      lockCounter.current = 0; lockResets.current++;
    }
  }, []);

  const doMoveRight = useCallback(() => {
    if (isGameOver.current) return;
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (!pm) return;
    pp.x++;
    if (collide(arena.current, pp, pm)) pp.x--;
    else if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
      lockCounter.current = 0; lockResets.current++;
    }
  }, []);

  const doRotateCW = useCallback(() => {
    if (isGameOver.current) return;
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (!pm) return;
    const posX = pp.x;
    let offset = 1;
    rotateMatrix(pm, 1);
    while (collide(arena.current, pp, pm)) {
      pp.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > pm[0].length) { rotateMatrix(pm, -1); pp.x = posX; break; }
    }
    if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
      lockCounter.current = 0; lockResets.current++;
    }
  }, []);

  const doRotateCCW = useCallback(() => {
    if (isGameOver.current) return;
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (!pm) return;
    const posX = pp.x;
    let offset = 1;
    rotateMatrix(pm, -1);
    while (collide(arena.current, pp, pm)) {
      pp.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > pm[0].length) { rotateMatrix(pm, 1); pp.x = posX; break; }
    }
    if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
      lockCounter.current = 0; lockResets.current++;
    }
  }, []);

  const doSoftDrop = useCallback(() => {
    if (isGameOver.current) return;
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (!pm) return;
    pp.y++;
    if (collide(arena.current, pp, pm)) {
      pp.y--;
      if (!isLanding.current) { isLanding.current = true; lockCounter.current = 0; }
    } else {
      isLanding.current = false; lockCounter.current = 0; scoreRef.current++;
    }
    dropCounter.current = 0;
  }, []);

  const doHardDrop = useCallback(() => {
    if (isGameOver.current) return;
    const pm = playerMatrix.current;
    const pp = playerPos.current;
    if (!pm) return;
    let gy = pp.y;
    while (!collide(arena.current, { x: pp.x, y: gy + 1 }, pm)) gy++;
    if (collide(arena.current, { x: pp.x, y: gy }, pm)) {
      doGameOver();
    } else {
      scoreRef.current += (gy - pp.y) * 2;
      pp.y = gy;
      lockPiece();
    }
  }, [doGameOver, lockPiece]);

  // 터치 버튼 반복 입력 — 좌우 이동·소프트 드롭에 사용
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRepeat = useCallback((action: () => void, interval = 80) => {
    action();
    if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    repeatTimerRef.current = setInterval(action, interval);
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    };
  }, []);

  // gameLoop ref — doGameOver 내부 재시작에서 참조
  const gameLoopRef = useRef<(time: number) => void>(() => {});

  // 게임 루프
  const gameLoop = useCallback((time: number) => {
    if (isGameOver.current) return;
    const dt = time - lastTime.current;
    lastTime.current = time;
    dropCounter.current += dt;

    if (isLanding.current) {
      lockCounter.current += dt;
      if (lockCounter.current >= LOCK_DELAY) {
        lockPiece();
        if (animId.current === null) return;
      }
    }

    if (dropCounter.current > dropInterval.current) {
      const pm = playerMatrix.current;
      const pp = playerPos.current;
      if (pm) {
        pp.y++;
        if (collide(arena.current, pp, pm)) {
          pp.y--;
          if (!isLanding.current) { isLanding.current = true; lockCounter.current = 0; }
        } else {
          isLanding.current = false;
          lockCounter.current = 0;
        }
      }
      dropCounter.current = 0;
      updateDisplay();
    }

    draw();
    animId.current = requestAnimationFrame(gameLoop);
  }, [draw, lockPiece, updateDisplay]);

  // gameLoopRef 최신화
  useEffect(() => { gameLoopRef.current = gameLoop; }, [gameLoop]);

  // 게임 시작/종료
  useEffect(() => {
    if (!isPlaying && !isPractice) {
      if (animId.current) {
        cancelAnimationFrame(animId.current);
        animId.current = null;
      }
      return;
    }

    // 게임 초기화
    isGameOver.current = false;
    isLanding.current = false;
    lockCounter.current = 0;
    lockResets.current = 0;
    dropCounter.current = 0;
    holdUsed.current = false;
    setHoldActive(false);
    garbagePendingRef.current = 0;

    const isRestore = !!initialState && isPlaying && !isPractice;

    if (isRestore) {
      // 새로고침 복원 — 서버 스냅샷 + sessionStorage 클라이언트 상태
      arena.current = initialState!.board.map(row => [...row]);
      scoreRef.current = initialState!.score;
      linesRef.current = initialState!.lines;
      levelRef.current = Math.max(1, initialState!.level);
      comboCount.current = initialState!.combo;
      dropInterval.current = DROP_SPEEDS[Math.min(levelRef.current - 1, DROP_SPEEDS.length - 1)];

      const cs = loadClientState();
      if (cs) {
        holdPiece.current = cs.holdPiece;
        bagRef.current = cs.bag;
        bagIdxRef.current = cs.bagIdx;
        nextQueue.current = cs.nextQueue;
      } else {
        // 클라이언트 측 데이터가 없는 경우 (다른 디바이스 접속 등) — bag 새로 시작
        holdPiece.current = null;
        bagRef.current = shuffleBag();
        bagIdxRef.current = 0;
        nextQueue.current = [];
        for (let i = 0; i < NEXT_QUEUE_SIZE; i++) nextQueue.current.push(drawFromBag());
      }
    } else {
      // 신규 게임 — fresh init + 이전 클라이언트 상태 캐시 정리
      arena.current = createMatrix(BOARD_W, BOARD_H);
      scoreRef.current = 0;
      linesRef.current = 0;
      levelRef.current = 1;
      comboCount.current = 0;
      dropInterval.current = DROP_SPEEDS[0];
      holdPiece.current = null;
      bagRef.current = shuffleBag();
      bagIdxRef.current = 0;
      nextQueue.current = [];
      for (let i = 0; i < NEXT_QUEUE_SIZE; i++) nextQueue.current.push(drawFromBag());
      if (isPlaying && !isPractice) clearClientState();
    }

    playerReset();
    updateDisplay();

    lastTime.current = 0;
    animId.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animId.current) {
        cancelAnimationFrame(animId.current);
        animId.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isPractice]);

  // 키보드 입력
  useEffect(() => {
    if (!isPlaying && !isPractice) return;

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowLeft':  e.preventDefault(); doMoveLeft();  break;
        case 'ArrowRight': e.preventDefault(); doMoveRight(); break;
        case 'ArrowDown':  e.preventDefault(); doSoftDrop();  break;
        case 'ArrowUp':
        case 'KeyX':       e.preventDefault(); doRotateCW();  break;
        case 'KeyZ':       e.preventDefault(); doRotateCCW(); break;
        case 'Space':      e.preventDefault(); doHardDrop();  break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':       e.preventDefault(); playerHold();  break;
        default: break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, isPractice, doMoveLeft, doMoveRight, doRotateCW, doRotateCCW, doSoftDrop, doHardDrop, playerHold]);

  // 보드 상태 주기적 전송 (200ms) — 실제 게임 중에만 (연습 모드 제외)
  useEffect(() => {
    if (!isPlaying || isPractice) return;
    const interval = setInterval(() => {
      if (!isGameOver.current) {
        onBoardChange(getBoardSnapshot(), scoreRef.current, linesRef.current, levelRef.current, comboCount.current);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, isPractice, getBoardSnapshot, onBoardChange]);

  const myPlayer = players.find(p => p.id === myPlayerId);
  const opponentPlayers = players.filter(p => p.id !== myPlayerId);

  const myNickname = isPractice && players.length === 0
    ? '연습 중'
    : (myPlayer?.nickname ?? (isPractice ? '연습 중' : '나'));

  return (
    <div className="battle-layout">
      {/* 좌측: 내 보드 (크게) */}
      <div className="battle-my-section">
        {/* 모바일에서 transform: scale()로 보드를 뷰포트에 맞게 축소 */}
        <div
          className="battle-my-scaler"
          style={mobileScale < 1 ? {
            transform: `scale(${mobileScale})`,
            transformOrigin: 'top center',
            width: MY_SECTION_W,
            marginBottom: `${-(MY_SECTION_H * (1 - mobileScale))}px`,
          } : undefined}
        >
        <div className={`battle-board-item mine ${garbageFlash ? 'garbage-flash' : ''}`}>
          <div className="battle-board-item-header">
            <span className="battle-board-nickname mine">
              {myNickname}
              {myPlayer?.isGuest && (
                <span style={{ marginLeft: 4, fontSize: '0.78em', color: '#8b949e' }}>
                  손님
                </span>
              )}
            </span>
            <span className="battle-board-score">{score.toLocaleString()}</span>
          </div>

          {/* 좌측 패널 + 보드 캔버스 + 우측 패널 가로 래퍼 */}
          <div className="battle-my-play-area">

            {/* 좌측 패널: HOLD + Stats (NEXT는 우측 패널 최상단으로 통합) */}
            <div className="battle-my-left-panel">
              <div className="battle-side-box">
                <div className="battle-side-title">HOLD</div>
                <canvas
                  ref={holdCanvasRef}
                  width={CELL_MINI * 4}
                  height={CELL_MINI * 4}
                  className={`battle-next-mini-canvas${holdActive ? ' battle-hold-used' : ''}`}
                />
              </div>
              <div className="battle-stats-area">
                <div className="battle-stat-row">
                  <span className="battle-stat-label">SCORE</span>
                  <span className="battle-stat-value">{score.toLocaleString()}</span>
                </div>
                <div className="battle-stat-row">
                  <span className="battle-stat-label">LINES</span>
                  <span className="battle-stat-value">{lines}</span>
                </div>
                <div className="battle-stat-row">
                  <span className="battle-stat-label">LEVEL</span>
                  <span className="battle-stat-value">{level}</span>
                </div>
                {combo >= 2 && (
                  <div className="battle-stat-row">
                    <span className="battle-stat-label">COMBO</span>
                    <span className="battle-stat-value combo">{combo}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 보드 캔버스 래퍼 — 일반 모드와 동일하게 buffer zone 포함한 BOARD_H 전체를 노출 */}
            <div
              className="battle-board-canvas-wrap"
              style={{
                position: 'relative',
                height: BOARD_H * CELL,
                flexShrink: 0,
              }}
            >
              <canvas
                ref={boardRef}
                width={BOARD_W * CELL}
                height={BOARD_H * CELL}
                style={{
                  display: 'block',
                  width: BOARD_W * CELL,
                  height: BOARD_H * CELL,
                }}
              />
              {garbagePending > 0 && (
                <div className="battle-garbage-badge">
                  -{garbagePending}
                </div>
              )}
            </div>

            {/* 우측 패널: NEXT 단일 캔버스 (5 슬롯 세로 스택) */}
            <div className="battle-my-right-panel">
              <div className="battle-side-title battle-right-next-title">NEXT</div>
              <canvas
                ref={el => { nextStackCanvasRef.current = el; }}
                width={CELL_MINI * 4}
                height={NEXT_PANEL_H_PX}
                className="battle-next-mini-canvas"
              />
            </div>
          </div>
        </div>
        </div>{/* end battle-my-scaler */}

        {/* 터치 컨트롤 — CSS로 모바일(≤600px)에서만 표시 */}
        <div className="battle-touch-controls">
          <div className="btc-row">
            <button
              className="btc-btn"
              onPointerDown={() => startRepeat(doMoveLeft)}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              type="button"
              aria-label="왼쪽"
            >◀</button>
            <button
              className="btc-btn btc-rotate-btn"
              onPointerDown={doRotateCW}
              type="button"
              aria-label="회전"
            >↺</button>
            <button
              className="btc-btn"
              onPointerDown={() => startRepeat(doMoveRight)}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              type="button"
              aria-label="오른쪽"
            >▶</button>
          </div>
          <div className="btc-row">
            <button
              className="btc-btn btc-hold-btn"
              onPointerDown={playerHold}
              type="button"
              aria-label="홀드"
            >HOLD</button>
            <button
              className="btc-btn"
              onPointerDown={() => startRepeat(doSoftDrop, 50)}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              type="button"
              aria-label="내리기"
            >▼</button>
            <button
              className="btc-btn btc-hard-btn"
              onPointerDown={doHardDrop}
              type="button"
              aria-label="하드 드롭"
            >⬇</button>
          </div>
        </div>
      </div>

      {/* 우측: 상대 슬롯 3개 */}
      <div className="battle-opponents-section">
        {Array.from({ length: MAX_OPP_SLOTS }, (_, i) => {
          const op = opponentPlayers[i];
          if (!op) {
            return (
              <div key={`empty-${i}`} className="battle-board-item battle-opp-waiting-slot">
                <div className="battle-board-item-header">
                  <span className="battle-board-nickname" style={{ color: '#484f58' }}>대기 중...</span>
                </div>
                <div
                  className="battle-opp-waiting-body"
                  style={{ width: BOARD_W * CELL_OPP, height: BOARD_H * CELL_OPP }}
                >
                  <span className="battle-opp-waiting-icon">⏳</span>
                </div>
              </div>
            );
          }
          const opData = opponents.get(op.id);
          const eliminated = eliminatedPlayers.get(op.id);
          return (
            <OpponentBoard
              key={op.id}
              nickname={op.nickname}
              isGuest={op.isGuest}
              board={opData?.board ?? createMatrix(BOARD_W, BOARD_H)}
              score={opData?.score ?? 0}
              isEliminated={eliminated !== undefined}
              rank={eliminated?.rank}
              cellSize={CELL_OPP}
              isWaiting={isPractice}
            />
          );
        })}
      </div>
    </div>
  );
}
