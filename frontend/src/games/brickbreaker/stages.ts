import type { Brick, ItemType } from './types';

// 벽돌 배치 상수
export const BRICK_WIDTH    = 64;
export const BRICK_HEIGHT   = 22;
export const BRICK_PADDING  = 1;
export const BRICK_OFFSET_LEFT = 30;
export const BRICK_OFFSET_TOP  = 50;

export interface StageConfig {
  rows: number;
  cols: number;
  d1: number;
  d2: number;
  d3: number;
  items: number;
  speedDx: number; // 절댓값 (부호 발사 시 결정)
  speedDy: number; // 음수 (위 방향)
}

export const STAGE_CONFIGS: StageConfig[] = [
  { rows: 3, cols: 9,  d1: 27, d2:  0, d3:  0, items: 0, speedDx: 3.5, speedDy: -4.0 },
  { rows: 4, cols: 9,  d1: 34, d2:  0, d3:  0, items: 2, speedDx: 3.7, speedDy: -4.2 },
  { rows: 4, cols: 9,  d1: 18, d2: 16, d3:  0, items: 2, speedDx: 3.9, speedDy: -4.4 },
  { rows: 5, cols: 9,  d1: 21, d2:  8, d3:  0, items: 2, speedDx: 4.1, speedDy: -4.6 },
  { rows: 5, cols: 9,  d1: 28, d2: 13, d3:  0, items: 4, speedDx: 4.3, speedDy: -4.9 },
  { rows: 6, cols: 9,  d1: 24, d2: 16, d3:  4, items: 4, speedDx: 4.6, speedDy: -5.1 },
  { rows: 6, cols: 10, d1: 24, d2: 20, d3: 10, items: 6, speedDx: 4.8, speedDy: -5.3 },
  { rows: 6, cols: 10, d1: 14, d2: 28, d3: 18, items: 0, speedDx: 5.0, speedDy: -5.5 },
  { rows: 7, cols: 10, d1: 26, d2: 28, d3: 12, items: 4, speedDx: 5.2, speedDy: -5.8 },
  { rows: 7, cols: 10, d1: 18, d2: 32, d3: 20, items: 0, speedDx: 5.5, speedDy: -6.0 },
];

/**
 * 스테이지 번호(1~10)를 받아 벽돌 배열 생성.
 * 배치 규칙:
 * - D3: 중앙 집중 (그리드 중앙부터 채움)
 * - ITEM: 나머지 슬롯에서 랜덤 배치
 * - D2: ITEM 배치 후 앞 슬롯에 배치
 * - D1: 나머지 모든 슬롯
 */
export function generateBricks(stage: number): Brick[] {
  const cfg = STAGE_CONFIGS[stage - 1];
  // d1 count는 나머지(d2/d3/items 제외) 슬롯이 자동으로 채우므로 별도 사용 불필요
  const { rows, cols, d2, d3, items } = cfg;
  const total = rows * cols;

  // 인덱스 배열 (0 ~ total-1)
  const indices = Array.from({ length: total }, (_, i) => i);

  // D3: 중앙에서 바깥쪽으로 슬롯 선택
  const centerR = (rows - 1) / 2;
  const centerC = (cols - 1) / 2;
  const sorted = [...indices].sort((a, b) => {
    const ar = Math.floor(a / cols), ac = a % cols;
    const br = Math.floor(b / cols), bc = b % cols;
    const da = Math.hypot(ar - centerR, ac - centerC);
    const db = Math.hypot(br - centerR, bc - centerC);
    return da - db;
  });

  const d3Slots  = new Set(sorted.slice(0, d3));

  // 나머지 슬롯에서 ITEM 랜덤 배치
  const remaining = indices.filter(i => !d3Slots.has(i));
  shuffleArray(remaining);
  const itemSlots = new Set(remaining.slice(0, items));

  // D2: ITEM 이후 앞에서 채움
  const afterItem = remaining.filter(i => !itemSlots.has(i));
  const d2Slots = new Set(afterItem.slice(0, d2));

  // D1: 나머지
  const d1Slots = new Set(afterItem.filter(i => !d2Slots.has(i)));

  const itemTypes: ItemType[] = ['M', 'W', 'P', 'S'];
  const itemTypeList = Array.from({ length: items }, (_, k) => itemTypes[k % itemTypes.length]);
  shuffleArray(itemTypeList);

  let itemIdx = 0;
  const bricks: Brick[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = BRICK_OFFSET_LEFT + c * (BRICK_WIDTH + BRICK_PADDING);
      const y = BRICK_OFFSET_TOP  + r * (BRICK_HEIGHT + BRICK_PADDING);

      if (d3Slots.has(idx)) {
        bricks.push({ x, y, durability: 3, maxDurability: 3, type: 'normal' });
      } else if (itemSlots.has(idx)) {
        bricks.push({
          x, y,
          durability: 1, maxDurability: 1,
          type: 'item',
          itemType: itemTypeList[itemIdx++],
        });
      } else if (d2Slots.has(idx)) {
        bricks.push({ x, y, durability: 2, maxDurability: 2, type: 'normal' });
      } else if (d1Slots.has(idx)) {
        bricks.push({ x, y, durability: 1, maxDurability: 1, type: 'normal' });
      }
    }
  }

  // total 수량 검증 (d1+d2+d3+items <= total 보장)
  return bricks.slice(0, total);
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
