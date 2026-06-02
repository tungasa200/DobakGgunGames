package com.dobakggun.controller;

import com.dobakggun.dto.apple.AppleRemoveRequest;
import com.dobakggun.security.BattlePrincipal;
import com.dobakggun.service.AppleBattleRoomManager;
import com.dobakggun.service.AppleBattleRoomService;
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
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 사과게임 배틀 WebSocket (STOMP) 컨트롤러.
 * /ws-battle 엔드포인트를 Blockfall Battle, Minesweeper Battle 과 공유.
 *
 * 발행 경로 (/app 접두사 생략):
 *   /apple-battle/room/{roomId}/remove
 *   /apple-battle/room/{roomId}/request-state
 *   /apple-battle/room/{roomId}/leave
 *   /apple-battle/room/{roomId}/rematch
 *
 * 구독 경로:
 *   /topic/apple-battle/room/{roomId}        — 공개 브로드캐스트
 *   /user/queue/apple-battle/board           — 개인 게임 시작 이벤트
 *   /user/queue/apple-battle/state           — 개인 상태 스냅샷
 *   /user/queue/apple-battle/errors          — 개인 에러
 */
@Slf4j
@Controller
public class AppleBattleWebSocketController {

    private final AppleBattleRoomService appleService;
    private final AppleBattleRoomManager appleManager;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public AppleBattleWebSocketController(
            AppleBattleRoomService appleService,
            AppleBattleRoomManager appleManager) {
        this.appleService = appleService;
        this.appleManager = appleManager;
    }

    // ─── CONNECT ──────────────────────────────────────────────────────────────

    /**
     * WS 연결 시 sessionId 를 AppleBattleRoomManager 에 등록.
     * /ws-battle 엔드포인트를 공유하므로 wsGameType == "apple-battle" 인 경우만 처리.
     */
    @EventListener
    public void handleConnect(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return;

        // /ws-battle 연결만 처리 (isGuest 속성 존재 여부로 구분)
        if (!attrs.containsKey("isGuest")) return;

        // wsGameType == "apple-battle" 인 경우만 처리
        if (!"apple-battle".equals(attrs.get("wsGameType"))) return;

        Principal principal = event.getUser();
        if (!(principal instanceof BattlePrincipal bp)) return;

        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        appleService.handleConnect(bp.getPlayerId(), sessionId);

        log.debug("AppleBattle CONNECT: playerId={} sessionId={}", bp.getPlayerId(), sessionId);
    }

    // ─── REMOVE ───────────────────────────────────────────────────────────────

    /**
     * 사과 제거 요청.
     * cells: [[row, col], ...] — 합이 10이 되는 셀 좌표 목록.
     */
    @MessageMapping("/apple-battle/room/{roomId}/remove")
    public void onRemove(@DestinationVariable String roomId,
                         @Payload AppleRemoveRequest req,
                         StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) {
            sendUnauthorized(accessor);
            return;
        }

        List<List<Integer>> cells = (req != null && req.getCells() != null)
                ? req.getCells() : Collections.emptyList();

        log.debug("AppleBattle REMOVE: roomId={} playerId={} cellCount={}",
                roomId, bp.getPlayerId(), cells.size());

        appleService.handleRemove(roomId, bp.getPlayerId(), cells);
    }

    // ─── REQUEST_STATE ────────────────────────────────────────────────────────

    @MessageMapping("/apple-battle/room/{roomId}/request-state")
    public void onRequestState(@DestinationVariable String roomId,
                               StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) {
            sendUnauthorized(accessor);
            return;
        }
        log.debug("AppleBattle REQUEST_STATE: roomId={} playerId={}", roomId, bp.getPlayerId());
        appleService.handleRequestState(roomId, bp.getPlayerId());
    }

    // ─── LEAVE ───────────────────────────────────────────────────────────────

    @MessageMapping("/apple-battle/room/{roomId}/leave")
    public void onLeave(@DestinationVariable String roomId,
                        StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) return;
        log.info("AppleBattle LEAVE: roomId={} playerId={}", roomId, bp.getPlayerId());
        appleService.handleLeave(roomId, bp.getPlayerId());
    }

    // ─── REMATCH ──────────────────────────────────────────────────────────────

    @MessageMapping("/apple-battle/room/{roomId}/rematch")
    public void onRematch(@DestinationVariable String roomId,
                          StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) return;
        log.info("AppleBattle REMATCH: roomId={} playerId={}", roomId, bp.getPlayerId());
        appleService.handleRematch(roomId, bp.getPlayerId());
    }

    // ─── DISCONNECT ───────────────────────────────────────────────────────────

    /**
     * WS 연결 끊김 처리.
     * appleManager.findRoomIdBySession 이 null 이면 조용히 무시.
     */
    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = event.getUser();

        // gameType 체크 — apple-battle 세션만 처리
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null || !"apple-battle".equals(attrs.get("wsGameType"))) return;

        if (!(principal instanceof BattlePrincipal bp)) return;

        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        // Apple 방에 속한 세션인지 확인
        Optional<String> roomId = appleManager.findRoomIdBySession(sessionId);
        if (roomId.isEmpty()) return;

        log.debug("AppleBattle DISCONNECT: sessionId={} playerId={}", sessionId, bp.getPlayerId());
        appleService.handleDisconnect(sessionId);
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    private BattlePrincipal extractPrincipal(StompHeaderAccessor accessor) {
        if (accessor == null) return null;
        Principal user = accessor.getUser();
        if (user instanceof BattlePrincipal bp) return bp;
        return null;
    }

    private void sendUnauthorized(StompHeaderAccessor accessor) {
        if (accessor == null) return;
        Principal user = accessor.getUser();
        if (user == null) return;
        messagingTemplate.convertAndSendToUser(
                user.getName(),
                "/queue/apple-battle/errors",
                Map.of("type", "ERROR", "payload",
                        Map.of("code", "UNAUTHORIZED", "message", "인증이 필요합니다.")));
    }
}
