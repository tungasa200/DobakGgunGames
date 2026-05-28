import { useReducer, useRef, useEffect, useCallback, type Dispatch } from 'react';
import type {
  BattleState,
  BattleAction,
  BattleCell,
  BattleCellMark,
  MatchReadyPayload,
  GameStartedPayload,
  ProgressUpdatePayload,
  GameResultPayload,
  StateSnapshotPayload,
} from './types';

// ── 상수 ───────────────────────────────────────────────────
const ROWS = 9;
const COLS = 9;
const TOTAL_MINES = 10;
const TOTAL_SAFE = ROWS * COLS - TOTAL_MINES; // 71

// ── 유틸 ───────────────────────────────────────────────────
function isValid(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function emptyBoard(): BattleCell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      isRevealed: false,
      mark: 'none' as BattleCellMark,
      adjCount: 0,
    }))
  );
}

function boardFromAdjMines(adjMines: number[][]): BattleCell[][] {
  return adjMines.map((row) =>
    row.map((val) => ({
      isMine: val === -1,
      isRevealed: false,
      mark: 'none' as BattleCellMark,
      adjCount: val === -1 ? 0 : val,
    }))
  );
}

/**
 * flood-fill reveal: adjCount === 0인 셀은 인접 셀도 자동 reveal.
 * flag인 셀은 reveal하지 않음.
 * 반환: { board, newlyRevealed }
 */
function revealCells(
  board: BattleCell[][],
  startR: number,
  startC: number,
): { board: BattleCell[][]; newlyRevealed: number } {
  const next = board.map((row) => row.map((c) => ({ ...c })));
  let count = 0;

  function dfs(r: number, c: number) {
    if (!isValid(r, c)) return;
    const cell = next[r][c];
    if (cell.isRevealed || cell.mark === 'flag') return;
    cell.isRevealed = true;
    count++;
    if (cell.adjCount === 0 && !cell.isMine) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) dfs(r + dr, c + dc);
    }
  }

  dfs(startR, startC);
  return { board: next, newlyRevealed: count };
}

function revealAllMines(board: BattleCell[][]): BattleCell[][] {
  return board.map((row) =>
    row.map((cell) =>
      cell.isMine && !cell.isRevealed && cell.mark !== 'flag'
        ? { ...cell, isRevealed: true }
        : cell
    )
  );
}

// ── 배틀 보드 상태 ─────────────────────────────────────────

interface BoardState {
  board: BattleCell[][];
  revealedCount: number;
  flagCount: number;
  /** 'idle': 게임 시작 전, 'playing': 게임 중, 'won': 클리어, 'lost': 지뢰 클릭 */
  boardStatus: 'idle' | 'playing' | 'won' | 'lost';
}

type BoardAction =
  | { type: 'INIT_BOARD'; adjMines: number[][]; firstR: number; firstC: number }
  | { type: 'REVEAL'; r: number; c: number }
  | { type: 'TOGGLE_MARK'; r: number; c: number }
  | { type: 'CHORD'; r: number; c: number }
  | { type: 'EXPLODE'; r: number; c: number }  // MINE_HIT 후 보드 표시용
  | { type: 'RESET_BOARD' };

const initialBoardState: BoardState = {
  board: emptyBoard(),
  revealedCount: 0,
  flagCount: 0,
  boardStatus: 'idle',
};

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'INIT_BOARD': {
      const { adjMines, firstR, firstC } = action;
      const newBoard = boardFromAdjMines(adjMines);
      // (4,4)는 GAME_STARTED 수신 시 즉시 reveal (서버가 safe 보장)
      if (newBoard[firstR]?.[firstC]?.isMine) {
        // 서버가 안전을 보장하므로 이 분기는 발생하지 않아야 함
        return { ...initialBoardState, board: revealAllMines(newBoard), boardStatus: 'lost' };
      }
      const { board, newlyRevealed } = revealCells(newBoard, firstR, firstC);
      const total = newlyRevealed;
      return {
        board,
        revealedCount: total,
        flagCount: 0,
        boardStatus: total >= TOTAL_SAFE ? 'won' : 'playing',
      };
    }
    case 'REVEAL': {
      if (state.boardStatus !== 'playing') return state;
      const cell = state.board[action.r][action.c];
      if (!cell || cell.isRevealed || cell.mark === 'flag') return state;
      if (cell.isMine) {
        // MINE_HIT — 보드 표시 (지뢰 모두 오픈)
        return {
          ...state,
          board: revealAllMines(state.board),
          boardStatus: 'lost',
        };
      }
      const { board, newlyRevealed } = revealCells(state.board, action.r, action.c);
      const total = state.revealedCount + newlyRevealed;
      return {
        ...state,
        board,
        revealedCount: total,
        boardStatus: total >= TOTAL_SAFE ? 'won' : 'playing',
      };
    }
    case 'TOGGLE_MARK': {
      if (state.boardStatus !== 'playing' && state.boardStatus !== 'idle') return state;
      const cell = state.board[action.r][action.c];
      if (!cell || cell.isRevealed) return state;
      const next = state.board.map((row) => row.map((c) => ({ ...c })));
      let flagDelta = 0;
      if (cell.mark === 'none')      { next[action.r][action.c].mark = 'flag';     flagDelta = +1; }
      else if (cell.mark === 'flag') { next[action.r][action.c].mark = 'question'; flagDelta = -1; }
      else                            { next[action.r][action.c].mark = 'none';     flagDelta = 0; }
      return { ...state, board: next, flagCount: state.flagCount + flagDelta };
    }
    case 'CHORD': {
      if (state.boardStatus !== 'playing') return state;
      const cell = state.board[action.r][action.c];
      if (!cell || !cell.isRevealed || cell.adjCount === 0) return state;

      // 인접 flag 수 확인
      let adjFlags = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if ((dr || dc) && isValid(action.r + dr, action.c + dc) &&
              state.board[action.r + dr][action.c + dc].mark === 'flag')
            adjFlags++;

      if (adjFlags !== cell.adjCount) return state;

      // chord: 인접 unrevealed, non-flag 셀 일괄 reveal
      let board = state.board;
      let totalRevealed = state.revealedCount;
      let hitMine = false;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!(dr || dc) || !isValid(action.r + dr, action.c + dc)) continue;
          const nb = board[action.r + dr][action.c + dc];
          if (nb.isRevealed || nb.mark === 'flag') continue;
          if (nb.isMine) { hitMine = true; break; }
          const { board: next, newlyRevealed } = revealCells(board, action.r + dr, action.c + dc);
          board = next;
          totalRevealed += newlyRevealed;
        }
        if (hitMine) break;
      }

      if (hitMine) {
        return { ...state, board: revealAllMines(board), boardStatus: 'lost' };
      }

      return {
        ...state,
        board,
        revealedCount: totalRevealed,
        boardStatus: totalRevealed >= TOTAL_SAFE ? 'won' : 'playing',
      };
    }
    case 'EXPLODE': {
      // 서버 결과 수신 후 지뢰 표시
      return { ...state, board: revealAllMines(state.board), boardStatus: 'lost' };
    }
    case 'RESET_BOARD':
      return initialBoardState;
    default:
      return state;
  }
}

// ── 배틀 전체 상태 Reducer ──────────────────────────────────

const initialBattleState: BattleState = {
  phase: 'idle',
  roomId: null,
  myPlayerId: null,
  myNickname: null,
  opponentNickname: null,
  designatedCell: null,
  adjMines: null,
  serverStartAtMillis: null,
  myFirstClickConfirmed: false,
  opponentFirstClickConfirmed: false,
  myProgress: { revealedCount: 0, progressPercent: 0 },
  opponentProgress: { revealedCount: 0, progressPercent: 0 },
  myElapsedMs: 0,
  result: null,
  errorMessage: null,
  reconnecting: false,
};

function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'JOIN_REQUESTED':
      return {
        ...initialBattleState,
        phase: 'waiting',
        roomId: action.roomId,
        myPlayerId: action.playerId,
        myNickname: action.nickname,
      };
    case 'MATCH_READY': {
      const { payload, myPlayerId } = action;
      const me = payload.players.find(p => p.playerId === myPlayerId);
      return {
        ...state,
        phase: 'ready',
        roomId: payload.roomId,
        myNickname: me?.nickname ?? state.myNickname,
        opponentNickname: payload.opponentNickname,
        designatedCell: payload.designatedCell,
        myFirstClickConfirmed: false,
        opponentFirstClickConfirmed: false,
      };
    }
    case 'FIRST_CLICK_SENT':
      return { ...state, myFirstClickConfirmed: true };
    case 'GAME_STARTED':
      return {
        ...state,
        phase: 'playing',
        adjMines: action.payload.adjMines,
        serverStartAtMillis: action.payload.serverStartAtMillis,
        myElapsedMs: 0,
        myProgress: { revealedCount: 0, progressPercent: 0 },
        opponentProgress: { revealedCount: 0, progressPercent: 0 },
      };
    case 'PROGRESS_UPDATE': {
      // 상대 진행률만 업데이트 (본인 필터는 hook에서 처리)
      const { payload } = action;
      return {
        ...state,
        opponentProgress: {
          revealedCount: payload.revealedCount,
          progressPercent: payload.progressPercent,
        },
      };
    }
    case 'GAME_RESULT':
      return { ...state, phase: 'finished', result: action.payload };
    case 'STATE_SNAPSHOT': {
      const { payload, myPlayerId } = action;
      const me = payload.players.find(p => p.playerId === myPlayerId);
      const opponent = payload.players.find(p => p.playerId !== myPlayerId);
      const statusMap: Record<string, BattleState['phase']> = {
        WAITING: 'waiting',
        MATCH_READY: 'ready',
        PLAYING: 'playing',
        FINISHED: 'finished',
      };
      const newPhase = statusMap[payload.roomStatus] ?? state.phase;
      return {
        ...state,
        phase: newPhase,
        myNickname: me?.nickname ?? state.myNickname,
        opponentNickname: opponent?.nickname ?? state.opponentNickname,
        adjMines: payload.adjMines ?? state.adjMines,
        serverStartAtMillis: payload.serverStartAtMillis ?? state.serverStartAtMillis,
        myFirstClickConfirmed: payload.myFirstClickConfirmed,
        opponentFirstClickConfirmed: payload.opponentFirstClickConfirmed,
        myProgress: payload.myProgress,
        opponentProgress: payload.opponentProgress,
        reconnecting: false,
      };
    }
    case 'OPPONENT_DISCONNECTED':
      return { ...state, reconnecting: true };
    case 'OPPONENT_RECONNECTED':
      return { ...state, reconnecting: false };
    case 'SET_ELAPSED':
      return { ...state, myElapsedMs: action.elapsedMs };
    case 'ERROR':
      return { ...state, errorMessage: action.message };
    case 'RESET':
      return initialBattleState;
    default:
      return state;
  }
}

// ── Hook 반환 타입 ──────────────────────────────────────────

export interface UseMinesweeperBattleGameReturn {
  battleState: BattleState;
  boardState: BoardState;
  dispatchBattle: Dispatch<BattleAction>;
  revealCell: (r: number, c: number) => { hitMine: boolean; cleared: boolean; newCount: number };
  toggleMark: (r: number, c: number) => void;
  chordClick: (r: number, c: number) => { hitMine: boolean; cleared: boolean; newCount: number };
  handleMatchReady: (payload: MatchReadyPayload, myPlayerId: string) => void;
  handleGameStarted: (payload: GameStartedPayload) => void;
  handleProgress: (payload: ProgressUpdatePayload, myPlayerId: string) => void;
  handleGameResult: (payload: GameResultPayload) => void;
  handleStateSnapshot: (payload: StateSnapshotPayload, myPlayerId: string) => void;
  handleOpponentDisconnected: () => void;
  handleOpponentReconnected: () => void;
  handleError: (code: string, message: string) => void;
  resetGame: () => void;
}

export function useMinesweeperBattleGame(): UseMinesweeperBattleGameReturn {
  const [battleState, dispatchBattle] = useReducer(battleReducer, initialBattleState);
  const [boardState, dispatchBoard] = useReducer(boardReducer, initialBoardState);

  // 타이머 (requestAnimationFrame)
  const animIdRef = useRef<number | null>(null);
  const timerRunningRef = useRef(false);
  const serverStartAtMillisRef = useRef<number | null>(null);

  // battleState.serverStartAtMillis 동기화
  useEffect(() => {
    serverStartAtMillisRef.current = battleState.serverStartAtMillis;
  }, [battleState.serverStartAtMillis]);

  // 타이머 시작/중지
  useEffect(() => {
    if (battleState.phase === 'playing' && battleState.serverStartAtMillis !== null) {
      timerRunningRef.current = true;

      const tick = () => {
        if (!timerRunningRef.current) return;
        const elapsed = Date.now() - (serverStartAtMillisRef.current ?? Date.now());
        dispatchBattle({ type: 'SET_ELAPSED', elapsedMs: Math.max(0, elapsed) });
        animIdRef.current = requestAnimationFrame(tick);
      };

      animIdRef.current = requestAnimationFrame(tick);
    } else {
      timerRunningRef.current = false;
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    }

    return () => {
      timerRunningRef.current = false;
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [battleState.phase, battleState.serverStartAtMillis]);

  // ── 보드 조작 메서드 ───────────────────────────────────────

  const revealCell = useCallback((r: number, c: number): { hitMine: boolean; cleared: boolean; newCount: number } => {
    const cell = boardState.board[r]?.[c];
    if (!cell || cell.isRevealed || cell.mark === 'flag' || boardState.boardStatus !== 'playing') {
      return { hitMine: false, cleared: false, newCount: boardState.revealedCount };
    }

    if (cell.isMine) {
      dispatchBoard({ type: 'REVEAL', r, c }); // triggers boardStatus='lost' via reducer
      return { hitMine: true, cleared: false, newCount: boardState.revealedCount };
    }

    // Peek at result to get newCount before dispatching
    const { newlyRevealed } = revealCells(boardState.board, r, c);
    const newCount = boardState.revealedCount + newlyRevealed;
    dispatchBoard({ type: 'REVEAL', r, c });
    return { hitMine: false, cleared: newCount >= TOTAL_SAFE, newCount };
  }, [boardState]);

  const toggleMark = useCallback((r: number, c: number) => {
    dispatchBoard({ type: 'TOGGLE_MARK', r, c });
  }, []);

  const chordClick = useCallback((r: number, c: number): { hitMine: boolean; cleared: boolean; newCount: number } => {
    const cell = boardState.board[r]?.[c];
    if (!cell || !cell.isRevealed || boardState.boardStatus !== 'playing') {
      return { hitMine: false, cleared: false, newCount: boardState.revealedCount };
    }

    // 인접 flag 수 확인
    let adjFlags = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if ((dr || dc) && isValid(r + dr, c + dc) && boardState.board[r + dr][c + dc].mark === 'flag')
          adjFlags++;

    if (adjFlags !== cell.adjCount) {
      return { hitMine: false, cleared: false, newCount: boardState.revealedCount };
    }

    // 인접 셀 중 지뢰 있으면 hitMine
    let hitMine = false;
    let totalNew = 0;
    let board = boardState.board;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!(dr || dc) || !isValid(r + dr, c + dc)) continue;
        const nb = board[r + dr][c + dc];
        if (nb.isRevealed || nb.mark === 'flag') continue;
        if (nb.isMine) { hitMine = true; break; }
        const { board: next, newlyRevealed } = revealCells(board, r + dr, c + dc);
        board = next;
        totalNew += newlyRevealed;
      }
      if (hitMine) break;
    }

    const newCount = boardState.revealedCount + totalNew;
    dispatchBoard({ type: 'CHORD', r, c });
    return { hitMine, cleared: !hitMine && newCount >= TOTAL_SAFE, newCount };
  }, [boardState]);

  // ── 이벤트 핸들러 ─────────────────────────────────────────

  const handleMatchReady = useCallback((payload: MatchReadyPayload, myPlayerId: string) => {
    dispatchBattle({ type: 'MATCH_READY', payload, myPlayerId });
    dispatchBoard({ type: 'RESET_BOARD' });
  }, []);

  const handleGameStarted = useCallback((payload: GameStartedPayload) => {
    dispatchBattle({ type: 'GAME_STARTED', payload });
    // 보드 초기화: adjMines 적용 + (4,4) 즉시 reveal
    dispatchBoard({
      type: 'INIT_BOARD',
      adjMines: payload.adjMines,
      firstR: 4,
      firstC: 4,
    });
  }, []);

  const handleProgress = useCallback((payload: ProgressUpdatePayload, myPlayerId: string) => {
    // 본인 playerId는 무시
    if (payload.playerId === myPlayerId) return;
    dispatchBattle({ type: 'PROGRESS_UPDATE', payload });
  }, []);

  const handleGameResult = useCallback((payload: GameResultPayload) => {
    timerRunningRef.current = false;
    if (animIdRef.current !== null) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    dispatchBattle({ type: 'GAME_RESULT', payload });
  }, []);

  const handleStateSnapshot = useCallback((payload: StateSnapshotPayload, myPlayerId: string) => {
    dispatchBattle({ type: 'STATE_SNAPSHOT', payload, myPlayerId });
    if (payload.adjMines && payload.roomStatus === 'PLAYING') {
      dispatchBoard({
        type: 'INIT_BOARD',
        adjMines: payload.adjMines,
        firstR: 4,
        firstC: 4,
      });
    }
  }, []);

  const handleOpponentDisconnected = useCallback(() => {
    dispatchBattle({ type: 'OPPONENT_DISCONNECTED' });
  }, []);

  const handleOpponentReconnected = useCallback(() => {
    dispatchBattle({ type: 'OPPONENT_RECONNECTED' });
  }, []);

  const handleError = useCallback((code: string, message: string) => {
    dispatchBattle({ type: 'ERROR', message: `${code}: ${message}` });
  }, []);

  const resetGame = useCallback(() => {
    timerRunningRef.current = false;
    if (animIdRef.current !== null) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    dispatchBattle({ type: 'RESET' });
    dispatchBoard({ type: 'RESET_BOARD' });
  }, []);

  return {
    battleState,
    boardState,
    dispatchBattle,
    revealCell,
    toggleMark,
    chordClick,
    handleMatchReady,
    handleGameStarted,
    handleProgress,
    handleGameResult,
    handleStateSnapshot,
    handleOpponentDisconnected,
    handleOpponentReconnected,
    handleError,
    resetGame,
  };
}
