package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.dto.SolitaireMovesBatchRequest;
import com.dobakggun.dto.SolitaireMovesBatchResponse;
import com.dobakggun.entity.GameSession;
import com.dobakggun.entity.GameSession.SessionState;
import com.dobakggun.repository.GameSessionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SolitaireMoveService {

    // 서버-클라이언트 이동 수 허용 오차 (auto-complete 등으로 인한 차이 감안)
    private static final int MOVES_TOLERANCE = 30;

    private final GameSessionRepository sessionRepo;
    private final ObjectMapper objectMapper;

    // ── 이동 수 배치 누적 ─────────────────────────────────────────────
    @Transactional
    public SolitaireMovesBatchResponse processBatch(SolitaireMovesBatchRequest req) {
        String sessionId = Objects.requireNonNull(req.getSessionId());
        GameSession session = sessionRepo.findById(sessionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 세션입니다."));

        if (!session.getGame().equals("solitaire")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "세션 게임 정보가 일치하지 않습니다.");
        }
        if (session.getState() != SessionState.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 종료된 세션입니다.");
        }

        Map<String, Object> extra = parseExtra(session.getExtra());
        int currentMoves = extra.containsKey("moves") ? ((Number) extra.get("moves")).intValue() : 0;
        int newMoves = currentMoves + req.getCount();
        extra.put("moves", newMoves);

        try {
            session.setExtra(objectMapper.writeValueAsString(extra));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 업데이트 오류");
        }
        sessionRepo.save(session);

        double elapsed = (Instant.now().toEpochMilli() - session.getStartedAt().toEpochMilli()) / 1000.0;
        return new SolitaireMovesBatchResponse(newMoves, elapsed);
    }

    // ── 랭킹 제출 시 이동 수 검증 ────────────────────────────────────
    public void validateMoves(GameSession session, RankingRequest req) {
        if (session.getExtra() == null || req.getMoves() == null) return;

        Map<String, Object> extra = parseExtra(session.getExtra());
        if (!extra.containsKey("moves")) return;  // 배치 API를 사용하지 않은 경우 스킵

        int serverMoves = ((Number) extra.get("moves")).intValue();
        int clientMoves = req.getMoves();

        if (Math.abs(serverMoves - clientMoves) > MOVES_TOLERANCE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "이동 횟수 검증 실패 (server=" + serverMoves + ", client=" + clientMoves + ")");
        }
    }

    // ── 내부 유틸 ─────────────────────────────────────────────────────
    private Map<String, Object> parseExtra(String extra) {
        try {
            if (extra == null) return new HashMap<>();
            return objectMapper.readValue(extra, new TypeReference<>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}
