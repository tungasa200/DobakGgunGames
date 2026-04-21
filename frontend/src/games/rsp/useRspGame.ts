import { useCallback, useEffect, useReducer } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminRspApi } from '../../api/admin';
import type { RspChoice, RspResult, RspStats } from '../../api/admin';

// ── 타입 ──────────────────────────────────────────────────

export type { RspChoice, RspResult };

export type GamePhase = 'idle' | 'submitting' | 'revealing' | 'result' | 'error';

export interface HistoryEntry {
  round: number;
  userChoice: RspChoice;
  computerChoice: RspChoice;
  result: RspResult;
  streakSnapshot: number;
  playedAt: string;
}

interface RspGameState {
  phase: GamePhase;

  // 현재 판
  userChoice: RspChoice | null;
  computerChoice: RspChoice | null;
  roundResult: RspResult | null;

  // 세션 집계 (in-memory)
  sessionWins: number;
  sessionLosses: number;
  sessionDraws: number;
  /** 양수: 연승, 음수: 연패, 0: 없음 */
  streak: number;
  history: HistoryEntry[];

  // 누적 통계 (서버)
  totalPlays: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number | null;

  // UI
  statsLoading: boolean;
  errorMessage: string | null;
}

// ── 액션 ──────────────────────────────────────────────────

type Action =
  | { type: 'SUBMIT_START'; userChoice: RspChoice }
  | { type: 'SUBMIT_SUCCESS'; userChoice: RspChoice; computerChoice: RspChoice; result: RspResult; playedAt: string; stats: RspStats }
  | { type: 'SUBMIT_ERROR'; message: string }
  | { type: 'REVEAL_DONE' }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESET_SESSION' }
  | { type: 'DISMISS_ERROR' }
  | { type: 'STATS_LOADING' }
  | { type: 'STATS_LOADED'; stats: RspStats }
  | { type: 'STATS_ERROR' };

// ── 스트릭 계산 ───────────────────────────────────────────

function calcStreak(prev: number, result: RspResult): number {
  if (result === 'DRAW') return prev; // 무승부는 스트릭 유지
  if (result === 'WIN') return prev > 0 ? prev + 1 : 1;
  // LOSS
  return prev < 0 ? prev - 1 : -1;
}

// ── 에러 메시지 매핑 ──────────────────────────────────────

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message;
    if (msg.includes('400')) return '잘못된 요청입니다. 새로고침 후 다시 시도하세요.';
    if (msg.includes('401')) return '세션이 만료되었습니다. 다시 로그인해주세요.';
    if (msg.includes('500')) return '결과를 저장하지 못했습니다. 다시 시도해주세요.';
  }
  return '결과를 저장하지 못했습니다. 네트워크 상태를 확인하세요.';
}

// ── 리듀서 ────────────────────────────────────────────────

const initialState: RspGameState = {
  phase: 'idle',
  userChoice: null,
  computerChoice: null,
  roundResult: null,
  sessionWins: 0,
  sessionLosses: 0,
  sessionDraws: 0,
  streak: 0,
  history: [],
  totalPlays: 0,
  totalWins: 0,
  totalLosses: 0,
  totalDraws: 0,
  winRate: null,
  statsLoading: true,
  errorMessage: null,
};

function reducer(state: RspGameState, action: Action): RspGameState {
  switch (action.type) {
    case 'SUBMIT_START':
      return {
        ...state,
        phase: 'submitting',
        userChoice: action.userChoice,
        computerChoice: null,
        roundResult: null,
        errorMessage: null,
      };

    case 'SUBMIT_SUCCESS': {
      const newStreak = calcStreak(state.streak, action.result);
      const newEntry: HistoryEntry = {
        round: state.history.length + 1,
        userChoice: action.userChoice,
        computerChoice: action.computerChoice,
        result: action.result,
        streakSnapshot: newStreak,
        playedAt: action.playedAt,
      };
      return {
        ...state,
        phase: 'revealing',
        computerChoice: action.computerChoice,
        roundResult: action.result,
        sessionWins: state.sessionWins + (action.result === 'WIN' ? 1 : 0),
        sessionLosses: state.sessionLosses + (action.result === 'LOSS' ? 1 : 0),
        sessionDraws: state.sessionDraws + (action.result === 'DRAW' ? 1 : 0),
        streak: newStreak,
        history: [...state.history, newEntry],
        totalPlays: action.stats.totalPlays,
        totalWins: action.stats.wins,
        totalLosses: action.stats.losses,
        totalDraws: action.stats.draws,
        winRate: action.stats.winRate,
      };
    }

    case 'SUBMIT_ERROR':
      return {
        ...state,
        phase: 'error',
        errorMessage: action.message,
      };

    case 'REVEAL_DONE':
      return { ...state, phase: 'result' };

    case 'NEXT_ROUND':
      return {
        ...state,
        phase: 'idle',
        userChoice: null,
        computerChoice: null,
        roundResult: null,
      };

    case 'RESET_SESSION':
      return {
        ...state,
        phase: 'idle',
        userChoice: null,
        computerChoice: null,
        roundResult: null,
        sessionWins: 0,
        sessionLosses: 0,
        sessionDraws: 0,
        streak: 0,
        history: [],
        errorMessage: null,
      };

    case 'DISMISS_ERROR':
      return { ...state, phase: 'idle', errorMessage: null };

    case 'STATS_LOADING':
      return { ...state, statsLoading: true };

    case 'STATS_LOADED':
      return {
        ...state,
        statsLoading: false,
        totalPlays: action.stats.totalPlays,
        totalWins: action.stats.wins,
        totalLosses: action.stats.losses,
        totalDraws: action.stats.draws,
        winRate: action.stats.winRate,
      };

    case 'STATS_ERROR':
      return { ...state, statsLoading: false };

    default:
      return state;
  }
}

// ── 훅 ────────────────────────────────────────────────────

export interface RspGameActions {
  submitChoice: (choice: RspChoice) => Promise<void>;
  resetSession: () => void;
  dismissError: () => void;
  nextRound: () => void;
}

export interface UseRspGameReturn {
  state: RspGameState;
  actions: RspGameActions;
}

export function useRspGame(): UseRspGameReturn {
  const { accessToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  // 초기 통계 로드
  useEffect(() => {
    if (!accessToken) return;
    dispatch({ type: 'STATS_LOADING' });
    adminRspApi
      .getStats(accessToken)
      .then(stats => dispatch({ type: 'STATS_LOADED', stats }))
      .catch(() => dispatch({ type: 'STATS_ERROR' }));
  }, [accessToken]);

  const submitChoice = useCallback(
    async (choice: RspChoice) => {
      if (!accessToken) return;
      dispatch({ type: 'SUBMIT_START', userChoice: choice });
      try {
        const res = await adminRspApi.playRound(accessToken, choice);
        dispatch({
          type: 'SUBMIT_SUCCESS',
          userChoice: res.userChoice,
          computerChoice: res.computerChoice,
          result: res.result,
          playedAt: res.playedAt,
          stats: res.stats,
        });
        // revealing → result 전환 (600ms 애니메이션)
        setTimeout(() => dispatch({ type: 'REVEAL_DONE' }), 600);
      } catch (e) {
        dispatch({ type: 'SUBMIT_ERROR', message: toErrorMessage(e) });
      }
    },
    [accessToken],
  );

  const resetSession = useCallback(() => dispatch({ type: 'RESET_SESSION' }), []);
  const dismissError = useCallback(() => dispatch({ type: 'DISMISS_ERROR' }), []);
  const nextRound = useCallback(() => dispatch({ type: 'NEXT_ROUND' }), []);

  return { state, actions: { submitChoice, resetSession, dismissError, nextRound } };
}
