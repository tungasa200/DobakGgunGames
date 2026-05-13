package com.dobakggun.service.yacht;

import java.util.*;

/**
 * 야추 봇 최적 전략 알고리즘 (순수 계산 — Spring 비의존).
 *
 * Keep 결정: 5개 주사위의 32가지 유지 조합에 대해 1-step 기대값을 계산하고 최대값 선택.
 * 점수 결정: 즉시 점수가 가장 높은 족보 선택, 모두 0점이면 기회비용이 가장 낮은 족보 희생.
 *
 * 복잡도: O(32 × faces^5) per keep decision.
 *   D6: 32 × 7,776 ≈ 250K — < 5ms
 *   D8: 32 × 32,768 ≈ 1M  — < 20ms
 */
public class YachtBotStrategy {

    /**
     * 각 족보 슬롯을 0점으로 기록할 때 잃는 기대 점수 (희생 비용).
     * 낮을수록 희생하기 유리한 슬롯.
     */
    private static final Map<String, Double> SLOT_SACRIFICE_COST = Map.ofEntries(
            Map.entry("ONES",            2.08),
            Map.entry("TWOS",            4.17),
            Map.entry("THREES",          6.25),
            Map.entry("FOURS",           8.33),
            Map.entry("FIVES",          10.42),
            Map.entry("SIXES",          12.50),
            Map.entry("SEVENS",         14.58),
            Map.entry("EIGHTS",         16.67),
            Map.entry("CHOICE",         17.50),
            Map.entry("FOUR_OF_A_KIND",  9.50),
            Map.entry("FULL_HOUSE",      9.20),
            Map.entry("LITTLE_STRAIGHT", 8.60),
            Map.entry("BIG_STRAIGHT",   13.60),
            Map.entry("YACHT",           6.00)
    );

    // ─── 공개 API ────────────────────────────────────────────────────────────

    /**
     * 유지할 주사위 인덱스 결정.
     * 모든 32가지 keep 조합에 대해 1-step 기대값을 비교해 최적 조합 반환.
     *
     * @param dice       현재 주사위 5개 (1-indexed 면값)
     * @param remaining  아직 기록하지 않은 족보 key 집합
     * @param rules      D6 / D8 룰셋
     * @return 유지할 주사위 인덱스 리스트 (0~4)
     */
    public List<Integer> decideKeep(int[] dice, Set<String> remaining, YachtScoreRules rules) {
        if (remaining.isEmpty()) return allIndices();

        double bestEv = -1.0;
        List<Integer> bestKeep = List.of();

        for (int mask = 0; mask < 32; mask++) {
            List<Integer> keptIdx = indicesFromMask(mask);
            double ev = computeKeepEv(dice, keptIdx, remaining, rules);
            if (ev > bestEv) {
                bestEv = ev;
                bestKeep = keptIdx;
            }
        }
        return bestKeep;
    }

    /**
     * 점수를 기록할 족보 키 결정.
     *
     * 우선순위:
     * 1. 즉시 점수가 가장 높은 족보
     * 2. 모두 0점이면 희생 비용이 가장 낮은 족보 (ONES 먼저 희생)
     */
    public String decideScore(int[] dice, Set<String> remaining, YachtScoreRules rules) {
        String bestNonZero = null;
        int    bestScore   = -1;
        String bestZero    = null;
        double lowestCost  = Double.MAX_VALUE;

        for (String key : remaining) {
            int score = rules.calculateScore(key, dice);
            if (score > 0) {
                if (score > bestScore) {
                    bestScore   = score;
                    bestNonZero = key;
                }
            } else {
                double cost = SLOT_SACRIFICE_COST.getOrDefault(key, 10.0);
                if (cost < lowestCost) {
                    lowestCost = cost;
                    bestZero   = key;
                }
            }
        }

        return bestNonZero != null ? bestNonZero : bestZero;
    }

    /**
     * 현재 주사위가 이미 최적 상태(더 굴려도 이득 없음)인지 판단.
     * YACHT(50) 또는 BIG_STRAIGHT(30)를 달성한 경우 조기 종료 허용.
     */
    public boolean isOptimalToStop(int[] dice, Set<String> remaining, YachtScoreRules rules) {
        for (String key : remaining) {
            int score = rules.calculateScore(key, dice);
            if (score >= 50) return true; // YACHT
            if (score == 30 && "BIG_STRAIGHT".equals(key)) return true;
        }
        return false;
    }

    // ─── Keep EV 계산 ────────────────────────────────────────────────────────

    /**
     * keptIdx를 유지하고 나머지를 한 번 굴렸을 때의 평균 최고 점수.
     * 모든 faces^rerollCount 결과를 열거해 정확한 기대값 계산.
     */
    private double computeKeepEv(int[] dice, List<Integer> keptIdx,
                                  Set<String> remaining, YachtScoreRules rules) {
        int faces       = rules.rngFaces();
        int rerollCount = 5 - keptIdx.size();

        if (rerollCount == 0) {
            return bestRawScore(dice, remaining, rules);
        }

        int totalCombos = ipow(faces, rerollCount);
        double total    = 0.0;

        for (int combo = 0; combo < totalCombos; combo++) {
            int[] result = buildResult(dice, keptIdx, combo, faces);
            total += bestRawScore(result, remaining, rules);
        }
        return total / totalCombos;
    }

    /**
     * remaining 중 현재 dice로 낼 수 있는 최고 raw 점수.
     */
    private static double bestRawScore(int[] dice, Set<String> remaining, YachtScoreRules rules) {
        int best = 0;
        for (String key : remaining) {
            int s = rules.calculateScore(key, dice);
            if (s > best) best = s;
        }
        return best;
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    /**
     * keptIdx를 유지하고 나머지 자리를 combo에 해당하는 값으로 채운 결과 배열 생성.
     * combo는 0부터 faces^rerollCount - 1 범위의 정수.
     * 자리 순서(index 0→4)대로 faces 진법 디코딩.
     */
    private static int[] buildResult(int[] dice, List<Integer> keptIdx, int combo, int faces) {
        int[] result = Arrays.copyOf(dice, 5);
        int   temp   = combo;
        for (int i = 0; i < 5; i++) {
            if (!keptIdx.contains(i)) {
                result[i] = (temp % faces) + 1;
                temp      /= faces;
            }
        }
        return result;
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
        int result = 1;
        for (int i = 0; i < exp; i++) result *= base;
        return result;
    }
}
