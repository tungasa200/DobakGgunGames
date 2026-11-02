package com.dobakggun.controller;

import com.dobakggun.config.GamePlayExceptionHandler;
import com.dobakggun.config.GlobalExceptionHandler;
import com.dobakggun.dto.MinesweeperPlayStartResponse;
import com.dobakggun.dto.MinesweeperRevealResponse;
import com.dobakggun.dto.MinesweeperSessionStartResponse;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.service.MinesweeperPlayService;
import com.dobakggun.service.MinesweeperSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 경로 분기와 오류 응답 형식을 확인한다. 보안 필터는 포함하지 않는다. */
class MinesweeperControllerTest {

    private final MinesweeperSessionService legacy = mock(MinesweeperSessionService.class);
    private final MinesweeperPlayService play = mock(MinesweeperPlayService.class);
    private final MockMvc mvc = MockMvcBuilders
        .standaloneSetup(new MinesweeperController(legacy, play))
        .setControllerAdvice(new GlobalExceptionHandler(), new GamePlayExceptionHandler())
        .build();

    @Test
    void protocol이_없으면_구경로_응답을_유지한다() throws Exception {
        when(legacy.createSession(any(), any())).thenReturn(MinesweeperSessionStartResponse.builder()
            .sessionId("old").adjMines(new int[][]{{0}}).build());

        mvc.perform(post("/api/minesweeper/session/start").contentType(MediaType.APPLICATION_JSON)
                .content("{\"level\":\"beginner\",\"firstClickR\":0,\"firstClickC\":0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.adjMines").exists());
    }

    @Test
    void protocol_2는_서버_판정_응답을_준다() throws Exception {
        when(play.createSession(any(), any())).thenReturn(new MinesweeperPlayStartResponse(
            "new", 1L, 2L, 9, 9, 10, "PLAYING", List.of()));

        mvc.perform(post("/api/minesweeper/session/start").contentType(MediaType.APPLICATION_JSON)
                .content("{\"level\":\"beginner\",\"firstClickR\":0,\"firstClickC\":0,\"protocol\":2}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PLAYING"))
            .andExpect(jsonPath("$.adjMines").doesNotExist());
    }

    @Test
    void reveal_응답은_계약_형식이다() throws Exception {
        when(play.reveal(eq("s"), any(), any())).thenReturn(new MinesweeperRevealResponse(
            "PLAYING", List.of(new MinesweeperRevealResponse.RevealedCell(1, 2, 3)), null, null));

        mvc.perform(post("/api/minesweeper/session/s/reveal").contentType(MediaType.APPLICATION_JSON)
                .content("{\"cells\":[[1,2]],\"flags\":[[0,0]]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.revealed[0].n").value(3))
            .andExpect(jsonPath("$.mines").isEmpty())
            .andExpect(jsonPath("$.clearTimeMs").isEmpty());
    }

    @Test
    void 판정_오류는_코드형_응답이고_전역_RuntimeException_처리에_먹히지_않는다() throws Exception {
        when(play.reveal(eq("s"), any(), any())).thenThrow(new GamePlayException(GamePlayErrorCode.GAME_ENDED));

        mvc.perform(post("/api/minesweeper/session/s/reveal").contentType(MediaType.APPLICATION_JSON)
                .content("{\"cells\":[[1,2]]}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("GAME_ENDED"))
            .andExpect(jsonPath("$.message").exists());
    }
}
