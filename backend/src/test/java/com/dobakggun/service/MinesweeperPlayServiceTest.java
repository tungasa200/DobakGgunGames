package com.dobakggun.service;

import com.dobakggun.dto.MinesweeperPlayStartResponse;
import com.dobakggun.dto.MinesweeperRevealRequest;
import com.dobakggun.dto.MinesweeperRevealResponse;
import com.dobakggun.dto.MinesweeperSessionStartRequest;
import com.dobakggun.entity.GameSession;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MinesweeperPlayServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final GameSessionRepository repo = mock(GameSessionRepository.class);
    private final IpHashUtil ipHashUtil = mock(IpHashUtil.class);
    private final MockHttpServletRequest http = new MockHttpServletRequest();
    private MinesweeperPlayService service;
    private GameSession stored;

    @BeforeEach
    void setUp() {
        when(ipHashUtil.hash(any())).thenReturn("hash");
        when(repo.save(any())).thenAnswer(inv -> {
            stored = inv.getArgument(0);
            return stored;
        });
        when(repo.findByIdForUpdate(anyString())).thenAnswer(inv -> Optional.ofNullable(stored));
        service = new MinesweeperPlayService(ipHashUtil, new PlaySessionSupport(repo, ipHashUtil, mapper));
    }

    /** 3×3, (0,0)만 지뢰인 판 */
    private void useBoard(int[][] mines, int rows, int cols, String revealedB64) throws Exception {
        Map<String, Object> extra = new HashMap<>();
        extra.put("protocol", 2);
        extra.put("rows", rows);
        extra.put("cols", cols);
        extra.put("minePositions", mines);
        extra.put("revealed", revealedB64);
        extra.put("status", "PLAYING");
        stored = GameSession.builder().sessionId("s").game("minesweeper").level("beginner")
            .ipHash("hash").startedAt(Instant.now().minusSeconds(30))
            .extra(mapper.writeValueAsString(extra)).build();
    }

    private MinesweeperRevealRequest reveal(int[][] cells, int[][] flags) {
        MinesweeperRevealRequest req = new MinesweeperRevealRequest();
        req.setCells(Arrays.asList(cells));
        req.setFlags(flags == null ? null : Arrays.asList(flags));
        return req;
    }

    @Test
    void 시작_응답은_첫칸을_열고_지뢰_정보를_주지_않는다() throws Exception {
        MinesweeperSessionStartRequest req = new MinesweeperSessionStartRequest();
        req.setLevel("expert");
        req.setProtocol(2);
        req.setFirstClickR(5);
        req.setFirstClickC(5);

        MinesweeperPlayStartResponse res = service.createSession(req, http);

        assertThat(res.rows()).isEqualTo(16);
        assertThat(res.cols()).isEqualTo(30);
        assertThat(res.mines()).isEqualTo(99);
        assertThat(res.revealed()).isNotEmpty().allSatisfy(c -> assertThat(c.n()).isBetween(0, 8));
        assertThat(res.revealed()).anySatisfy(c -> {
            assertThat(c.r()).isEqualTo(5);
            assertThat(c.c()).isEqualTo(5);
            assertThat(c.n()).isZero();  // 첫 칸과 인접 8칸은 지뢰 제외
        });
        assertThat(mapper.writeValueAsString(res)).doesNotContain("minePositions", "adjMines", "\"n\":-1");
    }

    @Test
    void 프로토콜2_시작은_첫클릭이_필수다() {
        MinesweeperSessionStartRequest req = new MinesweeperSessionStartRequest();
        req.setLevel("beginner");
        req.setProtocol(2);

        assertThatThrownBy(() -> service.createSession(req, http))
            .extracting(e -> ((GamePlayException) e).getErrorCode())
            .isEqualTo(GamePlayErrorCode.INVALID_CELL);
    }

    @Test
    void 지뢰를_열면_패배하고_이때만_지뢰_좌표를_준다() throws Exception {
        useBoard(new int[][]{{0, 0}}, 3, 3, "");

        MinesweeperRevealResponse res = service.reveal("s", reveal(new int[][]{{0, 0}}, null), http);

        assertThat(res.status()).isEqualTo("LOST");
        assertThat(res.mines()).isDeepEqualTo(new int[][]{{0, 0}});
        assertThat(res.clearTimeMs()).isNull();
        assertThatThrownBy(() -> service.reveal("s", reveal(new int[][]{{1, 1}}, null), http))
            .extracting(e -> ((GamePlayException) e).getErrorCode())
            .isEqualTo(GamePlayErrorCode.GAME_ENDED);
    }

    @Test
    void 안전한_칸을_모두_열면_서버_시간으로_승리한다() throws Exception {
        useBoard(new int[][]{{0, 0}}, 3, 3, "");

        MinesweeperRevealResponse res = service.reveal("s", reveal(new int[][]{{2, 2}}, null), http);

        assertThat(res.status()).isEqualTo("WON");
        assertThat(res.revealed()).hasSize(8);
        assertThat(res.mines()).isNull();
        assertThat(res.clearTimeMs()).isBetween(29_000L, 40_000L);
    }

    @Test
    void 연쇄_오픈은_깃발에서_멈춘다() throws Exception {
        useBoard(new int[][]{{0, 0}}, 3, 3, "");

        MinesweeperRevealResponse res = service.reveal("s",
            reveal(new int[][]{{2, 2}}, new int[][]{{2, 1}, {1, 2}}), http);

        assertThat(res.status()).isEqualTo("PLAYING");
        assertThat(res.revealed()).extracting(c -> c.r() + "," + c.c())
            .contains("2,2", "1,1").doesNotContain("2,1", "1,2");
    }

    @Test
    void 깃발이_꽂힌_지뢰는_터지지_않는다() throws Exception {
        useBoard(new int[][]{{0, 0}}, 3, 3, "");

        MinesweeperRevealResponse res = service.reveal("s",
            reveal(new int[][]{{0, 0}}, new int[][]{{0, 0}}), http);

        assertThat(res.status()).isEqualTo("PLAYING");
        assertThat(res.revealed()).isEmpty();
    }

    @Test
    void 같은_칸을_다시_열어도_결과가_바뀌지_않는다() throws Exception {
        useBoard(new int[][]{{0, 0}, {2, 2}}, 3, 3, "");

        MinesweeperRevealResponse first = service.reveal("s", reveal(new int[][]{{0, 1}}, null), http);
        MinesweeperRevealResponse retry = service.reveal("s", reveal(new int[][]{{0, 1}}, null), http);

        assertThat(first.revealed()).hasSize(1);
        assertThat(retry.status()).isEqualTo("PLAYING");
        assertThat(retry.revealed()).isEmpty();
    }

    @Test
    void 범위_밖_좌표와_개수_위반은_거부한다() throws Exception {
        useBoard(new int[][]{{0, 0}}, 3, 3, "");

        for (int[][] cells : List.of(new int[][]{{3, 0}}, new int[][]{{0}}, new int[9][2], new int[0][2])) {
            assertThatThrownBy(() -> service.reveal("s", reveal(cells, null), http))
                .extracting(e -> ((GamePlayException) e).getErrorCode())
                .isEqualTo(GamePlayErrorCode.INVALID_CELL);
        }
    }

    @Test
    void 만료된_세션은_410이다() throws Exception {
        useBoard(new int[][]{{0, 0}}, 3, 3, "");
        stored.setStartedAt(Instant.now().minusSeconds(7201));

        assertThatThrownBy(() -> service.reveal("s", reveal(new int[][]{{1, 1}}, null), http))
            .extracting(e -> ((GamePlayException) e).getErrorCode())
            .isEqualTo(GamePlayErrorCode.SESSION_EXPIRED);
    }

    @Test
    void 구경로_세션은_reveal을_쓸_수_없다() {
        stored = GameSession.builder().sessionId("s").game("minesweeper").level("beginner")
            .ipHash("hash").startedAt(Instant.now()).extra("{\"rows\":9,\"cols\":9}").build();

        assertThatThrownBy(() -> service.reveal("s", reveal(new int[][]{{1, 1}}, null), http))
            .extracting(e -> ((GamePlayException) e).getErrorCode())
            .isEqualTo(GamePlayErrorCode.SESSION_INVALID);
    }

    @Test
    void IP가_달라도_거부하지_않고_기록만_한다() throws Exception {
        useBoard(new int[][]{{0, 0}}, 3, 3, "");
        when(ipHashUtil.hash(any())).thenReturn("other");

        service.reveal("s", reveal(new int[][]{{1, 1}}, null), http);

        assertThat(stored.isIpMismatch()).isTrue();
    }
}
