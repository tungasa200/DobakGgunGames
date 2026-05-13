package com.dobakggun.service;

import com.dobakggun.dto.yacht.YachtMatchResponse;
import com.dobakggun.entity.User;
import com.dobakggun.entity.yacht.YachtDiceType;
import com.dobakggun.entity.yacht.YachtParticipant;
import com.dobakggun.entity.yacht.YachtRoom;
import com.dobakggun.entity.yacht.YachtRoomStatus;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.repository.YachtParticipantRepository;
import com.dobakggun.repository.YachtRoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * POST /api/yacht/match 처리 서비스.
 *
 * d8 모드 도입 이후:
 * - match(userId, diceType) — diceType 필수.
 * - 매칭은 같은 diceType 방끼리만 (findAvailableRooms에 diceType 필터 추가).
 * - 신규 방 생성 시 diceType 저장.
 * - ALREADY_IN_ROOM 검사는 모드 무관 (한 사용자는 모드 막론 한 번에 한 방만).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YachtMatchService {

    private static final String LOCK_PREFIX    = "yacht:match:";
    private static final long   LOCK_TTL       = 3L;
    private static final int    LOCK_RETRY     = 3;
    private static final long   LOCK_DELAY_MS  = 100L;

    private static final String RATE_PREFIX       = "yacht:rate:";
    private static final long   RATE_WINDOW_SECS  = 10L;
    private static final long   RATE_LIMIT        = 5L;

    private final YachtRoomRepository        yachtRoomRepository;
    private final YachtParticipantRepository yachtParticipantRepository;
    private final UserRepository             userRepository;
    private final YachtGameService           yachtGameService;
    private final YachtBotService            yachtBotService;
    private final StringRedisTemplate        redisTemplate;

    /**
     * 자동 매칭 요청 처리.
     * @param userId   인증된 유저 ID (null 불가)
     * @param diceType D6 | D8 (컨트롤러에서 검증 완료)
     * @return 201(신규 방) or 200(기존 방 합류) 응답 DTO
     */
    @Transactional
    public YachtMatchResponse match(Long userId, YachtDiceType diceType) {
        // 1. Rate limit
        checkRateLimit(RATE_PREFIX + userId);

        // 2. 인메모리 ALREADY_IN_ROOM (모드 무관)
        Optional<String> inMemory = yachtGameService.findActiveRoomId(userId);
        if (inMemory.isPresent()) {
            throw new AlreadyInRoomException(inMemory.get());
        }

        // 3. DB ALREADY_IN_ROOM (모드 무관)
        List<YachtRoom> active = yachtRoomRepository.findActiveRoomsByUserId(
                userId, List.of(YachtRoomStatus.WAITING, YachtRoomStatus.PLAYING));
        if (!active.isEmpty()) {
            throw new AlreadyInRoomException(active.get(0).getRoomId());
        }

        // 4. Redis 분산락 (diceType별 분리 락)
        String lockKey   = LOCK_PREFIX + diceType.name();
        String lockValue = UUID.randomUUID().toString();
        boolean locked   = acquireLock(lockKey, lockValue);
        if (!locked) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "MATCH_UNAVAILABLE");
        }

        try {
            return doMatch(userId, diceType);
        } finally {
            releaseLock(lockKey, lockValue);
        }
    }

    private YachtMatchResponse doMatch(Long userId, YachtDiceType diceType) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"));

        // 1순위: 같은 diceType + WAITING + 정원 미달 방 FIFO
        List<YachtRoom> available = yachtRoomRepository.findAvailableRooms(YachtRoomStatus.WAITING, diceType);
        boolean asSpectator = false;

        // 2순위: WAITING이 없으면 같은 diceType + PLAYING + 정원 미달 방 (관전자로 입장)
        if (available.isEmpty()) {
            List<YachtRoom> playing = yachtRoomRepository.findAvailableRooms(YachtRoomStatus.PLAYING, diceType);
            if (!playing.isEmpty()) {
                available = playing;
                asSpectator = true;
            }
        }

        if (!available.isEmpty()) {
            YachtRoom room = available.get(0);

            List<YachtParticipant> existing = yachtParticipantRepository.findByRoomOrderByJoinOrderAsc(room);
            int joinOrder = existing.size();

            YachtParticipant participant = YachtParticipant.builder()
                    .room(room)
                    .userId(userId)
                    .joinOrder(joinOrder)
                    .ready(false)
                    .build();
            yachtParticipantRepository.save(participant);

            room.setCurrentPlayers(room.getCurrentPlayers() + 1);
            yachtRoomRepository.save(room);

            log.info("doMatch: userId={} 기존 방 {} 입장 ({}명, status={}, diceType={}, spectator={})",
                    userId, room.getRoomId(), room.getCurrentPlayers(), room.getStatus(), diceType, asSpectator);

            return YachtMatchResponse.builder()
                    .roomId(room.getRoomId())
                    .status(room.getStatus().name())
                    .diceType(room.getDiceType().name())
                    .playerCount(room.getCurrentPlayers())
                    .maxPlayers(room.getMaxPlayers())
                    .created(false)
                    .joinedAsSpectator(asSpectator)
                    .build();
        }

        // 신규 방 생성
        String newRoomId = generateRoomId();
        YachtRoom newRoom = YachtRoom.builder()
                .roomId(newRoomId)
                .status(YachtRoomStatus.WAITING)
                .hostUserId(userId)
                .maxPlayers(6)
                .currentPlayers(1)
                .diceType(diceType)
                .build();
        yachtRoomRepository.save(newRoom);

        YachtParticipant firstParticipant = YachtParticipant.builder()
                .room(newRoom)
                .userId(userId)
                .joinOrder(0)
                .ready(false)
                .build();
        yachtParticipantRepository.save(firstParticipant);

        log.info("doMatch: userId={} 신규 방 {} 생성 (diceType={})", userId, newRoomId, diceType);

        return YachtMatchResponse.builder()
                .roomId(newRoomId)
                .status(YachtRoomStatus.WAITING.name())
                .diceType(diceType.name())
                .playerCount(1)
                .maxPlayers(6)
                .created(true)
                .joinedAsSpectator(false)
                .build();
    }

    // ─── 봇 매칭 ─────────────────────────────────────────────────────────────

    /**
     * 봇 전용 1:1 방 생성.
     * - 인간 플레이어(방장) + 봇 유저(ready=true) 2명짜리 방을 즉시 생성.
     * - 자동 매칭 풀과 완전히 격리 (maxPlayers=2, 봇 전용 방).
     * - Redis 락 불필요 (경쟁 없음).
     */
    @Transactional
    public YachtMatchResponse matchBot(Long userId, YachtDiceType diceType) {
        // 기존 활성 방 중복 참여 방지
        Optional<String> inMemory = yachtGameService.findActiveRoomId(userId);
        if (inMemory.isPresent()) throw new AlreadyInRoomException(inMemory.get());

        List<YachtRoom> active = yachtRoomRepository.findActiveRoomsByUserId(
                userId, List.of(YachtRoomStatus.WAITING, YachtRoomStatus.PLAYING));
        if (!active.isEmpty()) throw new AlreadyInRoomException(active.get(0).getRoomId());

        long botId = yachtBotService.getBotUserId();

        // 봇 전용 2인 방 생성
        String newRoomId = generateRoomId();
        YachtRoom room = YachtRoom.builder()
                .roomId(newRoomId)
                .status(YachtRoomStatus.WAITING)
                .hostUserId(userId)
                .maxPlayers(2)
                .currentPlayers(2)
                .diceType(diceType)
                .build();
        yachtRoomRepository.save(room);

        // 인간 참가자 (방장, ready 불필요)
        yachtParticipantRepository.save(YachtParticipant.builder()
                .room(room).userId(userId).joinOrder(0).ready(false).build());

        // 봇 참가자 (ready=true — 인메모리 로딩 시 readySet에 자동 포함)
        yachtParticipantRepository.save(YachtParticipant.builder()
                .room(room).userId(botId).joinOrder(1).ready(true).build());

        log.info("matchBot: userId={} 봇 방 {} 생성 (diceType={})", userId, newRoomId, diceType);

        return YachtMatchResponse.builder()
                .roomId(newRoomId)
                .status(YachtRoomStatus.WAITING.name())
                .diceType(diceType.name())
                .playerCount(2)
                .maxPlayers(2)
                .created(true)
                .joinedAsSpectator(false)
                .build();
    }

    // ─── 방 현황 조회 ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getRoomStats() {
        long waitingD6  = yachtRoomRepository.countByStatusAndDiceType(YachtRoomStatus.WAITING, YachtDiceType.D6);
        long waitingD8  = yachtRoomRepository.countByStatusAndDiceType(YachtRoomStatus.WAITING, YachtDiceType.D8);
        long playingD6  = yachtRoomRepository.countByStatusAndDiceType(YachtRoomStatus.PLAYING, YachtDiceType.D6);
        long playingD8  = yachtRoomRepository.countByStatusAndDiceType(YachtRoomStatus.PLAYING, YachtDiceType.D8);
        long totalPlayers = Optional.ofNullable(
                yachtRoomRepository.sumCurrentPlayersByStatusIn(
                        List.of(YachtRoomStatus.WAITING, YachtRoomStatus.PLAYING))
        ).orElse(0L);

        return Map.of(
                "activeRooms",   waitingD6 + waitingD8 + playingD6 + playingD8,
                "activePlayers", totalPlayers,
                "D6", Map.of("waiting", waitingD6, "playing", playingD6),
                "D8", Map.of("waiting", waitingD8, "playing", playingD8)
        );
    }

    // ─── Rate Limit ───────────────────────────────────────────────────────────

    private void checkRateLimit(String key) {
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, RATE_WINDOW_SECS, TimeUnit.SECONDS);
            }
            if (count != null && count > RATE_LIMIT) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "MATCH_RATE_LIMIT");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("checkRateLimit: Redis 오류 key={}", key, e);
        }
    }

    // ─── 분산락 ───────────────────────────────────────────────────────────────

    private boolean acquireLock(String lockKey, String lockValue) {
        for (int i = 0; i < LOCK_RETRY; i++) {
            Boolean ok = redisTemplate.opsForValue()
                    .setIfAbsent(lockKey, lockValue, LOCK_TTL, TimeUnit.SECONDS);
            if (Boolean.TRUE.equals(ok)) return true;
            try { Thread.sleep(LOCK_DELAY_MS); } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    private void releaseLock(String lockKey, String lockValue) {
        try {
            String cur = redisTemplate.opsForValue().get(lockKey);
            if (lockValue.equals(cur)) redisTemplate.delete(lockKey);
        } catch (Exception e) {
            log.warn("releaseLock: Redis 오류 key={}", lockKey, e);
        }
    }

    // ─── roomId 생성 ─────────────────────────────────────────────────────────

    private String generateRoomId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toLowerCase();
    }

    // ─── 예외 ────────────────────────────────────────────────────────────────

    public static class AlreadyInRoomException extends RuntimeException {
        private final String roomId;

        public AlreadyInRoomException(String roomId) {
            super("ALREADY_IN_ROOM");
            this.roomId = roomId;
        }

        public String getRoomId() { return roomId; }
    }
}
