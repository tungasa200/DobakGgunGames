package com.dobakggun.service.yacht.bot;

/**
 * W 테이블이 완성된 후 턴 내 V 계산 엔진.
 * 모든 메서드 순수 계산 (Spring 비의존).
 * D6/D8 공통 — 모드별 파라미터는 YachtDpContext로 전달.
 *
 * vCache/vDone 크기는 ctx.vCacheSize. 호출자가 배열을 할당하고
 * 각 턴 시작 전 vDone[0..ctx.vCacheSize-1] = false로 초기화해야 함.
 */
public final class YachtDpEngine {

    // ── V 계산 (배열 기반 메모) ───────────────────────────────────────────────

    public static double computeV(YachtDpContext ctx, int[] sortedDice, int rollsLeft,
                                   int filled, int upperTotal,
                                   double[] wTable,
                                   double[] vCache, boolean[] vDone) {
        int idx = ctx.keyToVIdx[ctx.packKey(sortedDice, rollsLeft)];
        if (idx >= 0 && vDone[idx]) return vCache[idx];

        double result;
        if (rollsLeft == 0) {
            result = scoreOption(ctx, sortedDice, filled, upperTotal, wTable);
        } else {
            double best = scoreOption(ctx, sortedDice, filled, upperTotal, wTable);
            for (int mask = 0; mask < 32; mask++) {
                double ev = maskEv(ctx, sortedDice, mask, rollsLeft, filled, upperTotal, wTable, vCache, vDone);
                if (ev > best) best = ev;
            }
            result = best;
        }

        if (idx >= 0) { vCache[idx] = result; vDone[idx] = true; }
        return result;
    }

    public static double maskEv(YachtDpContext ctx, int[] sortedDice, int mask, int rollsLeft,
                                 int filled, int upperTotal,
                                 double[] wTable, double[] vCache, boolean[] vDone) {
        int rerollCount = 5 - Integer.bitCount(mask);
        if (rerollCount == 0) {
            return computeV(ctx, sortedDice, rollsLeft - 1, filled, upperTotal, wTable, vCache, vDone);
        }
        int[] kept     = YachtDiceMultiset.extractKeptSorted(sortedDice, mask);
        int[] rerolled = new int[rerollCount];
        double weightedSum = sumOverRerollMultisets(ctx, kept, rerolled, 0, 1, rollsLeft - 1,
                filled, upperTotal, wTable, vCache, vDone);
        return weightedSum / ipow(ctx.faces, rerollCount);
    }

    private static double sumOverRerollMultisets(YachtDpContext ctx,
                                                  int[] kept, int[] rerolled, int pos, int minVal,
                                                  int nextRollsLeft,
                                                  int filled, int upperTotal,
                                                  double[] wTable, double[] vCache, boolean[] vDone) {
        if (pos == rerolled.length) {
            int[] full = YachtDiceMultiset.mergeSorted(kept, rerolled);
            int mult = YachtDiceMultiset.multinomial(rerolled);
            return mult * computeV(ctx, full, nextRollsLeft, filled, upperTotal, wTable, vCache, vDone);
        }
        double sum = 0.0;
        for (int v = minVal; v <= ctx.faces; v++) {
            rerolled[pos] = v;
            sum += sumOverRerollMultisets(ctx, kept, rerolled, pos + 1, v,
                    nextRollsLeft, filled, upperTotal, wTable, vCache, vDone);
        }
        return sum;
    }

    // ── scoreOption ──────────────────────────────────────────────────────────

    /**
     * 현재 주사위로 점수를 기록할 때 기대할 수 있는 최대 값.
     * max over unfilled k of: score(k) + bonusTrigger(k) + W[newFilled][newUpper]
     */
    public static double scoreOption(YachtDpContext ctx, int[] dice, int filled, int upperTotal, double[] wTable) {
        double best    = Double.NEGATIVE_INFINITY;
        int utStride   = ctx.upperCap + 1;
        for (int k = 0; k < ctx.numSlots; k++) {
            if ((filled & (1 << k)) != 0) continue;
            int score     = ctx.rules.calculateScore(ctx.slotNames[k], dice);
            int newFilled = filled | (1 << k);
            int newUpper  = ctx.updateUpper(upperTotal, k, score);
            double bonus  = (ctx.isUpperSlot(k) && upperTotal < ctx.upperCap && newUpper == ctx.upperCap)
                            ? ctx.upperBonus : 0.0;
            double w = (newFilled == ctx.allFilled) ? 0.0 : wTable[newFilled * utStride + newUpper];
            double val = score + bonus + w;
            if (val > best) best = val;
        }
        return best;
    }

    /** scoreOption과 같은 로직, 최적 슬롯 인덱스 반환. */
    public static int bestScoreSlot(YachtDpContext ctx, int[] dice, int filled, int upperTotal, double[] wTable) {
        int    bestSlot = -1;
        double best     = Double.NEGATIVE_INFINITY;
        int utStride    = ctx.upperCap + 1;
        for (int k = 0; k < ctx.numSlots; k++) {
            if ((filled & (1 << k)) != 0) continue;
            int score     = ctx.rules.calculateScore(ctx.slotNames[k], dice);
            int newFilled = filled | (1 << k);
            int newUpper  = ctx.updateUpper(upperTotal, k, score);
            double bonus  = (ctx.isUpperSlot(k) && upperTotal < ctx.upperCap && newUpper == ctx.upperCap)
                            ? ctx.upperBonus : 0.0;
            double w = (newFilled == ctx.allFilled) ? 0.0 : wTable[newFilled * utStride + newUpper];
            double val = score + bonus + w;
            if (val > best) { best = val; bestSlot = k; }
        }
        return bestSlot;
    }

    // ── 헬퍼 ─────────────────────────────────────────────────────────────────

    private static int ipow(int base, int exp) {
        int r = 1;
        for (int i = 0; i < exp; i++) r *= base;
        return r;
    }

    private YachtDpEngine() {}
}
