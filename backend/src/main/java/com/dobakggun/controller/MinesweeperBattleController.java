package com.dobakggun.controller;

import com.dobakggun.dto.WaitingRoomInfo;
import com.dobakggun.dto.minesweeper.MinesweeperBattleJoinRequest;
import com.dobakggun.dto.minesweeper.MinesweeperBattleJoinResponse;
import com.dobakggun.service.MinesweeperBattleRoomService;
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
 * 지뢰찾기 배틀 REST 컨트롤러.
 *
 * POST /api/minesweeper-battle/join — 자동 매칭 진입
 *
 * 로그인 필수 — 게스트 불가.
 */
@Slf4j
@RestController
@RequestMapping("/api/minesweeper-battle")
@RequiredArgsConstructor
public class MinesweeperBattleController {

    private final MinesweeperBattleRoomService minesweeperService;
    private final JwtUtil jwtUtil;

    /**
     * POST /api/minesweeper-battle/join
     *
     * <p>Authorization 헤더의 JWT 에서 userId/nickname 추출 — 로그인 필수(게스트 불가).
     *
     * <p>응답:
     * <ul>
     *   <li>200 OK — MinesweeperBattleJoinResponse
     *   <li>401 — 비로그인 또는 잘못된 JWT
     *   <li>409 — 이미 다른 방에 참가 중
     * </ul>
     */
    @PostMapping("/join")
    public ResponseEntity<?> join(
            @RequestBody(required = false) MinesweeperBattleJoinRequest req,
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

        String difficulty = (req != null && req.getDifficulty() != null)
                ? req.getDifficulty() : "BEGINNER";

        try {
            MinesweeperBattleJoinResponse response =
                    minesweeperService.joinOrCreate(userId, null, nickname, difficulty);

            log.info("MinesweeperBattleController.join: playerId={} roomId={} status={} difficulty={}",
                    response.getPlayerId(), response.getRoomId(), response.getStatus(), difficulty);

            return ResponseEntity.ok(response);

        } catch (MinesweeperBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId(), "playerId", e.getPlayerId()));
        } catch (Exception e) {
            log.error("MinesweeperBattleController.join: 매칭 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE",
                            "message", "일시적으로 매칭을 처리할 수 없습니다."));
        }
    }

    /**
     * GET /api/minesweeper-battle/rooms/waiting
     * WAITING 상태 대기방 목록 (인증 불필요).
     */
    @GetMapping("/rooms/waiting")
    public ResponseEntity<List<WaitingRoomInfo>> getWaitingRooms(
            @RequestParam(required = false) String difficulty) {
        return ResponseEntity.ok(minesweeperService.listWaitingRooms(difficulty));
    }

    /**
     * POST /api/minesweeper-battle/create — 신규 방 직접 생성 (로그인 필수).
     */
    @PostMapping("/create")
    public ResponseEntity<?> create(
            @RequestBody(required = false) MinesweeperBattleJoinRequest req,
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

        String createDifficulty = (req != null && req.getDifficulty() != null)
                ? req.getDifficulty() : "BEGINNER";

        try {
            MinesweeperBattleJoinResponse response = minesweeperService.createRoomOnly(userId, null, nickname, createDifficulty);
            return ResponseEntity.ok(response);
        } catch (MinesweeperBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId(), "playerId", e.getPlayerId()));
        } catch (Exception e) {
            log.error("MinesweeperBattleController.create: 방 생성 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 처리할 수 없습니다."));
        }
    }

    /**
     * POST /api/minesweeper-battle/join/{roomId} — 특정 방 직접 입장 (로그인 필수).
     */
    @PostMapping("/join/{roomId}")
    public ResponseEntity<?> joinSpecific(
            @PathVariable String roomId,
            @RequestBody(required = false) MinesweeperBattleJoinRequest req,
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
            MinesweeperBattleJoinResponse response = minesweeperService.joinSpecificRoom(roomId, userId, null, nickname);
            return ResponseEntity.ok(response);
        } catch (MinesweeperBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId(), "playerId", e.getPlayerId()));
        } catch (MinesweeperBattleRoomService.RoomNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ROOM_NOT_FOUND"));
        } catch (MinesweeperBattleRoomService.RoomFullOrStartedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ROOM_FULL_OR_STARTED"));
        } catch (Exception e) {
            log.error("MinesweeperBattleController.joinSpecific: 입장 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 처리할 수 없습니다."));
        }
    }

    /**
     * POST /api/minesweeper-battle/room/{roomId}/cancel
     *
     * <p>WebSocket 연결 전에 취소 버튼을 누른 경우를 위한 REST 폴백.
     * WAITING 상태의 방만 취소 가능.
     */
    @PostMapping("/room/{roomId}/cancel")
    public ResponseEntity<?> cancel(
            @PathVariable String roomId,
            @RequestBody(required = false) MinesweeperBattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String playerId;

        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (!jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED", "message", "로그인 정보가 만료되었습니다."));
            }
            playerId = String.valueOf(jwtUtil.getUserIdFromToken(token));
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "로그인이 필요합니다."));
        }

        boolean cancelled = minesweeperService.cancelWaiting(roomId, playerId);
        if (cancelled) {
            return ResponseEntity.ok(Map.of("result", "CANCELLED"));
        }
        // 이미 처리됐거나 방 없음 → 멱등성 보장
        return ResponseEntity.ok(Map.of("result", "NOT_WAITING"));
    }
}
