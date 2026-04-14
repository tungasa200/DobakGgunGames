import { useCallback, useEffect, useReducer, useRef } from 'react';

export type Level = 'easy' | 'normal' | 'hard';

export const DIGIT_COUNT: Record<Level, number> = { easy: 3, normal: 4, hard: 5 };
export const MAX_ATTEMPTS: Record<Level, number> = { easy: 10, normal: 15, hard: 20 };

export interface HistoryRow {
  attempt: number;
  guess: string;
  strikes: number;
  balls: number;
}

interface State {
  level: Level;
  answer: number[];
  attempts: number;
  history: HistoryRow[];
  elapsed: number;
  timerRunning: boolean;
  won: boolean;
  gameOver: boolean;
}

type Action =
  | { type: 'RESET'; level: Level; answer: number[] }
  | { type: 'GUESS'; row: HistoryRow }
  | { type: 'WIN'; elapsed: number }
  | { type: 'GAME_OVER'; elapsed: number }
  | { type: 'TICK'; elapsed: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return {
        level: action.level,
        answer: action.answer,
        attempts: 0,
        history: [],
        elapsed: 0,
        timerRunning: false,
        won: false,
        gameOver: false,
      };
    case 'GUESS':
      return {
        ...state,
        attempts: state.attempts + 1,
        history: [action.row, ...state.history],
        timerRunning: true,
      };
    case 'WIN':
      return { ...state, won: true, timerRunning: false, elapsed: action.elapsed };
    case 'GAME_OVER':
      return { ...state, gameOver: true, timerRunning: false, elapsed: action.elapsed };
    case 'TICK':
      return { ...state, elapsed: action.elapsed };
    default:
      return state;
  }
}

function generateAnswer(n: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  // Fisher-Yates 셔플 (sort+random 방식은 V8에서 편향 발생)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function judge(guess: number[], answer: number[]): { strikes: number; balls: number } {
  let strikes = 0, balls = 0;
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) strikes++;
    else if (answer.includes(guess[i])) balls++;
  }
  return { strikes, balls };
}

export function useBaseballGame(initialLevel: Level = 'easy') {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    level: initialLevel,
    answer: generateAnswer(DIGIT_COUNT[initialLevel]),
    attempts: 0,
    history: [],
    elapsed: 0,
    timerRunning: false,
    won: false,
    gameOver: false,
  }));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // 타이머
  useEffect(() => {
    if (state.timerRunning) {
      startTimeRef.current = Date.now() - state.elapsed * 1000;
      timerRef.current = setInterval(() => {
        dispatch({ type: 'TICK', elapsed: (Date.now() - startTimeRef.current) / 1000 });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // elapsed를 의존성에 넣으면 매 tick마다 재시작되므로 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timerRunning]);

  const reset = useCallback((level: Level = state.level) => {
    startTimeRef.current = 0;
    dispatch({ type: 'RESET', level, answer: generateAnswer(DIGIT_COUNT[level]) });
  }, [state.level]);

  const guess = useCallback((input: string): string | null => {
    const digitCount = DIGIT_COUNT[state.level];
    if (!/^\d+$/.test(input) || input.length !== digitCount)
      return `${digitCount}자리 숫자를 입력하세요.`;

    const digits = input.split('').map(Number);
    if (new Set(digits).size !== digitCount)
      return '중복되지 않는 숫자를 입력하세요.';

    const attempt = state.attempts + 1;
    const { strikes, balls } = judge(digits, state.answer);
    const row: HistoryRow = { attempt, guess: input, strikes, balls };

    // 첫 번째 guess 시 useEffect보다 먼저 호출되므로 startTimeRef를 직접 초기화
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }

    dispatch({ type: 'GUESS', row });

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    if (strikes === digitCount) {
      dispatch({ type: 'WIN', elapsed });
    } else if (attempt >= MAX_ATTEMPTS[state.level]) {
      dispatch({ type: 'GAME_OVER', elapsed });
    }
    return null;
  }, [state.level, state.attempts, state.answer]);

  return { state, reset, guess };
}
