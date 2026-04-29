package com.dobakggun.service;

import com.dobakggun.dto.yacht.YachtMatchResponse;
import com.dobakggun.entity.User;
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
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * POST /api/yacht/match 처리 서비스.
 *
 * - 로그인 유저 전용 (userId != null 보장).
 * - Redis 분산락 yacht:match:global 으로 동시 매칭 제어.
 * - Rate limit: 10초 내 5회 초과 시 429.
 * - ALREADY_IN_ROOM: 인메모리 + DB 두 레이어 확인.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YachtMatchService {

    private static final String LOCK_KEY      = "yacht:match:global";
    private static final long   LOCK_TTL      = 3L;
    private static final int    LOCK_RETRY    = 3;
    private static final long   LOCK_DELAY_MS = 100L;

    private static final String RATE_PREFIX      = "yacht:rate:";
    private static final long   RATE_WINDOW_SECS = 10L;
    private static final long   RATE_LIMIT       = 5L;

    private final YachtRoomRepository        yachtRoomRepository;
    private final YachtParticipantRepository yachtParticipantRepository;
    private final UserRepository             userRepository;
    private final YachtGameService           yachtGameService;
    private final StringRedisTemplate        redisTemplate;

    /**
     * 자동 매칭 요청 처리.
     * @param userId 인증된 유저 ID (null 불가)
     * @return 201(신규 방) or 200(기존 방 합류) 응답 DTO
     */
    @Transactional
    public YachtMatchResponse match(Long userId) {
        // 1. Rate limit
        checkRateLimit(RATE_PREFIX + userId);

        // 2. 인메모리 ALREADY_IN_ROOM
        Optional<String> inMemory = yachtGameService.findActiveRoomId(userId);
        if (inMemory.isPresent()) {
            throw new AlreadyInRoomException(inMemory.get());
        }

        // 3. DB ALREADY_IN_ROOM
        List<YachtRoom> active = yachtRoomRepository.findActiveRoomsByUserId(
                userId, List.of(YachtRoomStatus.WAITING, YachtRoomStatus.PLAYING));
        if (!active.isEmpty()) {
            throw new AlreadyInRoomException(active.get(0).getRoomId());
        }

        // 4. Redis 분산락
        String lockValue = UUID.randomUUID().toString();
        boolean locked = acquireLock(lockValue);
        if (!locked) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "MATCH_UNAVAILABLE");
        }

        try {
            return doMatch(userId);
        } finally {
            releaseLock(lockValue);
        }
    }

    private YachtMatchResponse doMatch(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"));

        // WAITING + 정원 미달 방 FIFO 탐색
        List<YachtRoom> available = yachtRoomRepository.findAvailableRooms(YachtRoomStatus.WAITING);

        if (!available.isEmpty()) {
            YachtRoom room = available.get(0);

            // 현재 참가자 수 확인 후 join_order 결정
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

            log.info("doMatch: userId={} 기존 방 {} 입장 ({}명)", userId, room.getRoomId(), room.getCurrentPlayers());

            return YachtMatchResponse.builder()
                    .roomId(room.getRoomId())
                    .status(YachtRoomStatus.WAITING.name())
                    .playerCount(room.getCurrentPlayers())
                    .maxPlayers(room.getMaxPlayers())
                    .created(false)
                    .build();
        }

        // 신규 방 생성
        String newRoomId = generateRoomId();
        YachtRoom newRoom = YachtRoom.builder()
                .roomId(newRoomId)
                .status(YachtRoomStatus.WAITING)
                .hostUserId(userId)
                .maxPlayers(4)
                .currentPlayers(1)
                .build();
        yachtRoomRepository.save(newRoom);

        YachtParticipant firstParticipant = YachtParticipant.builder()
                .room(newRoom)
                .userId(userId)
                .joinOrder(0)
                .ready(false)
                .build();
        yachtParticipantRepository.save(firstParticipant);

        log.info("doMatch: userId={} 신규 방 {} 생성", userId, newRoomId);

        return YachtMatchResponse.builder()
                .roomId(newRoomId)
                .status(YachtRoomStatus.WAITING.name())
                .playerCount(1)
                .maxPlayers(4)
                .created(true)
                .build();
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

    private boolean acquireLock(String lockValue) {
        for (int i = 0; i < LOCK_RETRY; i++) {
            Boolean ok = redisTemplate.opsForValue()
                    .setIfAbsent(LOCK_KEY, lockValue, LOCK_TTL, TimeUnit.SECONDS);
            if (Boolean.TRUE.equals(ok)) return true;
            try { Thread.sleep(LOCK_DELAY_MS); } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    private void releaseLock(String lockValue) {
        try {
            String cur = redisTemplate.opsForValue().get(LOCK_KEY);
            if (lockValue.equals(cur)) redisTemplate.delete(LOCK_KEY);
        } catch (Exception e) {
            log.warn("releaseLock: Redis 오류", e);
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
