package com.dobakggun.controller;

import com.dobakggun.config.SecurityConfig;
import com.dobakggun.dto.rps.MatchResponseDto;
import com.dobakggun.handler.OAuth2SuccessHandler;
import com.dobakggun.service.GameStatusService;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OnlineRpsController 시큐리티 슬라이스 테스트.
 * /api/rps/match 는 시큐리티에서 permitAll 이지만 컨트롤러가 비로그인을 401로 막는다.
 */
@WebMvcTest(OnlineRpsController.class)
@Import(SecurityConfig.class)
class OnlineRpsControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RpsMatchService rpsMatchService;

    // GameStartInterceptor 의존성
    @MockBean
    private GameStatusService gameStatusService;

    // SecurityConfig 의존성
    @MockBean
    private JwtUtil jwtUtil;
    @MockBean
    private IpBanService ipBanService;
    @MockBean(name = "customOAuth2UserService")
    private com.dobakggun.service.CustomOAuth2UserService customOAuth2UserService;
    @MockBean(name = "oAuth2SuccessHandler")
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    private MatchResponseDto stubResponse(boolean created) {
        return MatchResponseDto.builder()
                .roomId("test1234")
                .status("WAITING")
                .playerCount(1)
                .maxPlayers(4)
                .created(created)
                .build();
    }

    /**
     * 프로덕션 JwtAuthenticationFilter와 동일하게 principal을 userId(Long)로 주입.
     * @AuthenticationPrincipal Long 추출 가능하게 함.
     */
    private static RequestPostProcessor userPrincipal(Long userId, String role) {
        return authentication(new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority(role))));
    }

    // ─── 미인증 차단 ─────────────────────────────────────────────────────────

    @Test
    @WithAnonymousUser
    @DisplayName("미인증 사용자 POST /api/rps/match → 401 UNAUTHORIZED 차단")
    void anonymous_matchUnauthorized() throws Exception {
        mockMvc.perform(post("/api/rps/match")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));

        verifyNoInteractions(rpsMatchService);
    }

    // ─── USER role 접근 허용 ─────────────────────────────────────────────────

    @Test
    @DisplayName("USER role 은 POST /api/rps/match 접근 가능 — 200 반환")
    void userRole_canAccessMatch() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenReturn(stubResponse(false));

        mockMvc.perform(post("/api/rps/match")
                        .with(userPrincipal(1L, "ROLE_USER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("test1234"));
    }

    @Test
    @DisplayName("신규 방이 생성되면 POST /api/rps/match → 201 반환")
    void newRoom_returns201() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenReturn(stubResponse(true));

        mockMvc.perform(post("/api/rps/match")
                        .with(userPrincipal(1L, "ROLE_USER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomId").value("test1234"));
    }

    // ─── ADMIN role 접근 허용 ────────────────────────────────────────────────

    @Test
    @DisplayName("ADMIN role 은 POST /api/rps/match 접근 가능 — 200 반환")
    void adminRole_canAccessMatch() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenReturn(stubResponse(false));

        mockMvc.perform(post("/api/rps/match")
                        .with(userPrincipal(2L, "ROLE_ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
    }

    // ─── ALREADY_IN_ROOM 409 ─────────────────────────────────────────────────

    @Test
    @DisplayName("AlreadyInRoomException 발생 시 409 ALREADY_IN_ROOM 반환")
    void alreadyInRoom_returns409() throws Exception {
        when(rpsMatchService.match(any(), any()))
                .thenThrow(new RpsMatchService.AlreadyInRoomException("abcd1234"));

        mockMvc.perform(post("/api/rps/match")
                        .with(userPrincipal(1L, "ROLE_USER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("ALREADY_IN_ROOM"))
                .andExpect(jsonPath("$.roomId").value("abcd1234"));
    }
}
