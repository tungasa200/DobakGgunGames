package com.dobakggun.service.yacht;

import java.util.Set;

/**
 * D8 (정팔면체, 1~8) 룰셋.
 * 14종 족보 (상단 8 + 하단 6), 상단 보너스 임계 108점, 턴당 4롤.
 *
 * 균형 설계:
 * - 면당 적중률이 1/8로 떨어져 하단 족보(YACHT/FH/4K/스트레이트) 단판 확률이 D6의 절반 이하 → 턴당 굴림 4회로 보정
 * - 상단 임계 108 = 63 × (1+2+…+8)/(1+2+…+6) = 63 × 36/21. 면 합 비례 기준.
 *
 * 스트레이트 확장:
 * - LITTLE_STRAIGHT: {4,5,6,7}, {5,6,7,8} 추가
 * - BIG_STRAIGHT:    {3,4,5,6,7}, {4,5,6,7,8} 추가
 */
public class D8Rules implements YachtScoreRules {

    private static final Set<String> VALID_SCORE_KEYS = Set.of(
            "ONES", "TWOS", "THREES", "FOURS", "FIVES", "SIXES", "SEVENS", "EIGHTS",
            "CHOICE", "FOUR_OF_A_KIND", "FULL_HOUSE",
            "LITTLE_STRAIGHT", "BIG_STRAIGHT", "YACHT"
    );

    private static final Set<String> UPPER_KEYS = Set.of(
            "ONES", "TWOS", "THREES", "FOURS", "FIVES", "SIXES", "SEVENS", "EIGHTS"
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
        return 108;
    }

    @Override
    public int upperBonusValue() {
        return 35;
    }

    @Override
    public int totalScoreKeys() {
        return 14;
    }

    @Override
    public int rngFaces() {
        return 8;
    }

    @Override
    public int maxRollsPerTurn() {
        return 4;
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
            case "SEVENS"          -> sumOf(dice, 7);
            case "EIGHTS"          -> sumOf(dice, 8);
            case "CHOICE"          -> sum(dice);
            case "FOUR_OF_A_KIND"  -> calcFourOfAKind(dice);
            case "FULL_HOUSE"      -> calcFullHouse(dice);
            case "LITTLE_STRAIGHT" -> calcLittleStraight(dice);
            case "BIG_STRAIGHT"    -> calcBigStraight(dice);
            case "YACHT"           -> calcYacht(dice);
            default -> throw new IllegalArgumentException("D8 룰셋에 유효하지 않은 scoreKey: " + scoreKey);
        };
    }

    // ─── 점수 계산 헬퍼 ───────────────────────────────────────────────────────

    private static int sumOf(int[] dice, int face) {
        int sum = 0;
        for (int d : dice) if (d == face) sum += d;
        return sum;
    }

    private static int sum(int[] dice) {
        int s = 0;
        for (int d : dice) s += d;
        return s;
    }

    /** int[9]: 인덱스 1-8 → 해당 면 개수 */
    private static int[] counts(int[] dice) {
        int[] c = new int[9];
        for (int d : dice) c[d]++;
        return c;
    }

    private static int calcFourOfAKind(int[] dice) {
        int[] c = counts(dice);
        for (int f = 1; f <= 8; f++)
            if (c[f] >= 4) return f * 4;
        return 0;
    }

    private static int calcFullHouse(int[] dice) {
        int[] c = counts(dice);
        boolean has2 = false, has3 = false;
        for (int f = 1; f <= 8; f++) {
            if (c[f] == 2) has2 = true;
            else if (c[f] == 3) has3 = true;
        }
        // 정확히 2개+3개인 경우만 (5개 동일은 has3만 true → 0)
        if (!has2 || !has3) return 0;
        return sum(dice);
    }

    private static int calcLittleStraight(int[] dice) {
        // Little Straight: 4개 연속 (D6 3조합 + D8 추가 2조합)
        // {1,2,3,4}, {2,3,4,5}, {3,4,5,6}, {4,5,6,7}, {5,6,7,8}
        boolean[] seen = new boolean[9];
        for (int d : dice) seen[d] = true;
        return ((seen[1] && seen[2] && seen[3] && seen[4])
             || (seen[2] && seen[3] && seen[4] && seen[5])
             || (seen[3] && seen[4] && seen[5] && seen[6])
             || (seen[4] && seen[5] && seen[6] && seen[7])
             || (seen[5] && seen[6] && seen[7] && seen[8])) ? 15 : 0;
    }

    private static int calcBigStraight(int[] dice) {
        // Big Straight: 정확히 5개 연속 (D6 2조합 + D8 추가 2조합)
        // {1,2,3,4,5}, {2,3,4,5,6}, {3,4,5,6,7}, {4,5,6,7,8}
        // 주사위 5개가 모두 다른 값이어야 하므로 seen true 개수도 5여야 함
        boolean[] seen = new boolean[9];
        for (int d : dice) seen[d] = true;
        // seen 개수 5 확인 (중복 주사위 배제)
        int cnt = 0;
        for (int i = 1; i <= 8; i++) if (seen[i]) cnt++;
        if (cnt != 5) return 0;
        return ((seen[1] && seen[2] && seen[3] && seen[4] && seen[5])
             || (seen[2] && seen[3] && seen[4] && seen[5] && seen[6])
             || (seen[3] && seen[4] && seen[5] && seen[6] && seen[7])
             || (seen[4] && seen[5] && seen[6] && seen[7] && seen[8])) ? 30 : 0;
    }

    private static int calcYacht(int[] dice) {
        int first = dice[0];
        for (int d : dice) if (d != first) return 0;
        return 50;
    }
}
