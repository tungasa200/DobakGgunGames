import { useCallback, useEffect, useReducer, useRef } from 'react';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameStatus = 'idle' | 'playing' | 'won';

export interface SudokuState {
  board: number[][];
  fixed: boolean[][];
  notes: Set<number>[][];
  selected: [number, number] | null;
  isNoteMode: boolean;
  hintsLeft: number;
  status: GameStatus;
  elapsed: number;
  timerRunning: boolean;
  difficulty: Difficulty;
  sessionId: string | null;
  gameKey: number;
}

type Action =
  | { type: 'START'; puzzle: number[][]; sessionId: string; difficulty: Difficulty }
  | { type: 'SELECT'; row: number; col: number }
  | { type: 'INPUT'; num: number }
  | { type: 'DELETE' }
  | { type: 'TOGGLE_NOTE' }
  | { type: 'USE_HINT'; row: number; col: number; answer: number }
  | { type: 'TICK'; elapsed: number }
  | { type: 'RESET'; difficulty: Difficulty };

function makeNotes(): Set<number>[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>())
  );
}

function initState(difficulty: Difficulty): SudokuState {
  return {
    board: Array.from({ length: 9 }, () => Array(9).fill(0)),
    fixed: Array.from({ length: 9 }, () => Array(9).fill(false)),
    notes: makeNotes(),
    selected: null,
    isNoteMode: false,
    hintsLeft: 3,
    status: 'idle',
    elapsed: 0,
    timerRunning: false,
    difficulty,
    sessionId: null,
    gameKey: 0,
  };
}

function checkComplete(board: number[][]): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0) return false;

  for (let r = 0; r < 9; r++) {
    const s = new Set(board[r]);
    if (s.size !== 9 || s.has(0)) return false;
  }
  for (let c = 0; c < 9; c++) {
    const s = new Set(board.map(row => row[c]));
    if (s.size !== 9 || s.has(0)) return false;
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const s = new Set<number>();
      for (let r = br * 3; r < br * 3 + 3; r++)
        for (let c = bc * 3; c < bc * 3 + 3; c++)
          s.add(board[r][c]);
      if (s.size !== 9 || s.has(0)) return false;
    }
  }
  return true;
}

function reducer(state: SudokuState, action: Action): SudokuState {
  switch (action.type) {
    case 'START': {
      const fixed = action.puzzle.map(row => row.map(v => v !== 0));
      return {
        ...initState(action.difficulty),
        board: action.puzzle.map(row => [...row]),
        fixed,
        sessionId: action.sessionId,
        status: 'playing',
        timerRunning: true,
        gameKey: state.gameKey + 1,
      };
    }
    case 'SELECT':
      if (state.status !== 'playing') return state;
      return { ...state, selected: [action.row, action.col] };

    case 'INPUT': {
      if (state.status !== 'playing' || !state.selected) return state;
      const [r, c] = state.selected;
      if (state.fixed[r][c]) return state;

      if (state.isNoteMode) {
        if (state.board[r][c] !== 0) return state;
        const notes = state.notes.map(row => row.map(s => new Set(s)));
        const cell = notes[r][c];
        cell.has(action.num) ? cell.delete(action.num) : cell.add(action.num);
        return { ...state, notes };
      }

      const board = state.board.map(row => [...row]);
      board[r][c] = action.num;
      const notes = state.notes.map(row => row.map(s => new Set(s)));
      notes[r][c] = new Set();
      const won = checkComplete(board);
      return { ...state, board, notes, status: won ? 'won' : 'playing', timerRunning: !won };
    }

    case 'DELETE': {
      if (state.status !== 'playing' || !state.selected) return state;
      const [r, c] = state.selected;
      if (state.fixed[r][c]) return state;
      const board = state.board.map(row => [...row]);
      const notes = state.notes.map(row => row.map(s => new Set(s)));
      if (board[r][c] !== 0) board[r][c] = 0;
      else notes[r][c] = new Set();
      return { ...state, board, notes };
    }

    case 'TOGGLE_NOTE':
      return { ...state, isNoteMode: !state.isNoteMode };

    case 'USE_HINT': {
      if (state.hintsLeft <= 0 || state.status !== 'playing') return state;
      const board = state.board.map(row => [...row]);
      const fixed = state.fixed.map(row => [...row]);
      const notes = state.notes.map(row => row.map(s => new Set(s)));
      board[action.row][action.col] = action.answer;
      fixed[action.row][action.col] = true;
      notes[action.row][action.col] = new Set();
      const won = checkComplete(board);
      return {
        ...state, board, fixed, notes,
        hintsLeft: state.hintsLeft - 1,
        selected: [action.row, action.col],
        status: won ? 'won' : 'playing',
        timerRunning: !won,
      };
    }

    case 'TICK':
      return { ...state, elapsed: action.elapsed };

    case 'RESET':
      return initState(action.difficulty);

    default:
      return state;
  }
}

export function useSudokuGame(initialDifficulty: Difficulty = 'easy') {
  const [state, dispatch] = useReducer(reducer, initialDifficulty, initState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (state.timerRunning) {
      startTimeRef.current = Date.now() - state.elapsed * 1000;
      timerRef.current = setInterval(() => {
        dispatch({ type: 'TICK', elapsed: (Date.now() - startTimeRef.current) / 1000 });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timerRunning, state.gameKey]);

  const startGame = useCallback((puzzle: number[][], sessionId: string, difficulty: Difficulty) => {
    dispatch({ type: 'START', puzzle, sessionId, difficulty });
  }, []);

  const selectCell = useCallback((row: number, col: number) => {
    dispatch({ type: 'SELECT', row, col });
  }, []);

  const inputNumber = useCallback((num: number) => {
    dispatch({ type: 'INPUT', num });
  }, []);

  const deleteCell = useCallback(() => {
    dispatch({ type: 'DELETE' });
  }, []);

  const toggleNote = useCallback(() => {
    dispatch({ type: 'TOGGLE_NOTE' });
  }, []);

  const useHint = useCallback((row: number, col: number, answer: number) => {
    dispatch({ type: 'USE_HINT', row, col, answer });
  }, []);

  const reset = useCallback((difficulty?: Difficulty) => {
    dispatch({ type: 'RESET', difficulty: difficulty ?? state.difficulty });
  }, [state.difficulty]);

  return { state, startGame, selectCell, inputNumber, deleteCell, toggleNote, useHint, reset };
}
