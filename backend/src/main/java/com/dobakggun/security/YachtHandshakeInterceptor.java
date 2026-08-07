package com.dobakggun.security;

import com.dobakggun.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * /ws-yacht 전용 핸드셰이크 인터셉터.
 * 로그인 유저만 허용 (게스트 불가) — FRIEND 이상 제한은 없음 (USER 포함 전체 로그인 유저).
 *
 * 기존 /ws(JwtHandshakeInterceptor)는 채팅용으로 FRIEND 이상만 허용하는데,
 * Yacht가 이를 공유하면서 USER 등급은 REST로 매칭까지는 되지만 WS 연결이 403으로
 * 거부되어 실제 게임 플레이가 불가능한 버그가 있었음 — 그래서 전용 엔드포인트로 분리.
 */
@Slf4j
@RequiredArgsConstructor
public class YachtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        String token = extractToken(request);
        if (!StringUtils.hasText(token) || !jwtUtil.validateToken(token)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        Long userId = jwtUtil.getUserIdFromToken(token);
        String nickname = jwtUtil.getNicknameFromToken(token);
        String role = jwtUtil.getRoleFromToken(token);

        attributes.put("userId", userId);
        attributes.put("nickname", nickname);
        attributes.put("role", role);
        attributes.put("isYacht", true);
        log.debug("Yacht handshake OK userId={}", userId);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
    }

    private String extractToken(ServerHttpRequest request) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpRequest = servletRequest.getServletRequest();
            String bearer = httpRequest.getHeader("Authorization");
            if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
                return bearer.substring(7);
            }
            String query = httpRequest.getQueryString();
            if (StringUtils.hasText(query)) {
                for (String param : query.split("&")) {
                    if (param.startsWith("token=")) {
                        return param.substring(6);
                    }
                }
            }
        }
        return null;
    }
}
