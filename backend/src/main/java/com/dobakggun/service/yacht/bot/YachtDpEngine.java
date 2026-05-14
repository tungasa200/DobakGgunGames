package com.dobakggun.service.yacht.bot;

import com.dobakggun.service.yacht.D6Rules;
import java.util.HashMap;
import java.util.Map;

/**
 * W 테이블이 완성된 후 턴 내 V 계산 엔진.
 * 모든 메서드 순수 계산 (Spring 비의존).
 *
 * 상태 공간:
 *   filledSlotsMask: 12비트 (2^12 = 4096)
 *   upperTotalCapped: 0..63 (64값)
 *   W 인덱스: filled * 64 + upperTotal
 */
public final class YachtDpEngine {

    public static final int NUM_SLOTS       = 12;
    public static final int ALL_FILLED      = (1 << NUM_SLOTS) - 1;  // 4095
    public static final int UPPER_CAP       = 63;
    public static final int UPPER_THRESHOLD = 63;
    public static final int UPPER_BONUS     = 35;
    public static final int TABLE_SIZE      = 4096 * 64;  // 262,144

    /** 비트 인덱스 → 슬롯 이름 (D6 전용, 0-11) */
    public static final String[] SLOT_NAMES = {
        "ONES", "TWOS", "THREES", "FOURS", "FIVES", "SIXES",
        "CHOICE", "FOUR_OF_A_KIND", "FULL_HOUSE",
        "LITTLE_STRAIGHT", "BIG_STRAIGHT", "YACHT"
    };

    /** 슬롯 이름 → 비트 인덱스 */
    public static final Map<String, Integer> SLOT_INDEX;
    static {
        SLOT_INDEX = new HashMap<>(16);
        for (int i = 0; i < SLOT_NAMES.length; i++) SLOT_INDEX.put(SLOT_NAMES[i], i);
    }

    private static final D6Rules D6 = new D6Rules();
    private static final int[] POW6 = {1, 6, 36, 216, 1296, 7776};

    // ── V 계산 ────────────────────────────────────────────────────────────────

    /**
     * V(sortedDice, rollsLeft, filled, upperTotal).
     * vMemo는 턴 단위로 새로 생성해야 함 (filled/upperTotal 고정).
     */
    public static double computeV(int[] sortedDice, int rollsLeft,
                                   int filled, int upperTotal,
                                   double[] wTable,
                                   Map<Long, Double> vMemo) {
        long key = YachtDiceMultiset.packKey(sortedDice, rollsLeft);
        Double cached = vMemo.get(key);
        if (cached != null) return cached;

        double result;
        if (rollsLeft == 0) {
            result = scoreOption(sortedDice, filled, upperTotal, wTable);
        } else {
            double best = scoreOption(sortedDice, filled, upperTotal, wTable);
            for (int mask = 0; mask < 32; mask++) {
                double ev = maskEv(sortedDice, mask, rollsLeft, filled, upperTotal, wTable, vMemo);
                if (ev > best) best = ev;
            }
            result = best;
        }
        vMemo.put(key, result);
        return result;
    }

    /** keep mask에 대한 기대값. */
    public static double maskEv(int[] sortedDice, int mask, int rollsLeft,
                                 int filled, int upperTotal,
                                 double[] wTable, Map<Long, Double> vMemo) {
        int rerollCount = 5 - Integer.bitCount(mask);
        if (rerollCount == 0) {
            return computeV(sortedDice, rollsLeft - 1, filled, upperTotal, wTable, vMemo);
        }
        int[] kept    = YachtDiceMultiset.extractKeptSorted(sortedDice, mask);
        int[] rerolled = new int[rerollCount];
        double weightedSum = sumOverRerollMultisets(
                kept, rerolled, 0, 1, rollsLeft - 1,
                filled, upperTotal, wTable, vMemo);
        return weightedSum / POW6[rerollCount];
    }

    private static double sumOverRerollMultisets(int[] kept, int[] rerolled, int pos, int minVal,
                                                  int nextRollsLeft,
                                                  int filled, int upperTotal,
                                                  double[] wTable, Map<Long, Double> vMemo) {
        if (pos == rerolled.length) {
            int[] full = YachtDiceMultiset.mergeSorted(kept, rerolled);
            int mult = YachtDiceMultiset.multinomial(rerolled);
            return mult * computeV(full, nextRollsLeft, filled, upperTotal, wTable, vMemo);
        }
        double sum = 0.0;
        for (int v = minVal; v <= 6; v++) {
            rerolled[pos] = v;
            sum += sumOverRerollMultisets(kept, rerolled, pos + 1, v,
                    nextRollsLeft, filled, upperTotal, wTable, vMemo);
        }
        return sum;
    }

    // ── scoreOption ──────────────────────────────────────────────────────────

    /**
     * 현재 주사위로 점수를 기록할 때 기대할 수 있는 최대 값.
     * max over unfilled k of: score(k) + bonusTrigger(k) + W[newFilled][newUpper]
     */
    public static double scoreOption(int[] dice, int filled, int upperTotal, double[] wTable) {
        double best = Double.NEGATIVE_INFINITY;
        for (int k = 0; k < NUM_SLOTS; k++) {
            if ((filled & (1 << k)) != 0) continue;
            int score     = D6.calculateScore(SLOT_NAMES[k], dice);
            int newFilled = filled | (1 << k);
            int newUpper  = updateUpper(upperTotal, k, score);
            double bonus  = (isUpperSlot(k) && upperTotal < UPPER_CAP && newUpper == UPPER_CAP)
                            ? UPPER_BONUS : 0.0;
            double w = (newFilled == ALL_FILLED) ? 0.0 : wTable[newFilled * 64 + newUpper];
            double val = score + bonus + w;
            if (val > best) best = val;
        }
        return best;
    }

    /** scoreOption과 같은 로직, 최적 슬롯 인덱스 반환. */
    public static int bestScoreSlot(int[] dice, int filled, int upperTotal, double[] wTable) {
        int    bestSlot = -1;
        double best     = Double.NEGATIVE_INFINITY;
        for (int k = 0; k < NUM_SLOTS; k++) {
            if ((filled & (1 << k)) != 0) continue;
            int score     = D6.calculateScore(SLOT_NAMES[k], dice);
            int newFilled = filled | (1 << k);
            int newUpper  = updateUpper(upperTotal, k, score);
            double bonus  = (isUpperSlot(k) && upperTotal < UPPER_CAP && newUpper == UPPER_CAP)
                            ? UPPER_BONUS : 0.0;
            double w = (newFilled == ALL_FILLED) ? 0.0 : wTable[newFilled * 64 + newUpper];
            double val = score + bonus + w;
            if (val > best) { best = val; bestSlot = k; }
        }
        return bestSlot;
    }

    // ── 헬퍼 ─────────────────────────────────────────────────────────────────

    /** upperTotal + score(상단 슬롯이면), 63으로 cap. 하단 슬롯이면 그대로. */
    public static int updateUpper(int upperTotal, int slotBit, int score) {
        if (!isUpperSlot(slotBit)) return upperTotal;
        return Math.min(UPPER_CAP, upperTotal + score);
    }

    /** bits 0-5 = ONES~SIXES = 상단 슬롯. */
    public static boolean isUpperSlot(int slotBit) {
        return slotBit >= 0 && slotBit < 6;
    }

    private YachtDpEngine() {}
}
