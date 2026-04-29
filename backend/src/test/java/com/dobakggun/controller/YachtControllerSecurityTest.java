package com.dobakggun.controller;

import com.dobakggun.config.SecurityConfig;
import com.dobakggun.dto.yacht.YachtMatchResponse;
import com.dobakggun.handler.OAuth2SuccessHandler;
import com.dobakggun.service.IpBanService;
import com.dobakggun.service.YachtGameService;
import com.dobakggun.service.YachtMatchService;
import com.dobakggun.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * YachtController 시큐리티 슬라이스 테스트.
 * /api/yacht/** 는 authenticated() — 비로그인 차단.
 */
@WebMvcTest(YachtController.class)
@Import(SecurityConfig.class)
@DisplayName("Yacht 컨트롤러 보안 테스트")
class YachtControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private YachtMatchService yachtMatchService;

    @MockBean
    private YachtGameService yachtGameService;

    // SecurityConfig 의존성
    @MockBean
    private JwtUtil jwtUtil;
    @MockBean
    private IpBanService ipBanService;
    @MockBean(name = "customOAuth2UserService")
    private com.dobakggun.service.CustomOAuth2UserService customOAuth2UserService;
    @MockBean(name = "oAuth2SuccessHandler")
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    // ─── 비인증 차단 ──────────────────────────────────────────────────────────

    @Test
    @WithAnonymousUser
    @DisplayName("비인증 사용자 POST /api/yacht/match → 403 차단")
    void anonymous_matchBlocked() throws Exception {
        mockMvc.perform(post("/api/yacht/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    @DisplayName("비인증 사용자 GET /api/yacht/room/testroom → 403 차단")
    void anonymous_getRoomBlocked() throws Exception {
        mockMvc.perform(get("/api/yacht/room/testroom"))
                .andExpect(status().isForbidden());
    }

    // ─── 인증 사용자 허용 ─────────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("USER role POST /api/yacht/match → 201 (신규 방 생성)")
    void userRole_matchAllowed() throws Exception {
        when(yachtMatchService.match(any()))
                .thenReturn(YachtMatchResponse.builder()
                        .roomId("yacht1234")
                        .status("WAITING")
                        .playerCount(1)
                        .maxPlayers(6)
                        .created(true)
                        .build());

        mockMvc.perform(post("/api/yacht/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomId").value("yacht1234"))
                .andExpect(jsonPath("$.created").value(true));
    }

    // ─── ALREADY_IN_ROOM 409 ─────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("ALREADY_IN_ROOM 시 409 반환")
    void alreadyInRoom_returns409() throws Exception {
        when(yachtMatchService.match(any()))
                .thenThrow(new YachtMatchService.AlreadyInRoomException("existing1"));

        mockMvc.perform(post("/api/yacht/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("ALREADY_IN_ROOM"))
                .andExpect(jsonPath("$.roomId").value("existing1"));
    }
}
