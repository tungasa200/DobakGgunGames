import { useCallback, useEffect, useReducer, useRef } from 'react';

export type Level = 'beginner' | 'intermediate' | 'expert' | 'custom';
export type CellMark = 'none' | 'flag' | 'question';

export const PRESETS: Record<Exclude<Level, 'custom'>, { rows: number; cols: number; mines: number }> = {
  beginner:     { rows: 9,  cols: 9,  mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert:       { rows: 16, cols: 30, mines: 99 },
};

export interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  mark: CellMark;   // none | flag | question
  adjMines: number;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

interface State {
  level: Level;
  rows: number;
  cols: number;
  totalMines: number;
  board: Cell[][];
  revealedCount: number;
  flagCount: number;
  status: GameStatus;
  elapsed: number;
  timerRunning: boolean;
  /** Phase 3: 서버에서 받은 보드인 경우 true → 첫 클릭에서 placeMines 생략 */
  boardFromServer: boolean;
}

type Action =
  | { type: 'RESET'; level: Level; customRows?: number; customCols?: number; customMines?: number }
  | { type: 'REVEAL'; r: number; c: number; newBoard: Cell[][]; revealedCount: number }
  | { type: 'MARK'; r: number; c: number; mark: CellMark; flagDelta: number }
  | { type: 'WIN'; elapsed: number }
  | { type: 'LOSE'; newBoard: Cell[][] }
  | { type: 'TICK'; elapsed: number }
  /**
   * Phase 3: 서버 adjMines 보드를 적용한 뒤 firstClick 셀을 즉시 오픈.
   * adjMines[r][c] === -1 → 지뢰 셀 (서버가 firstClick 안전 보장).
   */
  | { type: 'FIRST_REVEAL_SERVER'; adjMines: number[][]; firstR: number; firstC: number };

function emptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      isRevealed: false,
      mark: 'none' as CellMark,
      adjMines: 0,
    }))
  );
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET': {
      const rows  = action.level === 'custom' ? (action.customRows  ?? 10) : PRESETS[action.level].rows;
      const cols  = action.level === 'custom' ? (action.customCols  ?? 10) : PRESETS[action.level].cols;
      const mines = action.level === 'custom' ? (action.customMines ?? 15) : PRESETS[action.level].mines;
      return {
        level: action.level,
        rows,
        cols,
        totalMines: mines,
        board: emptyBoard(rows, cols),
        revealedCount: 0,
        flagCount: 0,
        status: 'idle',
        elapsed: 0,
        timerRunning: false,
        boardFromServer: false,
      };
    }
    case 'REVEAL':
      return {
        ...state,
        board: action.newBoard,
        revealedCount: action.revealedCount,
        status: 'playing',
        timerRunning: true,
      };
    case 'MARK': {
      const board = state.board.map((row) => row.map((c) => ({ ...c })));
      board[action.r][action.c].mark = action.mark;
      return { ...state, board, flagCount: state.flagCount + action.flagDelta };
    }
    case 'WIN':
      return { ...state, status: 'won', timerRunning: false, elapsed: action.elapsed };
    case 'LOSE':
      return { ...state, board: action.newBoard, status: 'lost', timerRunning: false };
    case 'TICK':
      return { ...state, elapsed: action.elapsed };

    case 'FIRST_REVEAL_SERVER': {
      // Phase 3: adjMines 배열로 보드를 구성한 뒤 firstClick 셀 즉시 오픈
      const { adjMines, firstR, firstC } = action;
      const rows = adjMines.length;
      const cols = adjMines[0]?.length ?? 0;

      const newBoard: Cell[][] = adjMines.map((row) =>
        row.map((val) => ({
          isMine:     val === -1,
          isRevealed: false,
          mark:       'none' as CellMark,
          adjMines:   val === -1 ? 0 : val,
        }))
      );

      // 서버가 firstClick 안전을 보장하므로 지뢰 셀 클릭은 발생하지 않아야 함
      if (newBoard[firstR]?.[firstC]?.isMine) {
        return { ...state, board: revealAllMines(newBoard), status: 'lost', timerRunning: false, boardFromServer: true };
      }

      const { board: revealed, revealed: count } = revealCells(newBoard, rows, cols, firstR, firstC);
      const won = count === rows * cols - state.totalMines;

      return {
        ...state,
        board:         revealed,
        revealedCount: count,
        status:        won ? 'won' : 'playing',
        timerRunning:  !won,
        elapsed:       0,
        boardFromServer: true,
      };
    }

    default:
      return state;
  }
}

function isValid(r: number, c: number, rows: number, cols: number) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}

function placeMines(board: Cell[][], rows: number, cols: number, mines: number, firstR: number, firstC: number): Cell[][] {
  const next = board.map((row) => row.map((c) => ({ ...c })));
  let planted = 0;
  while (planted < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!next[r][c].isMine && !isAdjacent(r, c, firstR, firstC)) {
      next[r][c].isMine = true;
      planted++;
    }
  }
  // adjMines 계산
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!next[r][c].isMine) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if ((dr || dc) && isValid(r + dr, c + dc, rows, cols) && next[r + dr][c + dc].isMine)
              count++;
        next[r][c].adjMines = count;
      }
  return next;
}

function revealCells(board: Cell[][], rows: number, cols: number, startR: number, startC: number): { board: Cell[][]; revealed: number } {
  const next = board.map((row) => row.map((c) => ({ ...c })));
  let revealed = 0;

  function dfs(r: number, c: number) {
    if (!isValid(r, c, rows, cols)) return;
    const cell = next[r][c];
    if (cell.isRevealed || cell.mark === 'flag') return;
    cell.isRevealed = true;
    revealed++;
    if (cell.adjMines === 0 && !cell.isMine)
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) dfs(r + dr, c + dc);
  }

  dfs(startR, startC);
  return { board: next, revealed };
}

function revealAllMines(board: Cell[][]): Cell[][] {
  return board.map((row) =>
    row.map((cell) =>
      cell.isMine && !cell.isRevealed && cell.mark !== 'flag' ? { ...cell, isRevealed: true } : cell
    )
  );
}

function initState(level: Exclude<Level, 'custom'>): State {
  const p = PRESETS[level];
  return {
    level,
    rows: p.rows,
    cols: p.cols,
    totalMines: p.mines,
    board: emptyBoard(p.rows, p.cols),
    revealedCount: 0,
    flagCount: 0,
    status: 'idle',
    elapsed: 0,
    timerRunning: false,
    boardFromServer: false,
  };
}

export function useMinesweeperGame(initialLevel: Exclude<Level, 'custom'> = 'beginner') {
  const [state, dispatch] = useReducer(reducer, initialLevel, initState);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

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
    dispatch({ type: 'RESET', level });
  }, [state.level]);

  const resetCustom = useCallback((rows: number, cols: number, mines: number) => {
    dispatch({ type: 'RESET', level: 'custom', customRows: rows, customCols: cols, customMines: mines });
  }, []);

  /**
   * Phase 3: 서버 adjMines 보드를 적용하고 첫 셀을 오픈.
   * 단일 dispatch 로 처리해 React 상태 타이밍 문제를 회피.
   */
  const revealFirstCellWithServerBoard = useCallback((adjMines: number[][], r: number, c: number) => {
    dispatch({ type: 'FIRST_REVEAL_SERVER', adjMines, firstR: r, firstC: c });
  }, []);

  const revealCell = useCallback((r: number, c: number) => {
    if (state.status === 'won' || state.status === 'lost') return;
    const cell = state.board[r][c];
    if (cell.isRevealed || cell.mark === 'flag') return;

    // 첫 클릭 — 서버 보드가 없을 때만 클라이언트에서 지뢰 배치
    let board = state.board;
    if (state.status === 'idle' && !state.boardFromServer) {
      board = placeMines(board, state.rows, state.cols, state.totalMines, r, c);
    }

    if (board[r][c].isMine) {
      const revealed = revealAllMines(board);
      dispatch({ type: 'LOSE', newBoard: revealed });
      return;
    }

    const { board: next, revealed } = revealCells(board, state.rows, state.cols, r, c);
    const total = state.revealedCount + revealed;
    dispatch({ type: 'REVEAL', r, c, newBoard: next, revealedCount: total });

    if (total === state.rows * state.cols - state.totalMines) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      dispatch({ type: 'WIN', elapsed });
    }
  }, [state]);

  // 코드 클릭 (양클릭): 인접 플래그 수 == adjMines 이면 나머지 열기
  const chordClick = useCallback((r: number, c: number) => {
    if (state.status !== 'playing') return;
    const cell = state.board[r][c];
    if (!cell.isRevealed || cell.adjMines === 0) return;

    let adjFlags = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if ((dr || dc) && isValid(r + dr, c + dc, state.rows, state.cols) &&
            state.board[r + dr][c + dc].mark === 'flag')
          adjFlags++;

    if (adjFlags !== cell.adjMines) return;

    let board = state.board;
    let totalRevealed = state.revealedCount;
    let hitMine = false;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!(dr || dc) || !isValid(r + dr, c + dc, state.rows, state.cols)) continue;
        const nb = board[r + dr][c + dc];
        if (nb.isRevealed || nb.mark === 'flag') continue;
        if (nb.isMine) { hitMine = true; break; }
        const { board: next, revealed } = revealCells(board, state.rows, state.cols, r + dr, c + dc);
        board = next;
        totalRevealed += revealed;
      }
      if (hitMine) break;
    }

    if (hitMine) {
      dispatch({ type: 'LOSE', newBoard: revealAllMines(board) });
      return;
    }

    dispatch({ type: 'REVEAL', r, c, newBoard: board, revealedCount: totalRevealed });
    if (totalRevealed === state.rows * state.cols - state.totalMines) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      dispatch({ type: 'WIN', elapsed });
    }
  }, [state]);

  const toggleMark = useCallback((r: number, c: number) => {
    if (state.status === 'idle' || state.status === 'won' || state.status === 'lost') return;
    const cell = state.board[r][c];
    if (cell.isRevealed) return;

    let mark: CellMark;
    let flagDelta = 0;
    if (cell.mark === 'none')     { mark = 'flag';     flagDelta = +1; }
    else if (cell.mark === 'flag') { mark = 'question'; flagDelta = -1; }
    else                           { mark = 'none';     flagDelta = 0; }

    dispatch({ type: 'MARK', r, c, mark, flagDelta });
  }, [state.status, state.board]);

  return { state, reset, resetCustom, revealCell, revealFirstCellWithServerBoard, chordClick, toggleMark };
}
