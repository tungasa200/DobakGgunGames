import { useEffect, useRef, useCallback } from 'react';
import { useBrickBreakerGame, CANVAS_W, CANVAS_H } from './useBrickBreakerGame';
import type { Ball, Brick, ItemCapsule } from './types';
import { BRICK_WIDTH, BRICK_HEIGHT } from './stages';

const PADDLE_H  = 12;
const PADDLE_Y  = 460;
const BALL_R    = 8;
const CAPSULE_W = 24;
const CAPSULE_H = 16;

const COLOR_BG     = '#0d1117';
const COLOR_BALL   = '#00D9FF';
const COLOR_PADDLE = '#A855F7';

function brickColor(brick: Brick): string {
  if (brick.type === 'item') return '#F39C12';
  switch (brick.maxDurability) {
    case 1: return '#E74C3C';
    case 2: return '#E67E22';
    case 3: return '#8E44AD';
    default: return '#E74C3C';
  }
}

function brickDamageColor(brick: Brick): string {
  const ratio = brick.durability / brick.maxDurability;
  if (ratio >= 0.66) return brickColor(brick);
  if (ratio >= 0.33) return '#aaaaaa';
  return '#888888';
}

function capsuleColor(type: string): string {
  switch (type) {
    case 'M': return '#00D9FF';
    case 'W': return '#A855F7';
    case 'P': return '#E74C3C';
    case 'S': return '#27AE60';
    default:  return '#FFFFFF';
  }
}


interface Props {
  game: ReturnType<typeof useBrickBreakerGame>;
  className?: string;
}

/** 공 잔상 저장 (컴포넌트 외부 ref용) */
const TRAIL_LEN = 3;

export default function BrickBreakerCanvas({ game, className }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const trailRef   = useRef<Ball[][]>([]); // 각 공의 이전 위치 (최대 TRAIL_LEN)

  const { state, paddleInputRef, launchBall } = game;

  // 패들 X 업데이트 (마우스)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    paddleInputRef.current = (e.clientX - rect.left) * scaleX;
  }, [paddleInputRef]);

  // 패들 X 업데이트 (터치)
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const touch = e.touches[0];
    if (touch) paddleInputRef.current = (touch.clientX - rect.left) * scaleX;
  }, [paddleInputRef]);

  // 공 발사 (클릭)
  const handleClick = useCallback(() => {
    if (state.status === 'idle') launchBall();
  }, [state.status, launchBall]);

  // 공 발사 (터치 탭)
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (state.status === 'idle') launchBall();
  }, [state.status, launchBall]);

  // 잔상 업데이트
  useEffect(() => {
    if (state.status !== 'playing') return;
    const prev = trailRef.current;
    // 각 공에 대해 위치 추적
    state.balls.forEach((ball, i) => {
      if (!prev[i]) prev[i] = [];
      prev[i] = [{ ...ball }, ...prev[i]].slice(0, TRAIL_LEN);
    });
    // 공 개수 감소 시 잔상 정리
    if (prev.length > state.balls.length) {
      prev.splice(state.balls.length);
    }
    trailRef.current = prev;
  }, [state.balls, state.status]);

  // 그리기
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    // 배경
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 벽돌
    drawBricks(ctx, state.bricks);

    // 캡슐
    drawCapsules(ctx, state.capsules);

    // 공 잔상
    trailRef.current.forEach((trail) => {
      trail.forEach((pos, ti) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,217,255,${0.1 * (TRAIL_LEN - ti)})`;
        ctx.fill();
      });
    });

    // 공
    for (const ball of state.balls) {
      // 글로우
      ctx.shadowColor = COLOR_BALL;
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_BALL;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 패들
    const pw = state.paddle.width;
    const px = state.paddle.x - pw / 2;
    ctx.shadowColor = COLOR_PADDLE;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = COLOR_PADDLE;
    ctx.beginPath();
    ctx.roundRect(px, PADDLE_Y - PADDLE_H, pw, PADDLE_H, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 캔버스 내 오버레이 (idle/countdown/paused/stageClear — DOM이 없는 상태)
    if (state.status === 'idle') {
      drawOverlay(ctx, 'SPACE / 클릭으로 발사');
    } else if (state.status === 'countdown') {
      drawOverlay(ctx, String(state.countdownNum));
    } else if (state.status === 'paused') {
      drawOverlay(ctx, 'PAUSED');
    } else if (state.status === 'stageClear') {
      drawOverlay(ctx, `STAGE ${state.stage} CLEAR!`);
    }
    // gameOver / ended 는 React DOM overlay가 처리
  }, [state]);

  // 상태 변화 시 재렌더
  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ cursor: state.status === 'idle' ? 'pointer' : 'none' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}

// ── 보조 draw 함수 ─────────────────────────────────────────

function drawBricks(ctx: CanvasRenderingContext2D, bricks: Brick[]) {
  for (const b of bricks) {
    const color = brickDamageColor(b);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, BRICK_WIDTH, BRICK_HEIGHT, 3);
    ctx.fill();

    // 테두리
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 아이템 벽돌 레이블
    if (b.type === 'item' && b.itemType) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.itemType, b.x + BRICK_WIDTH / 2, b.y + BRICK_HEIGHT / 2);
    }

    // D2/D3 내구도 표시 (흰색 점)
    if (b.maxDurability > 1) {
      for (let i = 0; i < b.durability; i++) {
        ctx.beginPath();
        ctx.arc(
          b.x + BRICK_WIDTH / 2 - ((b.durability - 1) * 6) / 2 + i * 6,
          b.y + BRICK_HEIGHT - 5,
          2,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      }
    }
  }
}

function drawCapsules(ctx: CanvasRenderingContext2D, capsules: ItemCapsule[]) {
  for (const cap of capsules) {
    const color = capsuleColor(cap.type);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(cap.x - CAPSULE_W / 2, cap.y, CAPSULE_W, CAPSULE_H, CAPSULE_H / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cap.type, cap.x, cap.y + CAPSULE_H / 2);
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, text: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, CANVAS_H / 2 - 36, CANVAS_W, 60);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 6);
}

