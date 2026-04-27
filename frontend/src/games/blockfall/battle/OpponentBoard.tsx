import { useEffect, useRef } from 'react';
import './blockfall-battle.css';

// 싱글 게임과 동일한 상수
const BOARD_W = 11;
const VISIBLE_H = 21;
const BUFFER_H = 2;
const BOARD_H = VISIBLE_H + BUFFER_H;

const COLORS_NORMAL: (string | null)[] = [
  null,
  '#ffaa0d', // 1: T
  '#f4b0c6', // 2: O
  '#ABEE62', // 3: L
  '#0DC2FF', // 4: J
  '#46e37b', // 5: I
  '#FFE138', // 6: S
  '#CA41D9', // 7: Z
  '#ff88ff', // 8: rainbow placeholder
  '#888888', // 9: garbage (gray)
];

interface OpponentBoardProps {
  nickname: string;
  isGuest: boolean;
  board: number[][];
  score: number;
  isEliminated: boolean;
  rank?: number;
  isMine?: boolean;
  /** 셀 픽셀 크기 — 보드 크기를 외부에서 제어 */
  cellSize?: number;
  /** 연습 모드일 때 "대기 중" 보드 표시 */
  isWaiting?: boolean;
}

export default function OpponentBoard({
  nickname,
  isGuest,
  board,
  score,
  isEliminated,
  rank,
  isMine = false,
  cellSize = 18,
  isWaiting = false,
}: OpponentBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // canvas는 전체 BOARD_H를 그리되, wrapper div로 BUFFER_H만큼 잘라낸다
  const canvasW = BOARD_W * cellSize;
  const canvasTotalH = BOARD_H * cellSize;
  const visibleH = VISIBLE_H * cellSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // canvas는 1:1 unit 사용 (scale은 CSS transform으로)
    // 실제 drawCell에서 cellSize 단위로 그림
    ctx.clearRect(0, 0, canvasW, canvasTotalH);

    // 배경
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvasW, canvasTotalH);

    // 그리드 선 (visible 영역만)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 1; x < BOARD_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, BUFFER_H * cellSize);
      ctx.lineTo(x * cellSize, canvasTotalH);
      ctx.stroke();
    }
    for (let y = BUFFER_H + 1; y <= BOARD_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(canvasW, y * cellSize);
      ctx.stroke();
    }

    // 보드 블록
    if (board && board.length >= BOARD_H) {
      for (let y = 0; y < BOARD_H; y++) {
        const row = board[y];
        if (!row) continue;
        for (let x = 0; x < BOARD_W; x++) {
          const val = row[x];
          if (val === 0) continue;
          drawCell(ctx, x, y, val, cellSize);
        }
      }
    }

    // 게임오버 반투명 처리
    if (isEliminated) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvasW, canvasTotalH);
    }
  }, [board, isEliminated, cellSize, canvasW, canvasTotalH]);

  const classNames = [
    'battle-board-item',
    isMine ? 'mine' : '',
    isEliminated ? 'eliminated' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="battle-board-item-header">
        <span className={`battle-board-nickname ${isMine ? 'mine' : ''}`}>
          {nickname}
          {isGuest && (
            <span className="battle-board-badge-guest" style={{ marginLeft: 4 }}>
              손님
            </span>
          )}
        </span>
        <span className="battle-board-score">{score.toLocaleString()}</span>
      </div>

      {/* buffer zone 숨김: overflow hidden + 음수 marginTop */}
      <div
        className="battle-board-canvas-wrap"
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: visibleH,
          flexShrink: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          className="battle-board-canvas"
          width={canvasW}
          height={canvasTotalH}
          style={{
            display: 'block',
            width: canvasW,
            height: canvasTotalH,
            marginTop: -(BUFFER_H * cellSize),
          }}
        />
        {isEliminated && (
          <div className="eliminated-overlay">
            <span className="eliminated-text">GAME OVER</span>
            {rank !== undefined && (
              <span className="eliminated-rank">{rank}위</span>
            )}
          </div>
        )}
        {isWaiting && !isEliminated && (
          <div className="eliminated-overlay">
            <span className="eliminated-text" style={{ fontSize: 13, color: '#8b949e' }}>대기 중</span>
          </div>
        )}
      </div>
    </div>
  );
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  cellSize: number,
) {
  const px = x * cellSize;
  const py = y * cellSize;
  const color = COLORS_NORMAL[colorIndex] ?? '#ccc';

  ctx.fillStyle = color;
  ctx.fillRect(px, py, cellSize, cellSize);

  // 하이라이트
  const hi = Math.round(cellSize * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(px, py, cellSize, hi);
  ctx.fillRect(px, py, hi, cellSize);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px, py + cellSize - hi, cellSize, hi);
  ctx.fillRect(px + cellSize - hi, py, hi, cellSize);
}
