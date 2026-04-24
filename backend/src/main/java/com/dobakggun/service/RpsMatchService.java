package com.dobakggun.service;

import com.dobakggun.dto.rps.MatchResponseDto;
import com.dobakggun.entity.User;
import com.dobakggun.entity.rps.RoomStatus;
import com.dobakggun.entity.rps.RpsRoom;
import com.dobakggun.repository.RpsRoomRepository;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * POST /api/rps/match 처리 서비스.
 *
 * - Redis 분산락으로 동시성 제어.
 * - Rate limit: 10초 내 5회 초과 시 429.
 * - ALREADY_IN_ROOM: 인메모리 + DB 두 레이어에서 확인.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RpsMatchService {

    private static final String LOCK_KEY = "rps:match:global";
    private static final long LOCK_TTL_SECONDS = 3;
    private static final int LOCK_RETRY = 3;
    private static final long LOCK_RETRY_DELAY_MS = 100;

    private static final String RATE_KEY_PREFIX = "rps:rate:";
    private static final long RATE_WINDOW_SECONDS = 10;
    private static final long RATE_LIMIT = 5;

    private final RpsRoomRepository rpsRoomRepository;
    private final UserRepository userRepository;
    private final RpsRoomService rpsRoomService;
    private final StringRedisTemplate redisTemplate;

    /**
     * 자동 매칭 요청 처리.
     *
     * @param userId 인증된 유저 ID
     * @return 201(신규 생성) or 200(기존 입장) 응답 DTO
     */
    @Transactional
    public MatchResponseDto match(Long userId) {
        // 1. Rate limit 확인
        checkRateLimit(userId);

        // 2. 이미 활성 방에 있는지 확인 (인메모리 우선)
        Optional<String> existingRoomId = rpsRoomService.findActiveRoomId(userId);
        if (existingRoomId.isPresent()) {
            throw new AlreadyInRoomException(existingRoomId.get());
        }

        // DB에서도 확인 (서버 재시작 후 등 인메모리 누락 케이스)
        List<RoomStatus> activeStatuses = List.of(RoomStatus.WAITING, RoomStatus.PLAYING);
        List<RpsRoom> activeRooms = rpsRoomRepository.findActiveRoomsByCreatedBy(userId, activeStatuses);
        if (!activeRooms.isEmpty()) {
            throw new AlreadyInRoomException(activeRooms.get(0).getRoomId());
        }

        // 3. Redis 분산락 획득
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

    private MatchResponseDto doMatch(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"));

        // WAITING + 정원 미달 방 탐색 (FIFO)
        List<RpsRoom> available = rpsRoomRepository.findAvailableRooms(RoomStatus.WAITING);

        if (!available.isEmpty()) {
            RpsRoom room = available.get(0);
            int newCount = room.getCurrentPlayers() + 1;
            room.setCurrentPlayers(newCount);
            rpsRoomRepository.save(room);

            log.info("doMatch: userId={} 기존 방 {} 입장 ({}명)", userId, room.getRoomId(), newCount);

            return MatchResponseDto.builder()
                    .roomId(room.getRoomId())
                    .status(RoomStatus.WAITING.name())
                    .playerCount(newCount)
                    .maxPlayers(room.getMaxPlayers())
                    .created(false)
                    .build();
        }

        // 신규 방 생성
        String newRoomId = generateRoomId();
        String name = "RPS-" + Instant.now().toEpochMilli();
        RpsRoom newRoom = RpsRoom.builder()
                .roomId(newRoomId)
                .name(name)
                .status(RoomStatus.WAITING)
                .maxPlayers(4)
                .currentPlayers(1)
                .createdBy(user)
                .build();
        rpsRoomRepository.save(newRoom);

        log.info("doMatch: userId={} 신규 방 {} 생성", userId, newRoomId);

        return MatchResponseDto.builder()
                .roomId(newRoomId)
                .status(RoomStatus.WAITING.name())
                .playerCount(1)
                .maxPlayers(4)
                .created(true)
                .build();
    }

    // ─── Rate Limit ───────────────────────────────────────────────────────────

    private void checkRateLimit(Long userId) {
        String key = RATE_KEY_PREFIX + userId;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1) {
                redisTemplate.expire(key, RATE_WINDOW_SECONDS, TimeUnit.SECONDS);
            }
            if (count != null && count > RATE_LIMIT) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "MATCH_RATE_LIMIT");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            // Redis 오류 시 Rate limit 건너뜀 (서비스 가용성 우선)
            log.warn("checkRateLimit: Redis 오류 userId={}", userId, e);
        }
    }

    // ─── 분산락 ───────────────────────────────────────────────────────────────

    private boolean acquireLock(String lockValue) {
        for (int i = 0; i < LOCK_RETRY; i++) {
            Boolean acquired = redisTemplate.opsForValue()
                    .setIfAbsent(LOCK_KEY, lockValue, LOCK_TTL_SECONDS, TimeUnit.SECONDS);
            if (Boolean.TRUE.equals(acquired)) {
                return true;
            }
            try {
                Thread.sleep(LOCK_RETRY_DELAY_MS);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    private void releaseLock(String lockValue) {
        try {
            String current = redisTemplate.opsForValue().get(LOCK_KEY);
            if (lockValue.equals(current)) {
                redisTemplate.delete(LOCK_KEY);
            }
        } catch (Exception e) {
            log.warn("releaseLock: Redis 오류", e);
        }
    }

    // ─── roomId 생성 ─────────────────────────────────────────────────────────

    private String generateRoomId() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return uuid.substring(0, 8).toLowerCase();
    }

    // ─── 예외 ────────────────────────────────────────────────────────────────

    public static class AlreadyInRoomException extends RuntimeException {
        private final String roomId;

        public AlreadyInRoomException(String roomId) {
            super("ALREADY_IN_ROOM");
            this.roomId = roomId;
        }

        public String getRoomId() {
            return roomId;
        }
    }
}
