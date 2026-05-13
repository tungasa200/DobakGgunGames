package com.dobakggun.service.yacht;

import java.util.*;

/**
 * 야추 봇 최적 전략 알고리즘 (순수 계산 — Spring 비의존).
 *
 * ── Keep 결정 (P2) ─────────────────────────────────────────────────────────
 * Multi-step DP + 턴 내 메모이제이션.
 *   EV(sorted_dice, rollsLeft) = max over keep_mask of E[EV(next, rollsLeft-1)]
 *   EV(sorted_dice, 0)        = bestNetScore(sorted_dice)
 *
 * maskEv 열거 최적화: 8^5=32,768 순열 대신 정렬 다중집합(multiset) + 다항계수.
 *   D6 allReroll: C(10,5)=252, D8 allReroll: C(12,5)=792 → ~40x 절감
 *   D6 per-stateEv(1): 1,683회, D8 per-stateEv(1): 5,323회
 *   총 결정 1회: D6 ~5ms, D8 ~84ms — 성능 목표 충족.
 *
 * ── 점수 결정 (P0) ──────────────────────────────────────────────────────────
 * score − dynamic_cost 통합 비교. 0점 희생도 동일 기준 경쟁(음수 net 처리 수정).
 *
 * ── 슬롯 기회비용 (P1+P3) ───────────────────────────────────────────────────
 * keep EV · score 결정 동일 costMap 사용.
 * 상단 슬롯: par(F) + dynamic_bonus_premium(currentUpperTotal, remaining)
 * 하단 슬롯: 정적 기준값.
 */
public class YachtBotStrategy {

    // 하단 섹션 기회비용 (정적, 모드 공통)
    private static final Map<String, Double> LOWER_COST = Map.of(
            "CHOICE",          17.50,
            "FOUR_OF_A_KIND",   9.50,
            "FULL_HOUSE",       9.20,
            "LITTLE_STRAIGHT",  8.60,
            "BIG_STRAIGHT",    13.60,
            "YACHT",            6.00
    );

    private static final int[] FACT = {1, 1, 2, 6, 24, 120}; // 0!..5!

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * 유지할 주사위 인덱스 결정.
     *
     * @param rollsLeft        이 결정 후 남은 굴림 횟수 (≥ 1)
     * @param currentUpperTotal 현재 상단 누적 점수 (보너스 동적 계산용)
     * @return 유지할 인덱스 리스트. 크기 5 = 조기 종료 신호
     */
    public List<Integer> decideKeep(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                    int rollsLeft, int currentUpperTotal) {
        if (remaining.isEmpty() || rollsLeft == 0) return allIndices();

        Map<String, Double> costMap = buildCostMap(rules, remaining, currentUpperTotal);
        Map<Long, Double>   memo    = new HashMap<>();

        int    bestMask = 31;
        double bestEv   = Double.NEGATIVE_INFINITY;

        int[] sorted = sortedCopy(dice);
        for (int mask = 0; mask < 32; mask++) {
            double ev = maskEv(sorted, mask, rollsLeft, remaining, rules, costMap, memo);
            if (ev > bestEv) { bestEv = ev; bestMask = mask; }
        }
        return indicesFromMask(bestMask);
    }

    /**
     * 점수를 기록할 족보 키 결정.
     * score − dynamic_cost 통합 비교 (음수 net과 0점 희생 동일 기준).
     */
    public String decideScore(int[] dice, Set<String> remaining, YachtScoreRules rules,
                              int currentUpperTotal) {
        Map<String, Double> costMap = buildCostMap(rules, remaining, currentUpperTotal);

        String bestKey = null;
        double bestNet = Double.NEGATIVE_INFINITY;

        for (String key : remaining) {
            double net = rules.calculateScore(key, dice) - costMap.getOrDefault(key, 10.0);
            if (net > bestNet) { bestNet = net; bestKey = key; }
        }
        return bestKey;
    }

    /**
     * 현재 주사위를 그대로 쓰는 것이 최적인지 판단 (DP 기반).
     * decideKeep이 모든 인덱스를 반환하면 stop.
     */
    public boolean isOptimalToStop(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                   int rollsLeft, int currentUpperTotal) {
        if (rollsLeft == 0) return true;
        return decideKeep(dice, remaining, rules, rollsLeft, currentUpperTotal).size() == 5;
    }

    // ─── Package-private: simulation memo-sharing ────────────────────────────

    /** costMap을 외부에 노출 — 시뮬레이터가 턴 단위로 재사용할 수 있도록. */
    Map<String, Double> costMapFor(YachtScoreRules rules, Set<String> remaining,
                                    int currentUpperTotal) {
        return buildCostMap(rules, remaining, currentUpperTotal);
    }

    /**
     * decideKeep과 동일 로직이지만 costMap·memo를 호출자가 제공.
     * 시뮬레이터가 한 턴의 여러 굴림 결정에 같은 memo를 재사용할 때 사용.
     */
    List<Integer> decideKeepShared(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                    int rollsLeft, Map<String, Double> costMap,
                                    Map<Long, Double> memo) {
        if (remaining.isEmpty() || rollsLeft == 0) return allIndices();
        int    bestMask = 31;
        double bestEv   = Double.NEGATIVE_INFINITY;
        int[]  sorted   = sortedCopy(dice);
        for (int mask = 0; mask < 32; mask++) {
            double ev = maskEv(sorted, mask, rollsLeft, remaining, rules, costMap, memo);
            if (ev > bestEv) { bestEv = ev; bestMask = mask; }
        }
        return indicesFromMask(bestMask);
    }

    // ─── Multi-step DP ───────────────────────────────────────────────────────

    /**
     * EV(sortedDice, rollsLeft): rollsLeft번 굴림 기회가 남았을 때 최대 기대값.
     * 결과는 turnScoped memo에 캐시됨.
     * sortedDice는 항상 정렬 상태로 전달 — memoKey 정렬 생략.
     */
    private double stateEv(int[] sortedDice, int rollsLeft, Set<String> remaining,
                            YachtScoreRules rules, Map<String, Double> costMap,
                            Map<Long, Double> memo) {
        if (rollsLeft == 0) return bestNetScore(sortedDice, remaining, rules, costMap);

        long   key    = packKey(sortedDice, rollsLeft);
        Double cached = memo.get(key);
        if (cached != null) return cached;

        double best = Double.NEGATIVE_INFINITY;
        for (int mask = 0; mask < 32; mask++) {
            double ev = maskEv(sortedDice, mask, rollsLeft, remaining, rules, costMap, memo);
            if (ev > best) best = ev;
        }
        memo.put(key, best);
        return best;
    }

    /**
     * mask 조합으로 유지하고 나머지를 한 번 굴렸을 때의 평균 EV.
     * 정렬 다중집합 열거 + 다항계수 가중치로 순열 중복 제거.
     */
    private double maskEv(int[] sortedDice, int mask, int rollsLeft, Set<String> remaining,
                           YachtScoreRules rules, Map<String, Double> costMap,
                           Map<Long, Double> memo) {
        int faces       = rules.rngFaces();
        int rerollCount = 5 - Integer.bitCount(mask);

        if (rerollCount == 0) {
            // 전부 유지 → 같은 주사위로 rollsLeft-1 기대값
            return stateEv(sortedDice, rollsLeft - 1, remaining, rules, costMap, memo);
        }

        int[] kept     = extractKeptSorted(sortedDice, mask);
        int[] rerolled = new int[rerollCount];
        // weightedSum = Σ multinomial(rerolled) × EV(merged)
        double weightedSum = sumOverMultisets(
                kept, rerolled, 0, 1, faces, rollsLeft - 1, remaining, rules, costMap, memo);
        return weightedSum / ipow(faces, rerollCount);
    }

    /**
     * rerolled 배열을 재귀적으로 정렬 다중집합으로 채우며
     * EV(merged_sorted_dice, nextRollsLeft) × multinomial(rerolled) 합산.
     *
     * @param pos    현재 채울 rerolled 인덱스
     * @param minVal 단조 비감소 보장을 위한 최솟값 (중복/순서 제거)
     */
    private double sumOverMultisets(int[] kept, int[] rerolled, int pos, int minVal,
                                     int faces, int nextRollsLeft,
                                     Set<String> remaining, YachtScoreRules rules,
                                     Map<String, Double> costMap, Map<Long, Double> memo) {
        if (pos == rerolled.length) {
            int[] full = mergeSorted(kept, rerolled);
            int   mult = multinomial(rerolled);
            return mult * stateEv(full, nextRollsLeft, remaining, rules, costMap, memo);
        }
        double sum = 0.0;
        for (int v = minVal; v <= faces; v++) {
            rerolled[pos] = v;
            sum += sumOverMultisets(kept, rerolled, pos + 1, v, faces, nextRollsLeft,
                    remaining, rules, costMap, memo);
        }
        return sum;
    }

    private static double bestNetScore(int[] dice, Set<String> remaining,
                                       YachtScoreRules rules, Map<String, Double> costMap) {
        double best = Double.NEGATIVE_INFINITY;
        for (String key : remaining) {
            double net = rules.calculateScore(key, dice) - costMap.getOrDefault(key, 10.0);
            if (net > best) best = net;
        }
        return best;
    }

    // ─── 동적 기회비용 (P3) ───────────────────────────────────────────────────

    private Map<String, Double> buildCostMap(YachtScoreRules rules, Set<String> remaining,
                                              int currentUpperTotal) {
        Map<String, Double> map     = new HashMap<>();
        Set<String>         upperKs = rules.upperKeys();
        for (String key : remaining) {
            map.put(key, upperKs.contains(key)
                    ? dynamicUpperCost(key, rules, currentUpperTotal, remaining)
                    : LOWER_COST.getOrDefault(key, 10.0));
        }
        return map;
    }

    /**
     * 상단 슬롯 기회비용 = par(F) + dynamic_bonus_premium.
     *
     * par(F) = F × threshold / Σ(1..faces)
     *   D6: F×63/21=3F  |  D8: F×112/36≈3.11F
     *
     * premium:
     *   gap = threshold − currentUpperTotal
     *   gap ≤ 0 → 보너스 확정, premium = 0
     *   cushion = expectedRemainingPar − gap
     *   pBonus  = clamp(0.5 + cushion / (2×threshold), 0, 1)
     *   premium = bonusValue × pBonus × (parF / threshold)
     */
    private static double dynamicUpperCost(String key, YachtScoreRules rules,
                                            int currentUpperTotal, Set<String> remaining) {
        int faces     = rules.rngFaces();
        int threshold = rules.upperBonusThreshold();
        int bonus     = rules.upperBonusValue();
        int sumFaces  = faces * (faces + 1) / 2;

        double parF = (double) faceOf(key) * threshold / sumFaces;
        int    gap  = threshold - currentUpperTotal;
        if (gap <= 0) return parF;

        Set<String> upperKs     = rules.upperKeys();
        double      expectedRem = remaining.stream()
                .filter(upperKs::contains)
                .mapToDouble(k -> (double) faceOf(k) * threshold / sumFaces)
                .sum();

        double cushion = expectedRem - gap;
        double pBonus  = Math.max(0.0, Math.min(1.0, 0.5 + cushion / (2.0 * threshold)));
        return parF + bonus * pBonus * (parF / threshold);
    }

    private static int faceOf(String key) {
        return switch (key) {
            case "ONES"   -> 1; case "TWOS"   -> 2; case "THREES" -> 3;
            case "FOURS"  -> 4; case "FIVES"  -> 5; case "SIXES"  -> 6;
            case "SEVENS" -> 7; case "EIGHTS" -> 8; default       -> 0;
        };
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    /** 정렬된 kept 배열 추출. mask가 1인 비트 위치의 값만 추출 후 정렬. */
    private static int[] extractKeptSorted(int[] sortedDice, int mask) {
        int k = Integer.bitCount(mask);
        if (k == 0) return new int[0];
        int[] kept = new int[k];
        int   idx  = 0;
        for (int i = 0; i < 5; i++) {
            if ((mask & (1 << i)) != 0) kept[idx++] = sortedDice[i];
        }
        // sortedDice가 이미 정렬되어 있으므로 추출 결과도 정렬됨
        return kept;
    }

    /** 두 정렬 배열을 병합 (merge-sort 병합 단계). */
    private static int[] mergeSorted(int[] a, int[] b) {
        int[] result = new int[a.length + b.length];
        int   i = 0, j = 0, k = 0;
        while (i < a.length && j < b.length) {
            result[k++] = (a[i] <= b[j]) ? a[i++] : b[j++];
        }
        while (i < a.length) result[k++] = a[i++];
        while (j < b.length) result[k++] = b[j++];
        return result;
    }

    /** 정렬된 배열의 다항계수: n! / Π(ci!) */
    private static int multinomial(int[] sorted) {
        int n    = sorted.length;
        int denom = 1;
        int i    = 0;
        while (i < n) {
            int j = i + 1;
            while (j < n && sorted[j] == sorted[i]) j++;
            denom *= FACT[j - i];
            i = j;
        }
        return FACT[n] / denom;
    }

    /**
     * 메모 키: 정렬 주사위 5개(각 4비트) + rollsLeft(4비트) = 24비트 long.
     * 호출 전 sortedDice가 항상 정렬 상태임을 보장하므로 추가 정렬 불필요.
     */
    private static long packKey(int[] s, int rollsLeft) {
        return ((long) rollsLeft)
             | ((long) s[0] << 4)
             | ((long) s[1] << 8)
             | ((long) s[2] << 12)
             | ((long) s[3] << 16)
             | ((long) s[4] << 20);
    }

    private static int[] sortedCopy(int[] dice) {
        int[] s = Arrays.copyOf(dice, 5);
        Arrays.sort(s);
        return s;
    }

    private static List<Integer> indicesFromMask(int mask) {
        List<Integer> idx = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            if ((mask & (1 << i)) != 0) idx.add(i);
        }
        return idx;
    }

    private static List<Integer> allIndices() {
        return List.of(0, 1, 2, 3, 4);
    }

    private static int ipow(int base, int exp) {
        int r = 1;
        for (int i = 0; i < exp; i++) r *= base;
        return r;
    }
}
