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
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * POST /api/rps/match 처리 서비스.
 *
 * - Redis 분산락으로 동시성 제어.
 * - Rate limit: 10초 내 5회 초과 시 429.
 * - ALREADY_IN_ROOM: 인메모리 + DB 두 레이어에서 확인 (게스트는 인메모리만).
 * - 비로그인 게스트: guestToken(guest_{UUID}) 기반 식별, 음수 Long ID 파생.
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

    private static final String GUEST_PREFIX = "guest_";
    private static final Pattern GUEST_TOKEN_PATTERN = Pattern.compile(
        "^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    );

    private final RpsRoomRepository rpsRoomRepository;
    private final UserRepository userRepository;
    private final RpsRoomService rpsRoomService;
    private final StringRedisTemplate redisTemplate;

    /**
     * 자동 매칭 요청 처리.
     *
     * @param userId     인증된 유저 ID. 비로그인 시 null.
     * @param guestToken 클라이언트가 보관 중인 guestToken. 없으면 null.
     * @return 201(신규 생성) or 200(기존 입장) 응답 DTO
     */
    @Transactional
    public MatchResponseDto match(Long userId, String guestToken) {
        boolean isGuest = (userId == null);
        String resolvedGuestToken = null;
        Long effectiveUserId;
        String nickname;
        User user = null;

        if (isGuest) {
            resolvedGuestToken = resolveGuestToken(guestToken);
            effectiveUserId = guestTokenToLong(resolvedGuestToken);
            nickname = buildGuestNickname(resolvedGuestToken);
            log.debug("match: 게스트 effectiveUserId={} guestToken={}", effectiveUserId, resolvedGuestToken);
        } else {
            effectiveUserId = userId;
            user = userRepository.findById(Objects.requireNonNull(userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"));
            nickname = user.getNickname();
            log.debug("match: 로그인 userId={} nickname={}", userId, nickname);
        }

        // 1. Rate limit 확인
        String rateKey = isGuest
                ? RATE_KEY_PREFIX + "g" + effectiveUserId
                : RATE_KEY_PREFIX + effectiveUserId;
        checkRateLimit(rateKey);

        // 2. ALREADY_IN_ROOM — 인메모리
        Optional<String> existingRoomId = rpsRoomService.findActiveRoomId(effectiveUserId);
        if (existingRoomId.isPresent()) {
            throw new AlreadyInRoomException(existingRoomId.get());
        }

        // 3. ALREADY_IN_ROOM — DB (로그인 사용자만, 게스트는 DB createdBy 없음)
        if (!isGuest) {
            List<RoomStatus> activeStatuses = List.of(RoomStatus.WAITING, RoomStatus.PLAYING);
            List<RpsRoom> activeRooms = rpsRoomRepository.findActiveRoomsByCreatedBy(userId, activeStatuses);
            if (!activeRooms.isEmpty()) {
                throw new AlreadyInRoomException(activeRooms.get(0).getRoomId());
            }
        }

        // 4. Redis 분산락 획득
        String lockValue = UUID.randomUUID().toString();
        boolean locked = acquireLock(lockValue);
        if (!locked) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "MATCH_UNAVAILABLE");
        }

        try {
            return doMatch(effectiveUserId, nickname, user, resolvedGuestToken);
        } finally {
            releaseLock(lockValue);
        }
    }

    private MatchResponseDto doMatch(Long effectiveUserId, String nickname, User user, String guestToken) {
        // WAITING + 정원 미달 방 탐색 (FIFO)
        List<RpsRoom> available = rpsRoomRepository.findAvailableRooms(RoomStatus.WAITING);

        if (!available.isEmpty()) {
            RpsRoom room = available.get(0);
            int newCount = room.getCurrentPlayers() + 1;
            room.setCurrentPlayers(newCount);
            rpsRoomRepository.save(room);

            log.info("doMatch: effectiveUserId={} 기존 방 {} 입장 ({}명)", effectiveUserId, room.getRoomId(), newCount);

            return MatchResponseDto.builder()
                    .roomId(room.getRoomId())
                    .status(RoomStatus.WAITING.name())
                    .playerCount(newCount)
                    .maxPlayers(room.getMaxPlayers())
                    .created(false)
                    .guestToken(guestToken) // 로그인 사용자이면 null → JSON 미포함
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
                .createdBy(user) // 게스트이면 null
                .build();
        rpsRoomRepository.save(newRoom);

        log.info("doMatch: effectiveUserId={} 신규 방 {} 생성 (guest={})", effectiveUserId, newRoomId, guestToken != null);

        return MatchResponseDto.builder()
                .roomId(newRoomId)
                .status(RoomStatus.WAITING.name())
                .playerCount(1)
                .maxPlayers(4)
                .created(true)
                .guestToken(guestToken) // 로그인 사용자이면 null → JSON 미포함
                .build();
    }

    // ─── 게스트 토큰 유틸 ────────────────────────────────────────────────────

    /**
     * 제공된 guestToken이 유효하면 그대로 사용, 아니면 신규 발급.
     */
    private String resolveGuestToken(String provided) {
        if (provided != null && GUEST_TOKEN_PATTERN.matcher(provided).matches()) {
            return provided;
        }
        return GUEST_PREFIX + UUID.randomUUID();
    }

    /**
     * guestToken에서 Long ID 파생. MSBits | Long.MIN_VALUE → 항상 음수 (로그인 ID와 충돌 없음).
     */
    private Long guestTokenToLong(String guestToken) {
        String uuidStr = guestToken.substring(GUEST_PREFIX.length());
        UUID uuid = UUID.fromString(uuidStr);
        return uuid.getMostSignificantBits() | Long.MIN_VALUE;
    }

    /**
     * guestToken에서 닉네임 생성. 예: guest_b3f1... → 손님-B3F1
     */
    private String buildGuestNickname(String guestToken) {
        String uuid = guestToken.substring(GUEST_PREFIX.length()).replace("-", "");
        return "손님-" + uuid.substring(0, 4).toUpperCase();
    }

    // ─── Rate Limit ───────────────────────────────────────────────────────────

    private void checkRateLimit(String key) {
        try {
            String safeKey = Objects.requireNonNull(key);
            Long count = redisTemplate.opsForValue().increment(safeKey);
            if (count != null && count == 1) {
                redisTemplate.expire(safeKey, RATE_WINDOW_SECONDS, TimeUnit.SECONDS);
            }
            if (count != null && count > RATE_LIMIT) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "MATCH_RATE_LIMIT");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            // Redis 오류 시 Rate limit 건너뜀 (서비스 가용성 우선)
            log.warn("checkRateLimit: Redis 오류 key={}", key, e);
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

    @Transactional(readOnly = true)
    public Map<String, Long> getRoomStats() {
        long waiting = rpsRoomRepository.countByStatus(RoomStatus.WAITING);
        long playing  = rpsRoomRepository.countByStatus(RoomStatus.PLAYING);
        return Map.of("waitingRooms", waiting, "playingRooms", playing, "activeRooms", waiting + playing);
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
