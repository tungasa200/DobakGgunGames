package com.dobakggun.controller;

import com.dobakggun.dto.battle.BoardStateMessage;
import com.dobakggun.dto.battle.ComboAttackMessage;
import com.dobakggun.security.BattlePrincipal;
import com.dobakggun.service.BattleRoomManager;
import com.dobakggun.service.BattleRoomService;
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
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Map;

/**
 * 블록폴 배틀 WebSocket (STOMP) 컨트롤러.
 *
 * 발행 경로:
 *   /app/blockfall-battle/room/{roomId}/board-state
 *   /app/blockfall-battle/room/{roomId}/combo-attack
 *   /app/blockfall-battle/room/{roomId}/leave
 *   /app/blockfall-battle/room/{roomId}/player-finished
 *   /app/blockfall-battle/room/{roomId}/player-ready
 *   /app/blockfall-battle/room/{roomId}/request-state   ← WS 연결 직후 catch-up
 *
 * 구독 경로:
 *   /topic/blockfall-battle/room/{roomId}
 *   /user/queue/blockfall-battle/errors
 *   /user/queue/blockfall-battle/board    (개인 BOARD_UPDATE)
 *   /user/queue/blockfall-battle/queue   (개인 QUEUE_POSITION)
 *   /user/queue/blockfall-battle/state   (개인 catch-up: ROOM_STATE + MATCH_COUNTDOWN)
 */
@Slf4j
@Controller
public class BlockfallBattleWebSocketController {

    private final BattleRoomService battleRoomService;
    private final BattleRoomManager battleRoomManager;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public BlockfallBattleWebSocketController(BattleRoomService battleRoomService,
                                               BattleRoomManager battleRoomManager) {
        this.battleRoomService = battleRoomService;
        this.battleRoomManager = battleRoomManager;
    }

    // ─── CONNECT ──────────────────────────────────────────────────────────────

    /**
     * /ws-battle 연결 후 sessionId 를 BattleRoomManager 에 등록.
     * Principal 설정은 StompChannelInterceptor.handleConnect 에서 처리됨.
     */
    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return;

        // /ws-battle 연결만 처리 (isGuest 속성 존재 여부로 구분)
        if (!attrs.containsKey("isGuest")) return;

        Principal principal = event.getUser();
        if (!(principal instanceof BattlePrincipal bp)) return;

        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        // 이미 방에 배정된 경우 sessionId 등록
        battleRoomManager.findActiveRoomByPlayerId(bp.getPlayerId())
                .ifPresent(rid -> battleRoomManager.registerSession(rid, bp.getPlayerId(), sessionId));

        log.debug("BlockfallBattle CONNECT: playerId={} sessionId={}", bp.getPlayerId(), sessionId);
    }

    // ─── BOARD_STATE ──────────────────────────────────────────────────────────

    @MessageMapping("/blockfall-battle/room/{roomId}/board-state")
    public void handleBoardState(@DestinationVariable String roomId,
                                  @Payload BoardStateMessage msg,
                                  StompHeaderAccessor headerAccessor,
                                  Principal principal) {
        BattlePrincipal bp = toBattlePrincipal(principal);
        if (bp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        battleRoomService.handleBoardState(roomId, bp.getPlayerId(), msg);
    }

    // ─── COMBO_ATTACK ─────────────────────────────────────────────────────────

    @MessageMapping("/blockfall-battle/room/{roomId}/combo-attack")
    public void handleComboAttack(@DestinationVariable String roomId,
                                   @Payload ComboAttackMessage msg,
                                   Principal principal) {
        BattlePrincipal bp = toBattlePrincipal(principal);
        if (bp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        if (msg.getCombo() < 0) {
            sendError(bp, "INVALID_COMBO", "combo 값이 유효하지 않습니다.");
            return;
        }

        battleRoomService.handleComboAttack(roomId, bp.getPlayerId(), msg);
        log.debug("BlockfallBattle COMBO_ATTACK: roomId={} playerId={} combo={}", roomId, bp.getPlayerId(), msg.getCombo());
    }

    // ─── PLAYER_FINISHED (Block Out) ─────────────────────────────────────────

    /**
     * 클라이언트가 자신의 Block Out(보드 상단 초과)을 감지해 서버에 알림.
     * PRD §10.3.5 — BUG-001 수정
     *
     * 발행: /app/blockfall-battle/room/{roomId}/player-finished
     * Body: {} (body 무시, score는 서버 쪽 PlayerSessionInfo.score 사용)
     */
    @MessageMapping("/blockfall-battle/room/{roomId}/player-finished")
    public void handlePlayerFinished(@DestinationVariable String roomId,
                                      StompHeaderAccessor headerAccessor,
                                      Principal principal) {
        BattlePrincipal bp = toBattlePrincipal(principal);
        if (bp == null) {
            sendError(principal, "UNAUTHORIZED", "인증이 필요합니다.");
            return;
        }

        log.debug("BlockfallBattle PLAYER_FINISHED: roomId={} playerId={}", roomId, bp.getPlayerId());
        battleRoomService.handlePlayerFinished(roomId, bp.getPlayerId());
    }

    // ─── PLAYER_READY ─────────────────────────────────────────────────────────

    /**
     * 결과 화면에서 "준비" 클릭.
     * 발행: /app/blockfall-battle/room/{roomId}/player-ready
     * Body: {} (무시)
     */
    @MessageMapping("/blockfall-battle/room/{roomId}/player-ready")
    public void handlePlayerReady(@DestinationVariable String roomId,
                                   Principal principal) {
        BattlePrincipal bp = toBattlePrincipal(principal);
        if (bp == null) return;
        log.debug("BlockfallBattle PLAYER_READY: roomId={} playerId={}", roomId, bp.getPlayerId());
        battleRoomService.handlePlayerReady(roomId, bp.getPlayerId());
    }

    // ─── REQUEST_STATE (WS 연결 직후 catch-up) ───────────────────────────────

    /**
     * WS 구독 직후 클라이언트가 요청하는 현재 방 상태 catch-up.
     * REST join → WS 구독 사이의 타이밍 갭으로 놓친 MATCH_COUNTDOWN 등을 개인 채널로 재전송.
     *
     * 발행: /app/blockfall-battle/room/{roomId}/request-state
     * Body: {} (무시)
     * 응답: /user/queue/blockfall-battle/state → ROOM_STATE (+ MATCH_COUNTDOWN if active)
     */
    @MessageMapping("/blockfall-battle/room/{roomId}/request-state")
    public void handleRequestState(@DestinationVariable String roomId, Principal principal) {
        BattlePrincipal bp = toBattlePrincipal(principal);
        if (bp == null) return;
        log.debug("BlockfallBattle REQUEST_STATE: roomId={} playerId={}", roomId, bp.getPlayerId());
        battleRoomService.handleRequestState(roomId, bp.getPlayerId());
    }

    // ─── LEAVE ────────────────────────────────────────────────────────────────

    @MessageMapping("/blockfall-battle/room/{roomId}/leave")
    public void handleLeave(@DestinationVariable String roomId,
                             StompHeaderAccessor headerAccessor,
                             Principal principal) {
        BattlePrincipal bp = toBattlePrincipal(principal);
        if (bp == null) return;

        String sessionId = headerAccessor.getSessionId();
        if (sessionId != null) {
            battleRoomService.handleExplicitLeave(sessionId);
        }
        log.debug("BlockfallBattle LEAVE: roomId={} playerId={}", roomId, bp.getPlayerId());
    }

    // ─── SESSION DISCONNECT ───────────────────────────────────────────────────

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = event.getUser();

        // BattlePrincipal 인 경우만 처리 (ChatPrincipal 등 다른 Principal 은 무시)
        if (!(principal instanceof BattlePrincipal)) return;

        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        battleRoomService.handleLeaveBySession(sessionId);
        log.debug("BlockfallBattle DISCONNECT: sessionId={} playerId={}", sessionId, ((BattlePrincipal) principal).getPlayerId());
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    private BattlePrincipal toBattlePrincipal(Principal principal) {
        if (principal instanceof BattlePrincipal bp) return bp;
        if (principal != null) {
            log.warn("BlockfallBattleWebSocketController: unexpected principal type={}", principal.getClass().getName());
        }
        return null;
    }

    private void sendError(Principal principal, String code, String message) {
        if (principal == null) return;
        messagingTemplate.convertAndSendToUser(
                principal.getName(),
                "/queue/blockfall-battle/errors",
                Map.of("code", code, "message", message));
    }

    private void sendError(BattlePrincipal bp, String code, String message) {
        sendError((Principal) bp, code, message);
    }
}
