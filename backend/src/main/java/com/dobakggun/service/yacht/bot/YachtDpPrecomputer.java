package com.dobakggun.service.yacht.bot;

import com.dobakggun.service.yacht.D6Rules;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * W 테이블 사전 계산 — Row 기반 최적화 + 병렬 처리.
 *
 * 핵심 최적화:
 * 1) computeWRow: filled 하나당 upperTotal 0..63을 한 번에 계산.
 *    vMemo를 64번 따로 만드는 대신 한 번만 생성 → 64× vMemo 생성 감소.
 * 2) parallelStream: 같은 비트 카운트 레벨의 filled 값들을 병렬 처리.
 *    Backward induction 순서는 레벨 단위로 직렬 (bc=11→bc=0),
 *    같은 레벨 내부는 완전 독립이므로 병렬 안전.
 * 3) vMemo: HashMap<Long,double[]> → double[][] 배열 (boxing 제거).
 *    KEY_TO_V_IDX 정적 맵으로 packKey → 0..755 인덱스 직접 조회.
 */
@Slf4j
public final class YachtDpPrecomputer {

    private static final D6Rules D6 = new D6Rules();
    private static final int[] POW6 = {1, 6, 36, 216, 1296, 7776};

    /** vMemo 배열 크기: rollsLeft(0..2) × 252 멀티셋 = 756 */
    private static final int V_MEMO_SIZE = 3 * 252;

    /**
     * W 테이블 전체 사전 계산 후 반환.
     * Row + 병렬 최적화로 단순 구현 대비 수백 배 빠름.
     */
    public static double[] precompute() {
        double[] w = new double[YachtDpEngine.TABLE_SIZE];

        @SuppressWarnings("unchecked")
        List<Integer>[] byBitCount = new List[13];
        for (int i = 0; i <= 12; i++) byBitCount[i] = new ArrayList<>();
        for (int f = 0; f < 4096; f++) byBitCount[Integer.bitCount(f)].add(f);

        long t0 = System.currentTimeMillis();

        // bc=11 → bc=0 순서로 처리 (backward induction)
        // bc=12 (ALL_FILLED) → W=0, 배열 기본값으로 처리
        for (int bc = 11; bc >= 0; bc--) {
            List<Integer> filledList = byBitCount[bc];
            // 같은 레벨 내 filled 값들은 서로 독립 → 병렬 안전
            filledList.parallelStream().forEach(filled -> computeWRow(filled, w));

            long elapsed = (System.currentTimeMillis() - t0) / 1000;
            log.info("YachtDpPrecomputer: {} slots filled completed, elapsed={}s", bc, elapsed);
        }

        long total = System.currentTimeMillis() - t0;
        log.info("YachtDpPrecomputer: 완료 ({} entries, {}ms)", YachtDpEngine.TABLE_SIZE, total);
        return w;
    }

    /**
     * filled 하나에 대해 upperTotal 0..63을 동시에 계산.
     * vMemo를 double[][] 배열로 관리 (boxing 없음).
     */
    private static void computeWRow(int filled, double[] w) {
        double[][] vMemo = new double[V_MEMO_SIZE][];  // null = 미계산
        double[] rowSum = new double[64];

        for (int i = 0; i < YachtDiceMultiset.ALL_MULTISETS.length; i++) {
            int[] dice = YachtDiceMultiset.ALL_MULTISETS[i];
            int   mult = YachtDiceMultiset.MULTINOMIALS[i];
            double[] v = computeVRow(dice, 2, filled, w, vMemo);
            for (int ut = 0; ut <= 63; ut++) rowSum[ut] += mult * v[ut];
        }

        for (int ut = 0; ut <= 63; ut++) {
            w[filled * 64 + ut] = rowSum[ut] / YachtDiceMultiset.TOTAL_OUTCOMES;
        }
    }

    /**
     * V(sortedDice, rollsLeft, filled, upperTotal) 를 upperTotal 전체에 대해 한 번에 계산.
     * 반환값: double[64], index = upperTotal (0..63).
     */
    private static double[] computeVRow(int[] sortedDice, int rollsLeft,
                                         int filled, double[] w,
                                         double[][] vMemo) {
        int idx = YachtDiceMultiset.KEY_TO_V_IDX[
                      YachtDiceMultiset.packKey(sortedDice, rollsLeft)];
        if (idx >= 0 && vMemo[idx] != null) return vMemo[idx];

        // scoreOption 결과를 초기 baseline으로 사용 (rollsLeft=0일 때는 이것이 최종값)
        double[] result = scoreOptionRow(sortedDice, filled, w);

        if (rollsLeft > 0) {
            for (int mask = 0; mask < 32; mask++) {
                double[] ev = maskEvRow(sortedDice, mask, rollsLeft, filled, w, vMemo);
                for (int ut = 0; ut <= 63; ut++) {
                    if (ev[ut] > result[ut]) result[ut] = ev[ut];
                }
            }
        }

        if (idx >= 0) vMemo[idx] = result;
        return result;
    }

    private static double[] maskEvRow(int[] sortedDice, int mask, int rollsLeft,
                                       int filled, double[] w,
                                       double[][] vMemo) {
        int rerollCount = 5 - Integer.bitCount(mask);
        if (rerollCount == 0) {
            return computeVRow(sortedDice, rollsLeft - 1, filled, w, vMemo);
        }
        int[] kept    = YachtDiceMultiset.extractKeptSorted(sortedDice, mask);
        int[] rerolled = new int[rerollCount];
        double[] out  = new double[64];
        sumRerollsRow(kept, rerolled, 0, 1, rollsLeft - 1, filled, w, vMemo, out);
        double divisor = POW6[rerollCount];
        for (int ut = 0; ut <= 63; ut++) out[ut] /= divisor;
        return out;
    }

    private static void sumRerollsRow(int[] kept, int[] rerolled, int pos, int minVal,
                                       int nextRolls, int filled, double[] w,
                                       double[][] vMemo, double[] out) {
        if (pos == rerolled.length) {
            int[] full = YachtDiceMultiset.mergeSorted(kept, rerolled);
            int   mult = YachtDiceMultiset.multinomial(rerolled);
            double[] v = computeVRow(full, nextRolls, filled, w, vMemo);
            for (int ut = 0; ut <= 63; ut++) out[ut] += mult * v[ut];
            return;
        }
        for (int val = minVal; val <= 6; val++) {
            rerolled[pos] = val;
            sumRerollsRow(kept, rerolled, pos + 1, val, nextRolls, filled, w, vMemo, out);
        }
    }

    /**
     * scoreOption을 upperTotal 0..63 전체에 대해 한 번에 계산.
     * 각 unfilled slot k에 대해 score, newFilled, newUpper를 한 번만 계산하고
     * upperTotal 루프 안에서 bonus/W 조회만 처리.
     */
    private static double[] scoreOptionRow(int[] dice, int filled, double[] w) {
        double[] result = new double[64];
        Arrays.fill(result, Double.NEGATIVE_INFINITY);

        for (int k = 0; k < YachtDpEngine.NUM_SLOTS; k++) {
            if ((filled & (1 << k)) != 0) continue;

            int score     = D6.calculateScore(YachtDpEngine.SLOT_NAMES[k], dice);
            int newFilled = filled | (1 << k);
            boolean isUpper = (k < 6);

            for (int ut = 0; ut <= 63; ut++) {
                int newUpper = isUpper ? Math.min(63, ut + score) : ut;
                double bonus = (isUpper && ut < 63 && newUpper == 63) ? 35.0 : 0.0;
                double wVal  = (newFilled == YachtDpEngine.ALL_FILLED) ? 0.0
                                : w[newFilled * 64 + newUpper];
                double val   = score + bonus + wVal;
                if (val > result[ut]) result[ut] = val;
            }
        }
        return result;
    }

    private YachtDpPrecomputer() {}
}
