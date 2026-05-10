package com.dobakggun.service;

import com.dobakggun.service.yacht.D6Rules;
import com.dobakggun.service.yacht.D8Rules;
import com.dobakggun.service.yacht.YachtScoreRules;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Yacht 점수 계산 단위 테스트.
 * D6Rules (PRD §5.6 기존 룰) + D8Rules (PRD yacht-d8-mode-prd.md §5) 검증.
 */
@DisplayName("Yacht 점수 계산 테스트")
class YachtScoreCalculatorTest {

    private static final YachtScoreRules D6 = new D6Rules();
    private static final YachtScoreRules D8 = new D8Rules();

    // ─── D6 룰셋 테스트 ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("D6 — 상단 족보")
    class D6Upper {

        @Test
        @DisplayName("ONES: 1 눈 총합")
        void ones() {
            assertThat(D6.calculateScore("ONES", new int[]{1, 1, 2, 3, 1})).isEqualTo(3);
            assertThat(D6.calculateScore("ONES", new int[]{2, 3, 4, 5, 6})).isEqualTo(0);
            assertThat(D6.calculateScore("ONES", new int[]{1, 1, 1, 1, 1})).isEqualTo(5);
        }

        @Test
        @DisplayName("TWOS: 2 눈 총합")
        void twos() {
            assertThat(D6.calculateScore("TWOS", new int[]{2, 2, 2, 3, 4})).isEqualTo(6);
            assertThat(D6.calculateScore("TWOS", new int[]{1, 3, 4, 5, 6})).isEqualTo(0);
        }

        @Test
        @DisplayName("THREES: 3 눈 총합")
        void threes() {
            assertThat(D6.calculateScore("THREES", new int[]{3, 3, 3, 1, 2})).isEqualTo(9);
        }

        @Test
        @DisplayName("FOURS: 4 눈 총합")
        void fours() {
            assertThat(D6.calculateScore("FOURS", new int[]{4, 4, 4, 4, 4})).isEqualTo(20);
        }

        @Test
        @DisplayName("FIVES: 5 눈 총합")
        void fives() {
            assertThat(D6.calculateScore("FIVES", new int[]{5, 5, 1, 2, 3})).isEqualTo(10);
        }

        @Test
        @DisplayName("SIXES: 6 눈 총합")
        void sixes() {
            assertThat(D6.calculateScore("SIXES", new int[]{6, 6, 6, 6, 6})).isEqualTo(30);
            assertThat(D6.calculateScore("SIXES", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("D6 — 하단 족보")
    class D6Lower {

        @Test
        @DisplayName("CHOICE: 5개 총합")
        void choice() {
            assertThat(D6.calculateScore("CHOICE", new int[]{1, 2, 3, 4, 5})).isEqualTo(15);
            assertThat(D6.calculateScore("CHOICE", new int[]{6, 6, 6, 6, 6})).isEqualTo(30);
        }

        @Test
        @DisplayName("FOUR_OF_A_KIND: 4개 이상 동일 → 그 눈×4")
        void fourOfAKind() {
            assertThat(D6.calculateScore("FOUR_OF_A_KIND", new int[]{6, 6, 6, 6, 2})).isEqualTo(24);
            assertThat(D6.calculateScore("FOUR_OF_A_KIND", new int[]{5, 5, 5, 5, 5})).isEqualTo(20); // Yacht도 인정
            assertThat(D6.calculateScore("FOUR_OF_A_KIND", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
            assertThat(D6.calculateScore("FOUR_OF_A_KIND", new int[]{3, 3, 3, 1, 2})).isEqualTo(0); // 3개는 불가
        }

        @Test
        @DisplayName("FULL_HOUSE: 3+2 조합 → 총합. Yacht는 0.")
        void fullHouse() {
            assertThat(D6.calculateScore("FULL_HOUSE", new int[]{3, 3, 3, 2, 2})).isEqualTo(13);
            assertThat(D6.calculateScore("FULL_HOUSE", new int[]{5, 5, 5, 5, 5})).isEqualTo(0); // Yacht → 0
            assertThat(D6.calculateScore("FULL_HOUSE", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
            assertThat(D6.calculateScore("FULL_HOUSE", new int[]{6, 6, 6, 6, 2})).isEqualTo(0); // 4+1 → 0
        }

        @Test
        @DisplayName("LITTLE_STRAIGHT: 어느 4개 연속이든 → 15점 (D6 룰)")
        void littleStraight() {
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 4, 1})).isEqualTo(15);
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{2, 3, 4, 5, 5})).isEqualTo(15);
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{3, 4, 5, 6, 6})).isEqualTo(15);
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 4, 5})).isEqualTo(15);
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{2, 3, 4, 5, 6})).isEqualTo(15);
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{6, 5, 4, 3, 1})).isEqualTo(15); // 순서 무관
            // 4개 연속 미달
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 5, 6})).isEqualTo(0);
            assertThat(D6.calculateScore("LITTLE_STRAIGHT", new int[]{1, 1, 2, 2, 3})).isEqualTo(0);
        }

        @Test
        @DisplayName("BIG_STRAIGHT: 어느 5개 연속이든 → 30점 (D6 룰)")
        void bigStraight() {
            assertThat(D6.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 5})).isEqualTo(30);
            assertThat(D6.calculateScore("BIG_STRAIGHT", new int[]{2, 3, 4, 5, 6})).isEqualTo(30);
            assertThat(D6.calculateScore("BIG_STRAIGHT", new int[]{6, 5, 4, 3, 2})).isEqualTo(30); // 순서 무관
            assertThat(D6.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 6})).isEqualTo(0); // 끊김
            assertThat(D6.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 4})).isEqualTo(0); // 중복
        }

        @Test
        @DisplayName("YACHT: 5개 동일 → 50")
        void yacht() {
            assertThat(D6.calculateScore("YACHT", new int[]{3, 3, 3, 3, 3})).isEqualTo(50);
            assertThat(D6.calculateScore("YACHT", new int[]{6, 6, 6, 6, 6})).isEqualTo(50);
            assertThat(D6.calculateScore("YACHT", new int[]{1, 1, 1, 1, 2})).isEqualTo(0);
            assertThat(D6.calculateScore("YACHT", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("D6 — 경계값 / 교차 케이스")
    class D6Edge {

        @Test
        @DisplayName("FOUR_OF_A_KIND vs YACHT — 모든 5개 동일 시 4개 합 반환")
        void fourOfAKindYachtEdge() {
            assertThat(D6.calculateScore("FOUR_OF_A_KIND", new int[]{4, 4, 4, 4, 4})).isEqualTo(16);
            assertThat(D6.calculateScore("YACHT",          new int[]{4, 4, 4, 4, 4})).isEqualTo(50);
        }

        @Test
        @DisplayName("FULL_HOUSE — [2,2,3,3,3] 정상 케이스")
        void fullHouseNormal() {
            assertThat(D6.calculateScore("FULL_HOUSE", new int[]{2, 2, 3, 3, 3})).isEqualTo(13);
        }

        @Test
        @DisplayName("FULL_HOUSE — [2,2,2,3,3] 정상 케이스")
        void fullHouseNormal2() {
            assertThat(D6.calculateScore("FULL_HOUSE", new int[]{2, 2, 2, 3, 3})).isEqualTo(12);
        }
    }

    // ─── D8 룰셋 테스트 ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("D8 — 상단 족보 (ONES~EIGHTS)")
    class D8Upper {

        @Test
        @DisplayName("SEVENS: 7 눈 총합")
        void sevens() {
            assertThat(D8.calculateScore("SEVENS", new int[]{7, 7, 1, 2, 3})).isEqualTo(14);
            assertThat(D8.calculateScore("SEVENS", new int[]{7, 7, 7, 7, 7})).isEqualTo(35);
            assertThat(D8.calculateScore("SEVENS", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
        }

        @Test
        @DisplayName("EIGHTS: 8 눈 총합")
        void eights() {
            assertThat(D8.calculateScore("EIGHTS", new int[]{8, 8, 8, 1, 2})).isEqualTo(24);
            assertThat(D8.calculateScore("EIGHTS", new int[]{8, 8, 8, 8, 8})).isEqualTo(40);
            assertThat(D8.calculateScore("EIGHTS", new int[]{1, 2, 3, 4, 5})).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("D8 — 하단 족보")
    class D8Lower {

        @Test
        @DisplayName("CHOICE: D8 face 범위 (최대 40)")
        void choice() {
            assertThat(D8.calculateScore("CHOICE", new int[]{8, 8, 8, 8, 8})).isEqualTo(40);
            assertThat(D8.calculateScore("CHOICE", new int[]{1, 2, 3, 4, 5})).isEqualTo(15);
        }

        @Test
        @DisplayName("FOUR_OF_A_KIND: D8 face 8 (최대 32)")
        void fourOfAKind() {
            assertThat(D8.calculateScore("FOUR_OF_A_KIND", new int[]{8, 8, 8, 8, 1})).isEqualTo(32);
            assertThat(D8.calculateScore("FOUR_OF_A_KIND", new int[]{8, 8, 8, 8, 8})).isEqualTo(32); // 5개 동일도 ×4
            assertThat(D8.calculateScore("FOUR_OF_A_KIND", new int[]{7, 7, 7, 1, 2})).isEqualTo(0);  // 3개는 0
        }

        @Test
        @DisplayName("LITTLE_STRAIGHT: D8 추가 셋 {4,5,6,7} {5,6,7,8}")
        void littleStraightD8() {
            // D6 기존 셋도 동작
            assertThat(D8.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 4, 8})).isEqualTo(15);
            assertThat(D8.calculateScore("LITTLE_STRAIGHT", new int[]{2, 3, 4, 5, 8})).isEqualTo(15);
            assertThat(D8.calculateScore("LITTLE_STRAIGHT", new int[]{3, 4, 5, 6, 1})).isEqualTo(15);
            // D8 추가 셋
            assertThat(D8.calculateScore("LITTLE_STRAIGHT", new int[]{4, 5, 6, 7, 1})).isEqualTo(15);
            assertThat(D8.calculateScore("LITTLE_STRAIGHT", new int[]{5, 6, 7, 8, 1})).isEqualTo(15);
            // 불일치
            assertThat(D8.calculateScore("LITTLE_STRAIGHT", new int[]{1, 2, 3, 5, 8})).isEqualTo(0);
        }

        @Test
        @DisplayName("BIG_STRAIGHT: D8 추가 셋 {3,4,5,6,7} {4,5,6,7,8}")
        void bigStraightD8() {
            // D6 기존 셋도 동작
            assertThat(D8.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 5})).isEqualTo(30);
            assertThat(D8.calculateScore("BIG_STRAIGHT", new int[]{2, 3, 4, 5, 6})).isEqualTo(30);
            // D8 추가 셋
            assertThat(D8.calculateScore("BIG_STRAIGHT", new int[]{3, 4, 5, 6, 7})).isEqualTo(30);
            assertThat(D8.calculateScore("BIG_STRAIGHT", new int[]{4, 5, 6, 7, 8})).isEqualTo(30);
            // 순서 무관
            assertThat(D8.calculateScore("BIG_STRAIGHT", new int[]{8, 7, 6, 5, 4})).isEqualTo(30);
            // 불일치
            assertThat(D8.calculateScore("BIG_STRAIGHT", new int[]{1, 2, 3, 4, 6})).isEqualTo(0);
            assertThat(D8.calculateScore("BIG_STRAIGHT", new int[]{1, 3, 5, 7, 8})).isEqualTo(0);
        }

        @Test
        @DisplayName("YACHT: D8 — 5개 동일 → 50")
        void yacht() {
            assertThat(D8.calculateScore("YACHT", new int[]{8, 8, 8, 8, 8})).isEqualTo(50);
            assertThat(D8.calculateScore("YACHT", new int[]{7, 7, 7, 7, 7})).isEqualTo(50);
            assertThat(D8.calculateScore("YACHT", new int[]{8, 8, 8, 8, 7})).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("D8 — 룰셋 메타 검증")
    class D8Meta {

        @Test
        @DisplayName("D8 총 족보 수 = 14")
        void totalScoreKeys() {
            assertThat(D8.totalScoreKeys()).isEqualTo(14);
            assertThat(D8.validScoreKeys()).hasSize(14);
        }

        @Test
        @DisplayName("D8 상단 족보 = 8개")
        void upperKeys() {
            assertThat(D8.upperKeys()).hasSize(8);
            assertThat(D8.upperKeys()).contains("SEVENS", "EIGHTS");
        }

        @Test
        @DisplayName("D8 상단 보너스 임계 = 84")
        void upperBonusThreshold() {
            assertThat(D8.upperBonusThreshold()).isEqualTo(84);
        }

        @Test
        @DisplayName("D8 주사위 면 수 = 8")
        void rngFaces() {
            assertThat(D8.rngFaces()).isEqualTo(8);
        }

        @Test
        @DisplayName("D6 총 족보 수 = 12")
        void d6TotalScoreKeys() {
            assertThat(D6.totalScoreKeys()).isEqualTo(12);
        }

        @Test
        @DisplayName("D6 상단 보너스 임계 = 63")
        void d6UpperBonusThreshold() {
            assertThat(D6.upperBonusThreshold()).isEqualTo(63);
        }
    }
}
