// ── Block Crush — 타입 정의 ──────────────────────────────────
// null = 빈 칸, string = 색상 키 (CSS 색상값)
export type CellValue = string | null;

// 8×8 보드
export type Board = CellValue[][];

// 폴리오미노 조각
export interface Piece {
  id: string;
  shape: [number, number][]; // [row, col] 오프셋 배열
  color: string;             // CSS 색상값
}

// 트레이 슬롯 (null = 이미 배치됨)
export type TraySlot = Piece | null;

export type GameStatus = 'idle' | 'playing' | 'gameOver';

export interface BlockCrushState {
  board: Board;
  tray: [TraySlot, TraySlot, TraySlot];
  score: number;
  linesCleared: number;
  combo: number;
  status: GameStatus;
}
