package com.dobakggun.service;

import com.dobakggun.entity.GameSession;
import com.dobakggun.entity.GameSession.SessionState;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** 서버 판정 세션의 공통 처리: 잠금 조회, 상태 확인, extra 읽기·쓰기, 랭킹 제출 전 클리어 확인. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlaySessionSupport {

    /** 서버 판정 세션 표시. 2단계 뒤 구버전 세션과 구분하는 값이다. */
    public static final int PROTOCOL = 2;
    static final String CLEAR_TIME_MS = "clearTimeMs";

    static final long EXPIRE_SECONDS = 7200L;

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil            ipHashUtil;
    private final ObjectMapper          objectMapper;

    /** 호출자의 트랜잭션 안에서 불러야 한다. 같은 세션의 동시 요청을 직렬화한다. */
    GameSession lockSession(String sessionId, String game, HttpServletRequest httpReq) {
        GameSession session = sessionRepo.findByIdForUpdate(sessionId)
            .orElseThrow(() -> new GamePlayException(GamePlayErrorCode.SESSION_INVALID));
        if (!game.equals(session.getGame())) {
            throw new GamePlayException(GamePlayErrorCode.SESSION_INVALID);
        }

        // IP 불일치: 거부 대신 플래그 기록
        if (!session.isIpMismatch() && !session.getIpHash().equals(ipHashUtil.hash(getClientIp(httpReq)))) {
            log.warn("IP mismatch during play: sessionId={}, game={}", sessionId, game);
            session.setIpMismatch(true);
        }
        return session;
    }

    void requireActive(GameSession session) {
        boolean timedOut = Instant.now().isAfter(session.getStartedAt().plusSeconds(EXPIRE_SECONDS));
        if (session.getState() == SessionState.EXPIRED || timedOut) {
            throw new GamePlayException(GamePlayErrorCode.SESSION_EXPIRED);
        }
        if (session.getState() != SessionState.ACTIVE) {
            throw new GamePlayException(GamePlayErrorCode.GAME_ENDED);
        }
    }

    Map<String, Object> readExtra(GameSession session) {
        if (session.getExtra() == null) return new HashMap<>();
        try {
            return objectMapper.readValue(session.getExtra(), new TypeReference<>() {});
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 데이터 오류");
        }
    }

    void saveExtra(GameSession session, Map<String, Object> extra) {
        try {
            session.setExtra(objectMapper.writeValueAsString(extra));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 업데이트 오류");
        }
        sessionRepo.save(session);
    }

    <T> T convert(Object value, Class<T> type) {
        return objectMapper.convertValue(value, type);
    }

    static boolean isServerJudged(Map<String, Object> extra) {
        return Integer.valueOf(PROTOCOL).equals(extra.get("protocol"));
    }

    long elapsedMs(GameSession session) {
        return Instant.now().toEpochMilli() - session.getStartedAt().toEpochMilli();
    }

    /**
     * 세션을 소모하기 전에 부른다.
     * 서버가 판정한 클리어 세션이면 그 시간을, 구버전 세션이면 null을 돌려준다.
     * 구버전 세션은 기존 경로가 그대로 검증한다.
     */
    public Long serverClearTimeMs(String sessionId, String level) {
        GameSession session = sessionRepo.findById(sessionId).orElse(null);
        if (session == null) return null;

        Map<String, Object> extra = readExtra(session);
        if (extra.get(CLEAR_TIME_MS) instanceof Number clearTimeMs) {
            // 쉬운 레벨의 클리어를 어려운 레벨 기록으로 내는 것을 막는다
            if (!session.getLevel().equals(level)) {
                throw new GamePlayException(GamePlayErrorCode.SESSION_INVALID);
            }
            return clearTimeMs.longValue();
        }
        if (isServerJudged(extra)) {
            throw new GamePlayException(GamePlayErrorCode.SESSION_NOT_CLEARED);
        }
        return null;
    }

    static String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
