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
  | { type: 'TICK' }
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
      // 상대방 제거 — 점수 반영 없음 (서버에서 받은 scores로 별도 업데이트)
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
    case 'TICK':
      // 배틀 모드: status 체크 없이 항상 감소 (게임 종료는 battleState.phase로 판단)
      return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
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

  const initBattle = useCallback((board: number[][]) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: 'INIT_BATTLE', board });
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    // 1초마다 TICK — 실제 남은 시간은 gameStartedAt 기반으로 AppleBattleBoard에서도 관리
    timerRef.current = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
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

  const syncTime = useCallback((remainingMs: number) => {
    dispatch({ type: 'SYNC_TIME', timeLeft: Math.ceil(remainingMs / 1000) });
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
