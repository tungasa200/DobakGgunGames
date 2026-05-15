package com.dobakggun.service.yacht.bot;

import lombok.extern.slf4j.Slf4j;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * W 테이블 사전 계산 — Row 기반 최적화 + 병렬 처리.
 * D6/D8 공통 — 모드별 파라미터는 YachtDpContext로 전달.
 *
 * 핵심 최적화:
 * 1) computeWRow: filled 하나당 upperTotal 0..upperCap을 한 번에 계산.
 * 2) parallelStream: 같은 비트 카운트 레벨의 filled 값들을 병렬 처리.
 *    Backward induction 순서는 레벨 단위로 직렬, 같은 레벨 내부는 병렬 안전.
 * 3) vMemo: double[][] 배열 (boxing 없음). ctx.keyToVIdx 로 packKey → 인덱스 직접 조회.
 */
@Slf4j
public final class YachtDpPrecomputer {

    public static double[] precompute(YachtDpContext ctx) {
        double[] w       = new double[ctx.tableSize];
        int numFilled    = 1 << ctx.numSlots;
        int utStride     = ctx.upperCap + 1;

        @SuppressWarnings("unchecked")
        List<Integer>[] byBitCount = new List[ctx.numSlots + 1];
        for (int i = 0; i <= ctx.numSlots; i++) byBitCount[i] = new ArrayList<>();
        for (int f = 0; f < numFilled; f++) byBitCount[Integer.bitCount(f)].add(f);

        long t0 = System.currentTimeMillis();

        // bc=numSlots-1 → bc=0 순서 (backward induction). bc=numSlots → W=0, 배열 기본값.
        for (int bc = ctx.numSlots - 1; bc >= 0; bc--) {
            List<Integer> filledList = byBitCount[bc];
            filledList.parallelStream().forEach(filled -> computeWRow(ctx, filled, w, utStride));

            long elapsed = (System.currentTimeMillis() - t0) / 1000;
            log.info("YachtDpPrecomputer [{}]: {} slots filled, elapsed={}s",
                    ctx.binFileName, bc, elapsed);
        }

        long total = System.currentTimeMillis() - t0;
        log.info("YachtDpPrecomputer: 완료 ({} entries, {}ms)", ctx.tableSize, total);
        return w;
    }

    // ── Row 계산 ─────────────────────────────────────────────────────────────

    private static void computeWRow(YachtDpContext ctx, int filled, double[] w, int utStride) {
        double[][] vMemo = new double[ctx.vCacheSize][];
        double[]   rowSum = new double[ctx.upperCap + 1];

        for (int i = 0; i < ctx.allMultisets.length; i++) {
            int[]    dice = ctx.allMultisets[i];
            int      mult = ctx.multinomials[i];
            double[] v    = computeVRow(ctx, dice, ctx.maxRollsLeft, filled, w, vMemo, utStride);
            for (int ut = 0; ut <= ctx.upperCap; ut++) rowSum[ut] += mult * v[ut];
        }

        for (int ut = 0; ut <= ctx.upperCap; ut++) {
            w[filled * utStride + ut] = rowSum[ut] / ctx.totalOutcomes;
        }
    }

    private static double[] computeVRow(YachtDpContext ctx, int[] sortedDice, int rollsLeft,
                                         int filled, double[] w,
                                         double[][] vMemo, int utStride) {
        int idx = ctx.keyToVIdx[ctx.packKey(sortedDice, rollsLeft)];
        if (idx >= 0 && vMemo[idx] != null) return vMemo[idx];

        double[] result = scoreOptionRow(ctx, sortedDice, filled, w, utStride);

        if (rollsLeft > 0) {
            for (int mask = 0; mask < 32; mask++) {
                double[] ev = maskEvRow(ctx, sortedDice, mask, rollsLeft, filled, w, vMemo, utStride);
                for (int ut = 0; ut <= ctx.upperCap; ut++) {
                    if (ev[ut] > result[ut]) result[ut] = ev[ut];
                }
            }
        }

        if (idx >= 0) vMemo[idx] = result;
        return result;
    }

    private static double[] maskEvRow(YachtDpContext ctx, int[] sortedDice, int mask, int rollsLeft,
                                       int filled, double[] w,
                                       double[][] vMemo, int utStride) {
        int rerollCount = 5 - Integer.bitCount(mask);
        if (rerollCount == 0) {
            return computeVRow(ctx, sortedDice, rollsLeft - 1, filled, w, vMemo, utStride);
        }
        int[]    kept    = YachtDiceMultiset.extractKeptSorted(sortedDice, mask);
        int[]    rerolled = new int[rerollCount];
        double[] out     = new double[ctx.upperCap + 1];
        sumRerollsRow(ctx, kept, rerolled, 0, 1, rollsLeft - 1, filled, w, vMemo, out, utStride);
        double divisor = ipow(ctx.faces, rerollCount);
        for (int ut = 0; ut <= ctx.upperCap; ut++) out[ut] /= divisor;
        return out;
    }

    private static void sumRerollsRow(YachtDpContext ctx, int[] kept, int[] rerolled, int pos, int minVal,
                                       int nextRolls, int filled, double[] w,
                                       double[][] vMemo, double[] out, int utStride) {
        if (pos == rerolled.length) {
            int[]    full = YachtDiceMultiset.mergeSorted(kept, rerolled);
            int      mult = YachtDiceMultiset.multinomial(rerolled);
            double[] v    = computeVRow(ctx, full, nextRolls, filled, w, vMemo, utStride);
            for (int ut = 0; ut <= ctx.upperCap; ut++) out[ut] += mult * v[ut];
            return;
        }
        for (int val = minVal; val <= ctx.faces; val++) {
            rerolled[pos] = val;
            sumRerollsRow(ctx, kept, rerolled, pos + 1, val, nextRolls, filled, w, vMemo, out, utStride);
        }
    }

    private static double[] scoreOptionRow(YachtDpContext ctx, int[] dice, int filled, double[] w, int utStride) {
        double[] result = new double[ctx.upperCap + 1];
        Arrays.fill(result, Double.NEGATIVE_INFINITY);

        for (int k = 0; k < ctx.numSlots; k++) {
            if ((filled & (1 << k)) != 0) continue;

            int     score     = ctx.rules.calculateScore(ctx.slotNames[k], dice);
            int     newFilled = filled | (1 << k);
            boolean isUpper   = ctx.isUpperSlot(k);

            for (int ut = 0; ut <= ctx.upperCap; ut++) {
                int    newUpper = isUpper ? Math.min(ctx.upperCap, ut + score) : ut;
                double bonus    = (isUpper && ut < ctx.upperCap && newUpper == ctx.upperCap)
                                  ? ctx.upperBonus : 0.0;
                double wVal     = (newFilled == ctx.allFilled) ? 0.0
                                  : w[newFilled * utStride + newUpper];
                double val      = score + bonus + wVal;
                if (val > result[ut]) result[ut] = val;
            }
        }
        return result;
    }

    // ── 헬퍼 ─────────────────────────────────────────────────────────────────

    private static int ipow(int base, int exp) {
        int r = 1;
        for (int i = 0; i < exp; i++) r *= base;
        return r;
    }

    private YachtDpPrecomputer() {}
}
