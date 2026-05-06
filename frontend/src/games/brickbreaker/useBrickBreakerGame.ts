import { useReducer, useRef, useCallback, useEffect } from 'react';
import type { GameStatus, Ball, Brick, ItemCapsule, ActiveItem, ItemType } from './types';
import { generateBricks, STAGE_CONFIGS, BRICK_WIDTH, BRICK_HEIGHT } from './stages';
import { calcBrickScore, calcClearBonus } from './scoring';

// ── 캔버스 / 패들 / 공 상수 ─────────────────────────────────
export const CANVAS_W   = 720;
export const CANVAS_H   = 480;
const PADDLE_Y          = 460;
const PADDLE_H          = 12;
const PADDLE_W_NORMAL   = 90;
const PADDLE_W_WIDE     = 150;
const BALL_R            = 8;
const BALL_START_Y      = PADDLE_Y - BALL_R;
const CAPSULE_W         = 24;
const CAPSULE_H         = 16;
const CAPSULE_DY        = 2.0;

// 아이템 지속 시간 (ms)
const ITEM_DURATION: Record<ItemType, number> = {
  M: 0,    // 즉시 적용 (타이머 없음)
  W: 12000,
  P: 8000,
  S: 10000,
};

// ── 상태 타입 ───────────────────────────────────────────────
interface Paddle {
  x: number;       // 패들 중심 X
  width: number;
}

export interface BrickBreakerState {
  status: GameStatus;
  stage: number;
  score: number;
  lives: number;
  balls: Ball[];
  paddle: Paddle;
  bricks: Brick[];
  capsules: ItemCapsule[];
  activeItems: ActiveItem[];
  countdownNum: number;
}

// ── 액션 타입 ────────────────────────────────────────────────
type Action =
  | { type: 'INIT' }
  | { type: 'START_COUNTDOWN' }
  | { type: 'COUNTDOWN_TICK' }
  | { type: 'TICK'; now: number; paddleX: number }
  | { type: 'LAUNCH_BALL' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'GAME_OVER' }
  | { type: 'STAGE_CLEAR'; clearBonus: number }
  | { type: 'NEXT_STAGE' }
  | { type: 'ENDED' };

// ── 유틸 ────────────────────────────────────────────────────
function makePaddle(): Paddle {
  return { x: CANVAS_W / 2, width: PADDLE_W_NORMAL };
}

function makeBall(paddleX: number, stage: number): Ball {
  const cfg = STAGE_CONFIGS[stage - 1];
  return {
    x: paddleX,
    y: BALL_START_Y,
    dx: 0,
    dy: cfg?.speedDy ?? -3.0,
  };
}

function initialState(): BrickBreakerState {
  const paddle = makePaddle();
  return {
    status: 'idle',
    stage: 1,
    score: 0,
    lives: 3,
    balls: [makeBall(paddle.x, 1)],
    paddle,
    bricks: generateBricks(1),
    capsules: [],
    activeItems: [],
    countdownNum: 3,
  };
}

/** 스테이지 초기 상태 (점수/생명은 유지) */
function stageState(
  stage: number,
  score: number,
  lives: number,
): BrickBreakerState {
  const paddle = makePaddle();
  return {
    status: 'idle',
    stage,
    score,
    lives,
    balls: [makeBall(paddle.x, stage)],
    paddle,
    bricks: generateBricks(stage),
    capsules: [],
    activeItems: [],
    countdownNum: 3,
  };
}

// ── 활성 아이템 조회 ─────────────────────────────────────────
function hasItem(activeItems: ActiveItem[], type: ItemType, now: number): boolean {
  return activeItems.some(a => a.type === type && a.expiresAt > now);
}

// ── TICK 물리 로직 ────────────────────────────────────────────
function tickPhysics(
  state: BrickBreakerState,
  now: number,
  paddleX: number,
): BrickBreakerState {
  if (state.status !== 'playing') return state;

  // ① 패들 위치 업데이트 (아이템 W 반영)
  const paddleWidthActive = hasItem(state.activeItems, 'W', now)
    ? PADDLE_W_WIDE
    : PADDLE_W_NORMAL;
  const halfW = paddleWidthActive / 2;
  const clampedX = Math.max(halfW, Math.min(CANVAS_W - halfW, paddleX));
  const paddle: Paddle = { x: clampedX, width: paddleWidthActive };

  // ② 활성 아이템 만료 체크
  const activeItems = state.activeItems.filter(a => a.type === 'M' || a.expiresAt > now);

  // ③ 공 이동 + 충돌
  const isThrough = hasItem(activeItems, 'P', now);
  const isSlow    = hasItem(activeItems, 'S', now);
  const slowFactor = isSlow ? 0.6 : 1.0;

  let bricks = [...state.bricks];
  let score  = state.score;
  let capsules = [...state.capsules];
  const newBalls: Ball[] = [];

  for (const ball of state.balls) {
    const moved = moveBall(
      ball,
      paddle,
      bricks,
      isThrough,
      slowFactor,
    );
    bricks  = moved.bricks;
    score  += moved.scoreGain;
    capsules = [...capsules, ...moved.newCapsules];
    if (moved.ball !== null) {
      newBalls.push(moved.ball);
    }
  }

  // ④ 캡슐 낙하 + 패들 획득
  let updatedActiveItems = [...activeItems];
  const remainingCapsules: ItemCapsule[] = [];

  for (const cap of capsules) {
    const newY = cap.y + CAPSULE_DY;
    // 패들과 충돌 체크
    const paddleLeft  = paddle.x - paddleWidthActive / 2;
    const paddleRight = paddle.x + paddleWidthActive / 2;
    const paddleTop   = PADDLE_Y - PADDLE_H;

    if (
      newY + CAPSULE_H >= paddleTop &&
      newY <= PADDLE_Y &&
      cap.x + CAPSULE_W / 2 >= paddleLeft &&
      cap.x - CAPSULE_W / 2 <= paddleRight
    ) {
      // 아이템 발동
      score += 100;
      updatedActiveItems = applyItem(cap.type, updatedActiveItems, newBalls, now, state.stage);
    } else if (newY < CANVAS_H + 40) {
      remainingCapsules.push({ ...cap, y: newY });
    }
    // 화면 밖으로 나가면 버림
  }

  // ⑤ 바닥 추락 처리 — 공이 0개이면 생명 감소
  if (newBalls.length === 0) {
    const newLives = state.lives - 1;
    if (newLives <= 0) {
      return {
        ...state,
        status: 'gameOver',
        score,
        lives: 0,
        balls: [],
        paddle,
        bricks,
        capsules: [],
        activeItems: [],
        countdownNum: 3,
      };
    }
    // 생명 감소 후 공 재배치
    const resetPaddle = makePaddle();
    const resetBall   = makeBall(resetPaddle.x, state.stage);
    return {
      ...state,
      status: 'idle',
      score,
      lives: newLives,
      balls: [resetBall],
      paddle: resetPaddle,
      bricks,
      capsules: [],
      activeItems: [],  // 생명 소모 시 모든 아이템 해제
      countdownNum: 3,
    };
  }

  // ⑥ 모든 벽돌 파괴 → 스테이지 클리어
  if (bricks.length === 0) {
    const clearBonus = calcClearBonus(state.stage, state.lives);
    return {
      ...state,
      status: 'stageClear',
      score: score + clearBonus,
      balls: newBalls,
      paddle,
      bricks,
      capsules: remainingCapsules,
      activeItems: updatedActiveItems,
    };
  }

  return {
    ...state,
    score,
    balls: newBalls,
    paddle,
    bricks,
    capsules: remainingCapsules,
    activeItems: updatedActiveItems,
  };
}

/** 단일 공 이동 + 모든 충돌 처리 */
function moveBall(
  ball: Ball,
  paddle: Paddle,
  bricks: Brick[],
  isThrough: boolean,
  slowFactor: number,
): {
  ball: Ball | null;
  bricks: Brick[];
  scoreGain: number;
  newCapsules: ItemCapsule[];
} {
  const { x, y } = ball;
  let { dx, dy } = ball;
  dx *= slowFactor;
  dy *= slowFactor;

  let nx = x + dx;
  let ny = y + dy;
  let scoreGain = 0;
  const newCapsules: ItemCapsule[] = [];
  let updatedBricks = [...bricks];

  // 좌우 벽 반사
  if (nx - BALL_R < 0) {
    nx = BALL_R;
    dx = Math.abs(dx);
  } else if (nx + BALL_R > CANVAS_W) {
    nx = CANVAS_W - BALL_R;
    dx = -Math.abs(dx);
  }

  // 천장 반사
  if (ny - BALL_R < 0) {
    ny = BALL_R;
    dy = Math.abs(dy);
  }

  // 바닥 추락
  if (ny + BALL_R > CANVAS_H) {
    return { ball: null, bricks: updatedBricks, scoreGain, newCapsules };
  }

  // 패들 충돌
  const paddleLeft  = paddle.x - paddle.width / 2;
  const paddleRight = paddle.x + paddle.width / 2;
  const paddleTop   = PADDLE_Y - PADDLE_H;

  if (
    dy > 0 &&
    ny + BALL_R >= paddleTop &&
    ny - BALL_R <= PADDLE_Y &&
    nx >= paddleLeft &&
    nx <= paddleRight
  ) {
    ny = paddleTop - BALL_R;
    // 각도 보정
    const hitOffset = (nx - paddle.x) / (paddle.width / 2);
    const baseSpeed = Math.sqrt(dx * dx + dy * dy) / slowFactor;
    dx = baseSpeed * hitOffset * 1.2;
    dy = -Math.abs(dy);
    // dx가 0이 되지 않도록 최소값 보장
    if (Math.abs(dx) < 0.5) dx = dx >= 0 ? 0.5 : -0.5;
  }

  // 벽돌 충돌 (AABB)
  const hitBricks: number[] = [];
  for (let i = 0; i < updatedBricks.length; i++) {
    const b = updatedBricks[i];
    if (
      nx + BALL_R > b.x &&
      nx - BALL_R < b.x + BRICK_WIDTH &&
      ny + BALL_R > b.y &&
      ny - BALL_R < b.y + BRICK_HEIGHT
    ) {
      hitBricks.push(i);
    }
  }

  if (hitBricks.length > 0) {
    const hitIdx = hitBricks[0]; // 가장 가까운 벽돌 (첫 번째)
    const b = updatedBricks[hitIdx];
    const newDur = b.durability - 1;
    scoreGain += calcBrickScore(b, newDur);

    if (newDur <= 0) {
      // 파괴
      updatedBricks = updatedBricks.filter((_, i) => i !== hitIdx);
      // 아이템 캡슐 50% 확률 드롭
      if (b.type === 'item' && b.itemType && Math.random() < 0.5) {
        newCapsules.push({
          x: b.x + BRICK_WIDTH / 2,
          y: b.y + BRICK_HEIGHT,
          type: b.itemType,
        });
      }
    } else {
      updatedBricks = updatedBricks.map((br, i) =>
        i === hitIdx ? { ...br, durability: newDur } : br
      );
    }

    // 관통볼이 아니면 dy 반전
    if (!isThrough) {
      dy = -dy;
    }
  }

  // slowFactor 역적용 (속도 원복)
  if (slowFactor !== 1.0) {
    dx /= slowFactor;
    dy /= slowFactor;
  }

  return {
    ball: { x: nx, y: ny, dx, dy },
    bricks: updatedBricks,
    scoreGain,
    newCapsules,
  };
}

/** 아이템 발동 */
function applyItem(
  type: ItemType,
  activeItems: ActiveItem[],
  balls: Ball[],
  now: number,
  stage: number,
): ActiveItem[] {
  if (type === 'M') {
    // 멀티볼: 현재 공 중 하나를 기준으로 ±15도 방향으로 2개 추가 (최대 3개 제한)
    const base = balls[balls.length - 1];
    if (base && balls.length < 3) {
      const cfg = STAGE_CONFIGS[stage - 1];
      const speed = Math.sqrt(
        (cfg?.speedDx ?? 2.5) ** 2 + (cfg?.speedDy ?? -3.0) ** 2,
      );
      const addCount = Math.min(2, 3 - balls.length);
      const angles = [-15, 15].slice(0, addCount);
      for (const angleDeg of angles) {
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const ndx = base.dx * cos - base.dy * sin;
        const ndy = base.dx * sin + base.dy * cos;
        // 속도 정규화
        const len = Math.sqrt(ndx * ndx + ndy * ndy);
        balls.push({
          x: base.x,
          y: base.y,
          dx: (ndx / len) * speed,
          dy: (ndy / len) * speed,
        });
      }
    }
    // M은 타이머 없음
    return activeItems;
  }

  // 중복 아이템: 타이머만 갱신
  const duration = ITEM_DURATION[type];
  const expiresAt = now + duration;
  const existing = activeItems.find(a => a.type === type);
  if (existing) {
    return activeItems.map(a =>
      a.type === type ? { ...a, expiresAt } : a
    );
  }
  return [...activeItems, { type, expiresAt }];
}

// ── Reducer ─────────────────────────────────────────────────
function reducer(state: BrickBreakerState, action: Action): BrickBreakerState {
  switch (action.type) {
    case 'INIT':
      return initialState();

    case 'START_COUNTDOWN':
      return { ...state, status: 'countdown', countdownNum: 3 };

    case 'COUNTDOWN_TICK':
      if (state.countdownNum <= 1) {
        return { ...state, status: 'playing', countdownNum: 0 };
      }
      return { ...state, countdownNum: state.countdownNum - 1 };

    case 'LAUNCH_BALL': {
      if (state.status !== 'idle') return state;
      const cfg = STAGE_CONFIGS[state.stage - 1];
      const dx = (cfg?.speedDx ?? 2.5) * (Math.random() < 0.5 ? 1 : -1);
      const dy = cfg?.speedDy ?? -3.0;
      const launchedBall: Ball = { ...state.balls[0], dx, dy };
      return { ...state, status: 'playing', balls: [launchedBall] };
    }

    case 'TICK':
      return tickPhysics(state, action.now, action.paddleX);

    case 'PAUSE':
      if (state.status !== 'playing') return state;
      return { ...state, status: 'paused' };

    case 'RESUME':
      if (state.status !== 'paused') return state;
      return { ...state, status: 'playing' };

    case 'GAME_OVER':
      return { ...state, status: 'gameOver' };

    case 'STAGE_CLEAR':
      return {
        ...state,
        status: 'stageClear',
        score: state.score + action.clearBonus,
      };

    case 'NEXT_STAGE': {
      const nextStage = state.stage + 1;
      if (nextStage > 10) {
        return { ...state, status: 'ended' };
      }
      return stageState(nextStage, state.score, state.lives);
    }

    case 'ENDED':
      return { ...state, status: 'ended' };

    default:
      return state;
  }
}

// ── 커스텀 훅 ────────────────────────────────────────────────
export function useBrickBreakerGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // 3개 refs
  const rafRef          = useRef<number | null>(null);
  const paddleInputRef  = useRef<number>(CANVAS_W / 2); // 마우스/터치 X
  const gameStartTimeRef = useRef<number>(0);

  // 카운트다운 인터벌 ref
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // RAF 루프 정지
  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // RAF 루프 시작
  const startLoop = useCallback(() => {
    stopLoop();
    function loop() {
      dispatch({ type: 'TICK', now: Date.now(), paddleX: paddleInputRef.current });
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [stopLoop]);

  // 게임 초기화
  const init = useCallback(() => {
    stopLoop();
    if (countdownRef.current) clearInterval(countdownRef.current);
    dispatch({ type: 'INIT' });
    paddleInputRef.current = CANVAS_W / 2;
    gameStartTimeRef.current = 0;
  }, [stopLoop]);

  // 카운트다운 시작 (필요 시) — 현재는 즉시 발사 방식 사용
  const startCountdown = useCallback(() => {
    dispatch({ type: 'START_COUNTDOWN' });
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      dispatch({ type: 'COUNTDOWN_TICK' });
    }, 1000);
  }, []);

  // 공 발사
  const launchBall = useCallback(() => {
    dispatch({ type: 'LAUNCH_BALL' });
  }, []);

  // 일시정지 / 재개
  const pause  = useCallback(() => dispatch({ type: 'PAUSE' }),  []);
  const resume = useCallback(() => dispatch({ type: 'RESUME' }), []);

  // 다음 스테이지
  const nextStage = useCallback(() => {
    stopLoop();
    dispatch({ type: 'NEXT_STAGE' });
  }, [stopLoop]);

  // ── status 변화에 따른 RAF 제어 ─────────────────────────────
  useEffect(() => {
    const { status } = state;
    if (status === 'playing') {
      if (gameStartTimeRef.current === 0) {
        gameStartTimeRef.current = Date.now();
      }
      startLoop();
    } else {
      stopLoop();
    }
    // countdown 인터벌 정리 (playing 진입 시)
    if (status === 'playing' && countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopLoop();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [stopLoop]);

  return {
    state,
    dispatch,
    init,
    startCountdown,
    launchBall,
    pause,
    resume,
    nextStage,
    paddleInputRef,
    gameStartTimeRef,
    rafRef,
  };
}
