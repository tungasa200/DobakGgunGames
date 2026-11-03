package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.entity.GameSession;
import com.dobakggun.entity.GameSession.SessionState;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.repository.BlockfallRankingRepository;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.repository.MinesweeperRankingRepository;
import com.dobakggun.util.IpHashUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/** 랭킹 제출의 세션 소모와 기록 저장은 한 트랜잭션이다. 실제 커밋·롤백을 보려고 테스트 트랜잭션을 끈다. */
@DataJpaTest
@ImportAutoConfiguration(JacksonAutoConfiguration.class)
@Import({RankingService.class, SessionService.class, PlaySessionSupport.class, BaseballSessionService.class,
    SolitaireMoveService.class, AppleValidationService.class, BlockfallValidationService.class,
    BlockCrushValidationService.class, IpHashUtil.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RankingSubmitTransactionTest {

    private static final String SESSION_ID = "submit-session";
    private static final int THREADS = 8;
    private static final String CLEARED = "{\"protocol\":2,\"status\":\"WON\",\"clearTimeMs\":12345}";

    @Autowired private RankingService rankingService;
    @Autowired private GameSessionRepository sessionRepo;
    @Autowired private BlockfallRankingRepository blockfallRepo;
    @Autowired private MinesweeperRankingRepository minesweeperRepo;
    @Autowired private IpHashUtil ipHashUtil;

    private final MockHttpServletRequest http = new MockHttpServletRequest();

    @AfterEach
    void cleanUp() {
        sessionRepo.deleteAll();
        blockfallRepo.deleteAll();
        minesweeperRepo.deleteAll();
    }

    private void saveSession(String game, String level, String extra, long ageSeconds) {
        sessionRepo.save(GameSession.builder().sessionId(SESSION_ID).game(game).level(level)
            .ipHash(ipHashUtil.hash("127.0.0.1")).startedAt(Instant.now().minusSeconds(ageSeconds))
            .extra(extra).build());
    }

    private RankingRequest request(String level, String name) {
        RankingRequest req = new RankingRequest();
        req.setLevel(level);
        req.setName(name);
        req.setSessionId(SESSION_ID);
        return req;
    }

    private RankingRequest blockfallRequest(String name, int score) {
        RankingRequest req = request("easy", name);
        req.setScore(score);
        req.setLinesCleared(10);
        req.setGameLevel(1);
        return req;
    }

    private SessionState sessionState() {
        return sessionRepo.findById(SESSION_ID).orElseThrow().getState();
    }

    @Test
    void 저장에_실패하면_세션이_남아_다시_제출할_수_있다() {
        saveSession("blockfall", "easy", null, 100);

        // 이름 null은 검증을 지나 저장 단계에서 실패한다
        catchThrowableOfType(() -> rankingService.submit("blockfall", blockfallRequest(null, 100), http),
            NullPointerException.class);

        assertThat(sessionState()).isEqualTo(SessionState.ACTIVE);

        rankingService.submit("blockfall", blockfallRequest("name", 100), http);

        assertThat(sessionState()).isEqualTo(SessionState.SUBMITTED);
        assertThat(blockfallRepo.count()).isEqualTo(1);
    }

    @Test
    void 미클리어_거부는_세션을_남긴다() {
        saveSession("minesweeper", "beginner", "{\"protocol\":2,\"status\":\"PLAYING\"}", 100);

        GamePlayException e = catchThrowableOfType(
            () -> rankingService.submit("minesweeper", request("beginner", "name"), http), GamePlayException.class);

        assertThat(e.getErrorCode()).isEqualTo(GamePlayErrorCode.SESSION_NOT_CLEARED);
        assertThat(sessionState()).isEqualTo(SessionState.ACTIVE);
    }

    @Test
    void 위조_판정은_세션을_소모해_다시_낼_수_없다() {
        saveSession("blockfall", "easy", null, 100);

        ResponseStatusException forged = catchThrowableOfType(
            () -> rankingService.submit("blockfall", blockfallRequest("name", 9_000_000), http),
            ResponseStatusException.class);

        assertThat(forged.getStatusCode().value()).isEqualTo(400);
        assertThat(forged.getReason()).isEqualTo("점수가 유효 범위를 초과했습니다.");
        assertThat(sessionState()).isEqualTo(SessionState.SUBMITTED);

        ResponseStatusException retry = catchThrowableOfType(
            () -> rankingService.submit("blockfall", blockfallRequest("name", 100), http),
            ResponseStatusException.class);

        assertThat(retry.getReason()).isEqualTo("이미 사용되었거나 만료된 세션입니다.");
        assertThat(blockfallRepo.count()).isZero();
    }

    @Test
    void 좌표에_null이_있는_사과_이벤트는_위조로_판정한다() {
        saveSession("apple", "normal", "{\"board\":[[1,9]]}", 100);
        RankingRequest.AppleEvent event = new RankingRequest.AppleEvent();
        event.setT(1_000);
        event.setCells(List.of(Arrays.asList(null, 0), List.of(0, 1)));
        RankingRequest req = request("normal", "name");
        req.setScore(2);
        req.setEvents(List.of(event));

        ResponseStatusException e = catchThrowableOfType(
            () -> rankingService.submit("apple", req, http), ResponseStatusException.class);

        assertThat(e.getStatusCode().value()).isEqualTo(400);
        assertThat(sessionState()).isEqualTo(SessionState.SUBMITTED);
    }

    @Test
    void null_사과_이벤트는_위조로_판정한다() {
        saveSession("apple", "normal", null, 100);
        RankingRequest req = request("normal", "name");
        req.setScore(2);
        req.setEvents(Collections.singletonList(null));

        ResponseStatusException e = catchThrowableOfType(
            () -> rankingService.submit("apple", req, http), ResponseStatusException.class);

        assertThat(e.getStatusCode().value()).isEqualTo(400);
        assertThat(sessionState()).isEqualTo(SessionState.SUBMITTED);
    }

    @Test
    void 만료된_야구_세션은_제출할_수_없다() {
        saveSession("baseball", "easy", "{\"won\":true}", 7201);
        RankingRequest req = request("easy", "name");
        req.setAttempts(3);
        req.setTime(30.0);

        ResponseStatusException e = catchThrowableOfType(
            () -> rankingService.submit("baseball", req, http), ResponseStatusException.class);

        assertThat(e.getStatusCode().value()).isEqualTo(400);
        assertThat(e.getReason()).isEqualTo("세션이 만료되었습니다.");
    }

    /** 잠금보다 먼저 세션을 읽으면 트랜잭션 안의 잠금 조회가 캐시된 ACTIVE를 돌려줘 모두 통과한다. */
    @Test
    void 서버_판정_세션의_동시_제출은_1건만_저장한다() throws Exception {
        saveSession("minesweeper", "beginner", CLEARED, 100);
        CyclicBarrier start = new CyclicBarrier(THREADS);
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < THREADS; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        rankingService.submit("minesweeper", request("beginner", "name"), new MockHttpServletRequest());
                        return true;
                    } catch (ResponseStatusException rejected) {
                        return false;
                    }
                }));
            }
            int success = 0;
            for (Future<Boolean> result : results) {
                if (result.get(30, TimeUnit.SECONDS)) success++;
            }
            assertThat(success).isEqualTo(1);
            assertThat(minesweeperRepo.count()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }
}
