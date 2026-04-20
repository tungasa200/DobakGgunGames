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
                // 나머지 허용
                .anyRequest().permitAll()
            )
            .oauth2Login(oauth2 -> {
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
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
