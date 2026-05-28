package com.dobakggun.security;

import com.dobakggun.dto.chat.ChatErrorResponse;
import com.dobakggun.entity.User;
import com.dobakggun.service.ChatRedisService;
import com.dobakggun.util.JwtUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@Component
public class StompChannelInterceptor implements ChannelInterceptor {

    private static final Pattern ROOM_TOPIC_PATTERN = Pattern.compile("^/topic/room/([a-z0-9]{8})$");
    private static final Pattern ROOM_APP_PATTERN = Pattern.compile("^/app/chat/([a-z0-9]{8})$");

    // Blockfall Battle 경로 — StompChannelInterceptor 검사 제외 (별도 인터셉터가 처리)
    private static final Pattern BATTLE_TOPIC_PATTERN = Pattern.compile(
            "^/topic/(blockfall-battle|minesweeper-battle)/.*$");
    private static final Pattern BATTLE_APP_PATTERN = Pattern.compile(
            "^/app/(blockfall-battle|minesweeper-battle)/.*$");

    // Online RPS 경로 — 로그인/게스트 모두 허용 (role 체크 없음)
    private static final Pattern RPS_TOPIC_PATTERN = Pattern.compile("^/topic/rps/.*$");
    private static final Pattern RPS_APP_PATTERN = Pattern.compile("^/app/rps/.*$");

    private final JwtUtil jwtUtil;
    private final ChatRedisService chatRedisService;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public StompChannelInterceptor(JwtUtil jwtUtil, ChatRedisService chatRedisService) {
        this.jwtUtil = jwtUtil;
        this.chatRedisService = chatRedisService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }
        StompCommand command = accessor.getCommand();
        if (command == null) {
            return message;
        }

        switch (command) {
            case CONNECT -> {
                if (!handleConnect(accessor)) return null;
            }
            case SUBSCRIBE -> {
                if (!handleSubscribe(accessor, message)) return null;
            }
            case SEND -> {
                if (!handleSend(accessor, message)) return null;
            }
            default -> { }
        }
        return message;
    }

    /**
     * CONNECT 프레임 처리. 인증/권한 실패 시 에러를 전송하고 false를 반환하여 연결을 차단한다.
     *
     * @return true: 연결 허용, false: 연결 차단 (preSend가 null 반환)
     */
    private boolean handleConnect(StompHeaderAccessor accessor) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes == null) {
            log.warn("StompChannelInterceptor: CONNECT - sessionAttributes null, 연결 차단");
            return false;
        }

        // /ws-battle 연결: isGuest 속성이 있으면 BattlePrincipal 설정 후 허용 (별도 인터셉터 처리)
        Object isGuestAttr = sessionAttributes.get("isGuest");
        if (isGuestAttr != null) {
            boolean isGuest = Boolean.TRUE.equals(isGuestAttr);
            BattlePrincipal battlePrincipal;
            if (isGuest) {
                String guestId = (String) sessionAttributes.get("guestId");
                String nickname = (String) sessionAttributes.getOrDefault("nickname", "손님");
                if (guestId == null) {
                    log.warn("StompChannelInterceptor: Battle CONNECT - guestId null");
                    return false;
                }
                battlePrincipal = new BattlePrincipal(guestId, nickname);
            } else {
                Long userId = (Long) sessionAttributes.get("userId");
                String nickname = (String) sessionAttributes.getOrDefault("nickname", "");
                if (userId == null) {
                    log.warn("StompChannelInterceptor: Battle CONNECT - userId null");
                    return false;
                }
                battlePrincipal = new BattlePrincipal(userId, nickname);
            }
            accessor.setUser(battlePrincipal);
            log.debug("StompChannelInterceptor: Battle CONNECT OK playerId={}", battlePrincipal.getPlayerId());
            return true;
        }

        // /ws-rps 연결: isRpsGuest 속성이 있으면 ChatPrincipal 설정 후 허용
        Object isRpsGuestAttr = sessionAttributes.get("isRpsGuest");
        if (isRpsGuestAttr != null) {
            boolean isRpsGuest = Boolean.TRUE.equals(isRpsGuestAttr);
            if (isRpsGuest) {
                Long guestId = (Long) sessionAttributes.get("guestId");
                String nickname = (String) sessionAttributes.getOrDefault("nickname", "손님");
                if (guestId == null) {
                    log.warn("StompChannelInterceptor: RPS CONNECT - guestId null, 연결 차단");
                    return false;
                }
                accessor.setUser(new ChatPrincipal(guestId, nickname, "USER"));
            } else {
                Long uid = (Long) sessionAttributes.get("userId");
                String nickname = (String) sessionAttributes.getOrDefault("nickname", "");
                String role = (String) sessionAttributes.getOrDefault("role", "USER");
                if (uid == null) {
                    log.warn("StompChannelInterceptor: RPS CONNECT - userId null, 연결 차단");
                    return false;
                }
                accessor.setUser(new ChatPrincipal(uid, nickname, role));
            }
            log.debug("StompChannelInterceptor: RPS CONNECT OK isGuest={}", isRpsGuest);
            return true;
        }

        Long userId = (Long) sessionAttributes.get("userId");
        String nickname = (String) sessionAttributes.get("nickname");
        String role = (String) sessionAttributes.get("role");

        if (userId == null) {
            String token = extractTokenFromHeader(accessor);
            if (StringUtils.hasText(token) && jwtUtil.validateToken(token)) {
                userId = jwtUtil.getUserIdFromToken(token);
                nickname = jwtUtil.getNicknameFromToken(token);
                role = jwtUtil.getRoleFromToken(token);
            }
        }

        if (userId == null) {
            log.warn("StompChannelInterceptor: CONNECT - userId null, 인증 실패, 연결 차단");
            return false;
        }

        if (!isAllowedRole(role)) {
            log.warn("StompChannelInterceptor: CONNECT - 권한 없음 role={}, 연결 차단", role);
            ChatPrincipal tempPrincipal = new ChatPrincipal(userId, nickname != null ? nickname : "", role);
            sendError(tempPrincipal, "FORBIDDEN", "채팅 서비스 이용 권한이 없습니다.");
            return false;
        }

        accessor.setUser(new ChatPrincipal(userId, nickname != null ? nickname : "", role));
        return true;
    }

    /**
     * SUBSCRIBE 프레임 처리. 에러 시 false를 반환하여 구독을 차단한다.
     *
     * @return true: 구독 허용, false: 구독 차단
     */
    private boolean handleSubscribe(StompHeaderAccessor accessor, Message<?> message) {
        String destination = accessor.getDestination();
        if (destination == null) return true;

        // Battle 경로는 BattlePrincipal 기반으로 별도 처리 — 여기서는 통과
        if (BATTLE_TOPIC_PATTERN.matcher(destination).matches()) return true;

        // RPS 경로 — 로그인/게스트 모두 허용, role 체크 없음
        if (RPS_TOPIC_PATTERN.matcher(destination).matches()) return true;

        var topicMatcher = ROOM_TOPIC_PATTERN.matcher(destination);
        if (!topicMatcher.matches()) return true;

        String roomId = topicMatcher.group(1);
        ChatPrincipal principal = getPrincipal(accessor);

        if (principal == null || !isAllowedRole(principal.getRole())) {
            sendError(principal, "FORBIDDEN", "이 방에 접근할 수 없습니다.");
            return false;
        }
        if (!chatRedisService.roomExists(roomId)) {
            sendError(principal, "ROOM_NOT_FOUND", "채팅방이 종료되었습니다.");
            return false;
        }
        return true;
    }

    /**
     * SEND 프레임 처리. 에러 시 false를 반환하여 메시지를 차단한다.
     *
     * @return true: 발송 허용, false: 발송 차단
     */
    private boolean handleSend(StompHeaderAccessor accessor, Message<?> message) {
        String destination = accessor.getDestination();
        if (destination == null) return true;

        // Battle 경로는 별도 처리 — 여기서는 통과
        if (BATTLE_APP_PATTERN.matcher(destination).matches()) return true;

        // RPS 경로 — 로그인/게스트 모두 허용, role 체크 없음
        if (RPS_APP_PATTERN.matcher(destination).matches()) return true;

        var appMatcher = ROOM_APP_PATTERN.matcher(destination);
        if (!appMatcher.matches()) return true;

        String roomId = appMatcher.group(1);
        ChatPrincipal principal = getPrincipal(accessor);

        if (principal == null || !isAllowedRole(principal.getRole())) {
            sendError(principal, "FORBIDDEN", "이 방에 메시지를 보낼 수 없습니다.");
            return false;
        }
        if (!chatRedisService.roomExists(roomId)) {
            sendError(principal, "ROOM_NOT_FOUND", "채팅방이 종료되었습니다.");
            return false;
        }
        return true;
    }

    private ChatPrincipal getPrincipal(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof ChatPrincipal cp) {
            return cp;
        }
        return null;
    }

    private boolean isAllowedRole(String role) {
        if (role == null) return false;
        try {
            return User.Role.valueOf(role).ordinal() >= User.Role.FRIEND.ordinal();
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private void sendError(ChatPrincipal principal, String code, String message) {
        if (principal == null) return;
        ChatErrorResponse error = ChatErrorResponse.builder()
                .code(code)
                .message(message)
                .build();
        messagingTemplate.convertAndSendToUser(
                principal.getName(), "/queue/errors", error);
    }

    private String extractTokenFromHeader(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
