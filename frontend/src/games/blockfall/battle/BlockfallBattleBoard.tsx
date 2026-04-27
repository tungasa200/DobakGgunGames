import { useCallback, useEffect, useRef, useState } from 'react';
import '../../../styles/blockfall-battle.css';
import OpponentBoard from './OpponentBoard';

// ── 상수 (BlockfallBoard.tsx와 동일) ──────────────────────
const BOARD_W = 11;
const VISIBLE_H = 21;
const BUFFER_H = 2;
const BOARD_H = VISIBLE_H + BUFFER_H;
const CELL = 24; // 배틀용 약간 작은 셀

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

// ── 드롭 속도 (normal) ──────────────────────────────────
const DROP_SPEEDS = [400, 340, 290, 248, 213, 183, 158, 137, 119, 104, 91];
const LINE_SCORES = [0, 100, 300, 500, 800];

const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;

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
  onBoardChange: (board: number[][], score: number, lines: number, level: number, combo: number) => void;
  onComboAttack: (combo: number) => void;
  onGarbageConsumed: () => void;
  isPlaying: boolean;
}

export default function BlockfallBattleBoard({
  players,
  myPlayerId,
  opponents,
  eliminatedPlayers,
  garbagePending,
  onGameOver,
  onBoardChange,
  onComboAttack,
  onGarbageConsumed,
  isPlaying,
}: BlockfallBattleBoardProps) {
  const boardRef = useRef<HTMLCanvasElement>(null);

  // ── 게임 상태 refs ──────────────────────────────────
  const arena = useRef<Matrix>(createMatrix(BOARD_W, BOARD_H));
  const playerPos = useRef({ x: 0, y: 0 });
  const playerMatrix = useRef<Matrix | null>(null);
  const nextPiece = useRef<Matrix | null>(null);
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

  // React state (UI 표시용)
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [garbageFlash, setGarbageFlash] = useState(false);

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

  const doGameOver = useCallback(() => {
    if (isGameOver.current) return;
    isGameOver.current = true;
    if (animId.current) {
      cancelAnimationFrame(animId.current);
      animId.current = null;
    }
    playerMatrix.current = null;
    draw();
    onGameOver(scoreRef.current);
  }, [draw, onGameOver]);

  // Garbage line 적용 (piece lock 시점에 호출)
  const applyGarbage = useCallback((lines: number) => {
    if (lines <= 0) return;
    const holeX = Math.floor(Math.random() * BOARD_W);
    for (let i = 0; i < lines; i++) {
      // 보드를 위로 밀기
      arena.current.shift();
      // 하단에 garbage line 추가
      const garbageLine = new Array(BOARD_W).fill(9);
      garbageLine[holeX] = 0;
      arena.current.push(garbageLine);
    }
    // 현재 플레이어 위치 확인 — 밀려 올라가면 게임오버
    if (playerMatrix.current && collideInBuffer(arena.current, playerPos.current, playerMatrix.current)) {
      doGameOver();
    }
    onGarbageConsumed();
  }, [doGameOver, onGarbageConsumed]);

  const drawFromBag = useCallback((): Matrix => {
    if (bagRef.current.length - bagIdxRef.current < 7) {
      bagRef.current = bagRef.current.slice(bagIdxRef.current).concat(shuffleBag());
      bagIdxRef.current = 0;
    }
    return createPiece(bagRef.current[bagIdxRef.current++]);
  }, []);

  const playerReset = useCallback(() => {
    isLanding.current = false;
    lockCounter.current = 0;
    lockResets.current = 0;
    playerMatrix.current = nextPiece.current ?? drawFromBag();
    nextPiece.current = drawFromBag();
    playerPos.current.y = 0;
    playerPos.current.x = (BOARD_W / 2 | 0) - (playerMatrix.current[0].length / 2 | 0);

    if (collideInBuffer(arena.current, playerPos.current, playerMatrix.current)) {
      doGameOver();
    }
  }, [doGameOver, drawFromBag]);

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
      // 콤보 공격 발동 (2콤보 이상)
      if (comboCount.current >= 2) {
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

    // garbage 적용 (lock 시점)
    const pending = garbagePendingRef.current;
    if (pending > 0) {
      applyGarbage(pending);
    }

    isLanding.current = false;
    lockCounter.current = 0;

    // 보드 상태 전송 (200ms throttle)
    const now = Date.now();
    if (now - boardChangeThrottle.current >= 200) {
      boardChangeThrottle.current = now;
      onBoardChange(getBoardSnapshot(), scoreRef.current, linesRef.current, levelRef.current, comboCount.current);
    }
  }, [applyGarbage, arenaSweep, doGameOver, getBoardSnapshot, onBoardChange, playerReset]);

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

  // 게임 시작/종료
  useEffect(() => {
    if (!isPlaying) {
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

    bagRef.current = shuffleBag();
    bagIdxRef.current = 0;
    nextPiece.current = drawFromBag();
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
  }, [isPlaying]);

  // 키보드 입력
  useEffect(() => {
    if (!isPlaying) return;

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
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, doGameOver, lockPiece]);

  // 보드 상태 주기적 전송 (200ms)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (!isGameOver.current) {
        onBoardChange(getBoardSnapshot(), scoreRef.current, linesRef.current, levelRef.current, comboCount.current);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, getBoardSnapshot, onBoardChange]);

  // 레이아웃 계산
  const playerCount = players.length;
  const containerClass = `battle-board-container players-${Math.min(playerCount, 4)}`;

  const myPlayer = players.find(p => p.id === myPlayerId);
  const opponentPlayers = players.filter(p => p.id !== myPlayerId);

  return (
    <div className={containerClass}>
      {/* 내 보드 */}
      <div className={`battle-board-item mine ${garbageFlash ? 'garbage-flash' : ''}`}>
        <div className="battle-board-item-header">
          <span className="battle-board-nickname mine">
            {myPlayer?.nickname ?? '나'}
            {myPlayer?.isGuest && (
              <span style={{ marginLeft: 4, fontSize: '0.78em', color: '#8b949e' }}>
                손님
              </span>
            )}
          </span>
          <span className="battle-board-score">{score.toLocaleString()}</span>
        </div>

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
            <div
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                background: 'rgba(248,81,73,0.9)',
                color: 'white',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: '0.75em',
                fontWeight: 'bold',
                pointerEvents: 'none',
              }}
            >
              -{garbagePending}
            </div>
          )}
        </div>

        {/* 하단 스탯 바 */}
        <div className="battle-stats-bar">
          <div className="battle-stats-item">
            <span className="battle-stats-label">점수</span>
            <span className="battle-stats-value">{score.toLocaleString()}</span>
          </div>
          <div className="battle-stats-item">
            <span className="battle-stats-label">레벨</span>
            <span className="battle-stats-value">{level}</span>
          </div>
          <div className="battle-stats-item">
            <span className="battle-stats-label">줄</span>
            <span className="battle-stats-value">{lines}</span>
          </div>
          {combo >= 2 && (
            <div className="battle-garbage-indicator">
              COMBO x{combo}
            </div>
          )}
        </div>
      </div>

      {/* 상대 보드들 */}
      {opponentPlayers.map(op => {
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
            cellSize={playerCount <= 2 ? 16 : 12}
          />
        );
      })}
    </div>
  );
}
