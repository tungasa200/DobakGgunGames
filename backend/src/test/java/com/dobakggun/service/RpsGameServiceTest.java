package com.dobakggun.service;

import com.dobakggun.entity.rps.RpsChoice;
import com.dobakggun.entity.rps.RpsResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * RpsGameService 판정 로직 단위 테스트.
 * DB/Redis 연결 없이 순수 로직만 검증.
 */
class RpsGameServiceTest {

    private RpsGameService sut;

    @BeforeEach
    void setUp() {
        sut = new RpsGameService();
    }

    // ─── 1인 선택 (전원 DRAW) ─────────────────────────────────────────────────

    @Test
    @DisplayName("전원 ROCK → 전원 DRAW (kinds=1)")
    void allRock_isDraw() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.ROCK,
                2L, RpsChoice.ROCK,
                3L, RpsChoice.ROCK
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results).allSatisfy((id, r) -> assertThat(r).isEqualTo(RpsResult.DRAW));
    }

    @Test
    @DisplayName("전원 SCISSORS → 전원 DRAW (kinds=1)")
    void allScissors_isDraw() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.SCISSORS,
                2L, RpsChoice.SCISSORS
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results).allSatisfy((id, r) -> assertThat(r).isEqualTo(RpsResult.DRAW));
    }

    // ─── 3종 선택 (상성 루프 → 전원 DRAW) ───────────────────────────────────

    @Test
    @DisplayName("ROCK/PAPER/SCISSORS 모두 나옴 → 전원 DRAW (kinds=3)")
    void allThreeKinds_isDraw() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.ROCK,
                2L, RpsChoice.PAPER,
                3L, RpsChoice.SCISSORS
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results).allSatisfy((id, r) -> assertThat(r).isEqualTo(RpsResult.DRAW));
    }

    @Test
    @DisplayName("4인 ROCK/ROCK/PAPER/SCISSORS → 전원 DRAW")
    void fourPlayers_allThree_isDraw() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.ROCK,
                2L, RpsChoice.ROCK,
                3L, RpsChoice.PAPER,
                4L, RpsChoice.SCISSORS
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results).allSatisfy((id, r) -> assertThat(r).isEqualTo(RpsResult.DRAW));
    }

    // ─── 2종 선택 (WIN/LOSS 판정) ─────────────────────────────────────────────

    @Test
    @DisplayName("ROCK vs SCISSORS: ROCK=WIN, SCISSORS=LOSS")
    void rockBeatsScissors() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.ROCK,
                2L, RpsChoice.SCISSORS
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results.get(1L)).isEqualTo(RpsResult.WIN);
        assertThat(results.get(2L)).isEqualTo(RpsResult.LOSS);
    }

    @Test
    @DisplayName("SCISSORS vs PAPER: SCISSORS=WIN, PAPER=LOSS")
    void scissorsBeatsPaper() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.SCISSORS,
                2L, RpsChoice.PAPER
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results.get(1L)).isEqualTo(RpsResult.WIN);
        assertThat(results.get(2L)).isEqualTo(RpsResult.LOSS);
    }

    @Test
    @DisplayName("PAPER vs ROCK: PAPER=WIN, ROCK=LOSS")
    void paperBeatsRock() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.PAPER,
                2L, RpsChoice.ROCK
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results.get(1L)).isEqualTo(RpsResult.WIN);
        assertThat(results.get(2L)).isEqualTo(RpsResult.LOSS);
    }

    @Test
    @DisplayName("4인 ROCK×2 / SCISSORS×2: ROCK 2명 WIN, SCISSORS 2명 LOSS")
    void fourPlayers_rockAndScissors() {
        Map<Long, RpsChoice> choices = Map.of(
                1L, RpsChoice.ROCK,
                2L, RpsChoice.ROCK,
                3L, RpsChoice.SCISSORS,
                4L, RpsChoice.SCISSORS
        );
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results.get(1L)).isEqualTo(RpsResult.WIN);
        assertThat(results.get(2L)).isEqualTo(RpsResult.WIN);
        assertThat(results.get(3L)).isEqualTo(RpsResult.LOSS);
        assertThat(results.get(4L)).isEqualTo(RpsResult.LOSS);
    }

    // ─── 1:1 judgeOne 헬퍼 ───────────────────────────────────────────────────

    @ParameterizedTest(name = "user={0} vs opp={1} => {2}")
    @CsvSource({
        "ROCK,     ROCK,     DRAW",
        "ROCK,     SCISSORS, WIN",
        "ROCK,     PAPER,    LOSS",
        "SCISSORS, ROCK,     LOSS",
        "SCISSORS, SCISSORS, DRAW",
        "SCISSORS, PAPER,    WIN",
        "PAPER,    ROCK,     WIN",
        "PAPER,    SCISSORS, LOSS",
        "PAPER,    PAPER,    DRAW",
    })
    @DisplayName("judgeOne 전체 9가지 조합")
    void judgeOne_allCombinations(String user, String opp, String expected) {
        RpsChoice u = RpsChoice.valueOf(user.trim());
        RpsChoice o = RpsChoice.valueOf(opp.trim());
        RpsResult exp = RpsResult.valueOf(expected.trim());
        assertThat(sut.judgeOne(u, o)).isEqualTo(exp);
    }

    // ─── 경계값 ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("choices 가 null이면 IllegalArgumentException")
    void nullChoices_throws() {
        assertThatThrownBy(() -> sut.judge(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("choices 가 비어 있으면 IllegalArgumentException")
    void emptyChoices_throws() {
        assertThatThrownBy(() -> sut.judge(Map.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("2인 — 1명만 선택 시 단일 선택자는 DRAW (kinds=1)")
    void singleChoice_isDraw() {
        Map<Long, RpsChoice> choices = Map.of(1L, RpsChoice.ROCK);
        Map<Long, RpsResult> results = sut.judge(choices);
        assertThat(results.get(1L)).isEqualTo(RpsResult.DRAW);
    }
}
