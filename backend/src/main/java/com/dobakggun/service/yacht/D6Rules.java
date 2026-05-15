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
            case "CHOICE"          -> sum(dice);
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
        int s = 0;
        for (int d : dice) if (d == face) s += face;
        return s;
    }

    private static int sum(int[] dice) {
        int s = 0;
        for (int d : dice) s += d;
        return s;
    }

    /** int[7]: 인덱스 1-6 → 해당 면 개수 */
    private static int[] counts(int[] dice) {
        int[] c = new int[7];
        for (int d : dice) c[d]++;
        return c;
    }

    private static int calcFourOfAKind(int[] dice) {
        int[] c = counts(dice);
        for (int f = 1; f <= 6; f++)
            if (c[f] >= 4) return f * 4;
        return 0;
    }

    private static int calcFullHouse(int[] dice) {
        int[] c = counts(dice);
        boolean has2 = false, has3 = false;
        for (int f = 1; f <= 6; f++) {
            if (c[f] == 2) has2 = true;
            else if (c[f] == 3) has3 = true;
        }
        if (!has2 || !has3) return 0;
        return sum(dice);
    }

    private static int calcLittleStraight(int[] dice) {
        boolean[] seen = new boolean[7];
        for (int d : dice) seen[d] = true;
        return ((seen[1] && seen[2] && seen[3] && seen[4])
             || (seen[2] && seen[3] && seen[4] && seen[5])
             || (seen[3] && seen[4] && seen[5] && seen[6])) ? 15 : 0;
    }

    private static int calcBigStraight(int[] dice) {
        boolean[] seen = new boolean[7];
        for (int d : dice) seen[d] = true;
        return ((seen[1] && seen[2] && seen[3] && seen[4] && seen[5])
             || (seen[2] && seen[3] && seen[4] && seen[5] && seen[6])) ? 30 : 0;
    }

    private static int calcYacht(int[] dice) {
        int first = dice[0];
        for (int d : dice) if (d != first) return 0;
        return 50;
    }
}
