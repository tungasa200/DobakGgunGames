package com.dobakggun.controller;

import com.dobakggun.dto.yacht.YachtMatchRequest;
import com.dobakggun.dto.yacht.YachtMatchResponse;
import com.dobakggun.dto.yacht.YachtRankingResponse;
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
