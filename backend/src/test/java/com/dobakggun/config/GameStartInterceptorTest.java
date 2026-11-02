package com.dobakggun.config;

import com.dobakggun.controller.AppleController;
import com.dobakggun.controller.BaseballController;
import com.dobakggun.controller.MinesweeperController;
import com.dobakggun.controller.RankingController;
import com.dobakggun.controller.SessionController;
import com.dobakggun.controller.SolitaireController;
import com.dobakggun.controller.SudokuController;
import com.dobakggun.exception.GameDisabledException;
import com.dobakggun.service.GameStatusService;
import com.dobakggun.service.SessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 실제 컨트롤러의 매핑으로 디스패치해, 패턴이 바뀌면 함께 실패하게 한다. */
class GameStartInterceptorTest {

    /** 인터셉터가 아니라 각 매칭 서비스가 requireEnabled로 막는 게임. */
    private static final List<String> SERVICE_GUARDED_GAMES =
            List.of("blockfall-battle", "apple-battle", "minesweeper-battle", "yacht", "online-rps");

    private final GameStatusService gameStatusService = mock(GameStatusService.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                        mock(SessionController.class),
                        mock(AppleController.class),
                        mock(MinesweeperController.class),
                        mock(BaseballController.class),
                        mock(SudokuController.class),
                        mock(SolitaireController.class),
                        mock(RankingController.class))
                .addInterceptors(new GameStartInterceptor(gameStatusService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
            "/api/minesweeper/session/start, minesweeper",
            "/api/apple/session/start, apple",
            "/api/baseball/session/start, baseball",
            "/api/sudoku/session/start, sudoku",
            "/api/solitaire/session/start, solitaire",
            "/api/blockfall/session/start, blockfall",
            "/api/blockfall-insane/session/start, blockfall-insane",
            "/api/brickbreaker/session/start, brickbreaker",
            "/api/block-crush/session/start, block-crush",
    })
    @DisplayName("꺼진 게임의 세션 시작은 503 GAME_DISABLED, 켜진 게임은 차단되지 않는다")
    void blocksOnlyDisabledGame(String path, String gameKey) throws Exception {
        doThrow(new GameDisabledException(gameKey)).when(gameStatusService).requireEnabled(gameKey);

        mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("GAME_DISABLED"))
                .andExpect(jsonPath("$.error").isNotEmpty());

        doNothing().when(gameStatusService).requireEnabled(gameKey);

        mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(503));
    }

    @Test
    @DisplayName("꺼진 게임이어도 기록 제출 경로는 차단하지 않는다")
    void rankingSubmitPasses() throws Exception {
        doThrow(new GameDisabledException("apple")).when(gameStatusService).requireEnabled("apple");

        mockMvc.perform(post("/api/apple/rankings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"s\"}"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(503));

        verifyNoInteractions(gameStatusService);
    }

    @Test
    @DisplayName("모든 게임 키는 세션 게임이거나 서비스 차단 대상이다")
    void everyGameKeyIsGuarded() {
        @SuppressWarnings("unchecked")
        Set<String> sessionGames = ((Map<String, Long>) ReflectionTestUtils
                .getField(SessionService.class, "EXPIRE_SECONDS")).keySet();

        Set<String> guarded = new HashSet<>(sessionGames);
        guarded.addAll(SERVICE_GUARDED_GAMES);

        assertThat(guarded).containsExactlyInAnyOrderElementsOf(GameStatusService.DEFAULT_GAMES);
    }
}
