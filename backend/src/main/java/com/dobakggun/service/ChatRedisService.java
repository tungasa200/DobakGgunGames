package com.dobakggun.service;

import com.dobakggun.dto.chat.ChatMessageResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatRedisService {

    private static final String HISTORY_KEY = "chat:room:%s";
    private static final String META_KEY = "chat:room:meta:%s";
    private static final String ROOMS_KEY = "chat:rooms";
    private static final long ROOM_TTL = 3600L;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public void saveMessage(String roomId, ChatMessageResponse msg) {
        String historyKey = String.format(HISTORY_KEY, roomId);
        String metaKey = String.format(META_KEY, roomId);
        try {
            String json = objectMapper.writeValueAsString(msg);
            redisTemplate.opsForList().leftPush(historyKey, json);
            redisTemplate.opsForList().trim(historyKey, 0, 99);
            redisTemplate.expire(historyKey, ROOM_TTL, TimeUnit.SECONDS);
            redisTemplate.expire(metaKey, ROOM_TTL, TimeUnit.SECONDS);
            redisTemplate.opsForZSet().add(ROOMS_KEY, roomId, (double) System.currentTimeMillis());
        } catch (JsonProcessingException e) {
            log.warn("ChatRedisService: 메시지 직렬화 실패 roomId={}", roomId, e);
        } catch (Exception e) {
            log.warn("ChatRedisService: saveMessage 실패 roomId={}", roomId, e);
        }
    }

    /**
     * 메시지를 저장하되 TTL을 갱신하지 않는다.
     * 퇴장 시스템 메시지처럼 방의 만료 시점에 영향을 주어서는 안 되는 경우에 사용한다.
     * LPUSH + LTRIM만 수행하며 EXPIRE는 생략한다.
     */
    public void saveMessageWithoutTTLRefresh(String roomId, ChatMessageResponse msg) {
        String historyKey = String.format(HISTORY_KEY, roomId);
        try {
            String json = objectMapper.writeValueAsString(msg);
            redisTemplate.opsForList().leftPush(historyKey, json);
            redisTemplate.opsForList().trim(historyKey, 0, 99);
            // EXPIRE 갱신 의도적으로 생략 — 기존 TTL 유지
        } catch (JsonProcessingException e) {
            log.warn("ChatRedisService: 메시지 직렬화 실패 (noTTL) roomId={}", roomId, e);
        } catch (Exception e) {
            log.warn("ChatRedisService: saveMessageWithoutTTLRefresh 실패 roomId={}", roomId, e);
        }
    }

    public List<ChatMessageResponse> getHistory(String roomId) {
        String historyKey = String.format(HISTORY_KEY, roomId);
        List<String> jsonList = redisTemplate.opsForList().range(historyKey, 0, 49);
        if (jsonList == null || jsonList.isEmpty()) {
            return Collections.emptyList();
        }
        List<ChatMessageResponse> messages = new ArrayList<>();
        for (String json : jsonList) {
            try {
                messages.add(objectMapper.readValue(json, ChatMessageResponse.class));
            } catch (JsonProcessingException e) {
                log.warn("ChatRedisService: 메시지 역직렬화 실패", e);
            }
        }
        Collections.reverse(messages);
        return messages;
    }

    public void createRoom(String roomId, String name, String creatorId, String creatorNick) {
        String metaKey = String.format(META_KEY, roomId);
        long now = System.currentTimeMillis();
        Map<String, String> fields = new HashMap<>();
        fields.put("name", name);
        fields.put("creatorId", creatorId);
        fields.put("creatorNick", creatorNick);
        fields.put("createdAt", String.valueOf(now));
        redisTemplate.opsForHash().putAll(metaKey, fields);
        redisTemplate.expire(metaKey, ROOM_TTL, TimeUnit.SECONDS);
        redisTemplate.opsForZSet().add(ROOMS_KEY, roomId, (double) now);
    }

    public Optional<Map<Object, Object>> getRoomMeta(String roomId) {
        String metaKey = String.format(META_KEY, roomId);
        try {
            Map<Object, Object> meta = redisTemplate.opsForHash().entries(metaKey);
            if (meta == null || meta.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(meta);
        } catch (Exception e) {
            log.warn("ChatRedisService: getRoomMeta 실패 roomId={}", roomId, e);
            return Optional.empty();
        }
    }

    public void deleteRoom(String roomId) {
        try {
            redisTemplate.delete(String.format(HISTORY_KEY, roomId));
            redisTemplate.delete(String.format(META_KEY, roomId));
            redisTemplate.opsForZSet().remove(ROOMS_KEY, roomId);
        } catch (Exception e) {
            log.warn("ChatRedisService: deleteRoom 실패 roomId={}", roomId, e);
        }
    }

    public boolean roomExists(String roomId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(String.format(META_KEY, roomId)));
        } catch (Exception e) {
            log.warn("ChatRedisService: roomExists 실패 roomId={}", roomId, e);
            return false;
        }
    }

    public long countActiveRooms() {
        try {
            Long count = redisTemplate.opsForZSet().size(ROOMS_KEY);
            return count != null ? count : 0L;
        } catch (Exception e) {
            log.warn("ChatRedisService: countActiveRooms 실패", e);
            return 0L;
        }
    }

    public List<String> listRoomIds() {
        try {
            Set<String> ids = redisTemplate.opsForZSet().reverseRange(ROOMS_KEY, 0, 49);
            if (ids == null) return Collections.emptyList();
            return new ArrayList<>(ids);
        } catch (Exception e) {
            log.warn("ChatRedisService: listRoomIds 실패", e);
            return Collections.emptyList();
        }
    }

    public void removeFromRoomsSet(String roomId) {
        try {
            redisTemplate.opsForZSet().remove(ROOMS_KEY, roomId);
        } catch (Exception e) {
            log.warn("ChatRedisService: removeFromRoomsSet 실패 roomId={}", roomId, e);
        }
    }

    @Scheduled(fixedDelay = 300_000)
    public void sweepExpiredRooms() {
        try {
            long cutoff = System.currentTimeMillis() - ROOM_TTL * 1000;
            Set<String> expired = redisTemplate.opsForZSet()
                    .rangeByScore(ROOMS_KEY, 0, cutoff);
            if (expired != null && !expired.isEmpty()) {
                redisTemplate.opsForZSet().removeRangeByScore(ROOMS_KEY, 0, cutoff);
                log.info("ChatRedisService: 만료 방 {}개 스윕 완료", expired.size());
            }
        } catch (Exception e) {
            log.warn("ChatRedisService: sweepExpiredRooms 실패", e);
        }
    }

    public Double getRoomScore(String roomId) {
        try {
            return redisTemplate.opsForZSet().score(ROOMS_KEY, roomId);
        } catch (Exception e) {
            log.warn("ChatRedisService: getRoomScore 실패 roomId={}", roomId, e);
            return null;
        }
    }
}
