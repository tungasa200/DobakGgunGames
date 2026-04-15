package com.dobakggun.service;

import com.dobakggun.dto.GuessRequest;
import com.dobakggun.dto.GuessResponse;
import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.dto.SessionStartResponse;
import com.dobakggun.entity.GameSession;
import com.dobakggun.entity.GameSession.SessionState;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BaseballSessionService {

    private static final Map<String, Integer> DIGIT_COUNTS = Map.of(
        "easy", 3, "normal", 4, "hard", 5
    );
    private static final Map<String, Integer> MAX_ATTEMPTS = Map.of(
        "easy", 10, "normal", 15, "hard", 20
    );
    private static final long EXPIRE_SECONDS = 7200L;

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil ipHashUtil;
    private final ObjectMapper objectMapper;

    // ── 세션 생성 (서버에서 정답 생성) ─────────────────────────────────
    @Transactional
    public SessionStartResponse createSession(SessionStartRequest req, HttpServletRequest httpReq) {
        Integer digitCount = DIGIT_COUNTS.get(req.getLevel());
        if (digitCount == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 레벨입니다.");
        }

        Instant now = Instant.now();
        String sessionId = UUID.randomUUID().toString();
        String ipHash = ipHashUtil.hash(getClientIp(httpReq));

        List<Integer> answer = generateAnswer(digitCount);
        Map<String, Object> extra = new HashMap<>();
        extra.put("answer", answer);
        extra.put("attempts", 0);
        extra.put("won", false);
        extra.put("gameOver", false);

        GameSession session = GameSession.builder()
            .sessionId(sessionId)
            .game("baseball")
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

        return SessionStartResponse.builder()
            .sessionId(sessionId)
            .startedAt(now.toEpochMilli())
            .expiresAt(now.plusSeconds(EXPIRE_SECONDS).toEpochMilli())
            .digitCount(digitCount)
            .build();
    }

    // ── 추측 처리 ────────────────────────────────────────────────────────
    @Transactional
    public GuessResponse processGuess(GuessRequest req, HttpServletRequest httpReq) {
        GameSession session = sessionRepo.findById(req.getSessionId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 세션입니다."));

        if (!session.getGame().equals("baseball")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "세션 게임 정보가 일치하지 않습니다.");
        }
        if (session.getState() != SessionState.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 종료된 세션입니다.");
        }

        Instant expiresAt = session.getStartedAt().plusSeconds(EXPIRE_SECONDS);
        if (Instant.now().isAfter(expiresAt)) {
            session.setState(SessionState.EXPIRED);
            sessionRepo.save(session);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "세션이 만료되었습니다.");
        }

        Map<String, Object> extra = parseExtra(session.getExtra());

        if (Boolean.TRUE.equals(extra.get("won")) || Boolean.TRUE.equals(extra.get("gameOver"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 종료된 게임입니다.");
        }

        @SuppressWarnings("unchecked")
        List<Integer> answer = ((List<?>) extra.get("answer")).stream()
            .map(v -> ((Number) v).intValue())
            .collect(Collectors.toList());
        int digitCount = answer.size();
        int maxAtt = Objects.requireNonNull(MAX_ATTEMPTS.get(session.getLevel()));

        // 입력 검증
        String guess = req.getGuess().trim();
        if (!guess.matches("\\d{" + digitCount + "}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, digitCount + "자리 숫자를 입력하세요.");
        }
        List<Integer> digits = guess.chars().map(c -> c - '0').boxed().toList();
        if (new HashSet<>(digits).size() != digitCount) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "중복되지 않는 숫자를 입력하세요.");
        }

        // 스트라이크 / 볼
        int strikes = 0, balls = 0;
        for (int i = 0; i < digitCount; i++) {
            if (digits.get(i).equals(answer.get(i))) strikes++;
            else if (answer.contains(digits.get(i))) balls++;
        }

        int attempts = ((Number) extra.get("attempts")).intValue() + 1;
        boolean won = strikes == digitCount;
        boolean gameOver = !won && attempts >= maxAtt;
        double elapsed = (Instant.now().toEpochMilli() - session.getStartedAt().toEpochMilli()) / 1000.0;

        // IP 불일치 감지 (로깅 목적, 거부하지 않음)
        String currentIpHash = ipHashUtil.hash(getClientIp(httpReq));
        if (!session.getIpHash().equals(currentIpHash) && !session.isIpMismatch()) {
            log.warn("IP mismatch during guess: sessionId={}", req.getSessionId());
            session.setIpMismatch(true);
        }

        extra.put("attempts", attempts);
        if (won)      extra.put("won", true);
        if (gameOver) extra.put("gameOver", true);

        try {
            session.setExtra(objectMapper.writeValueAsString(extra));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 업데이트 오류");
        }
        sessionRepo.save(session);

        String revealedAnswer = gameOver
            ? answer.stream().map(String::valueOf).collect(Collectors.joining())
            : null;

        return new GuessResponse(strikes, balls, attempts, won, gameOver, elapsed, revealedAnswer);
    }

    // ── 랭킹 제출 시 검증 (승리 세션만 허용) ────────────────────────────
    @Transactional
    public GameSession validateWinAndConsume(String sessionId, HttpServletRequest httpReq) {
        GameSession session = sessionRepo.findById(sessionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 세션입니다."));

        if (!session.getGame().equals("baseball")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "세션 게임 정보가 일치하지 않습니다.");
        }
        if (session.getState() != SessionState.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 사용되었거나 만료된 세션입니다.");
        }

        Map<String, Object> extra = parseExtra(session.getExtra());
        if (!Boolean.TRUE.equals(extra.get("won"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "클리어하지 않은 세션입니다.");
        }

        // IP 불일치 감지
        String currentIpHash = ipHashUtil.hash(getClientIp(httpReq));
        if (!session.getIpHash().equals(currentIpHash)) {
            log.warn("IP mismatch on baseball submit: sessionId={}", sessionId);
            session.setIpMismatch(true);
        }

        session.setState(SessionState.SUBMITTED);
        session.setSubmittedAt(Instant.now());
        sessionRepo.save(session);
        return session;
    }

    // ── 내부 유틸 ────────────────────────────────────────────────────────
    private List<Integer> generateAnswer(int n) {
        List<Integer> pool = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9));
        Collections.shuffle(pool);
        return new ArrayList<>(pool.subList(0, n));
    }

    private Map<String, Object> parseExtra(String extra) {
        try {
            if (extra == null) return new HashMap<>();
            return objectMapper.readValue(extra, new TypeReference<>() {});
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 데이터 오류");
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
