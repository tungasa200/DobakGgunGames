package com.dobakggun.service;

import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.dto.SessionStartResponse;
import com.dobakggun.entity.GameSession;
import com.dobakggun.entity.GameSession.SessionState;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    // 게임별 세션 만료 시간 (초)
    private static final Map<String, Long> EXPIRE_SECONDS = Map.of(
        "apple",       300L,   // 게임 120초 + 순위 등록 여유 시간
        "minesweeper", 7200L,
        "baseball",    7200L,
        "solitaire",   7200L,
        "blockfall",   7200L,
        "sudoku",      7200L
    );

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil ipHashUtil;

    @Transactional
    public SessionStartResponse createSession(String game, SessionStartRequest req,
                                              HttpServletRequest httpReq) {
        Long expireSec = EXPIRE_SECONDS.get(game);
        if (expireSec == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 게임입니다.");
        }

        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(expireSec);
        String sessionId = UUID.randomUUID().toString();
        String ipHash = ipHashUtil.hash(getClientIp(httpReq));

        GameSession session = GameSession.builder()
            .sessionId(sessionId)
            .game(game)
            .level(req.getLevel())
            .ipHash(ipHash)
            .startedAt(now)
            .build();

        sessionRepo.save(session);

        return SessionStartResponse.builder()
            .sessionId(sessionId)
            .startedAt(now.toEpochMilli())
            .expiresAt(expiresAt.toEpochMilli())
            .build();
    }

    /**
     * 랭킹 제출 시 세션 검증.
     * - state == ACTIVE 확인
     * - 만료 시간 확인
     * - IP 불일치 시 거부 대신 ip_mismatch 플래그 기록
     * - 검증 통과 시 state를 SUBMITTED로 변경 (중복 제출 방지)
     */
    @Transactional
    public GameSession validateAndConsume(String sessionId, String game,
                                          HttpServletRequest httpReq) {
        GameSession session = sessionRepo.findById(sessionId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "유효하지 않은 세션입니다."));

        if (session.getState() != SessionState.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "이미 사용되었거나 만료된 세션입니다.");
        }

        if (!session.getGame().equals(game)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "세션 게임 정보가 일치하지 않습니다.");
        }

        // 만료 시간 초과 여부 확인
        long expireSec = EXPIRE_SECONDS.getOrDefault(game, 7200L);
        Instant expiresAt = session.getStartedAt().plusSeconds(expireSec);
        if (Instant.now().isAfter(expiresAt)) {
            session.setState(SessionState.EXPIRED);
            sessionRepo.save(session);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "세션이 만료되었습니다.");
        }

        // IP 불일치: 거부 대신 플래그 기록
        String currentIpHash = ipHashUtil.hash(getClientIp(httpReq));
        if (!session.getIpHash().equals(currentIpHash)) {
            log.warn("IP mismatch: sessionId={}, game={}", sessionId, game);
            session.setIpMismatch(true);
        }

        session.setState(SessionState.SUBMITTED);
        session.setSubmittedAt(Instant.now());
        sessionRepo.save(session);

        return session;
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
