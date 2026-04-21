package com.dobakggun.service;

import com.dobakggun.entity.RspChoice;
import com.dobakggun.entity.RspResult;
import com.dobakggun.repository.AdminRspPlayRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AdminRspService 판정 로직 단위 테스트.
 * DB 연결 없이 순수 로직만 검증.
 */
class AdminRspServiceTest {

    @Mock
    private AdminRspPlayRepository adminRspPlayRepository;

    private AdminRspService sut;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        sut = new AdminRspService(adminRspPlayRepository);
    }

    // ─── 동일 선택 = DRAW ─────────────────────────────────────────────────────

    @Test
    @DisplayName("ROCK vs ROCK = DRAW")
    void rockVsRock_isDraw() {
        assertThat(sut.judge(RspChoice.ROCK, RspChoice.ROCK)).isEqualTo(RspResult.DRAW);
    }

    @Test
    @DisplayName("SCISSORS vs SCISSORS = DRAW")
    void scissorsVsScissors_isDraw() {
        assertThat(sut.judge(RspChoice.SCISSORS, RspChoice.SCISSORS)).isEqualTo(RspResult.DRAW);
    }

    @Test
    @DisplayName("PAPER vs PAPER = DRAW")
    void paperVsPaper_isDraw() {
        assertThat(sut.judge(RspChoice.PAPER, RspChoice.PAPER)).isEqualTo(RspResult.DRAW);
    }

    // ─── WIN 케이스 ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("ROCK vs SCISSORS = WIN (바위가 가위를 이김)")
    void rockVsScissors_isWin() {
        assertThat(sut.judge(RspChoice.ROCK, RspChoice.SCISSORS)).isEqualTo(RspResult.WIN);
    }

    @Test
    @DisplayName("SCISSORS vs PAPER = WIN (가위가 보를 이김)")
    void scissorsVsPaper_isWin() {
        assertThat(sut.judge(RspChoice.SCISSORS, RspChoice.PAPER)).isEqualTo(RspResult.WIN);
    }

    @Test
    @DisplayName("PAPER vs ROCK = WIN (보가 바위를 이김)")
    void paperVsRock_isWin() {
        assertThat(sut.judge(RspChoice.PAPER, RspChoice.ROCK)).isEqualTo(RspResult.WIN);
    }

    // ─── LOSS 케이스 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("ROCK vs PAPER = LOSS (바위가 보에게 짐)")
    void rockVsPaper_isLoss() {
        assertThat(sut.judge(RspChoice.ROCK, RspChoice.PAPER)).isEqualTo(RspResult.LOSS);
    }

    @Test
    @DisplayName("SCISSORS vs ROCK = LOSS (가위가 바위에게 짐)")
    void scissorsVsRock_isLoss() {
        assertThat(sut.judge(RspChoice.SCISSORS, RspChoice.ROCK)).isEqualTo(RspResult.LOSS);
    }

    @Test
    @DisplayName("PAPER vs SCISSORS = LOSS (보가 가위에게 짐)")
    void paperVsScissors_isLoss() {
        assertThat(sut.judge(RspChoice.PAPER, RspChoice.SCISSORS)).isEqualTo(RspResult.LOSS);
    }

    // ─── 파라미터화 테스트 (전체 9가지 조합) ─────────────────────────────────

    @ParameterizedTest(name = "user={0}, computer={1} => {2}")
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
    @DisplayName("전체 판정 테이블 검증 (9가지 조합)")
    void allCombinations(String user, String computer, String expected) {
        RspChoice userChoice = RspChoice.valueOf(user.trim());
        RspChoice computerChoice = RspChoice.valueOf(computer.trim());
        RspResult expectedResult = RspResult.valueOf(expected.trim());

        assertThat(sut.judge(userChoice, computerChoice)).isEqualTo(expectedResult);
    }
}
