import type { ScoreKey, DiceType } from './yacht.types';

/**
 * 클라이언트 점수 미리보기 계산 (표시 전용 — 실제 기록은 서버가 검증/기록)
 * PRD §5.6 의사 코드 기반 구현
 */
export function calcScore(key: ScoreKey, dice: number[], diceType: DiceType = 'D6'): number {
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
    case 'sevens':
      return dice.filter((d) => d === 7).reduce((a, b) => a + b, 0);
    case 'eights':
      return dice.filter((d) => d === 8).reduce((a, b) => a + b, 0);
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
      const set = new Set(dice);
      const has = (...ns: number[]) => ns.every((n) => set.has(n));
      // D6: {1234} {2345} {3456}
      // D8: 위 3개 + {4567} {5678}
      if (has(1, 2, 3, 4) || has(2, 3, 4, 5) || has(3, 4, 5, 6)) return 15;
      if (diceType === 'D8' && (has(4, 5, 6, 7) || has(5, 6, 7, 8))) return 15;
      return 0;
    }
    case 'bigStraight': {
      const set = new Set(dice);
      const has = (...ns: number[]) => ns.every((n) => set.has(n));
      // D6: {12345} {23456}
      // D8: 위 2개 + {34567} {45678}
      if (has(1, 2, 3, 4, 5) || has(2, 3, 4, 5, 6)) return 30;
      if (diceType === 'D8' && (has(3, 4, 5, 6, 7) || has(4, 5, 6, 7, 8))) return 30;
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
