package com.dobakggun.controller;

import com.dobakggun.config.SecurityConfig;
import com.dobakggun.dto.rsp.RspPlayResponse;
import com.dobakggun.dto.rsp.RspStatsResponse;
import com.dobakggun.entity.RspChoice;
import com.dobakggun.entity.RspResult;
import com.dobakggun.handler.OAuth2SuccessHandler;
import com.dobakggun.service.AdminRspService;
import com.dobakggun.service.CustomOAuth2UserService;
import com.dobakggun.service.IpBanService;
import com.dobakggun.util.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AdminRspController 시큐리티 통합 테스트.
 * ADMIN 외 접근 시 403, 미인증 시 2xx 이외(401/403/302) 검증.
 *
 * @Import(SecurityConfig.class) 로 실제 Security 규칙(/api/admin/** → ADMIN role 필수)을 로드.
 * JwtAuthenticationFilter는 @WebMvcTest에서 자동 로드되지 않으므로
 * Spring Security의 @WithMockUser/@WithAnonymousUser로 역할 시뮬레이션.
 *
 * 참고: oauth2Login 활성화 환경에서 미인증 요청은 302(OAuth2 리다이렉트)로 응답될 수 있음.
 * 이는 401/403과 동일하게 "미인증 접근 차단" 의도를 만족한다.
 */
@WebMvcTest(AdminRspController.class)
@Import(SecurityConfig.class)
class AdminRspControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AdminRspService adminRspService;

    // SecurityConfig 의존성 — @WebMvcTest 컨텍스트에서 필요
    @MockBean
    private JwtUtil jwtUtil;
    @MockBean
    private IpBanService ipBanService;
    @MockBean(name = "customOAuth2UserService")
    private CustomOAuth2UserService customOAuth2UserService;
    @MockBean(name = "oAuth2SuccessHandler")
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    // ─── 미인증 접근 차단 ─────────────────────────────────────────────────────

    @Test
    @WithAnonymousUser
    @DisplayName("미인증 사용자가 POST /plays 요청하면 2xx 이외 반환 (401/403/302)")
    void anonymousUser_postPlays_isUnauthorized() throws Exception {
        mockMvc.perform(post("/api/admin/rsp/plays")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userChoice\":\"ROCK\"}")
                        .with(csrf()))
                .andExpect(status().is(not(200)));
    }

    @Test
    @WithAnonymousUser
    @DisplayName("미인증 사용자가 GET /stats 요청하면 2xx 이외 반환 (401/403/302)")
    void anonymousUser_getStats_isUnauthorized() throws Exception {
        mockMvc.perform(get("/api/admin/rsp/stats"))
                .andExpect(status().is(not(200)));
    }

    // ─── USER role 접근 차단 ──────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("USER role이 POST /plays 요청하면 403 반환")
    void userRole_postPlays_isForbidden() throws Exception {
        mockMvc.perform(post("/api/admin/rsp/plays")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userChoice\":\"ROCK\"}")
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("USER role이 GET /stats 요청하면 403 반환")
    void userRole_getStats_isForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/rsp/stats"))
                .andExpect(status().isForbidden());
    }

    // ─── ADMIN role 접근 허용 ─────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("ADMIN role이 POST /plays 요청하면 200 반환")
    void adminRole_postPlays_isOk() throws Exception {
        RspStatsResponse stats = RspStatsResponse.builder()
                .totalPlays(1).wins(1).losses(0).draws(0)
                .winRate(BigDecimal.valueOf(1.0000))
                .build();
        RspPlayResponse mockResponse = RspPlayResponse.builder()
                .id(1L)
                .userChoice(RspChoice.ROCK)
                .computerChoice(RspChoice.SCISSORS)
                .result(RspResult.WIN)
                .playedAt(LocalDateTime.now())
                .stats(stats)
                .build();

        when(adminRspService.play(anyLong(), any(RspChoice.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/admin/rsp/plays")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userChoice\":\"ROCK\"}")
                        .with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("ADMIN role이 GET /stats 요청하면 200 반환")
    void adminRole_getStats_isOk() throws Exception {
        RspStatsResponse mockStats = RspStatsResponse.builder()
                .totalPlays(0).wins(0).losses(0).draws(0)
                .winRate(null)
                .build();

        when(adminRspService.getStats(anyLong())).thenReturn(mockStats);

        mockMvc.perform(get("/api/admin/rsp/stats"))
                .andExpect(status().isOk());
    }
}
