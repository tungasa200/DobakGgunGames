package com.dobakggun.controller;

import com.dobakggun.config.SecurityConfig;
import com.dobakggun.dto.rps.MatchResponseDto;
import com.dobakggun.handler.OAuth2SuccessHandler;
import com.dobakggun.service.IpBanService;
import com.dobakggun.service.RpsMatchService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OnlineRpsController 시큐리티 슬라이스 테스트.
 * /api/rps/match 는 비로그인 포함 전체 허용 (게스트 지원).
 */
@WebMvcTest(OnlineRpsController.class)
@Import(SecurityConfig.class)
class OnlineRpsControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RpsMatchService rpsMatchService;

    // SecurityConfig 의존성
    @MockBean
    private JwtUtil jwtUtil;
    @MockBean
    private IpBanService ipBanService;
    @MockBean(name = "customOAuth2UserService")
    private com.dobakggun.service.CustomOAuth2UserService customOAuth2UserService;
    @MockBean(name = "oAuth2SuccessHandler")
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    private MatchResponseDto stubResponse(boolean created, String guestToken) {
        return MatchResponseDto.builder()
                .roomId("test1234")
                .status("WAITING")
                .playerCount(1)
                .maxPlayers(4)
                .created(created)
                .guestToken(guestToken)
                .build();
    }

    // ─── 미인증(게스트) 허용 ─────────────────────────────────────────────────

    @Test
    @WithAnonymousUser
    @DisplayName("미인증 사용자(게스트)도 POST /api/rps/match 접근 가능 — 201 반환")
    void anonymous_canAccessAsGuest() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenReturn(stubResponse(true, "guest_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"));

        mockMvc.perform(post("/api/rps/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomId").value("test1234"))
                .andExpect(jsonPath("$.guestToken").exists());
    }

    // ─── USER role 접근 허용 ─────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("USER role 은 POST /api/rps/match 접근 가능 — 200 반환")
    void userRole_canAccessMatch() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenReturn(stubResponse(false, null));

        mockMvc.perform(post("/api/rps/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("test1234"));
    }

    // ─── ADMIN role 접근 허용 ────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("ADMIN role 은 POST /api/rps/match 접근 가능 — 200 반환")
    void adminRole_canAccessMatch() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenReturn(stubResponse(false, null));

        mockMvc.perform(post("/api/rps/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
    }

    // ─── ALREADY_IN_ROOM 409 ─────────────────────────────────────────────────

    @Test
    @WithAnonymousUser
    @DisplayName("AlreadyInRoomException 발생 시 409 ALREADY_IN_ROOM 반환")
    void alreadyInRoom_returns409() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenThrow(new RpsMatchService.AlreadyInRoomException("abcd1234"));

        mockMvc.perform(post("/api/rps/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("ALREADY_IN_ROOM"))
                .andExpect(jsonPath("$.roomId").value("abcd1234"));
    }
}
