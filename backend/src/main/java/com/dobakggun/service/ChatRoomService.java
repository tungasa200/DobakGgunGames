package com.dobakggun.service;

import com.dobakggun.dto.chat.ChatMessageResponse;
import com.dobakggun.dto.chat.ChatRoomListResponse;
import com.dobakggun.dto.chat.ChatRoomResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Slf4j
@Service
public class ChatRoomService {

    private static final Pattern ROOM_NAME_PATTERN =
            Pattern.compile("^[가-힣a-zA-Z0-9 !?.\\-_()\\[\\]#]+$");
    private static final String CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final int MAX_ROOMS = 50;
    private static final int MAX_ROOM_ID_ATTEMPTS = 5;

    private final ChatRedisService chatRedisService;
    private final BadWordFilter badWordFilter;
    private final SecureRandom secureRandom = new SecureRandom();

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public ChatRoomService(ChatRedisService chatRedisService, BadWordFilter badWordFilter) {
        this.chatRedisService = chatRedisService;
        this.badWordFilter = badWordFilter;
    }

    public ChatRoomResponse createRoom(String name, Long userId, String nickname) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROOM_NAME_REQUIRED");
        }
        if (trimmed.length() > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROOM_NAME_TOO_LONG");
        }
        if (!ROOM_NAME_PATTERN.matcher(trimmed).matches() || badWordFilter.containsBadWord(trimmed)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROOM_NAME_INVALID");
        }
        if (chatRedisService.countActiveRooms() >= MAX_ROOMS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "ROOM_LIMIT_EXCEEDED");
        }

        String roomId = generateRoomId();

        try {
            chatRedisService.createRoom(roomId, trimmed, String.valueOf(userId), nickname);
        } catch (Exception e) {
            log.warn("ChatRoomService: Redis 장애로 방 생성 실패", e);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "REDIS_UNAVAILABLE");
        }

        String now = Instant.now().atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
        return ChatRoomResponse.builder()
                .roomId(roomId)
                .name(trimmed)
                .creatorNick(nickname)
                .createdAt(now)
                .build();
    }

    public ChatRoomListResponse listRooms() {
        try {
            List<String> roomIds = chatRedisService.listRoomIds();
            List<ChatRoomResponse> rooms = new ArrayList<>();
            for (String roomId : roomIds) {
                Optional<Map<Object, Object>> metaOpt = chatRedisService.getRoomMeta(roomId);
                if (metaOpt.isEmpty()) {
                    chatRedisService.removeFromRoomsSet(roomId);
                    continue;
                }
                Map<Object, Object> meta = metaOpt.get();
                String createdAtEpoch = (String) meta.get("createdAt");
                String lastActiveAt = epochMsToIso(chatRedisService.getRoomScore(roomId));
                rooms.add(ChatRoomResponse.builder()
                        .roomId(roomId)
                        .name((String) meta.get("name"))
                        .creatorId((String) meta.get("creatorId"))
                        .creatorNick((String) meta.get("creatorNick"))
                        .createdAt(epochMsToIso(createdAtEpoch))
                        .lastActiveAt(lastActiveAt)
                        .build());
            }
            return ChatRoomListResponse.builder()
                    .rooms(rooms)
                    .degraded(false)
                    .build();
        } catch (Exception e) {
            log.warn("ChatRoomService: listRooms Redis 오류", e);
            return ChatRoomListResponse.builder()
                    .rooms(List.of())
                    .degraded(true)
                    .build();
        }
    }

    public void deleteRoom(String roomId) {
        if (!chatRedisService.roomExists(roomId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
        }
        chatRedisService.deleteRoom(roomId);
        String ts = Instant.now().atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
        ChatMessageResponse systemMsg = ChatMessageResponse.builder()
                .type("SYSTEM")
                .userId(null)
                .nickname("system")
                .message("채팅방이 종료되었습니다.")
                .timestamp(ts)
                .build();
        messagingTemplate.convertAndSend("/topic/room/" + roomId, systemMsg);
    }

    private String generateRoomId() {
        for (int i = 0; i < MAX_ROOM_ID_ATTEMPTS; i++) {
            StringBuilder sb = new StringBuilder(8);
            for (int j = 0; j < 8; j++) {
                sb.append(CHARSET.charAt(secureRandom.nextInt(CHARSET.length())));
            }
            String candidate = sb.toString();
            if (!chatRedisService.roomExists(candidate)) {
                return candidate;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "방 ID 생성 실패");
    }

    private String epochMsToIso(String epochMsStr) {
        if (epochMsStr == null) return null;
        try {
            long ms = Long.parseLong(epochMsStr);
            return Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String epochMsToIso(Double score) {
        if (score == null) return null;
        return Instant.ofEpochMilli(score.longValue()).atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
    }
}
