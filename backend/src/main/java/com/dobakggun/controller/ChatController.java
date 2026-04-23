package com.dobakggun.controller;

import com.dobakggun.dto.chat.ChatErrorResponse;
import com.dobakggun.dto.chat.ChatMessageResponse;
import com.dobakggun.dto.chat.ChatSendRequest;
import com.dobakggun.security.ChatPrincipal;
import com.dobakggun.service.ChatRedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.security.Principal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Slf4j
@Controller
public class ChatController {

    private static final int MAX_MESSAGE_LENGTH = 200;
    private static final Pattern ROOM_TOPIC_PATTERN = Pattern.compile("^/topic/room/([a-z0-9]{8})$");
    private static final Pattern ROOM_ID_PATTERN = Pattern.compile("^[a-z0-9]{8}$");

    private final ChatRedisService chatRedisService;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public ChatController(ChatRedisService chatRedisService) {
        this.chatRedisService = chatRedisService;
    }

    @MessageMapping("/chat/{roomId}")
    public void handleMessage(@DestinationVariable String roomId,
                              ChatSendRequest request,
                              Principal principal) {
        if (!(principal instanceof ChatPrincipal chatPrincipal)) {
            return;
        }

        // roomId 패턴 검증
        if (!ROOM_ID_PATTERN.matcher(roomId).matches()) {
            sendError(chatPrincipal, "INVALID_ROOM_ID", "유효하지 않은 방 ID입니다.");
            return;
        }

        // 방 존재 여부 확인
        if (!chatRedisService.roomExists(roomId)) {
            sendError(chatPrincipal, "ROOM_NOT_FOUND", "채팅방이 존재하지 않거나 종료되었습니다.");
            return;
        }

        String text = request.getMessage() == null ? "" : request.getMessage().trim();
        if (text.isEmpty()) {
            sendError(chatPrincipal, "MESSAGE_EMPTY", "메시지를 입력해주세요.");
            return;
        }
        if (text.length() > MAX_MESSAGE_LENGTH) {
            sendError(chatPrincipal, "MESSAGE_TOO_LONG", "메시지는 200자를 넘을 수 없습니다.");
            return;
        }

        String ts = now();
        ChatMessageResponse msg = ChatMessageResponse.builder()
                .type("CHAT")
                .userId(chatPrincipal.getUserId())
                .nickname(chatPrincipal.getNickname())
                .message(text)
                .timestamp(ts)
                .build();

        messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
        chatRedisService.saveMessage(roomId, msg);
        log.info("CHAT roomId={} userId={}", roomId, chatPrincipal.getUserId());
    }

    @EventListener
    @SuppressWarnings("unchecked")
    public void handleSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();
        if (destination == null) return;

        var matcher = ROOM_TOPIC_PATTERN.matcher(destination);
        if (!matcher.matches()) return;

        String roomId = matcher.group(1);
        Principal principal = event.getUser();
        if (!(principal instanceof ChatPrincipal chatPrincipal)) {
            // Principal 타입 불일치 fallback 처리
            if (principal != null) {
                log.warn("SessionSubscribeEvent: unknown principal type={}, name={}",
                        principal.getClass().getName(), principal.getName());
            } else {
                log.warn("SessionSubscribeEvent: principal is null");
            }
            return;
        }

        String nickname = chatPrincipal.getNickname();
        String ts = now();
        ChatMessageResponse systemMsg = ChatMessageResponse.builder()
                .type("SYSTEM")
                .userId(null)
                .nickname("system")
                .message(nickname + "님이 입장하셨습니다.")
                .timestamp(ts)
                .build();

        messagingTemplate.convertAndSend("/topic/room/" + roomId, systemMsg);
        chatRedisService.saveMessage(roomId, systemMsg);
        log.info("ENTER roomId={} userId={}", roomId, chatPrincipal.getUserId());

        // 다중 방 구독 지원: Set<String>으로 누적 관리
        Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
        if (sessionAttrs != null) {
            Set<String> subscribedRooms = (Set<String>) sessionAttrs.get("subscribedRoomIds");
            if (subscribedRooms == null) {
                subscribedRooms = new HashSet<>();
                sessionAttrs.put("subscribedRoomIds", subscribedRooms);
            }
            subscribedRooms.add(roomId);
        }
    }

    @EventListener
    @SuppressWarnings("unchecked")
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = event.getUser();
        if (!(principal instanceof ChatPrincipal chatPrincipal)) return;

        Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
        if (sessionAttrs == null) return;

        // 다중 방 구독 지원: 모든 구독 방에 퇴장 메시지 발송
        Set<String> subscribedRooms = (Set<String>) sessionAttrs.get("subscribedRoomIds");
        if (subscribedRooms == null || subscribedRooms.isEmpty()) return;

        String ts = now();
        String leaveMessage = chatPrincipal.getNickname() + "님이 퇴장하셨습니다.";

        for (String roomId : subscribedRooms) {
            if (!chatRedisService.roomExists(roomId)) continue;

            ChatMessageResponse systemMsg = ChatMessageResponse.builder()
                    .type("SYSTEM")
                    .userId(null)
                    .nickname("system")
                    .message(leaveMessage)
                    .timestamp(ts)
                    .build();

            messagingTemplate.convertAndSend("/topic/room/" + roomId, systemMsg);
            // 퇴장 메시지는 TTL 갱신 없이 저장 (방 만료 시점에 영향을 주지 않음)
            chatRedisService.saveMessageWithoutTTLRefresh(roomId, systemMsg);
            log.info("LEAVE roomId={} userId={}", roomId, chatPrincipal.getUserId());
        }
    }

    private void sendError(ChatPrincipal principal, String code, String message) {
        ChatErrorResponse error = ChatErrorResponse.builder()
                .code(code)
                .message(message)
                .build();
        messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/errors", error);
    }

    private String now() {
        return Instant.now().atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
    }
}
