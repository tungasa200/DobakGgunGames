package com.dobakggun.controller;

import com.dobakggun.dto.yacht.YachtMatchRequest;
import com.dobakggun.dto.yacht.YachtMatchResponse;
import com.dobakggun.dto.yacht.YachtRankingResponse;
import com.dobakggun.dto.yacht.YachtWaitingRoomInfo;
import com.dobakggun.entity.yacht.YachtDiceType;
import com.dobakggun.service.YachtGameService;
import com.dobakggun.service.YachtMatchService;
import com.dobakggun.service.YachtRankingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Yacht REST API 컨트롤러.
 *
 * POST /api/yacht/match         — 자동 매칭 (diceType 필수)
 * GET  /api/yacht/rankings      — D6 / D8 분리 랭킹 TOP 10
 * GET  /api/yacht/room/{roomId} — 방 스냅샷 (diceType 포함)
 * GET  /api/yacht/rooms/status  — 모드별 방 현황
 */
@Slf4j
@RestController
@RequestMapping("/api/yacht")
@RequiredArgsConstructor
public class YachtController {

    private final YachtMatchService   yachtMatchService;
    private final YachtGameService    yachtGameService;
    private final YachtRankingService yachtRankingService;

    /**
     * POST /api/yacht/match — 자동 매칭.
     *
     * 요청 바디: { "diceType": "D6" | "D8" }
     * - 200: 기존 대기방 합류
     * - 201: 신규 방 자동 생성
     * - 400: INVALID_DICE_TYPE (누락 또는 D6/D8 외 값)
     * - 409: ALREADY_IN_ROOM
     * - 429: Rate limit 초과
     * - 503: Redis 락 획득 실패
     */
    @PostMapping("/match")
    public ResponseEntity<?> match(@AuthenticationPrincipal Long userId,
                                   @RequestBody(required = false) YachtMatchRequest request) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED"));
        }

        // diceType 검증
        YachtDiceType diceType = resolveDiceType(request == null ? null : request.getDiceType());
        if (diceType == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "INVALID_DICE_TYPE"));
        }

        try {
            YachtMatchResponse response = yachtMatchService.match(userId, diceType);
            HttpStatus status = response.isCreated() ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status).body(response);

        } catch (YachtMatchService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "ERROR"));
        } catch (Exception e) {
            log.error("YachtController.match: 처리 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "MATCH_UNAVAILABLE"));
        }
    }

    /**
     * POST /api/yacht/match-bot — 봇 전용 1:1 방 생성.
     * 로그인 필수. 자동 매칭 풀과 완전히 격리된 봇 전용 방을 즉시 생성.
     */
    @PostMapping("/match-bot")
    public ResponseEntity<?> matchBot(@AuthenticationPrincipal Long userId,
                                      @RequestBody(required = false) YachtMatchRequest request) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED"));
        }

        YachtDiceType diceType = resolveDiceType(request == null ? null : request.getDiceType());
        if (diceType == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "INVALID_DICE_TYPE"));
        }

        try {
            YachtMatchResponse response = yachtMatchService.matchBot(userId, diceType);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (YachtMatchService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "ERROR"));
        } catch (Exception e) {
            log.error("YachtController.matchBot: 처리 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "MATCH_UNAVAILABLE"));
        }
    }

    /**
     * GET /api/yacht/rankings — D6 / D8 분리 응답, 인증 불필요.
     */
    @GetMapping("/rankings")
    public ResponseEntity<YachtRankingResponse> getRankings() {
        return ResponseEntity.ok(yachtRankingService.getTopRankings());
    }

    /** GET /api/yacht/rooms/status — 모드별 방 현황, 인증 불필요. */
    @GetMapping("/rooms/status")
    public ResponseEntity<Map<String, Object>> getRoomsStatus() {
        return ResponseEntity.ok(yachtMatchService.getRoomStats());
    }

    /**
     * GET /api/yacht/room/{roomId} — 방 스냅샷 조회 (diceType 포함).
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

        Map<String, Object> snapshot = yachtGameService.buildRoomSnapshot(roomId, userId);

        if (snapshot == null) {
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

    /**
     * GET /api/yacht/rooms/waiting?diceType=D6
     * WAITING 상태 대기방 목록 (인증 불필요).
     * diceType 미제공 또는 잘못된 값 → 400.
     */
    @GetMapping("/rooms/waiting")
    public ResponseEntity<?> getWaitingRooms(
            @RequestParam(required = false) String diceType) {

        YachtDiceType type = resolveDiceType(diceType);
        if (type == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "INVALID_DICE_TYPE"));
        }

        List<YachtWaitingRoomInfo> rooms = yachtMatchService.listWaitingRooms(type);
        return ResponseEntity.ok(rooms);
    }

    /**
     * POST /api/yacht/create — 신규 방 직접 생성 (인증 필수).
     * 요청 바디: { "diceType": "D6" | "D8" }
     * - 201: 방 생성 성공
     * - 400: INVALID_DICE_TYPE
     * - 401: 비인증
     * - 409: ALREADY_IN_ROOM
     */
    @PostMapping("/create")
    public ResponseEntity<?> createRoom(@AuthenticationPrincipal Long userId,
                                        @RequestBody(required = false) YachtMatchRequest request) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED"));
        }

        YachtDiceType diceType = resolveDiceType(request == null ? null : request.getDiceType());
        if (diceType == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "INVALID_DICE_TYPE"));
        }

        try {
            YachtMatchResponse response = yachtMatchService.createRoom(userId, diceType);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (YachtMatchService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "ERROR"));
        } catch (Exception e) {
            log.error("YachtController.createRoom: 처리 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "MATCH_UNAVAILABLE"));
        }
    }

    /**
     * POST /api/yacht/join/{roomId} — 특정 방 직접 입장 (인증 필수).
     * - 200: 입장 성공
     * - 401: 비인증
     * - 404: ROOM_NOT_FOUND
     * - 409: ROOM_FULL_OR_STARTED | ALREADY_IN_ROOM
     */
    @PostMapping("/join/{roomId}")
    public ResponseEntity<?> joinRoom(@AuthenticationPrincipal Long userId,
                                       @PathVariable String roomId) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED"));
        }

        try {
            YachtMatchResponse response = yachtMatchService.joinRoom(userId, roomId);
            return ResponseEntity.ok(response);
        } catch (YachtMatchService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (YachtMatchService.RoomNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ROOM_NOT_FOUND"));
        } catch (YachtMatchService.RoomFullOrStartedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ROOM_FULL_OR_STARTED"));
        }
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    /**
     * diceType 문자열을 enum으로 변환.
     * "D6" 또는 "D8" 외 모든 값(null 포함) → null 반환.
     */
    private YachtDiceType resolveDiceType(String raw) {
        if ("D6".equals(raw)) return YachtDiceType.D6;
        if ("D8".equals(raw)) return YachtDiceType.D8;
        return null;
    }
}
