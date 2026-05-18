// ── Block Crush — 드래그&드롭 훅 (Pointer Events 방식) ────────
// 마우스 + 터치 통합: onPointerDown, onPointerMove, onPointerUp
// 모바일: 손가락 위 오프셋으로 미리보기 표시

import { useState, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import type { Board, Piece } from './types';
import { canPlacePiece } from './useBlockCrushGame';

export interface DragState {
  slotIndex: 0 | 1 | 2;
  piece: Piece;
  /** 보드 기준 미리보기 행 (null = 보드 밖) */
  previewRow: number | null;
  /** 보드 기준 미리보기 열 (null = 보드 밖) */
  previewCol: number | null;
  /** 유효한 드롭 위치 여부 */
  isValid: boolean;
  /** 현재 포인터 위치 (화면 절대좌표) */
  pointerX: number;
  pointerY: number;
}

interface UseDragDropOptions {
  boardRef: RefObject<HTMLDivElement | null>;
  board: Board;
  cellSize: number;
  onPlace: (slotIndex: 0 | 1 | 2, row: number, col: number) => void;
}

// 모바일 여부 판정 (터치 오프셋 적용용)
function isTouchPointer(e: PointerEvent): boolean {
  return e.pointerType === 'touch' || e.pointerType === 'pen';
}

// 보드 DOM에서 (clientX, clientY) → (row, col) 변환
function clientToCell(
  boardEl: HTMLDivElement,
  clientX: number,
  clientY: number,
  cellSize: number,
): { row: number; col: number } {
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  return { row, col };
}

export function useDragDrop({ boardRef, board, cellSize, onPlace }: UseDragDropOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  // 드래그 중 첫 포인터 ID만 인식 (멀티터치 무시)
  const activePointerId = useRef<number | null>(null);
  // 드래그 시작 시 조각 내 클릭 오프셋 (조각 상단 기준 row/col)
  const dragOffsetRef = useRef<{ dr: number; dc: number }>({ dr: 0, dc: 0 });

  const onPointerDown = useCallback(
    (
      e: React.PointerEvent,
      slotIndex: 0 | 1 | 2,
      piece: Piece,
    ) => {
      // 이미 드래그 중이면 무시 (멀티터치 방지)
      if (activePointerId.current !== null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerId.current = e.pointerId;

      setDragState({
        slotIndex,
        piece,
        previewRow: null,
        previewCol: null,
        isValid: false,
        pointerX: e.clientX,
        pointerY: e.clientY,
      });
      // 트레이 조각 클릭 시 조각 내 오프셋 0,0으로 고정 (단순화)
      dragOffsetRef.current = { dr: 0, dc: 0 };
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      if (!dragState) return;

      setDragState((prev) => {
        if (!prev) return null;

        const boardEl = boardRef.current;
        if (!boardEl) {
          return { ...prev, previewRow: null, previewCol: null, isValid: false, pointerX: e.clientX, pointerY: e.clientY };
        }

        // 모바일: 손가락 위로 약간 오프셋 (2셀 위) — 손가락에 가려지지 않도록
        const offsetY = isTouchPointer(e as PointerEvent) ? -cellSize * 2 : 0;
        const { row, col } = clientToCell(boardEl, e.clientX, e.clientY + offsetY, cellSize);
        // 드래그 오프셋 적용
        const targetRow = row - dragOffsetRef.current.dr;
        const targetCol = col - dragOffsetRef.current.dc;

        const valid = canPlacePiece(board, prev.piece, targetRow, targetCol);

        return {
          ...prev,
          previewRow: targetRow,
          previewCol: targetCol,
          isValid: valid,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
      });
    },
    [dragState, boardRef, board, cellSize],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      activePointerId.current = null;

      setDragState((prev) => {
        if (!prev) return null;

        const { slotIndex, piece, previewRow, previewCol, isValid } = prev;
        if (
          isValid &&
          previewRow !== null &&
          previewCol !== null &&
          canPlacePiece(board, piece, previewRow, previewCol)
        ) {
          onPlace(slotIndex, previewRow, previewCol);
        }
        // 드롭 성공/실패 모두 dragState null (원위치)
        return null;
      });
    },
    [board, onPlace],
  );

  const cancelDrag = useCallback(() => {
    activePointerId.current = null;
    setDragState(null);
  }, []);

  return {
    dragState,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancelDrag,
  };
}
