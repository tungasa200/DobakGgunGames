import type { ScoreKey } from './yacht.types';

/**
 * 클라이언트 점수 미리보기 계산 (표시 전용 — 실제 기록은 서버가 검증/기록)
 * PRD §5.6 의사 코드 기반 구현
 */
export function calcScore(key: ScoreKey, dice: number[]): number {
  switch (key) {
    case 'ones':
      return dice.filter((d) => d === 1).reduce((a, b) => a + b, 0);
    case 'twos':
      return dice.filter((d) => d === 2).reduce((a, b) => a + b, 0);
    case 'threes':
      return dice.filter((d) => d === 3).reduce((a, b) => a + b, 0);
    case 'fours':
      return dice.filter((d) => d === 4).reduce((a, b) => a + b, 0);
    case 'fives':
      return dice.filter((d) => d === 5).reduce((a, b) => a + b, 0);
    case 'sixes':
      return dice.filter((d) => d === 6).reduce((a, b) => a + b, 0);
    case 'choice':
      return dice.reduce((a, b) => a + b, 0);
    case 'fourOfAKind': {
      const counts: Record<number, number> = {};
      for (const d of dice) counts[d] = (counts[d] ?? 0) + 1;
      const face = Object.entries(counts).find(([, cnt]) => cnt >= 4)?.[0];
      return face !== undefined ? Number(face) * 4 : 0;
    }
    case 'fullHouse': {
      const counts: Record<number, number> = {};
      for (const d of dice) counts[d] = (counts[d] ?? 0) + 1;
      const vals = Object.values(counts).sort((a, b) => a - b);
      // Yacht(5개 동일)는 Full House 불인정 — [5]는 [2,3] 아님
      if (vals.length === 2 && vals[0] === 2 && vals[1] === 3) {
        return dice.reduce((a, b) => a + b, 0);
      }
      return 0;
    }
    case 'littleStraight': {
      // 로컬 룰: 어느 4개 연속이든 15점
      const set = new Set(dice);
      const has = (...ns: number[]) => ns.every((n) => set.has(n));
      if (has(1, 2, 3, 4) || has(2, 3, 4, 5) || has(3, 4, 5, 6)) return 15;
      return 0;
    }
    case 'bigStraight': {
      // 로컬 룰: 어느 5개 연속이든 30점
      const set = new Set(dice);
      const has = (...ns: number[]) => ns.every((n) => set.has(n));
      if (has(1, 2, 3, 4, 5) || has(2, 3, 4, 5, 6)) return 30;
      return 0;
    }
    case 'yacht': {
      const unique = new Set(dice);
      return unique.size === 1 ? 50 : 0;
    }
    default:
      return 0;
  }
}
