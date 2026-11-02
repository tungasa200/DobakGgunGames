package com.dobakggun.config;

import com.dobakggun.service.GameStatusService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Map;

/**
 * 킬스위치로 꺼진 게임의 세션 시작을 막는다. 진행 중 세션의 기록 제출은 건드리지 않는다.
 * 매칭 계열은 재접속 판단 뒤에 막아야 해서 각 서비스가 GameStatusService.requireEnabled를 부른다.
 * 요청 경로 대신 Spring이 매칭한 패턴으로 판별해 경로 표기 변형으로 우회되지 않게 한다.
 */
@Component
@RequiredArgsConstructor
public class GameStartInterceptor implements HandlerInterceptor {

    private static final String API_PREFIX = "/api/";
    private static final String SESSION_START_SUFFIX = "/session/start";

    private final GameStatusService gameStatusService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String gameKey = resolveGameKey(request);
        if (gameKey != null) {
            gameStatusService.requireEnabled(gameKey);
        }
        return true;
    }

    private String resolveGameKey(HttpServletRequest request) {
        String pattern = (String) request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (pattern == null || !pattern.endsWith(SESSION_START_SUFFIX)) {
            return null;
        }
        String game = pattern.substring(API_PREFIX.length(), pattern.length() - SESSION_START_SUFFIX.length());
        if (!game.equals("{game}")) {
            return game;
        }
        @SuppressWarnings("unchecked")
        Map<String, String> uriVariables =
                (Map<String, String>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        return uriVariables.get("game");
    }
}
