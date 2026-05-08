package com.dobakggun.controller;

import com.dobakggun.dto.yacht.YachtChatRequest;
import com.dobakggun.dto.yacht.YachtChatPayload;
import com.dobakggun.dto.yacht.YachtEnvelopeDto;
import com.dobakggun.dto.yacht.YachtReadyRequest;
import com.dobakggun.dto.yacht.YachtRollRequest;
import com.dobakggun.dto.yacht.YachtScoreRequest;
import com.dobakggun.dto.yacht.YachtVoteKickRequest;
import com.dobakggun.security.ChatPrincipal;
import com.dobakggun.service.YachtGameService;
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
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Yacht WebSocket (STOMP) 컨트롤러.
 *
 * 발행 경로:
 *   /app/yacht/room/{roomId}/join
 *   /app/yacht/room/{roomId}/ready
 *   /app/yacht/room/{roomId}/start
 *   /app/yacht/room/{roomId}/roll
 *   /app/yacht/room/{roomId}/score
 *   /app/yacht/room/{roomId}/leave
 *   /app/yacht/room/{roomId}/chat
 *
 * 구독 경로:
 *   /topic/yacht/room/{roomId}
 *
 * 에러 전달:
 *   /user/queue/errors
 *
 * 세션 속성 키: yachtSubscribedRoomIds (chat: subscribedRoomIds, rps: rpsSubscribedRoomIds 와 별도)
 */
@Slf4j
@Controller
public class YachtWebSocketController {

    private static final String SESSION_KEY = "yachtSubscribedRoomIds";

    private final YachtGameService yachtGameService;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public YachtWebSocketController(YachtGameService yachtGameService) {
        this.yachtGameService = yachtGameService;
    }

    // ─── JOIN ────────────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/join")
    public void handleJoin(@DestinationVariable String roomId,
                           StompHeaderAccessor accessor,
                           Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        String error = yachtGameService.joinRoom(roomId, cp.getUserId(), cp.getNickname());
        if (error != null) {
            sendError(cp, error, resolveMessage(error));
            return;
        }

        // 세션 ID 등록 (stale disconnect 방지)
        String sessionId = accessor.getSessionId();
        yachtGameService.registerSession(roomId, cp.getUserId(), sessionId);

        // 세션 속성에 roomId 기록
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null) {
            @SuppressWarnings("unchecked")
            Set<String> rooms = (Set<String>) attrs.get(SESSION_KEY);
            if (rooms == null) {
                rooms = new HashSet<>();
                attrs.put(SESSION_KEY, rooms);
            }
            rooms.add(roomId);
        }

        log.info("WS YACHT JOIN roomId={} userId={}", roomId, cp.getUserId());
    }

    // ─── READY ───────────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/ready")
    public void handleReady(@DestinationVariable String roomId,
                             @Payload(required = false) YachtReadyRequest request,
                             Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        boolean ready = (request != null) && request.isReady();
        String error = yachtGameService.setReady(roomId, cp.getUserId(), ready);
        if (error != null) {
            sendError(cp, error, resolveMessage(error));
        }

        log.info("WS YACHT READY roomId={} userId={} ready={}", roomId, cp.getUserId(), ready);
    }

    // ─── START ───────────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/start")
    public void handleStart(@DestinationVariable String roomId,
                             Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        String error = yachtGameService.startGame(roomId, cp.getUserId());
        if (error != null) {
            sendError(cp, error, resolveMessage(error));
        }

        log.info("WS YACHT START roomId={} userId={}", roomId, cp.getUserId());
    }

    // ─── ROLL ────────────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/roll")
    public void handleRoll(@DestinationVariable String roomId,
                            @Payload(required = false) YachtRollRequest request,
                            Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        List<Integer> keptIndices = (request != null && request.getKeptIndices() != null)
                ? request.getKeptIndices()
                : Collections.emptyList();

        String error = yachtGameService.rollDice(roomId, cp.getUserId(), keptIndices);
        if (error != null) {
            sendError(cp, error, resolveMessage(error));
        }

        log.info("WS YACHT ROLL roomId={} userId={} keptIndices={}", roomId, cp.getUserId(), keptIndices);
    }

    // ─── SCORE ───────────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/score")
    public void handleScore(@DestinationVariable String roomId,
                             @Payload(required = false) YachtScoreRequest request,
                             Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        if (request == null || request.getScoreKey() == null) {
            sendError(cp, "INVALID_SCORE_KEY", "scoreKey는 필수입니다.");
            return;
        }

        String error = yachtGameService.recordScore(roomId, cp.getUserId(), request.getScoreKey().toUpperCase());
        if (error != null) {
            sendError(cp, error, resolveMessage(error));
        }

        log.info("WS YACHT SCORE roomId={} userId={} scoreKey={}", roomId, cp.getUserId(), request.getScoreKey());
    }

    // ─── LEAVE ───────────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/leave")
    public void handleLeave(@DestinationVariable String roomId,
                             StompHeaderAccessor accessor,
                             Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) return;

        yachtGameService.leaveRoom(roomId, cp.getUserId(), "LEAVE");

        // 세션 속성에서 roomId 제거
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null) {
            @SuppressWarnings("unchecked")
            Set<String> rooms = (Set<String>) attrs.get(SESSION_KEY);
            if (rooms != null) rooms.remove(roomId);
        }

        log.info("WS YACHT LEAVE roomId={} userId={}", roomId, cp.getUserId());
    }

    // ─── VOTE KICK ───────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/vote-kick")
    public void handleVoteKick(@DestinationVariable String roomId,
                                @Payload YachtVoteKickRequest request,
                                Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) return;
        if (request == null || request.getTargetUserId() == null) return;

        String error = yachtGameService.voteKick(roomId, cp.getUserId(), request.getTargetUserId());
        if (error != null) {
            sendError(cp, error, resolveMessage(error));
        }
        log.info("WS YACHT VOTE-KICK roomId={} voterId={} targetUserId={}", roomId, cp.getUserId(), request.getTargetUserId());
    }

    // ─── CHAT ────────────────────────────────────────────────────────────────

    @MessageMapping("/yacht/room/{roomId}/chat")
    public void handleChat(@DestinationVariable String roomId,
                            @Payload YachtChatRequest request,
                            Principal principal) {
        ChatPrincipal cp = toChatPrincipal(principal);
        if (cp == null) return;
        if (request == null || request.getMessage() == null) return;

        if (!yachtGameService.isParticipant(roomId, cp.getUserId())) return;

        String text = request.getMessage().strip();
        if (text.isEmpty()) return;
        if (text.length() > 200) text = text.substring(0, 200);

        messagingTemplate.convertAndSend(
                "/topic/yacht/room/" + roomId,
                YachtEnvelopeDto.builder()
                        .type("CHAT")
                        .timestamp(Instant.now().atZone(ZoneOffset.UTC)
                                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")))
                        .payload(YachtChatPayload.builder()
                                .userId(cp.getUserId())
                                .nickname(cp.getNickname())
                                .message(text)
                                .build())
                        .build()
        );

        log.info("WS YACHT CHAT roomId={} userId={}", roomId, cp.getUserId());
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

        Set<String> yachtRooms = (Set<String>) attrs.get(SESSION_KEY);
        if (yachtRooms == null || yachtRooms.isEmpty()) return;

        String disconnectedSessionId = accessor.getSessionId();
        for (String roomId : yachtRooms) {
            if (!yachtGameService.isActiveSession(roomId, cp.getUserId(), disconnectedSessionId)) {
                log.info("WS YACHT DISCONNECT (stale) roomId={} userId={}", roomId, cp.getUserId());
                continue;
            }
            yachtGameService.leaveRoom(roomId, cp.getUserId(), "DISCONNECT");
            log.info("WS YACHT DISCONNECT roomId={} userId={}", roomId, cp.getUserId());
        }
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    private ChatPrincipal toChatPrincipal(Principal principal) {
        if (principal instanceof ChatPrincipal cp) return cp;
        if (principal != null) {
            log.warn("YachtWebSocketController: unknown principal type={}", principal.getClass().getName());
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

    private String resolveMessage(String code) {
        return switch (code) {
            case "ROOM_NOT_FOUND"      -> "방을 찾을 수 없습니다.";
            case "ROOM_NOT_AVAILABLE"  -> "참가할 수 없는 방입니다.";
            case "NOT_HOST"            -> "방장만 수행할 수 있습니다.";
            case "NOT_IN_ROOM"         -> "해당 방의 참가자가 아닙니다.";
            case "NOT_ENOUGH_PLAYERS"  -> "최소 2명이 필요합니다.";
            case "NOT_ALL_READY"       -> "모든 플레이어가 준비 완료해야 합니다.";
            case "GAME_NOT_ACTIVE"     -> "게임이 진행 중이 아닙니다.";
            case "NOT_YOUR_TURN"       -> "현재 당신의 턴이 아닙니다.";
            case "ALREADY_ROLLED_MAX"  -> "더 이상 굴릴 수 없습니다.";
            case "INVALID_KEPT_INDICES"-> "keptIndices 값이 올바르지 않습니다.";
            case "MUST_ROLL_FIRST"     -> "먼저 주사위를 굴려야 합니다.";
            case "INVALID_SCORE_KEY"   -> "유효하지 않은 족보 키입니다.";
            case "ALREADY_SCORED"      -> "이미 기록된 족보입니다.";
            case "TARGET_NOT_RECONNECTING" -> "해당 플레이어는 재접속 대기 중이 아닙니다.";
            case "NOT_ACTIVE_PLAYER"       -> "활성 플레이어만 투표할 수 있습니다.";
            default                    -> "처리할 수 없는 요청입니다.";
        };
    }
}
