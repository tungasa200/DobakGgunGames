package com.dobakggun.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * YachtGameService 점수 계산 단위 테스트.
 * PRD §5.6 의사 코드와 100% 일치 검증.
 */
@DisplayName("Yacht 점수 계산 테스트")
class YachtScoreCalculatorTest {

    // ─── 상단 족보 ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("ONES: 1 눈 총합")
    void ones() {
        assertThat(YachtGameService.calculateScore("ONES", new int[]{1, 1, 2, 3, 1})).isEqualTo(3);
        assertThat(YachtGameService.calculateScore("ONES", new int[]{2, 3, 4, 5, 6})).isEqualTo(0);
        assertThat(YachtGameService.calculateScore("ONES", new int[]{1, 1, 1, 1, 1})).isEqualTo(5);
    }

    @Test
    @DisplayName("TWOS: 2 눈 총합")
    void twos() {
        assertThat(YachtGameService.calculateScore("TWOS", new int[]{2, 2, 2, 3, 4})).isEqualTo(6);
        assertThat(YachtGameService.calculateScore("TWOS", new int[]{1, 3, 4, 5, 6})).isEqualTo(0);
    }

    @Test
    @DisplayName("THREES: 3 눈 총합")
    void threes() {
        assertThat(YachtGameService.calculateScore("THREES", new int[]{3, 3, 3, 1, 2})).isEqualTo(9);
    }

    @Test
    @DisplayName("FOURS: 4 눈 총합")
    void fours() {
        assertThat(YachtGameService.calculateScore("FOURS", new int[]{4, 4, 4, 4, 4})).isEqualTo(20);
    }

    @Test
    @DisplayName("FIVES: 5 눈 총합")
    void fives() {
        assertThat(YachtGameService.calculateScore("FIVES", new int[]{5, 5, 1, 2, 3})).isEqualTo(10);
    }

    @Test
    @DisplayName("SIXES: 6 눈 총합")
    void sixes() {
        assertThat(YachtGameService.calculateScore("SIXES", new int[]{6, 6, 6, 6, 6})).isEqualTo(30);
        assertThat(YachtGameService.calculateScore("SIXES", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
    }

    // ─── 하단 족보 ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("CHOICE: 5개 총합")
    void choice() {
        assertThat(YachtGameService.calculateScore("CHOICE", new int[]{1, 2, 3, 4, 5})).isEqualTo(15);
        assertThat(YachtGameService.calculateScore("CHOICE", new int[]{6, 6, 6, 6, 6})).isEqualTo(30);
    }

    @Test
    @DisplayName("FOUR_OF_A_KIND: 4개 이상 동일 → 그 눈×4")
    void fourOfAKind() {
        assertThat(YachtGameService.calculateScore("FOUR_OF_A_KIND", new int[]{6, 6, 6, 6, 2})).isEqualTo(24);
        assertThat(YachtGameService.calculateScore("FOUR_OF_A_KIND", new int[]{5, 5, 5, 5, 5})).isEqualTo(20); // Yacht도 인정
        assertThat(YachtGameService.calculateScore("FOUR_OF_A_KIND", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
        assertThat(YachtGameService.calculateScore("FOUR_OF_A_KIND", new int[]{3, 3, 3, 1, 2})).isEqualTo(0); // 3개는 불가
    }

    @Test
    @DisplayName("FULL_HOUSE: 3+2 조합 → 총합. Yacht는 0.")
    void fullHouse() {
        assertThat(YachtGameService.calculateScore("FULL_HOUSE", new int[]{3, 3, 3, 2, 2})).isEqualTo(13);
        assertThat(YachtGameService.calculateScore("FULL_HOUSE", new int[]{5, 5, 5, 5, 5})).isEqualTo(0); // Yacht → 0
        assertThat(YachtGameService.calculateScore("FULL_HOUSE", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
        assertThat(YachtGameService.calculateScore("FULL_HOUSE", new int[]{6, 6, 6, 6, 2})).isEqualTo(0); // 4+1 → 0
    }

    @Test
    @DisplayName("LITTLE_STRAIGHT: 어느 4개 연속이든 → 15점 (로컬 룰)")
    void littleStraight() {
        // 4개 연속만 있으면 인정 (1-2-3-4 / 2-3-4-5 / 3-4-5-6)
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 4, 1})).isEqualTo(15);
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{2, 3, 4, 5, 5})).isEqualTo(15);
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{3, 4, 5, 6, 6})).isEqualTo(15);
        // 5개 연속은 4개 연속 부분집합도 포함 → 인정 (Big Straight와 동시 만족 가능, 기록은 유저 선택)
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 4, 5})).isEqualTo(15);
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{2, 3, 4, 5, 6})).isEqualTo(15);
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{6, 5, 4, 3, 1})).isEqualTo(15); // 순서 무관 (3-4-5-6 포함)
        // 4개 연속 미달
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 5, 6})).isEqualTo(0); // 끊김
        assertThat(YachtGameService.calculateScore("LITTLE_STRAIGHT", new int[]{1, 1, 2, 2, 3})).isEqualTo(0); // 중복으로 4연속 미달
    }

    @Test
    @DisplayName("BIG_STRAIGHT: 어느 5개 연속이든 → 30점 (로컬 룰)")
    void bigStraight() {
        assertThat(YachtGameService.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 5})).isEqualTo(30);
        assertThat(YachtGameService.calculateScore("BIG_STRAIGHT", new int[]{2, 3, 4, 5, 6})).isEqualTo(30);
        assertThat(YachtGameService.calculateScore("BIG_STRAIGHT", new int[]{6, 5, 4, 3, 2})).isEqualTo(30); // 순서 무관
        assertThat(YachtGameService.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 6})).isEqualTo(0); // 끊김
        assertThat(YachtGameService.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 4})).isEqualTo(0); // 중복
    }

    @Test
    @DisplayName("YACHT: 5개 동일 → 50")
    void yacht() {
        assertThat(YachtGameService.calculateScore("YACHT", new int[]{3, 3, 3, 3, 3})).isEqualTo(50);
        assertThat(YachtGameService.calculateScore("YACHT", new int[]{6, 6, 6, 6, 6})).isEqualTo(50);
        assertThat(YachtGameService.calculateScore("YACHT", new int[]{1, 1, 1, 1, 2})).isEqualTo(0);
        assertThat(YachtGameService.calculateScore("YACHT", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
    }

    // ─── 경계값 / 교차 케이스 ─────────────────────────────────────────────────

    @Test
    @DisplayName("FOUR_OF_A_KIND vs YACHT — 모든 5개 동일 시 4개 합 반환")
    void fourOfAKindYachtEdge() {
        // [4,4,4,4,4]: FOUR_OF_A_KIND=16, YACHT=50
        assertThat(YachtGameService.calculateScore("FOUR_OF_A_KIND", new int[]{4, 4, 4, 4, 4})).isEqualTo(16);
        assertThat(YachtGameService.calculateScore("YACHT",          new int[]{4, 4, 4, 4, 4})).isEqualTo(50);
    }

    @Test
    @DisplayName("FULL_HOUSE — [2,2,3,3,3] 정상 케이스")
    void fullHouseNormal() {
        assertThat(YachtGameService.calculateScore("FULL_HOUSE", new int[]{2, 2, 3, 3, 3})).isEqualTo(13);
    }

    @Test
    @DisplayName("FULL_HOUSE — [2,2,2,3,3] 정상 케이스")
    void fullHouseNormal2() {
        assertThat(YachtGameService.calculateScore("FULL_HOUSE", new int[]{2, 2, 2, 3, 3})).isEqualTo(12);
    }
}
