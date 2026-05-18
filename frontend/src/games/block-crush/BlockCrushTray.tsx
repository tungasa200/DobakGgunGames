// ── Block Crush — 트레이 컴포넌트 ────────────────────────────
// 3개 슬롯, 각 슬롯 내 폴리오미노를 미니 그리드로 렌더링
// onPointerDown으로 드래그 시작

import type { TraySlot, Piece } from './types';
import styles from './BlockCrush.module.css';

// 트레이 내 미니 셀 크기 (px)
const MINI_CELL = 22;

interface TraySlotProps {
  slot: TraySlot;
  slotIndex: 0 | 1 | 2;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent, slotIndex: 0 | 1 | 2, piece: Piece) => void;
}

function TrayPiece({ slot, slotIndex, isDragging, onPointerDown }: TraySlotProps) {
  if (slot === null) {
    // 배치 완료 — 빈 자리 표시
    return (
      <div className={styles.traySlot}>
        <div className={styles.traySlotEmpty} />
      </div>
    );
  }

  // 조각의 실제 크기 계산 (bounding box)
  let maxRow = 0;
  let maxCol = 0;
  for (const [r, c] of slot.shape) {
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  const rows = maxRow + 1;
  const cols = maxCol + 1;

  const cellSet = new Set(slot.shape.map(([r, c]) => `${r},${c}`));

  return (
    <div
      className={`${styles.traySlot}${isDragging ? ' ' + styles.traySlotDragging : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown(e, slotIndex, slot);
      }}
      style={{ touchAction: 'none', cursor: 'grab' }}
      title="드래그해서 보드에 배치하세요"
    >
      <div
        className={styles.miniGrid}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${MINI_CELL}px)`,
          gridTemplateRows: `repeat(${rows}, ${MINI_CELL}px)`,
          gap: '2px',
          width: cols * MINI_CELL + (cols - 1) * 2,
          height: rows * MINI_CELL + (rows - 1) * 2,
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const key = `${r},${c}`;
            const filled = cellSet.has(key);
            return (
              <div
                key={key}
                className={filled ? styles.miniCellFilled : styles.miniCellEmpty}
                style={filled ? ({ '--cell-color': slot.color } as React.CSSProperties) : {}}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

interface BlockCrushTrayProps {
  tray: [TraySlot, TraySlot, TraySlot];
  draggingSlot: number | null;
  onPointerDown: (e: React.PointerEvent, slotIndex: 0 | 1 | 2, piece: Piece) => void;
}

export default function BlockCrushTray({
  tray,
  draggingSlot,
  onPointerDown,
}: BlockCrushTrayProps) {
  return (
    <div className={styles.tray}>
      {([0, 1, 2] as const).map((i) => (
        <TrayPiece
          key={i}
          slot={tray[i]}
          slotIndex={i}
          isDragging={draggingSlot === i}
          onPointerDown={onPointerDown}
        />
      ))}
    </div>
  );
}
