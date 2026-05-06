import type { Brick } from './types';

/** 스테이지 클리어 보너스 (stage 1~10 인덱스 0~9) */
export const STAGE_CLEAR_BONUS = [200, 300, 500, 700, 1000, 1500, 2000, 2800, 3800, 6000];

/**
 * 벽돌 타격 시 얻는 점수.
 * 파괴(durability 0 도달) 시 추가 보너스 포함.
 *
 * 점수 체계:
 * - D1 파괴: +10
 * - D2 타격 1차(2→1): +10 / 파괴 2차(1→0): +20+30=+50 (누적 총 60)
 * - D3 타격 1차(3→2): +10 / 타격 2차(2→1): +20 / 파괴 3차(1→0): +30+50=+80 (누적 총 110)
 * - ITEM 파괴: +50
 */
export function calcBrickScore(brick: Brick, newDurability: number): number {
  const wasHit = brick.durability;           // 타격 전 내구도
  const isDestroyed = newDurability <= 0;

  if (brick.type === 'item') {
    return isDestroyed ? 50 : 0;
  }

  const max = brick.maxDurability;

  if (max === 1) {
    // D1: 타격 = 파괴
    return isDestroyed ? 10 : 0;
  }

  if (max === 2) {
    if (wasHit === 2) return 10;           // 1차 타격
    if (wasHit === 1) return 20 + 30;      // 2차 파괴
    return 0;
  }

  if (max === 3) {
    if (wasHit === 3) return 10;           // 1차 타격
    if (wasHit === 2) return 20;           // 2차 타격
    if (wasHit === 1) return 30 + 50;      // 3차 파괴
    return 0;
  }

  return 0;
}

/**
 * 스테이지 클리어 + 잔여 생명 보너스
 * @param stage 1~10
 * @param livesLeft 잔여 생명 수
 */
export function calcClearBonus(stage: number, livesLeft: number): number {
  const stageBonus = STAGE_CLEAR_BONUS[stage - 1] ?? 0;
  const lifeBonus  = livesLeft * 50;
  return stageBonus + lifeBonus;
}
