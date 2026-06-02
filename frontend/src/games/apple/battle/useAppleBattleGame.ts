import { useReducer, useRef, useCallback } from 'react';

export type Apple = number | null;

export interface BattleGameState {
  apples: Apple[][];
  rows: number;
  cols: number;
  score: number;
  timeLeft: number;
  status: 'idle' | 'playing' | 'ended';
}

type BattleGameAction =
  | { type: 'INIT_BATTLE'; board: (number | null)[][] }
  | { type: 'REMOVE'; coords: { r: number; c: number }[] }
  | { type: 'REMOVE_EXTERNAL'; coords: { r: number; c: number }[] }
  | { type: 'SYNC_BOARD'; board: (number | null)[][] }
  | { type: 'SYNC_TIME'; timeLeft: number }
  | { type: 'END' };

function reducer(state: BattleGameState, action: BattleGameAction): BattleGameState {
  switch (action.type) {
    case 'INIT_BATTLE':
      return {
        apples: action.board as Apple[][],
        rows: action.board.length,
        cols: action.board[0]?.length ?? 0,
        score: 0,
        timeLeft: 120,
        status: 'idle',
      };
    case 'REMOVE': {
      const next = state.apples.map((row) => [...row]);
      action.coords.forEach(({ r, c }) => { next[r][c] = null; });
      return { ...state, apples: next, score: state.score + action.coords.length };
    }
    case 'REMOVE_EXTERNAL': {
      const next = state.apples.map((row) => [...row]);
      action.coords.forEach(({ r, c }) => { next[r][c] = null; });
      return { ...state, apples: next };
    }
    case 'SYNC_BOARD': {
      return {
        ...state,
        apples: action.board as Apple[][],
        rows: action.board.length,
        cols: action.board[0]?.length ?? 0,
      };
    }
    case 'SYNC_TIME':
      return { ...state, timeLeft: action.timeLeft };
    case 'END':
      return { ...state, status: 'ended' };
    default:
      return state;
  }
}

const initialState: BattleGameState = {
  apples: [],
  rows: 10,
  cols: 17,
  score: 0,
  timeLeft: 120,
  status: 'idle',
};

export function useAppleBattleGame() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 서버 기준 게임 종료 시각 (ms) — 드리프트 보정용
  const gameEndAtRef = useRef<number>(0);

  const initBattle = useCallback((board: number[][]) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: 'INIT_BATTLE', board });
  }, []);

  // gameEndAt(ms): 서버가 알려준 종료 타임스탬프 기준으로 매 tick 재계산 → 드리프트 없음
  const startTimer = useCallback((gameEndAt: number) => {
    gameEndAtRef.current = gameEndAt;
    if (timerRef.current) clearInterval(timerRef.current);
    // 즉시 한 번 업데이트
    dispatch({ type: 'SYNC_TIME', timeLeft: Math.max(0, Math.ceil((gameEndAt - Date.now()) / 1000)) });
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((gameEndAtRef.current - Date.now()) / 1000));
      dispatch({ type: 'SYNC_TIME', timeLeft: remaining });
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const removeApples = useCallback((coords: { r: number; c: number }[]) => {
    dispatch({ type: 'REMOVE', coords });
  }, []);

  const removeExternal = useCallback((coords: { r: number; c: number }[]) => {
    dispatch({ type: 'REMOVE_EXTERNAL', coords });
  }, []);

  const syncBoard = useCallback((board: (number | null)[][]) => {
    dispatch({ type: 'SYNC_BOARD', board });
  }, []);

  // STATE_SNAPSHOT 재연결 시 남은 시간 즉시 반영 + ref 갱신(다음 tick부터 보정)
  const syncTime = useCallback((remainingMs: number) => {
    gameEndAtRef.current = Date.now() + remainingMs;
    dispatch({ type: 'SYNC_TIME', timeLeft: Math.max(0, Math.ceil(remainingMs / 1000)) });
  }, []);

  const end = useCallback(() => {
    stopTimer();
    dispatch({ type: 'END' });
  }, [stopTimer]);

  return {
    state,
    initBattle,
    startTimer,
    stopTimer,
    removeApples,
    removeExternal,
    syncBoard,
    syncTime,
    end,
  };
}
