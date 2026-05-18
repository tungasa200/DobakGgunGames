// ── Block Crush — 점수 계산 순수 함수 ───────────────────────
// PRD §5 기준 — 모두 부작용 없는 순수 함수

/**
 * §5.1 배치 점수: 셀 수 × 1점
 */
export function calcPlaceScore(cellCount: number): number {
  return cellCount;
}

/**
 * §5.3 다중 클리어 보너스 테이블
 * bonus(n) = bonus(n-1) + 100 × (n-1)  (n >= 2)
 * - n=1: 0
 * - n=2: 100
 * - n=3: 300
 * - n=4: 600
 * - n=5: 1000
 * - n=6: 1500
 * - n=7: 2100
 * - n=8: 2800
 * - n>=9: 점화식으로 계산
 */
export function getMultiClearBonus(lineCount: number): number {
  if (lineCount <= 1) return 0;
  let bonus = 0;
  for (let n = 2; n <= lineCount; n++) {
    bonus += 100 * (n - 1);
  }
  return bonus;
}

/**
 * §5.2 + §5.3 + §5.4 줄 클리어 점수
 * = (줄 수 × 100) + 다중 보너스 + 콤보 보너스
 *
 * @param lineCount 이번 배치에서 동시 클리어된 줄 수
 * @param combo     현재 콤보 카운트 (이미 갱신된 값 — 이번 클리어가 포함된 값)
 */
export function calcLineClearScore(lineCount: number, combo: number): number {
  if (lineCount <= 0) return 0;
  const baseScore   = lineCount * 100;
  const multiBonus  = getMultiClearBonus(lineCount);
  const comboBonus  = combo * 50;
  return baseScore + multiBonus + comboBonus;
}
