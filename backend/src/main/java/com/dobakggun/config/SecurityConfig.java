package com.dobakggun.config;

import com.dobakggun.security.IpBanFilter;
import com.dobakggun.security.JwtAuthenticationFilter;
import com.dobakggun.service.CustomOAuth2UserService;
import com.dobakggun.service.IpBanService;
import com.dobakggun.handler.OAuth2SuccessHandler;
import com.dobakggun.util.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtUtil jwtUtil;
    private final IpBanService ipBanService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private CustomOAuth2UserService customOAuth2UserService;

    @Autowired(required = false)
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    @Autowired(required = false)
    private ClientRegistrationRepository clientRegistrationRepository;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    public SecurityConfig(JwtUtil jwtUtil, IpBanService ipBanService, ObjectMapper objectMapper) {
        this.jwtUtil = jwtUtil;
        this.ipBanService = ipBanService;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 인증 API
                .requestMatchers("/api/auth/**").permitAll()
                // OAuth2 콜백
                .requestMatchers("/login/oauth2/**", "/oauth2/**").permitAll()
                // 어드민 전용 — ADMIN role 필수
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // 게시판 — FRIEND 이상 필요
                .requestMatchers(HttpMethod.GET, "/api/board/posts", "/api/board/posts/**").hasAnyRole("FRIEND", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/board/posts", "/api/board/images").hasAnyRole("FRIEND", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/board/posts/*/comments").hasAnyRole("FRIEND", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/board/posts/*").hasAnyRole("FRIEND", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/board/posts/*", "/api/board/posts/*/comments/*").hasAnyRole("FRIEND", "ADMIN")
                // 기존 게임 서비스 — 인증 없이 모두 허용
                .requestMatchers("/api/*/session/**").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/*/rankings").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/*/rankings/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/*/rankings").permitAll()
                .requestMatchers("/api/*/guess").permitAll()
                .requestMatchers("/api/*/moves-batch").permitAll()
                // 패치노트 공개 API
                .requestMatchers(HttpMethod.GET, "/api/patch-notes").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/patch-notes/**").permitAll()
                // 사용자 프로필 — 로그인 필수
                .requestMatchers("/api/users/me/**").authenticated()
                // 문의 — 로그인 필수
                .requestMatchers("/api/contacts").authenticated()
                .requestMatchers("/api/contacts/my").authenticated()
                .requestMatchers("/api/contacts/my/**").authenticated()
                // WebSocket 엔드포인트 — 실제 인증은 JwtHandshakeInterceptor / BlockfallBattleHandshakeInterceptor에서 처리
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/ws-battle/**").permitAll()
                // Blockfall Battle REST API — join은 게스트 허용, rankings는 공개
                .requestMatchers("/api/blockfall-battle/join").permitAll()
                .requestMatchers("/api/blockfall-battle/rankings").permitAll()
                // 채팅 API — FRIEND 이상
                .requestMatchers(HttpMethod.GET,    "/api/chat/rooms").hasAnyRole("FRIEND", "ADMIN")
                .requestMatchers(HttpMethod.POST,   "/api/chat/rooms").hasAnyRole("FRIEND", "ADMIN")
                .requestMatchers(HttpMethod.GET,    "/api/chat/rooms/*/history").hasAnyRole("FRIEND", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/chat/rooms/**").hasAnyRole("FRIEND", "ADMIN")
                // Online RPS — 로그인 유저 전체 허용 (ADMIN/USER/FRIEND)
                .requestMatchers("/api/rps/**").authenticated()
                // 나머지 허용
                .anyRequest().permitAll()
            )
            .oauth2Login(oauth2 -> {
                // ClientRegistrationRepository 빈이 없는 환경(테스트 슬라이스 등)에서는
                // oauth2Login 세부 설정을 건너뜀으로써 filterChain 생성 실패를 방지
                if (clientRegistrationRepository == null) {
                    oauth2.disable();
                    return;
                }
                if (customOAuth2UserService != null) {
                    oauth2.userInfoEndpoint(u -> u.userService(customOAuth2UserService));
                }
                if (oAuth2SuccessHandler != null) {
                    oauth2.successHandler(oAuth2SuccessHandler);
                }
            })
            .addFilterBefore(new IpBanFilter(ipBanService, objectMapper),
                    UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new JwtAuthenticationFilter(jwtUtil),
                    UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        source.registerCorsConfiguration("/ws/**", config);
        source.registerCorsConfiguration("/ws-battle/**", config);
        return source;
    }
}
