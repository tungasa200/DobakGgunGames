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
import java.util.regex.Pattern;

/**
 * /ws-battle 전용 핸드셰이크 인터셉터 (Blockfall / Apple / Minesweeper Battle 공유).
 * 로그인 유저만 허용 (게스트 불가) — FRIEND 이상 제한은 없음 (USER 포함 전체 로그인 유저).
 */
@Slf4j
@RequiredArgsConstructor
public class BlockfallBattleHandshakeInterceptor implements HandshakeInterceptor {

    // BattleRoomController 등에서 참조하던 상수 — 게스트 제거 후에도 형식 검증 용도로 유지될 수 있어 보존
    public static final Pattern GUEST_TOKEN_PATTERN = Pattern.compile(
        "^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    );

    private final JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        String token = extractQueryParam(request, "token");

        // gameType 파라미터 저장 (blockfall / apple-battle / minesweeper-battle 구분용)
        String gameType = extractQueryParam(request, "gameType");
        attributes.put("wsGameType", (gameType != null && !gameType.isBlank()) ? gameType : "blockfall");

        if (!StringUtils.hasText(token) || !jwtUtil.validateToken(token)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            log.warn("BlockfallBattle handshake: 인증 실패 (토큰 없음/무효), 연결 거부");
            return false;
        }

        Long userId = jwtUtil.getUserIdFromToken(token);
        String nickname = jwtUtil.getNicknameFromToken(token);
        attributes.put("userId", userId);
        attributes.put("nickname", nickname);
        attributes.put("isGuest", false);
        log.debug("BlockfallBattle handshake OK (JWT) userId={}", userId);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // 빈 구현
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
