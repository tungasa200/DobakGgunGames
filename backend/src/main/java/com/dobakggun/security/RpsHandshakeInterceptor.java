package com.dobakggun.security;

import com.dobakggun.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * /ws-rps 전용 핸드셰이크 인터셉터.
 * JWT(로그인 유저) 또는 guestToken(게스트) 둘 다 허용.
 * 유효하지 않은 JWT는 게스트로 처리 (연결 차단 아님).
 *
 * attributes 키:
 *   - 로그인: userId(Long), nickname(String), role(String), isRpsGuest=false
 *   - 게스트:  guestId(Long, 음수), nickname(String), isRpsGuest=true
 */
@Slf4j
@RequiredArgsConstructor
public class RpsHandshakeInterceptor implements HandshakeInterceptor {

    private static final String GUEST_PREFIX = "guest_";
    private static final Pattern GUEST_TOKEN_PATTERN = Pattern.compile(
        "^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    );

    private final JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        String token = extractQueryParam(request, "token");

        // 1. JWT 검증 시도 (guest_ 접두사가 없는 토큰만)
        if (StringUtils.hasText(token) && !token.startsWith(GUEST_PREFIX)) {
            if (jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserIdFromToken(token);
                String nickname = jwtUtil.getNicknameFromToken(token);
                String role = jwtUtil.getRoleFromToken(token);
                attributes.put("userId", userId);
                attributes.put("nickname", nickname);
                attributes.put("role", role);
                attributes.put("isRpsGuest", false);
                log.debug("RPS handshake OK (JWT) userId={}", userId);
                return true;
            }
            // 잘못된 JWT → 게스트로 처리
            log.warn("RPS handshake: invalid JWT, treating as guest");
        }

        // 2. guestToken 처리
        if (StringUtils.hasText(token) && token.startsWith(GUEST_PREFIX)) {
            if (!GUEST_TOKEN_PATTERN.matcher(token).matches()) {
                log.warn("RPS handshake: malformed guestToken, issuing new one");
                token = generateGuestToken();
            }
            Long guestId = guestTokenToLong(token);
            String nickname = buildGuestNickname(token);
            attributes.put("guestId", guestId);
            attributes.put("nickname", nickname);
            attributes.put("isRpsGuest", true);
            log.debug("RPS handshake OK (guestToken) guestId={}", guestId);
            return true;
        }

        // 3. 토큰 없음 — 신규 게스트 발급
        String newGuestToken = generateGuestToken();
        Long guestId = guestTokenToLong(newGuestToken);
        String nickname = buildGuestNickname(newGuestToken);
        attributes.put("guestId", guestId);
        attributes.put("nickname", nickname);
        attributes.put("isRpsGuest", true);
        log.debug("RPS handshake: new guest issued guestId={}", guestId);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // 빈 구현
    }

    private Long guestTokenToLong(String guestToken) {
        String uuidStr = guestToken.substring(GUEST_PREFIX.length());
        UUID uuid = UUID.fromString(uuidStr);
        return uuid.getMostSignificantBits() | Long.MIN_VALUE;
    }

    private String buildGuestNickname(String guestToken) {
        String uuid = guestToken.substring(GUEST_PREFIX.length()).replace("-", "");
        return "손님-" + uuid.substring(0, 4).toUpperCase();
    }

    private String generateGuestToken() {
        return GUEST_PREFIX + UUID.randomUUID();
    }

    private String extractQueryParam(ServerHttpRequest request, String name) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpRequest = servletRequest.getServletRequest();
            String query = httpRequest.getQueryString();
            if (StringUtils.hasText(query)) {
                for (String param : query.split("&")) {
                    if (param.startsWith(name + "=")) {
                        return param.substring(name.length() + 1);
                    }
                }
            }
        }
        return null;
    }
}
