package com.dobakggun.config;

import com.dobakggun.controller.SessionController;
import com.dobakggun.exception.GameDisabledException;
import com.dobakggun.handler.OAuth2SuccessHandler;
import com.dobakggun.service.CustomOAuth2UserService;
import com.dobakggun.service.GameStatusService;
import com.dobakggun.service.IpBanService;
import com.dobakggun.service.SessionService;
import com.dobakggun.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 보안 필터 체인을 포함해 킬스위치에 어드민 예외가 없음을 확인한다. */
@WebMvcTest(SessionController.class)
@Import(SecurityConfig.class)
class GameStartSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SessionService sessionService;
    @MockBean
    private GameStatusService gameStatusService;

    // SecurityConfig 의존성
    @MockBean
    private JwtUtil jwtUtil;
    @MockBean
    private IpBanService ipBanService;
    @MockBean(name = "customOAuth2UserService")
    private CustomOAuth2UserService customOAuth2UserService;
    @MockBean(name = "oAuth2SuccessHandler")
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("게임이 꺼지면 ADMIN 도 503 GAME_DISABLED")
    void disabledGame_blocksAdmin() throws Exception {
        doThrow(new GameDisabledException("apple")).when(gameStatusService).requireEnabled("apple");

        mockMvc.perform(post("/api/apple/session/start")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("GAME_DISABLED"))
                .andExpect(jsonPath("$.error").isNotEmpty());

        verifyNoInteractions(sessionService);
    }
}
