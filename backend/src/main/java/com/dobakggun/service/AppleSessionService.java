package com.dobakggun.service;

import com.dobakggun.dto.AppleSessionStartResponse;
import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.entity.GameSession;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

/**
 * Phase 3 — 사과게임: 서버가 보드를 생성하여 제공.
 * <ul>
 *   <li>프론트엔드와 동일한 가중치(WEIGHTS)로 보드 생성</li>
 *   <li>extra.board 에 저장 → 이벤트 로그 좌표 완전 검증 가능</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AppleSessionService {

    private static final long  EXPIRE_SECONDS = 130L;
    private static final int   ROWS           = 10;
    private static final int   COLS           = 17;
    /** 1~9 각 숫자의 가중치 (프론트엔드 APPLE_WEIGHTS 와 동일) */
    private static final int[] WEIGHTS        = {5, 5, 4, 4, 3, 3, 2, 2, 1};
    private static final int   WEIGHT_TOTAL;

    static {
        int sum = 0;
        for (int w : WEIGHTS) sum += w;
        WEIGHT_TOTAL = sum;
    }

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil            ipHashUtil;
    private final ObjectMapper          objectMapper;

    @Transactional
    public AppleSessionStartResponse createSession(
            SessionStartRequest req,
            HttpServletRequest httpReq) {

        int[][] board = generateBoard();

        Instant now      = Instant.now();
        String sessionId = UUID.randomUUID().toString();
        String ipHash    = ipHashUtil.hash(getClientIp(httpReq));

        Map<String, Object> extra = new HashMap<>();
        extra.put("board", board);

        GameSession session = GameSession.builder()
            .sessionId(sessionId)
            .game("apple")
            .level(req.getLevel() != null ? req.getLevel() : "normal")
            .ipHash(ipHash)
            .startedAt(now)
            .build();

        try {
            session.setExtra(objectMapper.writeValueAsString(extra));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 생성 오류");
        }
        sessionRepo.save(session);

        return AppleSessionStartResponse.builder()
            .sessionId(sessionId)
            .startedAt(now.toEpochMilli())
            .expiresAt(now.plusSeconds(EXPIRE_SECONDS).toEpochMilli())
            .board(board)
            .build();
    }

    private int[][] generateBoard() {
        Random rng   = new Random();
        int[][] board = new int[ROWS][COLS];
        for (int r = 0; r < ROWS; r++)
            for (int c = 0; c < COLS; c++)
                board[r][c] = randomApple(rng);
        return board;
    }

    private int randomApple(Random rng) {
        int r = rng.nextInt(WEIGHT_TOTAL);
        for (int i = 0; i < WEIGHTS.length; i++) {
            r -= WEIGHTS[i];
            if (r < 0) return i + 1;
        }
        return 9;
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
