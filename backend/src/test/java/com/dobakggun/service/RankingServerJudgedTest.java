package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.entity.GameSession;
import com.dobakggun.entity.MinesweeperRanking;
import com.dobakggun.entity.SolitaireRanking;
import com.dobakggun.entity.SudokuRanking;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.repository.*;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 서버 판정 세션의 랭킹 제출과 구버전 세션 호환을 확인한다. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RankingServerJudgedTest {

    private final GameSessionRepository sessionRepo = mock(GameSessionRepository.class);
    private final MinesweeperRankingRepository minesweeperRepo = mock(MinesweeperRankingRepository.class);
    private final SudokuRankingRepository sudokuRepo = mock(SudokuRankingRepository.class);
    private final SolitaireRankingRepository solitaireRepo = mock(SolitaireRankingRepository.class);
    private final SessionService sessionService = mock(SessionService.class);
    private final IpHashUtil ipHashUtil = mock(IpHashUtil.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final MockHttpServletRequest http = new MockHttpServletRequest();
    private RankingService service;

    @BeforeEach
    void setUp() {
        when(ipHashUtil.hash(any())).thenReturn("hash");
        when(minesweeperRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(sudokuRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(solitaireRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new RankingService(
            minesweeperRepo, mock(BaseballRankingRepository.class), mock(BlockfallRankingRepository.class),
            mock(BlockfallInsaneRankingRepository.class), solitaireRepo, mock(AppleRankingRepository.class),
            sudokuRepo, mock(BrickBreakerRankingRepository.class), mock(BlockCrushRankingRepository.class),
            sessionService, new PlaySessionSupport(sessionRepo, ipHashUtil, mapper),
            mock(BaseballSessionService.class), new SolitaireMoveService(sessionRepo, mapper),
            mock(AppleValidationService.class), mock(BlockfallValidationService.class),
            mock(BlockCrushValidationService.class), ipHashUtil);
    }

    private GameSession session(String game, String level, String extra, long ageSeconds) {
        GameSession session = GameSession.builder().sessionId("s").game(game).level(level).ipHash("hash")
            .startedAt(Instant.now().minusSeconds(ageSeconds)).extra(extra).build();
        when(sessionRepo.findById("s")).thenReturn(Optional.of(session));
        when(sessionService.validateAndConsume(eq("s"), eq(game), any())).thenReturn(session);
        return session;
    }

    private RankingRequest request(String level, Double time) {
        RankingRequest req = new RankingRequest();
        req.setLevel(level);
        req.setName("name");
        req.setTime(time);
        req.setSessionId("s");
        return req;
    }

    @Test
    void 지뢰찾기_클리어_세션은_클라이언트_time을_무시하고_서버_시간을_저장한다() {
        session("minesweeper", "beginner", "{\"protocol\":2,\"status\":\"WON\",\"clearTimeMs\":12345}", 100);

        service.submit("minesweeper", request("beginner", 0.5), http);

        ArgumentCaptor<MinesweeperRanking> saved = ArgumentCaptor.forClass(MinesweeperRanking.class);
        verify(minesweeperRepo).save(saved.capture());
        assertThat(saved.getValue().getTime()).isEqualTo(12.345);
    }

    @Test
    void 서버가_잰_시간은_클라이언트_시간_범위_검사를_받지_않는다() {
        session("minesweeper", "beginner", "{\"protocol\":2,\"status\":\"WON\",\"clearTimeMs\":3700000}", 4000);

        service.submit("minesweeper", request("beginner", null), http);

        ArgumentCaptor<MinesweeperRanking> saved = ArgumentCaptor.forClass(MinesweeperRanking.class);
        verify(minesweeperRepo).save(saved.capture());
        assertThat(saved.getValue().getTime()).isEqualTo(3700.0);
    }

    @Test
    void 서버_시간이_하한보다_짧으면_소모하지_않고_거부한다() {
        session("sudoku", "easy", "{\"cleared\":true,\"clearTimeMs\":50}", 300);

        ResponseStatusException e = catchThrowableOfType(
            () -> service.submit("sudoku", request("easy", 100.0), http), ResponseStatusException.class);

        assertThat(e.getStatusCode().value()).isEqualTo(400);
        verify(sessionService, never()).validateAndConsume(any(), any(), any());
    }

    @Test
    void 프로토콜2_미클리어_세션은_소모하지_않고_거부한다() {
        session("minesweeper", "beginner", "{\"protocol\":2,\"status\":\"LOST\"}", 100);

        GamePlayException e = catchThrowableOfType(
            () -> service.submit("minesweeper", request("beginner", 10.0), http), GamePlayException.class);

        assertThat(e.getErrorCode()).isEqualTo(GamePlayErrorCode.SESSION_NOT_CLEARED);
        verify(sessionService, never()).validateAndConsume(any(), any(), any());
    }

    @Test
    void 클리어한_레벨과_다른_레벨로는_제출할_수_없다() {
        session("minesweeper", "beginner", "{\"protocol\":2,\"status\":\"WON\",\"clearTimeMs\":12345}", 100);

        GamePlayException e = catchThrowableOfType(
            () -> service.submit("minesweeper", request("expert", 10.0), http), GamePlayException.class);

        assertThat(e.getErrorCode()).isEqualTo(GamePlayErrorCode.SESSION_INVALID);
        verify(sessionService, never()).validateAndConsume(any(), any(), any());
    }

    @Test
    void 구버전_지뢰찾기_세션은_기존처럼_클라이언트_time을_쓴다() {
        session("minesweeper", "beginner", "{\"rows\":9,\"cols\":9,\"minePositions\":[]}", 100);

        service.submit("minesweeper", request("beginner", 42.5), http);

        ArgumentCaptor<MinesweeperRanking> saved = ArgumentCaptor.forClass(MinesweeperRanking.class);
        verify(minesweeperRepo).save(saved.capture());
        assertThat(saved.getValue().getTime()).isEqualTo(42.5);
    }

    @Test
    void 스도쿠_클리어_세션은_서버_시간을_저장한다() {
        session("sudoku", "easy", "{\"cleared\":true,\"clearTimeMs\":90500}", 300);

        service.submit("sudoku", request("easy", 5.0), http);

        ArgumentCaptor<SudokuRanking> saved = ArgumentCaptor.forClass(SudokuRanking.class);
        verify(sudokuRepo).save(saved.capture());
        assertThat(saved.getValue().getClearTime()).isEqualTo(90);
    }

    @Test
    void 구버전_스도쿠_세션은_기존_규칙을_유지한다() {
        session("sudoku", "easy", "{\"solution\":[]}", 300);

        service.submit("sudoku", request("easy", 200.0), http);

        ArgumentCaptor<SudokuRanking> saved = ArgumentCaptor.forClass(SudokuRanking.class);
        verify(sudokuRepo).save(saved.capture());
        assertThat(saved.getValue().getClearTime()).isEqualTo(200);
    }

    @Test
    void 솔리테어_time이_세션_경과시간을_넘으면_거부한다() {
        session("solitaire", "draw1", "{}", 100);
        RankingRequest req = request("draw1", 500.0);
        req.setMoves(100);

        ResponseStatusException e = catchThrowableOfType(
            () -> service.submit("solitaire", req, http), ResponseStatusException.class);

        assertThat(e.getStatusCode().value()).isEqualTo(400);
        verify(solitaireRepo, never()).save(any());
    }

    @Test
    void 솔리테어_정상_time은_그대로_저장한다() {
        session("solitaire", "draw1", "{}", 100);
        RankingRequest req = request("draw1", 95.0);
        req.setMoves(100);

        service.submit("solitaire", req, http);

        ArgumentCaptor<SolitaireRanking> saved = ArgumentCaptor.forClass(SolitaireRanking.class);
        verify(solitaireRepo).save(saved.capture());
        assertThat(saved.getValue().getTime()).isEqualTo(95.0);
    }
}
