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
 * /ws-battle 전용 핸드셰이크 인터셉터.
 * JWT(로그인 유저) 또는 guestToken(게스트) 둘 다 허용.
 *
 * 우선순위:
 *   1. 쿼리파라미터 token= 에서 JWT 시도
 *   2. guest_ 접두사이면 guestToken 처리
 *   3. 둘 다 없으면 신규 guest_{uuid} 발급
 */
@Slf4j
@RequiredArgsConstructor
public class BlockfallBattleHandshakeInterceptor implements HandshakeInterceptor {

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

        // gameType 파라미터 저장 (blockfall / minesweeper 구분용)
        String gameType = extractQueryParam(request, "gameType");
        attributes.put("wsGameType", (gameType != null && !gameType.isBlank()) ? gameType : "blockfall");

        // 1. JWT 검증 시도
        if (StringUtils.hasText(token) && !token.startsWith(GUEST_PREFIX)) {
            if (jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserIdFromToken(token);
                String nickname = jwtUtil.getNicknameFromToken(token);
                attributes.put("userId", userId);
                attributes.put("nickname", nickname);
                attributes.put("isGuest", false);
                log.debug("BlockfallBattle handshake OK (JWT) userId={}", userId);
                return true;
            } else {
                log.warn("BlockfallBattle handshake: invalid JWT, fallback to guest");
                // 잘못된 JWT면 게스트로 fallback 하지 않고 신규 게스트 발급
            }
        }

        // 2. guestToken 처리
        if (StringUtils.hasText(token) && token.startsWith(GUEST_PREFIX)) {
            if (!GUEST_TOKEN_PATTERN.matcher(token).matches()) {
                log.warn("BlockfallBattle handshake: malformed guestToken rejected, issuing new token");
                token = generateGuestToken();
            }
            String nickname = buildGuestNickname(token);
            attributes.put("guestId", token);
            attributes.put("nickname", nickname);
            attributes.put("isGuest", true);
            log.debug("BlockfallBattle handshake OK (guestToken) guestId={}", token);
            return true;
        }

        // 3. 토큰 없음 — 신규 게스트 발급
        String newGuestToken = generateGuestToken();
        String nickname = buildGuestNickname(newGuestToken);
        attributes.put("guestId", newGuestToken);
        attributes.put("nickname", nickname);
        attributes.put("isGuest", true);
        attributes.put("newGuest", true); // 신규 발급 플래그
        log.debug("BlockfallBattle handshake: new guest issued guestId={}", newGuestToken);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // 빈 구현
    }

    private String generateGuestToken() {
        return GUEST_PREFIX + UUID.randomUUID();
    }

    /**
     * guestToken 에서 닉네임 생성.
     * 포맷: 손님-{UUID 앞 4글자 대문자}
     * 예: guest_b3f1a2d4-... → 손님-B3F1
     */
    private String buildGuestNickname(String guestToken) {
        String uuid = guestToken.substring(GUEST_PREFIX.length());
        String prefix = uuid.replace("-", "").substring(0, Math.min(4, uuid.replace("-", "").length())).toUpperCase();
        return "손님-" + prefix;
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
