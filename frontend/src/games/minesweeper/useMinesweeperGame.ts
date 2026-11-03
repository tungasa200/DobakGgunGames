import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  getMinesweeperState,
  revealMinesweeperCells,
  startMinesweeperSession,
  type CellPosition,
  type MinesweeperPlayUpdate,
} from '../../api/minesweeper';
import { isGameDisabledError } from '../../api/gameDisabled';

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
  /** 서버 응답을 기다리는 칸. 눌린 모양으로 보여 준다 */
  isPending: boolean;
}

/** ended: 세션을 잃어 더 진행할 수 없다 */
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost' | 'ended';

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
  sessionId: string | null;
  clearTimeMs: number | null;
  notice: string | null;
}

interface ServerUpdate extends MinesweeperPlayUpdate {
  /** 응답을 받아 눌린 표시를 풀 칸 */
  settled: CellPosition[];
  sessionId?: string;
}

type Action =
  | { type: 'RESET'; level: Level; customRows?: number; customCols?: number; customMines?: number }
  | { type: 'REVEAL'; r: number; c: number; newBoard: Cell[][]; revealedCount: number }
  | { type: 'MARK'; r: number; c: number }
  | { type: 'WIN'; elapsed: number }
  | { type: 'LOSE'; newBoard: Cell[][] }
  | { type: 'TICK'; elapsed: number }
  | { type: 'PRESS'; cells: CellPosition[] }
  | { type: 'SERVER_UPDATE'; update: ServerUpdate }
  | { type: 'CLEAR_PENDING'; notice: string | null }
  | { type: 'SESSION_LOST'; notice: string };

function emptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      isRevealed: false,
      mark: 'none' as CellMark,
      adjMines: 0,
      isPending: false,
    }))
  );
}

function clearPending(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => (cell.isPending ? { ...cell, isPending: false } : cell)));
}

function applyServerUpdate(state: State, update: ServerUpdate): State {
  let board = state.board.map((row) => row.map((c) => ({ ...c })));
  let { flagCount } = state;

  for (const [r, c] of update.settled) board[r][c].isPending = false;
  for (const { r, c, n } of update.revealed) {
    const cell = board[r][c];
    if (cell.isRevealed) continue;
    // 요청을 보낸 뒤 꽂은 깃발은 서버가 모른다. 서버가 연 칸이 맞으므로 깃발을 뗀다
    if (cell.mark === 'flag') flagCount--;
    board[r][c] = { ...cell, isRevealed: true, isPending: false, mark: 'none', adjMines: n };
  }

  const next = { ...state, board, flagCount, sessionId: update.sessionId ?? state.sessionId };
  if (update.status === 'PLAYING') return { ...next, status: 'playing', timerRunning: true };

  if (update.status === 'WON') {
    const clearTimeMs = update.clearTimeMs ?? 0;
    return {
      ...next,
      board: clearPending(board),
      status: 'won',
      timerRunning: false,
      elapsed: clearTimeMs / 1000,
      clearTimeMs,
    };
  }

  for (const [r, c] of update.mines ?? []) board[r][c].isMine = true;
  board = revealAllMines(clearPending(board));
  return { ...next, board, status: 'lost', timerRunning: false };
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
        sessionId: null,
        clearTimeMs: null,
        notice: null,
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
      // 길게 누르기 타이머가 옛 렌더에서 불러도 지금 판으로 판단하도록 여기서 정한다
      const cell = state.board[action.r]?.[action.c];
      if (state.status !== 'playing' || !cell || cell.isRevealed || cell.isPending) return state;
      const mark: CellMark = cell.mark === 'none' ? 'flag' : cell.mark === 'flag' ? 'question' : 'none';
      const flagDelta = cell.mark === 'none' ? 1 : cell.mark === 'flag' ? -1 : 0;
      const board = state.board.map((row) => row.map((c) => ({ ...c })));
      board[action.r][action.c].mark = mark;
      return { ...state, board, flagCount: state.flagCount + flagDelta };
    }
    case 'WIN':
      return { ...state, status: 'won', timerRunning: false, elapsed: action.elapsed };
    case 'LOSE':
      return { ...state, board: action.newBoard, status: 'lost', timerRunning: false };
    case 'TICK':
      // 타이머는 렌더 뒤에 꺼지므로 그 사이의 틱이 서버 기록을 덮지 못하게 한다
      return state.timerRunning ? { ...state, elapsed: action.elapsed } : state;

    case 'PRESS': {
      const board = state.board.map((row) => row.map((c) => ({ ...c })));
      // 앞선 응답이 이미 연 칸은 응답이 다시 오지 않아 눌린 표시가 풀리지 않는다
      for (const [r, c] of action.cells) board[r][c].isPending = !board[r][c].isRevealed;
      return { ...state, board, notice: null };
    }
    case 'SERVER_UPDATE':
      return applyServerUpdate(state, action.update);
    case 'CLEAR_PENDING':
      return { ...state, board: clearPending(state.board), notice: action.notice };
    case 'SESSION_LOST':
      return { ...state, board: clearPending(state.board), status: 'ended', timerRunning: false, notice: action.notice };

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
    sessionId: null,
    clearTimeMs: null,
    notice: null,
  };
}

const MAX_CELLS_PER_REVEAL = 8;  // 서버 한도
const START_ATTEMPTS = 3;
const MAX_REVEAL_FAILURES = 3;
const RETRY_DELAY_MS = 1000;

/** 이 코드를 받으면 세션을 더 쓸 수 없어 판을 끝낸다 */
const SESSION_LOST_NOTICES: Record<string, string> = {
  SESSION_EXPIRED: '세션이 만료되었습니다. 새 게임을 시작해 주세요.',
  SESSION_INVALID: '세션을 확인할 수 없습니다. 새 게임을 시작해 주세요.',
};
const GAME_ENDED_NOTICE = '이미 종료된 게임입니다. 새 게임을 시작해 주세요.';

function errorCode(e: unknown) {
  return (e as { code?: string } | null)?.code ?? '';
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flagPositions(board: Cell[][]): CellPosition[] {
  return board.flatMap((row, r) =>
    row.flatMap((cell, c): CellPosition[] => (cell.mark === 'flag' ? [[r, c]] : []))
  );
}

/**
 * 한 판의 서버 통신. 판마다 새로 만들고 판이 바뀌면 cancel 하므로 늦은 응답이 다음 판을 건드리지 못한다.
 * 요청은 한 번에 하나만 보낸다. state 조회가 진행 중인 reveal을 앞지르지 않게 하고,
 * 응답을 기다리는 사이 누른 칸은 다음 요청에 묶는다.
 */
function createServerRun(level: string, dispatch: (action: Action) => void, getBoard: () => Cell[][]) {
  let queue: CellPosition[] = [];
  let sessionId: string | null = null;
  let busy = false;
  let cancelled = false;
  let failures = 0;
  let unsynced = false;  // 응답을 잃어 서버가 연 칸을 다 받았는지 모른다
  const opened = new Set<string>();  // dispatch 뒤 렌더 전에도 다음 요청이 볼 수 있게 따로 둔다

  const isOpened = ([r, c]: CellPosition) => opened.has(`${r},${c}`);

  function apply(update: Omit<ServerUpdate, 'settled'>, settled: CellPosition[]) {
    for (const { r, c } of update.revealed) opened.add(`${r},${c}`);
    if (update.status !== 'PLAYING') queue = [];
    dispatch({ type: 'SERVER_UPDATE', update: { ...update, settled } });
  }

  function stop(notice: string | null) {
    queue = [];
    failures = 0;
    dispatch({ type: 'CLEAR_PENDING', notice });
  }

  function endSession(notice: string) {
    queue = [];
    dispatch({ type: 'SESSION_LOST', notice });
  }

  async function start() {
    const [r, c] = queue.shift()!;
    for (let attempt = 1; attempt <= START_ATTEMPTS; attempt++) {
      try {
        const res = await startMinesweeperSession(level, { r, c });
        if (cancelled) return;
        sessionId = res.sessionId;
        apply(res, [[r, c]]);
        return;
      } catch (e) {
        if (cancelled) return;
        if (isGameDisabledError(e)) { stop(null); return; }
        if (attempt < START_ATTEMPTS) await delay(RETRY_DELAY_MS);
        if (cancelled) return;
      }
    }
    stop('게임을 시작하지 못했습니다. 다시 시도해 주세요.');
  }

  /** 응답을 잃었거나 받은 응답이 판과 맞지 않을 때 서버 판으로 맞춘다 */
  async function resync(id: string) {
    const state = await getMinesweeperState(id);
    if (cancelled) return null;
    unsynced = false;
    apply(state, []);
    return state.status;
  }

  async function recover(id: string, batch: CellPosition[], e: unknown) {
    if (isGameDisabledError(e)) { stop(null); return; }
    const code = errorCode(e);
    if (SESSION_LOST_NOTICES[code]) { endSession(SESSION_LOST_NOTICES[code]); return; }
    unsynced = true;
    const giveUp = () => stop('연결이 불안정합니다. 칸을 다시 눌러 주세요.');
    failures++;
    // GAME_ENDED는 서버가 답한 것이므로 연결 실패로 끝내지 않고 서버 판을 받아 온다
    if (code !== 'GAME_ENDED' && failures >= MAX_REVEAL_FAILURES) { giveUp(); return; }
    await delay(RETRY_DELAY_MS);
    if (cancelled) return;
    try {
      if ((await resync(id)) !== 'PLAYING') return;
      if (code === 'GAME_ENDED') { endSession(GAME_ENDED_NOTICE); return; }
    } catch (stateError) {
      if (cancelled) return;
      const lost = SESSION_LOST_NOTICES[errorCode(stateError)];
      if (lost) { endSession(lost); return; }
      if (failures >= MAX_REVEAL_FAILURES) { giveUp(); return; }
    }
    queue.unshift(...batch);  // 이미 열린 칸은 revealNext가 거른다
  }

  /** 응답에 빠진 칸을 받아 온다. 이미 끝난 판의 결과는 세션을 잃어도 유지한다 */
  async function backfill(id: string, status: MinesweeperPlayUpdate['status']) {
    try {
      await resync(id);
    } catch (e) {
      const lost = SESSION_LOST_NOTICES[errorCode(e)];
      if (!cancelled && lost && status === 'PLAYING') endSession(lost);
    }
  }

  async function revealNext(id: string) {
    queue = queue.filter((cell) => !isOpened(cell));
    const batch = queue.splice(0, MAX_CELLS_PER_REVEAL);
    if (batch.length === 0) return;
    let update: MinesweeperPlayUpdate;
    try {
      update = await revealMinesweeperCells(id, batch, flagPositions(getBoard()));
    } catch (e) {
      if (!cancelled) await recover(id, batch, e);
      return;
    }
    if (cancelled) return;
    failures = 0;
    apply(update, batch);
    // 앞선 요청이 응답만 잃고 처리됐으면 이번 응답에 그 칸이 빠진다
    if (unsynced || (update.status === 'PLAYING' && !batch.every(isOpened))) {
      await backfill(id, update.status);
    }
  }

  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length > 0 && !cancelled) {
      if (sessionId) await revealNext(sessionId);
      else await start();
    }
    busy = false;
  }

  return {
    enqueue(cells: CellPosition[]) {
      queue.push(...cells);
      void pump();
    },
    cancel() {
      cancelled = true;
    },
  };
}

export function useMinesweeperGame(initialLevel: Exclude<Level, 'custom'> = 'beginner') {
  const [state, dispatch] = useReducer(reducer, initialLevel, initState);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const runRef = useRef<ReturnType<typeof createServerRun> | null>(null);
  const boardRef = useRef(state.board);

  useEffect(() => {
    boardRef.current = state.board;
  }, [state.board]);

  const cancelRun = useCallback(() => {
    runRef.current?.cancel();
    runRef.current = null;
  }, []);

  useEffect(() => cancelRun, [cancelRun]);

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
    cancelRun();
    dispatch({ type: 'RESET', level });
  }, [state.level, cancelRun]);

  const resetCustom = useCallback((rows: number, cols: number, mines: number) => {
    cancelRun();
    dispatch({ type: 'RESET', level: 'custom', customRows: rows, customCols: cols, customMines: mines });
  }, [cancelRun]);

  /** 프리셋은 서버가 판정한다. 응답을 기다리지 않고 칸을 먼저 눌린 모양으로 바꾼다 */
  const pressCells = useCallback((cells: CellPosition[]) => {
    dispatch({ type: 'PRESS', cells });
    runRef.current ??= createServerRun(state.level, dispatch, () => boardRef.current);
    runRef.current.enqueue(cells);
  }, [state.level]);

  const revealCell = useCallback((r: number, c: number) => {
    if (state.status === 'won' || state.status === 'lost' || state.status === 'ended') return;
    const cell = state.board[r][c];
    if (cell.isRevealed || cell.isPending || cell.mark === 'flag') return;

    if (state.level !== 'custom') {
      pressCells([[r, c]]);
      return;
    }

    // 커스텀은 랭킹이 없어 클라이언트가 판정한다. 첫 클릭에 지뢰 배치
    let board = state.board;
    if (state.status === 'idle') {
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
  }, [state, pressCells]);

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

    if (state.level !== 'custom') {
      const cells: CellPosition[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!(dr || dc) || !isValid(r + dr, c + dc, state.rows, state.cols)) continue;
          const nb = state.board[r + dr][c + dc];
          if (!nb.isRevealed && !nb.isPending && nb.mark !== 'flag') cells.push([r + dr, c + dc]);
        }
      if (cells.length > 0) pressCells(cells);
      return;
    }

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
  }, [state, pressCells]);

  const toggleMark = useCallback((r: number, c: number) => {
    dispatch({ type: 'MARK', r, c });
  }, []);

  return { state, reset, resetCustom, revealCell, chordClick, toggleMark };
}
