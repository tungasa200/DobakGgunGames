package com.dobakggun.controller;

import com.dobakggun.dto.WaitingRoomInfo;
import com.dobakggun.dto.battle.BattleJoinRequest;
import com.dobakggun.dto.battle.BattleJoinResponse;
import com.dobakggun.dto.battle.BattleRankingResponse;
import com.dobakggun.service.BattleRankingService;
import com.dobakggun.service.BattleRoomService;
import com.dobakggun.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 블록폴 배틀 REST 컨트롤러.
 *
 * POST /api/blockfall-battle/join     — 자동 매칭 / 큐 진입
 * GET  /api/blockfall-battle/rankings — 역대 승수 TOP 10
 *
 * 로그인 필수 — 게스트 불가.
 */
@Slf4j
@RestController
@RequestMapping("/api/blockfall-battle")
@RequiredArgsConstructor
public class BattleRoomController {

    private final BattleRoomService battleRoomService;
    private final BattleRankingService battleRankingService;
    private final JwtUtil jwtUtil;

    /**
     * POST /api/blockfall-battle/join
     * PRD §13.1
     */
    @PostMapping("/join")
    public ResponseEntity<?> join(
            @RequestBody(required = false) BattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        // 인증 정보 파싱 — 로그인 필수 (게스트 불가)
        Long userId;
        String nickname;

        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (!jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED",
                                "message", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."));
            }
            userId = jwtUtil.getUserIdFromToken(token);
            nickname = jwtUtil.getNicknameFromToken(token);
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "로그인이 필요합니다."));
        }

        try {
            BattleJoinResponse response = battleRoomService.joinBattle(userId, null, false, nickname);
            log.info("BattleRoomController.join: playerId={} roomId={} status={}",
                    response.getPlayerId(), response.getRoomId(), response.getStatus());
            return ResponseEntity.ok(response);

        } catch (BattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (Exception e) {
            log.error("BattleRoomController.join: 매칭 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 매칭을 처리할 수 없습니다."));
        }
    }

    /**
     * GET /api/blockfall-battle/rankings
     * PRD §13.2
     */
    @GetMapping("/rankings")
    public ResponseEntity<BattleRankingResponse> getRankings() {
        List<BattleRankingResponse.RankingEntry> top = battleRankingService.getTopRankings();
        return ResponseEntity.ok(BattleRankingResponse.builder()
                .topRankings(top)
                .build());
    }

    /** GET /api/blockfall-battle/rooms/status — 공개 엔드포인트, 인증 불필요. */
    @GetMapping("/rooms/status")
    public ResponseEntity<Map<String, Integer>> getRoomsStatus() {
        return ResponseEntity.ok(battleRoomService.getRoomStats());
    }

    /** GET /api/blockfall-battle/rooms/waiting — WAITING 방 목록 (인증 불필요). */
    @GetMapping("/rooms/waiting")
    public ResponseEntity<List<WaitingRoomInfo>> getWaitingRooms() {
        return ResponseEntity.ok(battleRoomService.listWaitingRooms());
    }

    /** POST /api/blockfall-battle/create — 신규 방 직접 생성 (로그인 필수). */
    @PostMapping("/create")
    public ResponseEntity<?> create(
            @RequestBody(required = false) BattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Long userId;
        String nickname;

        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (!jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED",
                                "message", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."));
            }
            userId = jwtUtil.getUserIdFromToken(token);
            nickname = jwtUtil.getNicknameFromToken(token);
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "로그인이 필요합니다."));
        }

        try {
            BattleJoinResponse response = battleRoomService.createRoomOnly(userId, null, false, nickname);
            return ResponseEntity.ok(response);
        } catch (BattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (Exception e) {
            log.error("BattleRoomController.create: 방 생성 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 처리할 수 없습니다."));
        }
    }

    /** POST /api/blockfall-battle/join/{roomId} — 특정 방 직접 입장 (로그인 필수). */
    @PostMapping("/join/{roomId}")
    public ResponseEntity<?> joinSpecific(
            @PathVariable String roomId,
            @RequestBody(required = false) BattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Long userId;
        String nickname;

        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (!jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED",
                                "message", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."));
            }
            userId = jwtUtil.getUserIdFromToken(token);
            nickname = jwtUtil.getNicknameFromToken(token);
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "로그인이 필요합니다."));
        }

        try {
            BattleJoinResponse response = battleRoomService.joinSpecificRoom(roomId, userId, null, false, nickname);
            return ResponseEntity.ok(response);
        } catch (BattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (BattleRoomService.RoomNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ROOM_NOT_FOUND"));
        } catch (BattleRoomService.RoomFullOrStartedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ROOM_FULL_OR_STARTED"));
        } catch (Exception e) {
            log.error("BattleRoomController.joinSpecific: 입장 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 처리할 수 없습니다."));
        }
    }
}
