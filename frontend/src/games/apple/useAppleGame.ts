import { useCallback, useReducer, useRef } from 'react';

export interface AppleEvent {
  t: number;           // 게임 시작 이후 경과 ms
  cells: number[][];   // 제거된 셀 좌표 [[r, c], ...]
}

export const TIME_LIMIT = 120;

const APPLE_WEIGHTS = [5, 5, 4, 4, 3, 3, 2, 2, 1]; // 1~9의 가중치
const WEIGHT_TOTAL = APPLE_WEIGHTS.reduce((a, b) => a + b, 0);

function randomApple(): number {
  let r = Math.random() * WEIGHT_TOTAL;
  for (let i = 0; i < APPLE_WEIGHTS.length; i++) {
    r -= APPLE_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 9;
}

export type Apple = number | null;

interface State {
  apples: Apple[][];
  rows: number;
  cols: number;
  score: number;
  timeLeft: number;
  status: 'idle' | 'playing' | 'ended';
}

type Action =
  | { type: 'INIT'; rows: number; cols: number }
  /** Phase 3: 서버가 생성한 보드로 초기화 (클라이언트 randomApple 제거) */
  | { type: 'INIT_WITH_BOARD'; board: number[][] }
  | { type: 'START'; rows: number; cols: number }
  /** Phase 3: 서버 보드로 게임 시작 */
  | { type: 'START_WITH_BOARD'; board: number[][] }
  | { type: 'TICK' }
  | { type: 'REMOVE'; coords: { r: number; c: number }[] }
  | { type: 'END' };

function makeApples(rows: number, cols: number): Apple[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => randomApple())
  );
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return {
        apples: makeApples(action.rows, action.cols),
        rows: action.rows,
        cols: action.cols,
        score: 0,
        timeLeft: TIME_LIMIT,
        status: 'idle',
      };
    case 'INIT_WITH_BOARD':
      return {
        apples: action.board as Apple[][],
        rows: action.board.length,
        cols: action.board[0]?.length ?? 0,
        score: 0,
        timeLeft: TIME_LIMIT,
        status: 'idle',
      };
    case 'START':
      return {
        apples: makeApples(action.rows, action.cols),
        rows: action.rows,
        cols: action.cols,
        score: 0,
        timeLeft: TIME_LIMIT,
        status: 'playing',
      };
    case 'START_WITH_BOARD':
      return {
        apples: action.board as Apple[][],
        rows: action.board.length,
        cols: action.board[0]?.length ?? 0,
        score: 0,
        timeLeft: TIME_LIMIT,
        status: 'playing',
      };
    case 'TICK':
      if (state.status !== 'playing') return state;
      return { ...state, timeLeft: state.timeLeft - 1 };
    case 'REMOVE': {
      const next = state.apples.map((row) => [...row]);
      action.coords.forEach(({ r, c }) => { next[r][c] = null; });
      return { ...state, apples: next, score: state.score + action.coords.length };
    }
    case 'END':
      return { ...state, status: 'ended' };
    default:
      return state;
  }
}

export function useAppleGame() {
  const [state, dispatch] = useReducer(reducer, {
    apples: [],
    rows: 10,
    cols: 17,
    score: 0,
    timeLeft: TIME_LIMIT,
    status: 'idle',
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStartTimeRef = useRef<number>(0);
  const eventsRef = useRef<AppleEvent[]>([]);

  // 사과 배치만 초기화 (타이머 시작 안 함) — 원본 initGame()에 대응
  const init = useCallback((rows: number, cols: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    dispatch({ type: 'INIT', rows, cols });
  }, []);

  const start = useCallback((rows: number, cols: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    gameStartTimeRef.current = Date.now();
    eventsRef.current = [];
    dispatch({ type: 'START', rows, cols });
    timerRef.current = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
  }, []);

  /** Phase 3: 서버 보드로 게임 시작 (클라이언트 randomApple 제거) */
  const startWithBoard = useCallback((board: number[][]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    gameStartTimeRef.current = Date.now();
    eventsRef.current = [];
    dispatch({ type: 'START_WITH_BOARD', board });
    timerRef.current = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
  }, []);

  // END 처리는 컴포넌트에서 timeLeft === 0 감지 후 호출
  const end = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    dispatch({ type: 'END' });
  }, []);

  const removeApples = useCallback((coords: { r: number; c: number }[]) => {
    const t = gameStartTimeRef.current > 0 ? Date.now() - gameStartTimeRef.current : 0;
    eventsRef.current.push({ t, cells: coords.map(({ r, c }) => [r, c]) });
    dispatch({ type: 'REMOVE', coords });
  }, []);

  return { state, init, start, startWithBoard, end, removeApples, eventsRef };
}
