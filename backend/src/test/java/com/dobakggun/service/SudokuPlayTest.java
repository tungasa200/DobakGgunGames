package com.dobakggun.service;

import com.dobakggun.dto.SudokuCompleteRequest;
import com.dobakggun.dto.SudokuCompleteResponse;
import com.dobakggun.dto.SudokuHintRequest;
import com.dobakggun.dto.SudokuHintResponse;
import com.dobakggun.entity.GameSession;
import com.dobakggun.entity.GameSession.SessionState;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SudokuPlayTest {

    private static final int[][] SOLUTION = {
        {1, 2, 3, 4, 5, 6, 7, 8, 9}, {4, 5, 6, 7, 8, 9, 1, 2, 3}, {7, 8, 9, 1, 2, 3, 4, 5, 6},
        {2, 3, 4, 5, 6, 7, 8, 9, 1}, {5, 6, 7, 8, 9, 1, 2, 3, 4}, {8, 9, 1, 2, 3, 4, 5, 6, 7},
        {3, 4, 5, 6, 7, 8, 9, 1, 2}, {6, 7, 8, 9, 1, 2, 3, 4, 5}, {9, 1, 2, 3, 4, 5, 6, 7, 8},
    };

    private final ObjectMapper mapper = new ObjectMapper();
    private final GameSessionRepository repo = mock(GameSessionRepository.class);
    private final IpHashUtil ipHashUtil = mock(IpHashUtil.class);
    private final MockHttpServletRequest http = new MockHttpServletRequest();
    private SudokuService service;
    private GameSession stored;

    @BeforeEach
    void setUp() throws Exception {
        when(ipHashUtil.hash(any())).thenReturn("hash");
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(repo.findByIdForUpdate(anyString())).thenAnswer(inv -> Optional.ofNullable(stored));
        service = new SudokuService(repo, ipHashUtil, mapper, new PlaySessionSupport(repo, ipHashUtil, mapper));
        stored = GameSession.builder().sessionId("s").game("sudoku").level("easy")
            .ipHash("hash").startedAt(Instant.now().minusSeconds(60))
            .extra(mapper.writeValueAsString(Map.of("solution", SOLUTION))).build();
    }

    private SudokuHintRequest hintAt(int row, int col) {
        SudokuHintRequest req = new SudokuHintRequest();
        req.setRow(row);
        req.setCol(col);
        return req;
    }

    private SudokuCompleteRequest board(int[][] board) {
        SudokuCompleteRequest req = new SudokuCompleteRequest();
        req.setBoard(board);
        return req;
    }

    private GamePlayErrorCode errorOf(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        return org.assertj.core.api.Assertions.catchThrowableOfType(call, GamePlayException.class).getErrorCode();
    }

    @Test
    void 힌트는_정답을_주고_3회까지만_허용한다() {
        SudokuHintResponse first = service.hint("s", hintAt(0, 8), http);
        assertThat(first.value()).isEqualTo(9);
        assertThat(first.hintsLeft()).isEqualTo(2);

        service.hint("s", hintAt(1, 0), http);
        assertThat(service.hint("s", hintAt(2, 0), http).hintsLeft()).isZero();

        assertThat(errorOf(() -> service.hint("s", hintAt(3, 0), http)))
            .isEqualTo(GamePlayErrorCode.HINT_EXHAUSTED);
    }

    @Test
    void 힌트_좌표가_범위_밖이면_거부하고_횟수를_쓰지_않는다() {
        assertThat(errorOf(() -> service.hint("s", hintAt(9, 0), http))).isEqualTo(GamePlayErrorCode.INVALID_CELL);
        assertThat(service.hint("s", hintAt(0, 0), http).hintsLeft()).isEqualTo(2);
    }

    @Test
    void 정답_판이면_서버_시간으로_클리어하고_재호출은_처음_값을_준다() {
        SudokuCompleteResponse first = service.complete("s", board(SOLUTION), http);
        assertThat(first.cleared()).isTrue();
        assertThat(first.clearTimeMs()).isBetween(59_000L, 70_000L);

        stored.setStartedAt(Instant.now().minusSeconds(500));
        assertThat(service.complete("s", board(SOLUTION), http).clearTimeMs()).isEqualTo(first.clearTimeMs());
    }

    @Test
    void 오답_판은_422_형식이_틀린_판은_400이다() {
        int[][] wrong = new int[9][];
        for (int i = 0; i < 9; i++) wrong[i] = SOLUTION[i].clone();
        wrong[0][0] = 2;

        assertThat(errorOf(() -> service.complete("s", board(wrong), http)))
            .isEqualTo(GamePlayErrorCode.BOARD_INCORRECT);
        assertThat(errorOf(() -> service.complete("s", board(new int[8][9]), http)))
            .isEqualTo(GamePlayErrorCode.INVALID_CELL);
        assertThat(errorOf(() -> service.complete("s", board(new int[9][8]), http)))
            .isEqualTo(GamePlayErrorCode.INVALID_CELL);
    }

    @Test
    void 클리어와_제출_뒤에는_힌트를_쓸_수_없다() {
        service.complete("s", board(SOLUTION), http);
        assertThat(errorOf(() -> service.hint("s", hintAt(0, 0), http))).isEqualTo(GamePlayErrorCode.GAME_ENDED);

        stored.setState(SessionState.SUBMITTED);
        assertThat(errorOf(() -> service.hint("s", hintAt(0, 0), http))).isEqualTo(GamePlayErrorCode.GAME_ENDED);
    }

    @Test
    void 다른_게임의_세션은_거부한다() {
        stored.setGame("minesweeper");
        assertThatThrownBy(() -> service.complete("s", board(SOLUTION), http))
            .isInstanceOf(GamePlayException.class);
        assertThat(errorOf(() -> service.complete("s", board(SOLUTION), http)))
            .isEqualTo(GamePlayErrorCode.SESSION_INVALID);
    }
}
