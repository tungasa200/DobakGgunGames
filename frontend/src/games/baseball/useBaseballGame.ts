import { useCallback, useEffect, useReducer, useRef } from 'react';
import { submitGuess } from '../../api/baseball';

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
  attempts: number;
  history: HistoryRow[];
  elapsed: number;
  timerRunning: boolean;
  won: boolean;
  gameOver: boolean;
  revealedAnswer: string | null;  // 게임 오버 시 서버에서 공개
}

type Action =
  | { type: 'RESET'; level: Level }
  | { type: 'GUESS'; row: HistoryRow }
  | { type: 'WIN'; elapsed: number }
  | { type: 'GAME_OVER'; elapsed: number; answer: string | null }
  | { type: 'TICK'; elapsed: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return {
        level: action.level,
        attempts: 0,
        history: [],
        elapsed: 0,
        timerRunning: false,
        won: false,
        gameOver: false,
        revealedAnswer: null,
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
      return { ...state, gameOver: true, timerRunning: false, elapsed: action.elapsed, revealedAnswer: action.answer };
    case 'TICK':
      return { ...state, elapsed: action.elapsed };
    default:
      return state;
  }
}

export function useBaseballGame(initialLevel: Level = 'easy') {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    level: initialLevel,
    attempts: 0,
    history: [],
    elapsed: 0,
    timerRunning: false,
    won: false,
    gameOver: false,
    revealedAnswer: null,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timerRunning]);

  const reset = useCallback((level: Level = state.level) => {
    startTimeRef.current = 0;
    dispatch({ type: 'RESET', level });
  }, [state.level]);

  /** 서버에 추측값을 제출하고 결과를 state에 반영. 에러 메시지 반환 시 null이 아닌 string. */
  const guess = useCallback(async (input: string, sessionId: string): Promise<string | null> => {
    const digitCount = DIGIT_COUNT[state.level];

    if (!/^\d+$/.test(input) || input.length !== digitCount)
      return `${digitCount}자리 숫자를 입력하세요.`;

    const digits = input.split('').map(Number);
    if (new Set(digits).size !== digitCount)
      return '중복되지 않는 숫자를 입력하세요.';

    if (startTimeRef.current === 0) startTimeRef.current = Date.now();

    try {
      const result = await submitGuess(sessionId, input);
      const row: HistoryRow = {
        attempt: result.attempts,
        guess: input,
        strikes: result.strikes,
        balls: result.balls,
      };
      dispatch({ type: 'GUESS', row });

      if (result.won) {
        dispatch({ type: 'WIN', elapsed: result.elapsed });
      } else if (result.gameOver) {
        dispatch({ type: 'GAME_OVER', elapsed: result.elapsed, answer: result.answer });
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    }
  }, [state.level]);

  return { state, reset, guess };
}
