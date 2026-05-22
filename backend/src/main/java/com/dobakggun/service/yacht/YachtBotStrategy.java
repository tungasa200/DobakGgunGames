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
 * Phase B (하드 룰) → Phase C (보너스 우선) → score − dynamic_cost EV 비교.
 * Phase E: 전 슬롯 net 음수 시 SACRIFICE_ORDER에 따른 희생 선택.
 *
 * ── 슬롯 기회비용 (P1+P3+A) ─────────────────────────────────────────────────
 * cost = realization_value + conservation_premium
 *   상단 슬롯: dynamicUpperCost + conservationPremium
 *   하단 슬롯: LOWER_COST + conservationPremium
 *
 * ── 개발 단계 플래그 ────────────────────────────────────────────────────────
 * PHASE_A / PHASE_C / PHASE_E: 단계별 시뮬레이션 검증을 위해 on/off 가능.
 * Phase B (hard rules)는 항상 활성.
 */
@Deprecated(since = "2.0", forRemoval = false)
public class YachtBotStrategy {

    // ── Phase 활성 플래그 (시뮬레이션 단계 검증용) ─────────────────────────
    private static final boolean PHASE_A = true;  // conservation_premium
    private static final boolean PHASE_C = true;  // bonus-aware upper override
    private static final boolean PHASE_E = true;  // sacrifice order

    // 하단 섹션 기회비용 (정적, 모드 공통)
    private static final Map<String, Double> LOWER_COST = Map.of(
            "CHOICE",          17.50,
            "FOUR_OF_A_KIND",   9.50,
            "FULL_HOUSE",       9.20,
            "LITTLE_STRAIGHT",  8.60,
            "BIG_STRAIGHT",    13.60,
            "YACHT",            6.00
    );

    // Phase E: 완전 망한 패 희생 순서 (앞일수록 먼저 희생 — LOWER_COST 오름차순)
    private static final List<String> SACRIFICE_ORDER = List.of(
            "ONES", "TWOS", "YACHT", "LITTLE_STRAIGHT", "THREES",
            "FULL_HOUSE", "FOUR_OF_A_KIND", "FOURS", "BIG_STRAIGHT",
            "FIVES", "CHOICE", "SIXES",
            "SEVENS", "EIGHTS"
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

        int[]  sortOrder = sortOrder(dice);
        int[]  sorted    = applySortOrder(dice, sortOrder);
        for (int mask = 0; mask < 32; mask++) {
            double ev = maskEv(sorted, mask, rollsLeft, remaining, rules, costMap, memo);
            if (ev > bestEv) { bestEv = ev; bestMask = mask; }
        }
        return sortedMaskToOriginalIndices(bestMask, sortOrder);
    }

    /**
     * 점수를 기록할 족보 키 결정.
     * Phase B (하드 룰) → Phase C (보너스 상단 우선) → EV 비교 → Phase E (희생 순서).
     */
    public String decideScore(int[] dice, Set<String> remaining, YachtScoreRules rules,
                              int currentUpperTotal) {
        Map<String, Double> costMap = buildCostMap(rules, remaining, currentUpperTotal);

        // Phase B: 메이드 핸드 하드 룰 (항상 활성)
        String forced = hardRuleScore(dice, remaining, rules);
        if (forced != null) return forced;

        // Phase C: 보너스 달성 가능 상황에서 4K보다 상단 슬롯 우선
        if (PHASE_C) {
            String override = bonusAwareUpperOverride(dice, remaining, rules, currentUpperTotal);
            if (override != null) return override;
        }

        String bestKey = null;
        double bestNet = Double.NEGATIVE_INFINITY;

        for (String key : remaining) {
            double net = rules.calculateScore(key, dice) - costMap.getOrDefault(key, 10.0);
            if (net > bestNet) { bestNet = net; bestKey = key; }
        }

        // Phase E: BASE cost 기준으로 전 슬롯 0점일 때만 희생 순서 적용
        // (conservation premium 이 만든 인위적 음수 net에는 반응하지 않음)
        if (PHASE_E) {
            int bestRawScore = 0;
            for (String key : remaining) {
                bestRawScore = Math.max(bestRawScore, rules.calculateScore(key, dice));
            }
            if (bestRawScore == 0) {
                for (String s : SACRIFICE_ORDER) {
                    if (remaining.contains(s)) return s;
                }
            }
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
        int    bestMask  = 31;
        double bestEv    = Double.NEGATIVE_INFINITY;
        int[]  sortOrder = sortOrder(dice);
        int[]  sorted    = applySortOrder(dice, sortOrder);
        for (int mask = 0; mask < 32; mask++) {
            double ev = maskEv(sorted, mask, rollsLeft, remaining, rules, costMap, memo);
            if (ev > bestEv) { bestEv = ev; bestMask = mask; }
        }
        return sortedMaskToOriginalIndices(bestMask, sortOrder);
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
        long   key    = packKey(sortedDice, rollsLeft);
        Double cached = memo.get(key);
        if (cached != null) return cached;

        double result;
        if (rollsLeft == 0) {
            result = bestNetScore(sortedDice, remaining, rules, costMap);
        } else {
            result = Double.NEGATIVE_INFINITY;
            for (int mask = 0; mask < 32; mask++) {
                double ev = maskEv(sortedDice, mask, rollsLeft, remaining, rules, costMap, memo);
                if (ev > result) result = ev;
            }
        }
        memo.put(key, result);
        return result;
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

    // ─── Phase B: 하드 룰 ────────────────────────────────────────────────────

    /**
     * 메이드 핸드에 대한 절대 우선 결정.
     * EV 흔들림 없이 반드시 잡아야 할 케이스를 먼저 처리.
     */
    private static String hardRuleScore(int[] dice, Set<String> remaining,
                                         YachtScoreRules rules) {
        // 5개 동일 → YACHT 슬롯 살아있으면 무조건
        if (allSame(dice) && remaining.contains("YACHT")) return "YACHT";

        // Big Straight 메이드 → 슬롯 살아있으면 무조건
        if (rules.calculateScore("BIG_STRAIGHT", dice) > 0
                && remaining.contains("BIG_STRAIGHT")) return "BIG_STRAIGHT";

        // Little Straight 메이드 + Big Straight는 아닌 패 → LS
        if (rules.calculateScore("LITTLE_STRAIGHT", dice) > 0
                && rules.calculateScore("BIG_STRAIGHT", dice) == 0
                && remaining.contains("LITTLE_STRAIGHT")) return "LITTLE_STRAIGHT";

        return null;
    }

    private static boolean allSame(int[] dice) {
        for (int i = 1; i < dice.length; i++) {
            if (dice[i] != dice[0]) return false;
        }
        return true;
    }

    // ─── Phase A: 보존 가치 ───────────────────────────────────────────────────

    /**
     * 슬롯별 보존 프리미엄.
     * 양수 = "아직 쓰지 마라", 음수 = "먼저 희생해라".
     *
     * 튜닝된 수치: Phase A 시뮬레이션에서 회귀 없는 범위로 조정됨.
     *   CHOICE: 후반 3슬롯부터 점진적 보존 (최대 +3)
     *   YACHT:  게임 전반 보존 (후반부엔 소폭 완화)
     *   ONES/TWOS: 음수 = 쓰레기통 우선 — EV 비교에서 먼저 희생 유도
     */
    private static double conservationPremium(String key, int remainingSlotCount) {
        return switch (key) {
            // 후반부(≤3슬롯)에만 보존 가중치 — 조기 과보존 방지
            case "CHOICE" -> Math.max(0, 3.0 - remainingSlotCount);
            // 게임 내내 보존
            case "YACHT" -> remainingSlotCount > 4 ? 3.0 : 1.5;
            // 중반까지만 보존
            case "BIG_STRAIGHT" -> remainingSlotCount > 6 ? 2.0 : 0.0;
            // 전반부 보존 (조기 희생 방지)
            case "LITTLE_STRAIGHT" -> remainingSlotCount > 5 ? 1.5 : 0.0;
            case "FULL_HOUSE"      -> remainingSlotCount > 4 ? 1.0 : 0.0;
            // 쓰레기통 슬롯 — Phase E 발동 전에도 먼저 사용 유도
            case "ONES" -> -1.5;
            case "TWOS" -> -0.75;
            default -> 0.0;
        };
    }

    // ─── Phase C: 4K vs 상단 슬롯 보너스 인식 ───────────────────────────────

    /**
     * 보너스 달성 가능 상황에서 [F,F,F,F,X] 패턴이면 4K 대신 상단 슬롯 선택.
     * face ≥ 4이고, 원점수 차이 ≤ 5인 경우에만 발동.
     */
    private static String bonusAwareUpperOverride(int[] dice, Set<String> remaining,
                                                   YachtScoreRules rules,
                                                   int currentUpperTotal) {
        int fourFace = findFourOfAKindFace(dice);
        if (fourFace < 4) return null; // 낮은 면값은 보너스 기여 작음 → 4K 우선

        String upperKey = upperKeyOf(fourFace);
        if (upperKey == null || !remaining.contains(upperKey)) return null;

        if (!bonusStillReachable(currentUpperTotal, remaining, rules)) return null;

        // 4K 슬롯이 이미 사용됐으면 Phase C 미적용 (일반 EV에 위임)
        if (!remaining.contains("FOUR_OF_A_KIND")) return null;

        // 원점수 차이 ≤ 5일 때만 override (상단 점수가 충분히 경쟁력 있는 경우)
        int upperScore = rules.calculateScore(upperKey, dice);
        int fourKScore = rules.calculateScore("FOUR_OF_A_KIND", dice);
        return (fourKScore - upperScore <= 5) ? upperKey : null;
    }

    /** dice에서 4개 이상 같은 면값 중 가장 높은 것. 없으면 -1. */
    private static int findFourOfAKindFace(int[] dice) {
        int[] counts = new int[9];
        for (int d : dice) counts[d]++;
        for (int f = 8; f >= 1; f--) {
            if (counts[f] >= 4) return f;
        }
        return -1;
    }

    private static String upperKeyOf(int face) {
        return switch (face) {
            case 1 -> "ONES";   case 2 -> "TWOS";   case 3 -> "THREES";
            case 4 -> "FOURS";  case 5 -> "FIVES";  case 6 -> "SIXES";
            case 7 -> "SEVENS"; case 8 -> "EIGHTS"; default -> null;
        };
    }

    /**
     * 현재 상단 누적 + 남은 상단 슬롯 최대 기대치로 보너스 달성 가능 여부 판단.
     * 낙관적 추정(각 상단 슬롯을 면값×5로 가정)을 사용.
     */
    private static boolean bonusStillReachable(int currentUpperTotal,
                                                Set<String> remaining,
                                                YachtScoreRules rules) {
        Set<String> upperKs   = rules.upperKeys();
        int         threshold = rules.upperBonusThreshold();
        int maxRemaining = remaining.stream()
                .filter(upperKs::contains)
                .mapToInt(k -> faceOf(k) * 5)
                .sum();
        return currentUpperTotal + maxRemaining >= threshold;
    }

    // ─── 동적 기회비용 (P3 + Phase A) ────────────────────────────────────────

    private Map<String, Double> buildCostMap(YachtScoreRules rules, Set<String> remaining,
                                              int currentUpperTotal) {
        int                 remainingSlotCount = remaining.size();
        Map<String, Double> map                = new HashMap<>();
        Set<String>         upperKs            = rules.upperKeys();
        for (String key : remaining) {
            double base = upperKs.contains(key)
                    ? dynamicUpperCost(key, rules, currentUpperTotal, remaining)
                    : LOWER_COST.getOrDefault(key, 10.0);
            double premium = PHASE_A ? conservationPremium(key, remainingSlotCount) : 0.0;
            map.put(key, base + premium);
        }
        return map;
    }

    /**
     * 상단 슬롯 기회비용 = par(F) + dynamic_bonus_premium.
     *
     * par(F) = F × threshold / Σ(1..faces)
     *   D6: F×63/21=3F  |  D8: F×108/36=3F
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

    /** dice[i] 값 기준 오름차순 정렬 순서 반환. sortOrder[i] = sorted position i의 원본 인덱스. */
    private static int[] sortOrder(int[] dice) {
        Integer[] idx = {0, 1, 2, 3, 4};
        Arrays.sort(idx, (a, b) -> dice[a] - dice[b]);
        int[] order = new int[5];
        for (int i = 0; i < 5; i++) order[i] = idx[i];
        return order;
    }

    /** sortOrder를 적용해 정렬된 배열 반환. */
    private static int[] applySortOrder(int[] dice, int[] sortOrder) {
        int[] s = new int[5];
        for (int i = 0; i < 5; i++) s[i] = dice[sortOrder[i]];
        return s;
    }

    /** sorted 기준 mask의 유지 비트를 원본 dice 인덱스 리스트로 변환. */
    private static List<Integer> sortedMaskToOriginalIndices(int mask, int[] sortOrder) {
        List<Integer> idx = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            if ((mask & (1 << i)) != 0) idx.add(sortOrder[i]);
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
