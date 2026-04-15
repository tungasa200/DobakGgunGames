package com.dobakggun.service;

import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.dto.SolitaireSessionStartResponse;
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
 * Phase 3 — 솔리테어: 서버가 덱 순서를 생성하여 제공.
 * <ul>
 *   <li>52장 카드를 Fisher-Yates 셔플 후 extra.deck 에 저장</li>
 *   <li>클라이언트는 서버 덱으로 초기 패를 구성 → 클라이언트 셔플 제거</li>
 *   <li>클리어 제출 시 해당 덱으로 클리어 가능 여부 최소 검증 가능</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class SolitaireSessionService {

    private static final long     EXPIRE_SECONDS = 7200L;
    private static final String[] SUITS  = {"♠", "♣", "♥", "♦"};
    private static final String[] VALUES = {"A","2","3","4","5","6","7","8","9","10","J","Q","K"};

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil            ipHashUtil;
    private final ObjectMapper          objectMapper;

    @Transactional
    public SolitaireSessionStartResponse createSession(
            SessionStartRequest req,
            HttpServletRequest httpReq) {

        List<String> deck = buildShuffledDeck();

        Instant now       = Instant.now();
        String sessionId  = UUID.randomUUID().toString();
        String ipHash     = ipHashUtil.hash(getClientIp(httpReq));

        Map<String, Object> extra = new HashMap<>();
        extra.put("deck", deck);

        GameSession session = GameSession.builder()
            .sessionId(sessionId)
            .game("solitaire")
            .level(req.getLevel())
            .ipHash(ipHash)
            .startedAt(now)
            .build();

        try {
            session.setExtra(objectMapper.writeValueAsString(extra));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 생성 오류");
        }
        sessionRepo.save(session);

        return SolitaireSessionStartResponse.builder()
            .sessionId(sessionId)
            .startedAt(now.toEpochMilli())
            .expiresAt(now.plusSeconds(EXPIRE_SECONDS).toEpochMilli())
            .deck(deck)
            .build();
    }

    private List<String> buildShuffledDeck() {
        List<String> deck = new ArrayList<>(52);
        for (String suit : SUITS)
            for (String val : VALUES)
                deck.add(val + suit);
        Collections.shuffle(deck);
        return deck;
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
