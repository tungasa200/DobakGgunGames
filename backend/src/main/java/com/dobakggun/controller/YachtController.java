package com.dobakggun.controller;

import com.dobakggun.dto.yacht.YachtMatchResponse;
import com.dobakggun.service.YachtGameService;
import com.dobakggun.service.YachtMatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Yacht REST API 컨트롤러.
 *
 * POST /api/yacht/match  — 자동 매칭
 * GET  /api/yacht/room/{roomId} — 방 스냅샷
 */
@Slf4j
@RestController
@RequestMapping("/api/yacht")
@RequiredArgsConstructor
public class YachtController {

    private final YachtMatchService yachtMatchService;
    private final YachtGameService  yachtGameService;

    /**
     * POST /api/yacht/match — 자동 매칭.
     * - 200: 기존 대기방 합류
     * - 201: 신규 방 자동 생성
     * - 409: 이미 활성 방 참가 중
     * - 429: Rate limit 초과
     * - 503: Redis 락 획득 실패
     */
    @PostMapping("/match")
    public ResponseEntity<?> match(@AuthenticationPrincipal Long userId) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED"));
        }

        try {
            YachtMatchResponse response = yachtMatchService.match(userId);
            HttpStatus status = response.isCreated() ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status).body(response);

        } catch (YachtMatchService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        }
    }

    /** GET /api/yacht/rooms/status — 공개 엔드포인트, 인증 불필요. */
    @GetMapping("/rooms/status")
    public ResponseEntity<Map<String, Integer>> getRoomsStatus() {
        return ResponseEntity.ok(Map.of(
                "activeRooms",   yachtGameService.getActiveRoomCount(),
                "activePlayers", yachtGameService.getActiveTotalPlayerCount()
        ));
    }

    /**
     * GET /api/yacht/room/{roomId} — 방 스냅샷 조회.
     * - 200: 방 상태
     * - 401: 비인증
     * - 403: 참가자 아님
     * - 404: 방 없음
     */
    @GetMapping("/room/{roomId}")
    public ResponseEntity<?> getRoom(@PathVariable String roomId,
                                      @AuthenticationPrincipal Long userId) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED"));
        }

        // 먼저 인메모리 상태 확인
        Map<String, Object> snapshot = yachtGameService.buildRoomSnapshot(roomId, userId);

        if (snapshot == null) {
            // buildRoomSnapshot이 null을 반환하는 두 가지 경우:
            // 1) 방이 인메모리에 없음 → ROOM_NOT_FOUND
            // 2) 방은 있지만 requester가 참가자 아님 → NOT_IN_ROOM
            YachtGameService.YachtRoomState state = yachtGameService.getState(roomId);
            if (state == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "ROOM_NOT_FOUND"));
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "NOT_IN_ROOM"));
            }
        }

        return ResponseEntity.ok(snapshot);
    }
}
