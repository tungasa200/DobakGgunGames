package com.dobakggun.controller;

import com.dobakggun.dto.rps.RpsChooseRequest;
import com.dobakggun.security.ChatPrincipal;
import com.dobakggun.service.RpsRoomService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

/**
 * Online RPS WebSocket (STOMP) 컨트롤러.
 *
 * 발행 경로:
 *   /app/rps/room/{roomId}/join
 *   /app/rps/room/{roomId}/choose
 *   /app/rps/room/{roomId}/rematch
 *   /app/rps/room/{roomId}/leave
 *
 * 구독 경로 (브로커가 처리):
 *   /topic/rps/room/{roomId}
 */
@Slf4j
@Controller
public class OnlineRpsWebSocketController {

    private static final String SESSION_KEY = "rpsSubscribedRoomIds";

    private final RpsRoomService rpsRoomService;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public OnlineRpsWebSocketController(RpsRoomService rpsRoomService) {
        this.rpsRoomService = rpsRoomService;
    }

    // ─── JOIN ─────────────────────────────────────────────────────────────────

    @MessageMapping("/rps/room/{roomId}/join")
    public void handleJoin(@DestinationVariable String roomId,
                           StompHeaderAccessor accessor,
                           Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        boolean ok = rpsRoomService.joinRoom(roomId, cp.getUserId(), cp.getNickname());
        if (!ok) {
            sendError(cp, "ROOM_NOT_AVAILABLE", "방에 입장할 수 없습니다.");
            return;
        }

        // 세션 속성에 roomId 기록 (Disconnect 시 참조)
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null) {
            @SuppressWarnings("unchecked")
            Set<String> rpsRooms = (Set<String>) attrs.get(SESSION_KEY);
            if (rpsRooms == null) {
                rpsRooms = new HashSet<>();
                attrs.put(SESSION_KEY, rpsRooms);
            }
            rpsRooms.add(roomId);
        }

        log.info("WS JOIN roomId={} userId={}", roomId, cp.getUserId());
    }

    // ─── CHOOSE ───────────────────────────────────────────────────────────────

    @MessageMapping("/rps/room/{roomId}/choose")
    public void handleChoose(@DestinationVariable String roomId,
                             @Payload(required = false) RpsChooseRequest request,
                             Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        if (request == null || request.getChoice() == null) {
            sendError(cp, "INVALID_CHOICE", "choice 값은 ROCK/PAPER/SCISSORS 중 하나여야 합니다.");
            return;
        }

        String error = rpsRoomService.recordChoice(roomId, cp.getUserId(), request.getChoice());
        if (error != null) {
            String message = switch (error) {
                case "ROOM_NOT_FOUND"  -> "방을 찾을 수 없습니다.";
                case "GAME_NOT_ACTIVE" -> "게임이 진행 중이 아닙니다.";
                case "NOT_IN_ROOM"     -> "해당 방의 참가자가 아닙니다.";
                case "ALREADY_CHOSEN"  -> "이미 선택하셨습니다.";
                default                -> "처리할 수 없는 요청입니다.";
            };
            sendError(cp, error, message);
        }

        log.info("WS CHOOSE roomId={} userId={} choice={}", roomId, cp.getUserId(),
                request.getChoice());
    }

    // ─── REMATCH ──────────────────────────────────────────────────────────────

    @MessageMapping("/rps/room/{roomId}/rematch")
    public void handleRematch(@DestinationVariable String roomId,
                              Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        String error = rpsRoomService.rematch(roomId, cp.getUserId());
        if (error != null) {
            String message = switch (error) {
                case "ROOM_NOT_FOUND"     -> "방을 찾을 수 없습니다.";
                case "INVALID_ACTION"     -> "현재 재도전을 요청할 수 없습니다.";
                case "NOT_ENOUGH_PLAYERS" -> "재도전을 위해 2명 이상이 필요합니다.";
                default                   -> "처리할 수 없는 요청입니다.";
            };
            sendError(cp, error, message);
        }

        log.info("WS REMATCH roomId={} userId={}", roomId, cp.getUserId());
    }

    // ─── LEAVE ────────────────────────────────────────────────────────────────

    @MessageMapping("/rps/room/{roomId}/leave")
    public void handleLeave(@DestinationVariable String roomId,
                            StompHeaderAccessor accessor,
                            Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) return;

        rpsRoomService.leaveRoom(roomId, cp.getUserId(), "LEAVE");

        // 세션 속성에서 roomId 제거
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null) {
            @SuppressWarnings("unchecked")
            Set<String> rpsRooms = (Set<String>) attrs.get(SESSION_KEY);
            if (rpsRooms != null) rpsRooms.remove(roomId);
        }

        log.info("WS LEAVE roomId={} userId={}", roomId, cp.getUserId());
    }

    // ─── SESSION DISCONNECT ───────────────────────────────────────────────────

    @EventListener
    @SuppressWarnings("unchecked")
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = event.getUser();
        if (!(principal instanceof ChatPrincipal cp)) return;

        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return;

        Set<String> rpsRooms = (Set<String>) attrs.get(SESSION_KEY);
        if (rpsRooms == null || rpsRooms.isEmpty()) return;

        for (String roomId : rpsRooms) {
            rpsRoomService.leaveRoom(roomId, cp.getUserId(), "DISCONNECT");
            log.info("WS DISCONNECT roomId={} userId={}", roomId, cp.getUserId());
        }
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    private ChatPrincipal toChatPrincipal(Principal principal) {
        if (principal instanceof ChatPrincipal cp) return cp;
        if (principal != null) {
            log.warn("OnlineRpsWebSocketController: unknown principal type={}",
                    principal.getClass().getName());
        }
        return null;
    }

    private void sendError(Principal principal, String code, String message) {
        if (principal == null) return;
        messagingTemplate.convertAndSendToUser(
                principal.getName(),
                "/queue/errors",
                Map.of("code", code, "message", message)
        );
    }

    private void sendError(ChatPrincipal cp, String code, String message) {
        sendError((Principal) cp, code, message);
    }

}
