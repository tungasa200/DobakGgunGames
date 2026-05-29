package com.dobakggun.controller;

import com.dobakggun.dto.minesweeper.BoardClearRequest;
import com.dobakggun.dto.minesweeper.FirstClickRequest;
import com.dobakggun.dto.minesweeper.MineHitRequest;
import com.dobakggun.dto.minesweeper.ProgressRequest;
import com.dobakggun.security.BattlePrincipal;
import com.dobakggun.service.MinesweeperBattleRoomManager;
import com.dobakggun.service.MinesweeperBattleRoomService;
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
import java.util.Map;
import java.util.Optional;

/**
 * 지뢰찾기 배틀 WebSocket (STOMP) 컨트롤러.
 * /ws-battle 엔드포인트를 Blockfall Battle 과 공유.
 *
 * 발행 경로 (/app 접두사 생략):
 *   /minesweeper-battle/room/{roomId}/first-click
 *   /minesweeper-battle/room/{roomId}/progress
 *   /minesweeper-battle/room/{roomId}/board-clear
 *   /minesweeper-battle/room/{roomId}/mine-hit
 *   /minesweeper-battle/room/{roomId}/request-state
 *   /minesweeper-battle/room/{roomId}/leave
 *
 * 구독 경로:
 *   /topic/minesweeper-battle/room/{roomId}
 *   /user/queue/minesweeper-battle/state
 *   /user/queue/minesweeper-battle/board
 *   /user/queue/minesweeper-battle/errors
 */
@Slf4j
@Controller
public class MinesweeperBattleWebSocketController {

    private final MinesweeperBattleRoomService minesweeperService;
    private final MinesweeperBattleRoomManager minesweeperManager;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public MinesweeperBattleWebSocketController(
            MinesweeperBattleRoomService minesweeperService,
            MinesweeperBattleRoomManager minesweeperManager) {
        this.minesweeperService = minesweeperService;
        this.minesweeperManager = minesweeperManager;
    }

    // ─── CONNECT ──────────────────────────────────────────────────────────────

    /**
     * WS 연결 시 sessionId 를 MinesweeperBattleRoomManager 에 등록.
     * Blockfall Battle 의 handleConnect 와 동일 패턴 — BattlePrincipal 기반.
     * /ws-battle 엔드포인트를 공유하므로 isGuest 속성 존재 여부로 구분.
     */
    @EventListener
    public void handleConnect(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return;

        // /ws-battle 연결만 처리 (isGuest 속성 존재 여부로 구분)
        if (!attrs.containsKey("isGuest")) return;

        Principal principal = event.getUser();
        if (!(principal instanceof BattlePrincipal bp)) return;

        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        attrs.put("wsGameType", "minesweeper");

        minesweeperService.handleConnect(bp.getPlayerId(), sessionId);

        log.debug("MinesweeperBattle CONNECT: playerId={} sessionId={}", bp.getPlayerId(), sessionId);
    }

    // ─── FIRST_CLICK ──────────────────────────────────────────────────────────

    @MessageMapping("/minesweeper-battle/room/{roomId}/first-click")
    public void onFirstClick(@DestinationVariable String roomId,
                             @Payload FirstClickRequest req,
                             StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) {
            sendUnauthorized(accessor);
            return;
        }
        log.debug("MinesweeperBattle FIRST_CLICK: roomId={} playerId={} r={} c={}", roomId, bp.getPlayerId(), req.getR(), req.getC());
        minesweeperService.handleFirstClick(roomId, bp.getPlayerId(), req.getR(), req.getC());
    }

    // ─── PROGRESS ────────────────────────────────────────────────────────────

    @MessageMapping("/minesweeper-battle/room/{roomId}/progress")
    public void onProgress(@DestinationVariable String roomId,
                           @Payload ProgressRequest req,
                           StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) return; // 에러 전송 없이 조용히 무시 (200ms throttle 메시지)

        minesweeperService.handleProgress(roomId, bp.getPlayerId(), req.getRevealedCount());
    }

    // ─── BOARD_CLEAR ─────────────────────────────────────────────────────────

    @MessageMapping("/minesweeper-battle/room/{roomId}/board-clear")
    public void onBoardClear(@DestinationVariable String roomId,
                             @Payload BoardClearRequest req,
                             StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) {
            sendUnauthorized(accessor);
            return;
        }
        log.info("MinesweeperBattle BOARD_CLEAR: roomId={} playerId={} elapsedMs={}", roomId, bp.getPlayerId(), req.getElapsedMs());
        minesweeperService.handleBoardClear(roomId, bp.getPlayerId(), req.getElapsedMs());
    }

    // ─── MINE_HIT ────────────────────────────────────────────────────────────

    @MessageMapping("/minesweeper-battle/room/{roomId}/mine-hit")
    public void onMineHit(@DestinationVariable String roomId,
                          @Payload MineHitRequest req,
                          StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) {
            sendUnauthorized(accessor);
            return;
        }
        int r = req.getCell() != null ? req.getCell().getOrDefault("r", -1) : -1;
        int c = req.getCell() != null ? req.getCell().getOrDefault("c", -1) : -1;
        log.info("MinesweeperBattle MINE_HIT: roomId={} playerId={} r={} c={}", roomId, bp.getPlayerId(), r, c);
        minesweeperService.handleMineHit(roomId, bp.getPlayerId(), req.getElapsedMs(), r, c);
    }

    // ─── REQUEST_STATE ────────────────────────────────────────────────────────

    @MessageMapping("/minesweeper-battle/room/{roomId}/request-state")
    public void onRequestState(@DestinationVariable String roomId,
                               StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) {
            sendUnauthorized(accessor);
            return;
        }
        log.debug("MinesweeperBattle REQUEST_STATE: roomId={} playerId={}", roomId, bp.getPlayerId());
        minesweeperService.handleRequestState(roomId, bp.getPlayerId());
    }

    // ─── LEAVE ───────────────────────────────────────────────────────────────

    @MessageMapping("/minesweeper-battle/room/{roomId}/leave")
    public void onLeave(@DestinationVariable String roomId,
                        StompHeaderAccessor accessor) {
        BattlePrincipal bp = extractPrincipal(accessor);
        if (bp == null) return;
        log.info("MinesweeperBattle LEAVE: roomId={} playerId={}", roomId, bp.getPlayerId());
        minesweeperService.handleLeave(roomId, bp.getPlayerId());
    }

    // ─── DISCONNECT ───────────────────────────────────────────────────────────

    /**
     * WS 연결 끊김 처리.
     * Blockfall Battle 과 같은 EventListener — 양쪽이 모두 처리하지만,
     * minesweeperManager.findRoomIdBySession 이 null 이면 조용히 무시.
     */
    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = event.getUser();

        // gameType 체크 — Blockfall 세션은 무시
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null || !"minesweeper".equals(attrs.get("wsGameType"))) return;

        if (!(principal instanceof BattlePrincipal bp)) return;

        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        // Minesweeper 방에 속한 세션인지 확인
        Optional<String> roomId = minesweeperManager.findRoomIdBySession(sessionId);
        if (roomId.isEmpty()) return; // Blockfall 세션이면 무시

        log.debug("MinesweeperBattle DISCONNECT: sessionId={} playerId={}", sessionId, bp.getPlayerId());
        minesweeperService.handleDisconnect(sessionId);
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    /**
     * StompHeaderAccessor 에서 BattlePrincipal 추출.
     * accessor.getUser() 가 BattlePrincipal 이 아니면 null 반환.
     */
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
                "/queue/minesweeper-battle/errors",
                Map.of("type", "ERROR", "payload",
                        Map.of("code", "UNAUTHORIZED", "message", "인증이 필요합니다.")));
    }
}
