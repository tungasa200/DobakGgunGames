// ── Block Crush — 보드 컴포넌트 ──────────────────────────────
import type { RefObject } from 'react';
import type { Board, Piece } from './types';
import styles from './BlockCrush.module.css';

export interface BoardPreview {
  piece: Piece;
  row: number;
  col: number;
  valid: boolean;
}

interface BlockCrushBoardProps {
  board: Board;
  preview: BoardPreview | null;
  boardRef: RefObject<HTMLDivElement | null>;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  /** 클리어 중인 행 인덱스 집합 (애니메이션용) */
  clearingRows?: Set<number>;
  /** 클리어 중인 열 인덱스 집합 (애니메이션용) */
  clearingCols?: Set<number>;
}

const BOARD_SIZE = 8;

export default function BlockCrushBoard({
  board,
  preview,
  boardRef,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  clearingRows,
  clearingCols,
}: BlockCrushBoardProps) {
  // 미리보기 셀 집합 계산
  const previewCells = new Map<string, boolean>(); // "row,col" → isValid
  if (preview) {
    for (const [dr, dc] of preview.piece.shape) {
      const r = preview.row + dr;
      const c = preview.col + dc;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        previewCells.set(`${r},${c}`, preview.valid);
      }
    }
  }

  return (
    <div
      ref={boardRef}
      className={styles.board}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{ touchAction: 'none' }}
    >
      {Array.from({ length: BOARD_SIZE }, (_, r) =>
        Array.from({ length: BOARD_SIZE }, (_, c) => {
          const cellKey = `${r},${c}`;
          const filled = board[r][c];
          const previewValid = previewCells.get(cellKey);
          const isClearing =
            clearingRows?.has(r) ?? clearingCols?.has(c) ?? false;

          let cellClass = styles.cell;
          let cellStyle: React.CSSProperties = {};

          if (previewValid === true) {
            cellClass = `${styles.cell} ${styles.cellPreviewValid}`;
          } else if (previewValid === false) {
            cellClass = `${styles.cell} ${styles.cellPreviewInvalid}`;
          } else if (filled) {
            cellClass = `${styles.cell} ${styles.cellFilled}${isClearing ? ' ' + styles.cellClearing : ''}`;
            cellStyle = { '--cell-color': filled } as React.CSSProperties;
          } else {
            cellClass = styles.cell;
          }

          return (
            <div
              key={cellKey}
              className={cellClass}
              style={cellStyle}
            />
          );
        })
      )}
    </div>
  );
}
