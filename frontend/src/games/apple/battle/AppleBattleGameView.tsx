import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import styles from './AppleBattleBoard.module.css';

// ── 사과 모양 그리기 (AppleCanvas.tsx에서 복사, 배틀 모드는 사과 테마 고정) ──
function drawAppleShape(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  fillColor: string, strokeColor: string | null,
) {
  const scale = 0.27;
  ctx.save();
  ctx.translate(cx - 50 * scale, cy - 50 * scale);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(50, 88);
  ctx.bezierCurveTo(30, 95, 10, 75, 15, 50);
  ctx.bezierCurveTo(20, 20, 40, 25, 50, 35);
  ctx.bezierCurveTo(60, 25, 80, 20, 85, 50);
  ctx.bezierCurveTo(90, 75, 70, 95, 50, 88);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 8;
    ctx.setLineDash([]);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(34, 55, 8, 14, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(50, 35); ctx.bezierCurveTo(48, 20, 52, 10, 55, 5);
  ctx.bezierCurveTo(57, 5, 53, 20, 50, 35); ctx.closePath();
  ctx.fillStyle = '#5C4033'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(55, 20); ctx.bezierCurveTo(65, 10, 80, 15, 80, 15);
  ctx.bezierCurveTo(80, 15, 75, 25, 65, 25);
  ctx.bezierCurveTo(55, 25, 55, 20, 55, 20);
  ctx.closePath(); ctx.fillStyle = '#4CBB17'; ctx.fill();
  ctx.restore();
}

// ── 선택 계산 ──────────────────────────────────────────────
function calcSelection(
  sx: number, sy: number, ex: number, ey: number,
  rows: number, cols: number, apples: (number | null)[][],
  pad: number, size: number,
) {
  const x1 = Math.min(sx, ex), x2 = Math.max(sx, ex);
  const y1 = Math.min(sy, ey), y2 = Math.max(sy, ey);
  const selected: { r: number; c: number }[] = [];
  let sum = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (apples[r]?.[c] === null || apples[r]?.[c] === undefined) continue;
      const ax = pad + c * size + size / 2;
      const ay = pad + r * size + size / 2;
      if (ax >= x1 && ax <= x2 && ay >= y1 && ay <= y2) {
        selected.push({ r, c });
        sum += apples[r][c] as number;
      }
    }
  }
  return { selected, sum };
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  myNickname: string;
  opponentNickname: string;
  myScore: number;
  opponentScore: number;
  timeLeft: number;
  reconnecting: boolean;
  opponentDisconnected: boolean;
  board: (number | null)[][];
  onRemove: (cells: { r: number; c: number }[]) => void;
}

// 배틀 고정 레이아웃 (10×17, 28px)
const BATTLE_ROWS = 10;
const BATTLE_COLS = 17;
const BATTLE_SIZE = 28;
const BATTLE_PAD  = 8;

export default function AppleBattleGameView({
  myNickname,
  opponentNickname,
  myScore,
  opponentScore,
  timeLeft,
  reconnecting,
  opponentDisconnected,
  board,
  onRemove,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, cx: 0, cy: 0 });
  const [dragSum, setDragSum] = useState<number | null>(null);

  const rows = board.length > 0 ? board.length : BATTLE_ROWS;
  const cols = board[0]?.length ?? BATTLE_COLS;
  const size = BATTLE_SIZE;
  const pad  = BATTLE_PAD;

  const timeWarning = timeLeft <= 30;

  // ── 캔버스 그리기 ──────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!board.length) return;

    canvas.width  = pad * 2 + cols * size;
    canvas.height = pad * 2 + rows * size;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drag = dragRef.current;
    let selSet = new Set<string>();
    let selSum = 0;
    if (drag.active) {
      const { selected, sum } = calcSelection(drag.sx, drag.sy, drag.cx, drag.cy, rows, cols, board, pad, size);
      selected.forEach(({ r, c }) => selSet.add(`${r},${c}`));
      selSum = sum;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r] || board[r][c] === null) continue;
        const cx = pad + c * size + size / 2;
        const cy = pad + r * size + size / 2;
        const isSelected = selSet.has(`${r},${c}`);

        let bodyColor = '#e03a27';
        let borderColor: string | null = null;
        if (isSelected) {
          if (selSum === 10)      { bodyColor = '#27ae60'; borderColor = '#1a8a4a'; }
          else if (selSum > 10)  { bodyColor = '#e67e22'; borderColor = '#b05a00'; }
          else                   { bodyColor = '#3498db'; borderColor = '#1a6aa0'; }
        }

        drawAppleShape(ctx, cx, cy, bodyColor, borderColor);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(board[r][c]), cx, cy + 3);
      }
    }

    // 드래그 선택 영역
    if (drag.active) {
      const x1 = Math.min(drag.sx, drag.cx), x2 = Math.max(drag.sx, drag.cx);
      const y1 = Math.min(drag.sy, drag.cy), y2 = Math.max(drag.sy, drag.cy);
      const rgb = selSum === 10 ? '39,174,96' : selSum > 10 ? '230,126,34' : '52,152,219';
      ctx.strokeStyle = `rgba(${rgb},0.8)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${rgb},0.07)`;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
  }, [board, rows, cols, size, pad]);

  useEffect(() => { draw(); }, [draw]);

  // ── 포인터 위치 변환 ───────────────────────────────────
  function getPos(e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const src = 'touches' in e
      ? ((e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0])
      : (e as MouseEvent);
    if (!src) return { x: 0, y: 0 };
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function handlePointerDown(e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement> | TouchEvent) {
    const p = getPos(e);
    dragRef.current = { active: true, sx: p.x, sy: p.y, cx: p.x, cy: p.y };
    setDragSum(0);
  }

  const handlePointerDownRef = useRef(handlePointerDown);
  handlePointerDownRef.current = handlePointerDown;

  // touchstart non-passive
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      handlePointerDownRef.current(e);
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => canvas.removeEventListener('touchstart', onTouchStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current.active) return;
      if ('touches' in e) e.preventDefault();
      const p = getPos(e);
      dragRef.current.cx = p.x;
      dragRef.current.cy = p.y;
      const { sum } = calcSelection(
        dragRef.current.sx, dragRef.current.sy,
        dragRef.current.cx, dragRef.current.cy,
        rows, cols, board, pad, size,
      );
      setDragSum(sum);
      draw();
    }
    function onUp(e: MouseEvent | TouchEvent) {
      if (!dragRef.current.active) return;
      const p = getPos(e);
      dragRef.current.cx = p.x;
      dragRef.current.cy = p.y;
      const { selected, sum } = calcSelection(
        dragRef.current.sx, dragRef.current.sy,
        dragRef.current.cx, dragRef.current.cy,
        rows, cols, board, pad, size,
      );
      dragRef.current.active = false;
      setDragSum(null);
      if (sum === 10 && selected.length > 0) {
        // 낙관적 업데이트: onRemove가 로컬 상태 + 소켓 전송 모두 처리
        onRemove(selected);
      } else {
        draw();
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, rows, cols, draw, onRemove]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
      {/* HUD */}
      <div className={styles.hud}>
        {/* 내 점수 */}
        <div className={styles.myScore}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>{myNickname} (나)</div>
            <div className={styles.infoValue}>{myScore}</div>
          </div>
        </div>

        {/* 타이머 */}
        <div className={styles.timerBlock}>
          <div className={styles.timerLabel}>남은 시간</div>
          <div className={`${styles.timerValue} ${timeWarning ? styles.timeWarning : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* 상대 점수 */}
        <div className={styles.opponentScore}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>{opponentNickname}</div>
            <div className={styles.infoValue}>{opponentScore}</div>
          </div>
        </div>
      </div>

      {/* 선택 합계 표시 */}
      {dragSum !== null && (
        <div style={{ fontSize: 13, color: '#888' }}>
          선택 합계: <strong style={{ color: dragSum === 10 ? '#27ae60' : dragSum > 10 ? '#e67e22' : '#3498db' }}>{dragSum}</strong>
        </div>
      )}

      {/* 상대 끊김 배너 */}
      {opponentDisconnected && (
        <div className={styles.oppDisconnectedBanner}>
          상대 플레이어가 연결을 잃었습니다
        </div>
      )}

      {/* 캔버스 */}
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={handlePointerDown}
        />
        {reconnecting && (
          <div className={styles.reconnectOverlay}>연결 복구 중...</div>
        )}
      </div>
    </div>
  );
}
