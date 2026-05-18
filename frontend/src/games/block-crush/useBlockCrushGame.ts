// ── Block Crush — 게임 로직 훅 (useReducer 기반) ─────────────
import { useReducer, useCallback } from 'react';
import type { Board, BlockCrushState, TraySlot } from './types';
import type { Piece } from './types';
import { getRandomPieces } from './pieces';
import { calcPlaceScore, calcLineClearScore } from './scoring';

const BOARD_SIZE = 8;

// ── 유틸 ────────────────────────────────────────────────────

/** 빈 8×8 보드 생성 */
function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array<string | null>(BOARD_SIZE).fill(null)
  );
}

/** 초기 상태 */
function createInitialState(): BlockCrushState {
  const [a, b, c] = getRandomPieces(3);
  return {
    board: emptyBoard(),
    tray: [a, b, c],
    score: 0,
    linesCleared: 0,
    combo: 0,
    status: 'idle',
  };
}

// ── 배치 유효성 검사 ──────────────────────────────────────────

/**
 * 주어진 보드에서 piece를 (row, col) 위치에 배치할 수 있는지 검사
 */
export function canPlacePiece(
  board: Board,
  piece: Piece,
  row: number,
  col: number,
): boolean {
  for (const [dr, dc] of piece.shape) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c] !== null) return false;
  }
  return true;
}

/**
 * 보드 어딘가에 piece를 놓을 수 있는 위치가 하나라도 있으면 true
 */
export function hasAnyValidPlacement(board: Board, piece: Piece): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlacePiece(board, piece, r, c)) return true;
    }
  }
  return false;
}

// ── 줄 클리어 ─────────────────────────────────────────────────

/**
 * 가득 찬 가로 행 + 세로 열을 한번에 빈 칸으로 클리어
 * @returns 새 보드 + 클리어된 줄 수 합계
 */
export function clearLines(board: Board): { newBoard: Board; cleared: number } {
  // 가로 행 검사
  const fullRows = new Set<number>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every((cell) => cell !== null)) {
      fullRows.add(r);
    }
  }

  // 세로 열 검사
  const fullCols = new Set<number>();
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c] === null) { full = false; break; }
    }
    if (full) fullCols.add(c);
  }

  const cleared = fullRows.size + fullCols.size;
  if (cleared === 0) return { newBoard: board, cleared: 0 };

  // 클리어 적용 — 한 번에 일괄 제거
  const newBoard: Board = board.map((row, r) =>
    row.map((cell, c) => {
      if (fullRows.has(r) || fullCols.has(c)) return null;
      return cell;
    })
  );

  return { newBoard, cleared };
}

// ── 게임 오버 감지 ────────────────────────────────────────────

/**
 * 트레이에 남은 비-null 조각 중 하나라도 보드에 놓을 수 있으면 false (계속 가능)
 * 모든 조각이 어디에도 놓을 수 없으면 true (게임 오버)
 */
function isGameOver(board: Board, tray: [TraySlot, TraySlot, TraySlot]): boolean {
  const pieces = tray.filter((s): s is Piece => s !== null);
  if (pieces.length === 0) return false; // 트레이 비어 있으면 보충 예정
  return pieces.every((piece) => !hasAnyValidPlacement(board, piece));
}

// ── 액션 타입 ────────────────────────────────────────────────

type Action =
  | { type: 'INIT' }
  | { type: 'PLACE_PIECE'; slotIndex: 0 | 1 | 2; row: number; col: number }
  | { type: 'GAME_OVER' }
  | { type: 'RESET' };

// ── Reducer ─────────────────────────────────────────────────

function reducer(state: BlockCrushState, action: Action): BlockCrushState {
  switch (action.type) {
    case 'INIT': {
      const [a, b, c] = getRandomPieces(3);
      return {
        board: emptyBoard(),
        tray: [a, b, c],
        score: 0,
        linesCleared: 0,
        combo: 0,
        status: 'playing',
      };
    }

    case 'RESET':
      return { ...createInitialState(), status: 'idle' };

    case 'GAME_OVER':
      return { ...state, status: 'gameOver' };

    case 'PLACE_PIECE': {
      if (state.status !== 'playing') return state;

      const { slotIndex, row, col } = action;
      const piece = state.tray[slotIndex];
      if (!piece) return state;

      // 1. 유효성 검사
      if (!canPlacePiece(state.board, piece, row, col)) return state;

      // 2. 보드에 블록 색상 기록
      const newBoard: Board = state.board.map((r) => [...r]);
      for (const [dr, dc] of piece.shape) {
        newBoard[row + dr][col + dc] = piece.color;
      }

      // 3. 트레이 해당 슬롯 null 처리
      const newTray: [TraySlot, TraySlot, TraySlot] = [...state.tray] as [TraySlot, TraySlot, TraySlot];
      newTray[slotIndex] = null;

      // 4. 배치 점수
      let score = state.score + calcPlaceScore(piece.shape.length);

      // 5. 줄 클리어 검사
      const { newBoard: clearedBoard, cleared } = clearLines(newBoard);
      let combo = state.combo;
      let linesCleared = state.linesCleared;

      if (cleared > 0) {
        // 6. 콤보 갱신 (직전 배치에서도 클리어가 있었으면 combo+1, 아니면 1부터)
        combo = combo + 1;
        linesCleared = linesCleared + cleared;
        // 7. 줄 클리어 점수 가산
        score = score + calcLineClearScore(cleared, combo);
      } else {
        // 클리어 없으면 콤보 리셋
        combo = 0;
      }

      // 8. 3슬롯 모두 null이면 새 3블록 보충
      const allUsed = newTray.every((s) => s === null);
      const finalTray: [TraySlot, TraySlot, TraySlot] = allUsed
        ? (getRandomPieces(3) as [Piece, Piece, Piece])
        : newTray;

      const finalBoard = clearedBoard;

      // 9. 게임 오버 감지 — 새 트레이 기준으로 검사
      if (isGameOver(finalBoard, finalTray)) {
        return {
          board: finalBoard,
          tray: finalTray,
          score,
          linesCleared,
          combo,
          status: 'gameOver',
        };
      }

      return {
        board: finalBoard,
        tray: finalTray,
        score,
        linesCleared,
        combo,
        status: 'playing',
      };
    }

    default:
      return state;
  }
}

// ── 커스텀 훅 ────────────────────────────────────────────────

export function useBlockCrushGame() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const init = useCallback(() => {
    dispatch({ type: 'INIT' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const placePiece = useCallback(
    (slotIndex: 0 | 1 | 2, row: number, col: number) => {
      dispatch({ type: 'PLACE_PIECE', slotIndex, row, col });
    },
    [],
  );

  return { state, dispatch, init, reset, placePiece };
}
