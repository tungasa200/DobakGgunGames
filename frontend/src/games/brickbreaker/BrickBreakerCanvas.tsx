import { useEffect, useRef, useCallback } from 'react';
import { useBrickBreakerGame, CANVAS_W, CANVAS_H } from './useBrickBreakerGame';
import type { Ball, Brick, ItemCapsule } from './types';
import { BRICK_WIDTH, BRICK_HEIGHT, BRICK_PADDING, BRICK_OFFSET_TOP } from './stages';

const PADDLE_H  = 12;
const PADDLE_Y  = 460;
const BALL_R    = 8;
const CAPSULE_W = 24;
const CAPSULE_H = 16;

const COLOR_BG     = '#0d0d0d';
const COLOR_BALL   = '#ffffff';
const COLOR_PADDLE = '#f1c40f'; // 클래식 노랑 패들

// 클래식 벽돌깨기 행 색상 팔레트 (Breakout/Arkanoid 스타일)
const ROW_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#3498db', '#9b59b6', '#1abc9c', '#e91e63'];

function brickBaseColor(brick: Brick): string {
  if (brick.type === 'item') return '#f1c40f';
  const row = Math.round((brick.y - BRICK_OFFSET_TOP) / (BRICK_HEIGHT + BRICK_PADDING));
  return ROW_COLORS[Math.abs(row) % ROW_COLORS.length];
}

function brickDisplayColor(brick: Brick): string {
  if (brick.type === 'item') return '#f1c40f';
  const base  = brickBaseColor(brick);
  const ratio = brick.durability / brick.maxDurability;
  if (ratio >= 0.66) return base;
  // 피격 시 밝기 감소 (어두운 버전)
  return ratio >= 0.33 ? darkenHex(base, 0.35) : darkenHex(base, 0.55);
}

function darkenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >>  8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round(( n        & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function capsuleColor(type: string): string {
  switch (type) {
    case 'M': return '#e74c3c';
    case 'W': return '#3498db';
    case 'P': return '#f1c40f';
    case 'S': return '#27ae60';
    default:  return '#ffffff';
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

    // 공 잔상 (흰색 반투명)
    trailRef.current.forEach((trail) => {
      trail.forEach((pos, ti) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.08 * (TRAIL_LEN - ti)})`;
        ctx.fill();
      });
    });

    // 공
    for (const ball of state.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_BALL;
      ctx.fill();
    }

    // 패들 (모서리 없이 직사각형)
    const pw = state.paddle.width;
    const px = state.paddle.x - pw / 2;
    ctx.fillStyle = COLOR_PADDLE;
    ctx.fillRect(px, PADDLE_Y - PADDLE_H, pw, PADDLE_H);

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
    const color = brickDisplayColor(b);

    // 벽돌 본체 (모서리 없이 클래식 직사각형)
    ctx.fillStyle = color;
    ctx.fillRect(b.x, b.y, BRICK_WIDTH, BRICK_HEIGHT);

    // 상단/좌측 하이라이트 (클래식 3D 느낌)
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(b.x,                     b.y,                      BRICK_WIDTH, 2);
    ctx.fillRect(b.x,                     b.y,                      2,           BRICK_HEIGHT);

    // 하단/우측 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(b.x,                     b.y + BRICK_HEIGHT - 2,   BRICK_WIDTH, 2);
    ctx.fillRect(b.x + BRICK_WIDTH - 2,   b.y,                      2,           BRICK_HEIGHT);

    // 아이템 벽돌 레이블
    if (b.type === 'item' && b.itemType) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.itemType, b.x + BRICK_WIDTH / 2, b.y + BRICK_HEIGHT / 2);
    }

    // D2/D3 내구도 점 (어두운 색)
    if (b.maxDurability > 1) {
      for (let i = 0; i < b.durability; i++) {
        ctx.beginPath();
        ctx.arc(
          b.x + BRICK_WIDTH / 2 - ((b.durability - 1) * 6) / 2 + i * 6,
          b.y + BRICK_HEIGHT - 5,
          2, 0, Math.PI * 2,
        );
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
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
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, CANVAS_H / 2 - 40, CANVAS_W, 68);
  ctx.fillStyle = '#f1c40f'; // 클래식 노랑 텍스트
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 6);
}

