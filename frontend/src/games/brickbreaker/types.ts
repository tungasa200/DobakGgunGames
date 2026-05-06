export type GameStatus =
  | 'idle'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'stageClear'
  | 'gameOver'
  | 'ended';

export type ItemType = 'M' | 'W' | 'P' | 'S';

export interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface Brick {
  x: number;
  y: number;
  durability: number;
  maxDurability: number;
  type: 'normal' | 'item';
  itemType?: ItemType;
}

export interface ItemCapsule {
  x: number;
  y: number;
  type: ItemType;
}

/** Date.now() 기준 만료 시간 */
export interface ActiveItem {
  type: ItemType;
  expiresAt: number;
}
