package com.dobakggun.service.yacht;

import java.util.*;

/**
 * D6 (정육면체, 1~6) 룰셋.
 * 12종 족보, 상단 보너스 임계 63점.
 */
public class D6Rules implements YachtScoreRules {

    private static final Set<String> VALID_SCORE_KEYS = Set.of(
            "ONES", "TWOS", "THREES", "FOURS", "FIVES", "SIXES",
            "CHOICE", "FOUR_OF_A_KIND", "FULL_HOUSE",
            "LITTLE_STRAIGHT", "BIG_STRAIGHT", "YACHT"
    );

    private static final Set<String> UPPER_KEYS = Set.of(
            "ONES", "TWOS", "THREES", "FOURS", "FIVES", "SIXES"
    );

    // Little Straight: 4개 연속 가능 셋
    private static final List<Set<Integer>> LITTLE_STRAIGHT_SETS = List.of(
            Set.of(1, 2, 3, 4),
            Set.of(2, 3, 4, 5),
            Set.of(3, 4, 5, 6)
    );

    // Big Straight: 5개 연속 가능 셋
    private static final List<Set<Integer>> BIG_STRAIGHT_SETS = List.of(
            Set.of(1, 2, 3, 4, 5),
            Set.of(2, 3, 4, 5, 6)
    );

    @Override
    public Set<String> validScoreKeys() {
        return VALID_SCORE_KEYS;
    }

    @Override
    public Set<String> upperKeys() {
        return UPPER_KEYS;
    }

    @Override
    public int upperBonusThreshold() {
        return 63;
    }

    @Override
    public int upperBonusValue() {
        return 35;
    }

    @Override
    public int totalScoreKeys() {
        return 12;
    }

    @Override
    public int rngFaces() {
        return 6;
    }

    @Override
    public int calculateScore(String scoreKey, int[] dice) {
        return switch (scoreKey) {
            case "ONES"            -> sumOf(dice, 1);
            case "TWOS"            -> sumOf(dice, 2);
            case "THREES"          -> sumOf(dice, 3);
            case "FOURS"           -> sumOf(dice, 4);
            case "FIVES"           -> sumOf(dice, 5);
            case "SIXES"           -> sumOf(dice, 6);
            case "CHOICE"          -> Arrays.stream(dice).sum();
            case "FOUR_OF_A_KIND"  -> calcFourOfAKind(dice);
            case "FULL_HOUSE"      -> calcFullHouse(dice);
            case "LITTLE_STRAIGHT" -> calcLittleStraight(dice);
            case "BIG_STRAIGHT"    -> calcBigStraight(dice);
            case "YACHT"           -> calcYacht(dice);
            default -> throw new IllegalArgumentException("D6 룰셋에 유효하지 않은 scoreKey: " + scoreKey);
        };
    }

    // ─── 점수 계산 헬퍼 ───────────────────────────────────────────────────────

    private static int sumOf(int[] dice, int face) {
        int sum = 0;
        for (int d : dice) if (d == face) sum += d;
        return sum;
    }

    private static int calcFourOfAKind(int[] dice) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int d : dice) counts.merge(d, 1, Integer::sum);
        for (Map.Entry<Integer, Integer> e : counts.entrySet()) {
            if (e.getValue() >= 4) return e.getKey() * 4;
        }
        return 0;
    }

    private static int calcFullHouse(int[] dice) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int d : dice) counts.merge(d, 1, Integer::sum);
        List<Integer> vals = new ArrayList<>(counts.values());
        Collections.sort(vals);
        // 정확히 [2,3]인 경우만 (5개 동일=[5]은 0)
        if (vals.equals(List.of(2, 3))) {
            return Arrays.stream(dice).sum();
        }
        return 0;
    }

    private static int calcLittleStraight(int[] dice) {
        Set<Integer> set = new HashSet<>();
        for (int d : dice) set.add(d);
        for (Set<Integer> required : LITTLE_STRAIGHT_SETS) {
            if (set.containsAll(required)) return 15;
        }
        return 0;
    }

    private static int calcBigStraight(int[] dice) {
        Set<Integer> set = new HashSet<>();
        for (int d : dice) set.add(d);
        for (Set<Integer> required : BIG_STRAIGHT_SETS) {
            if (set.containsAll(required)) return 30;
        }
        return 0;
    }

    private static int calcYacht(int[] dice) {
        Set<Integer> set = new HashSet<>();
        for (int d : dice) set.add(d);
        return set.size() == 1 ? 50 : 0;
    }
}
