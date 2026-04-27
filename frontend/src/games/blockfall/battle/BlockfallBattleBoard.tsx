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
const NEXT_DISPLAY_LEFT = 1;   // 좌측 패널에 보여줄 NEXT 개수
const NEXT_DISPLAY_RIGHT = 3;  // 우측 패널에 보여줄 NEXT 개수
const MAX_OPP_SLOTS = 4; // 5인 최대 — 나를 제외한 상대 슬롯 수

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
const DROP_SPEEDS = [400, 340, 290, 248, 213, 183, 158, 137, 119, 104, 91];
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
}: BlockfallBattleBoardProps) {
  const boardRef = useRef<HTMLCanvasElement>(null);

  // 좌측 NEXT 1개 캔버스
  const nextLeftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // 우측 NEXT 3개 캔버스
  const nextRightCanvasRefs = useRef<(HTMLCanvasElement | null)[]>(
    Array.from({ length: NEXT_DISPLAY_RIGHT }, () => null)
  );
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

  // garbage pending 동기화
  useEffect(() => {
    if (garbagePending > garbagePendingRef.current && !isGameOver.current) {
      setGarbageFlash(true);
      setTimeout(() => setGarbageFlash(false), 300);
    }
    garbagePendingRef.current = garbagePending;
  }, [garbagePending]);

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

    // buffer zone 표시
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, 0, BOARD_W * CELL, BUFFER_H * CELL);
    ctx.restore();

    // 좌측 NEXT 1개 (index 0)
    if (nextLeftCanvasRef.current) {
      drawMiniCanvas(nextLeftCanvasRef.current, nextQueue.current[0] ?? null);
    }

    // 우측 NEXT 3개 (index 1, 2, 3)
    nextRightCanvasRefs.current.forEach((c, i) => {
      if (c) drawMiniCanvas(c, nextQueue.current[i + NEXT_DISPLAY_LEFT] ?? null);
    });

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
    onBlockOut();
    onGameOver(scoreRef.current);
  }, [draw, drawFromBag, onBlockOut, onGameOver, updateDisplay]);

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

    if (collideInBuffer(arena.current, playerPos.current, playerMatrix.current)) {
      doGameOver();
    }
  }, [doGameOver, drawFromBag]);

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

    if (collideInBuffer(arena.current, playerPos.current, playerMatrix.current)) {
      doGameOver();
    }
  }, [doGameOver, drawFromBag]);

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
    // 5개 NEXT 큐 초기화
    nextQueue.current = [];
    for (let i = 0; i < NEXT_QUEUE_SIZE; i++) {
      nextQueue.current.push(drawFromBag());
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
      if (isGameOver.current) return;
      const pm = playerMatrix.current;
      const pp = playerPos.current;
      if (!pm) return;

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          pp.x--;
          if (collide(arena.current, pp, pm)) pp.x++;
          else {
            if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
              lockCounter.current = 0;
              lockResets.current++;
            }
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          pp.x++;
          if (collide(arena.current, pp, pm)) pp.x--;
          else {
            if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
              lockCounter.current = 0;
              lockResets.current++;
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          pp.y++;
          if (collide(arena.current, pp, pm)) {
            pp.y--;
            if (!isLanding.current) { isLanding.current = true; lockCounter.current = 0; }
          } else {
            isLanding.current = false;
            lockCounter.current = 0;
            scoreRef.current++;
          }
          dropCounter.current = 0;
          break;
        case 'ArrowUp':
        case 'KeyX':
          e.preventDefault();
          {
            const posX = pp.x;
            let offset = 1;
            rotateMatrix(pm, 1);
            while (collide(arena.current, pp, pm)) {
              pp.x += offset;
              offset = -(offset + (offset > 0 ? 1 : -1));
              if (Math.abs(offset) > pm[0].length) {
                rotateMatrix(pm, -1);
                pp.x = posX;
                break;
              }
            }
            if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
              lockCounter.current = 0;
              lockResets.current++;
            }
          }
          break;
        case 'KeyZ':
          e.preventDefault();
          {
            const posX = pp.x;
            let offset = 1;
            rotateMatrix(pm, -1);
            while (collide(arena.current, pp, pm)) {
              pp.x += offset;
              offset = -(offset + (offset > 0 ? 1 : -1));
              if (Math.abs(offset) > pm[0].length) {
                rotateMatrix(pm, 1);
                pp.x = posX;
                break;
              }
            }
            if (isLanding.current && lockResets.current < MAX_LOCK_RESETS) {
              lockCounter.current = 0;
              lockResets.current++;
            }
          }
          break;
        case 'Space':
          e.preventDefault();
          {
            let gy = pp.y;
            while (!collide(arena.current, { x: pp.x, y: gy + 1 }, pm)) gy++;
            if (collide(arena.current, { x: pp.x, y: gy }, pm)) {
              doGameOver();
            } else {
              scoreRef.current += (gy - pp.y) * 2;
              pp.y = gy;
              lockPiece();
            }
          }
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
          e.preventDefault();
          playerHold();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, isPractice, doGameOver, lockPiece, playerHold]);

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

            {/* 좌측 패널: HOLD + NEXT(1) + Stats */}
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
              <div className="battle-side-box">
                <div className="battle-side-title">NEXT</div>
                <canvas
                  ref={el => { nextLeftCanvasRef.current = el; }}
                  width={CELL_MINI * 4}
                  height={CELL_MINI * 4}
                  className="battle-next-mini-canvas"
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

            {/* 보드 캔버스 래퍼 */}
            <div
              className="battle-board-canvas-wrap"
              style={{
                position: 'relative',
                overflow: 'hidden',
                height: VISIBLE_H * CELL,
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
                  marginTop: -(BUFFER_H * CELL),
                }}
              />
              {garbagePending > 0 && (
                <div className="battle-garbage-badge">
                  -{garbagePending}
                </div>
              )}
            </div>

            {/* 우측 패널: 다음 3개 큐 */}
            <div className="battle-my-right-panel">
              <div className="battle-side-title battle-right-next-title">NEXT</div>
              {Array.from({ length: NEXT_DISPLAY_RIGHT }, (_, i) => (
                <canvas
                  key={i}
                  ref={el => { nextRightCanvasRefs.current[i] = el; }}
                  width={CELL_MINI * 4}
                  height={CELL_MINI * 4}
                  className="battle-next-mini-canvas"
                />
              ))}
            </div>
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
                  style={{ width: BOARD_W * CELL_OPP, height: VISIBLE_H * CELL_OPP }}
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
