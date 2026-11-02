package com.dobakggun.service;

import com.dobakggun.dto.GuessRequest;
import com.dobakggun.dto.SolitaireMovesBatchRequest;
import com.dobakggun.entity.GameSession;
import com.dobakggun.repository.GameSessionRepository;
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
import java.util.List;
import java.util.concurrent.*;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/** 같은 세션의 동시 랭킹 제출은 1건만 통과한다. 실제 트랜잭션과 행 잠금이 필요해 H2로 돌린다. */
@DataJpaTest
@ImportAutoConfiguration(JacksonAutoConfiguration.class)
@Import({SessionService.class, BaseballSessionService.class, SolitaireMoveService.class, IpHashUtil.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SessionConsumeConcurrencyTest {

    private static final int THREADS = 8;
    private static final String SESSION_ID = "concurrent-session";

    @Autowired private SessionService sessionService;
    @Autowired private BaseballSessionService baseballSessionService;
    @Autowired private SolitaireMoveService solitaireMoveService;
    @Autowired private GameSessionRepository sessionRepo;
    @Autowired private IpHashUtil ipHashUtil;

    @AfterEach
    void cleanUp() {
        sessionRepo.deleteAll();
    }

    private void saveSession(String game, String extra) {
        sessionRepo.save(GameSession.builder().sessionId(SESSION_ID).game(game).level("easy")
            .ipHash(ipHashUtil.hash("127.0.0.1")).startedAt(Instant.now()).extra(extra).build());
    }

    /** 스레드를 동시에 출발시켜 성공 횟수를 센다. 거부는 ResponseStatusException만 인정한다. */
    private int countSuccess(Function<MockHttpServletRequest, ?> consume) throws Exception {
        CyclicBarrier start = new CyclicBarrier(THREADS);
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < THREADS; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        consume.apply(new MockHttpServletRequest());
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
            return success;
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void 동시_제출은_1건만_성공한다() throws Exception {
        saveSession("minesweeper", null);

        assertThat(countSuccess(http -> sessionService.validateAndConsume(SESSION_ID, "minesweeper", http)))
            .isEqualTo(1);
    }

    @Test
    void 야구도_동시_제출은_1건만_성공한다() throws Exception {
        saveSession("baseball", "{\"won\":true}");

        assertThat(countSuccess(http -> baseballSessionService.validateWinAndConsume(SESSION_ID, http)))
            .isEqualTo(1);
    }

    /** 잠금 없이 읽고 저장하면 뒤늦은 저장이 SUBMITTED도 ACTIVE로 되돌린다. 유실 없음으로 그 경로를 막았는지 본다. */
    @Test
    void 야구_동시_추측은_시도_횟수를_잃지_않는다() throws Exception {
        saveSession("baseball", "{\"answer\":[1,2,3],\"attempts\":0,\"won\":false,\"gameOver\":false}");
        GuessRequest req = new GuessRequest();
        req.setSessionId(SESSION_ID);
        req.setGuess("456");

        assertThat(countSuccess(http -> baseballSessionService.processGuess(req, http))).isEqualTo(THREADS);
        assertThat(sessionRepo.findById(SESSION_ID).orElseThrow().getExtra()).contains("\"attempts\":" + THREADS);
    }

    @Test
    void 솔리테어_동시_배치는_이동_수를_잃지_않는다() throws Exception {
        saveSession("solitaire", null);
        SolitaireMovesBatchRequest req = new SolitaireMovesBatchRequest();
        req.setSessionId(SESSION_ID);
        req.setCount(1);

        assertThat(countSuccess(http -> solitaireMoveService.processBatch(req))).isEqualTo(THREADS);
        assertThat(sessionRepo.findById(SESSION_ID).orElseThrow().getExtra()).contains("\"moves\":" + THREADS);
    }
}
