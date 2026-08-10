package com.dobakggun.controller;

import com.dobakggun.dto.WaitingRoomInfo;
import com.dobakggun.dto.apple.AppleBattleJoinRequest;
import com.dobakggun.dto.apple.AppleBattleJoinResponse;
import com.dobakggun.service.AppleBattleRoomService;
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
 * 사과게임 배틀 REST 컨트롤러.
 *
 * POST /api/apple-battle/join          — 자동 매칭 진입
 * POST /api/apple-battle/create        — 신규 방 직접 생성
 * POST /api/apple-battle/join/{roomId} — 특정 방 직접 입장
 * POST /api/apple-battle/room/{roomId}/cancel — WAITING 방 취소
 * GET  /api/apple-battle/rooms/waiting — 대기방 목록
 *
 * 로그인 필수 — 게스트 불가.
 */
@Slf4j
@RestController
@RequestMapping("/api/apple-battle")
@RequiredArgsConstructor
public class AppleBattleController {

    private final AppleBattleRoomService appleService;
    private final JwtUtil jwtUtil;

    // ─── /join ────────────────────────────────────────────────────────────────

    /**
     * POST /api/apple-battle/join
     *
     * <p>Authorization 헤더의 JWT 에서 userId/nickname 추출 — 로그인 필수(게스트 불가).
     *
     * <p>응답:
     * <ul>
     *   <li>200 OK — AppleBattleJoinResponse
     *   <li>401 — 비로그인 또는 잘못된 JWT
     *   <li>409 — 이미 다른 방에 참가 중
     * </ul>
     */
    @PostMapping("/join")
    public ResponseEntity<?> join(
            @RequestBody(required = false) AppleBattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        AuthenticatedUser auth = resolveUserOrUnauthorized(authHeader);
        if (auth.errorResponse() != null) {
            return auth.errorResponse();
        }
        Long userId = auth.userId();
        String nickname = auth.nickname();

        try {
            AppleBattleJoinResponse response = appleService.joinOrCreate(userId, null, nickname);
            log.info("AppleBattleController.join: playerId={} roomId={} status={}",
                    response.getPlayerId(), response.getRoomId(), response.getStatus());
            return ResponseEntity.ok(response);

        } catch (AppleBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId(), "playerId", e.getPlayerId()));
        } catch (Exception e) {
            log.error("AppleBattleController.join: 매칭 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE",
                            "message", "일시적으로 매칭을 처리할 수 없습니다."));
        }
    }

    // ─── /create ──────────────────────────────────────────────────────────────

    /**
     * POST /api/apple-battle/create — 신규 방 직접 생성 (로그인 필수).
     */
    @PostMapping("/create")
    public ResponseEntity<?> create(
            @RequestBody(required = false) AppleBattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        AuthenticatedUser auth = resolveUserOrUnauthorized(authHeader);
        if (auth.errorResponse() != null) {
            return auth.errorResponse();
        }
        Long userId = auth.userId();
        String nickname = auth.nickname();

        try {
            AppleBattleJoinResponse response = appleService.createRoomOnly(userId, null, nickname);
            return ResponseEntity.ok(response);
        } catch (AppleBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId(), "playerId", e.getPlayerId()));
        } catch (Exception e) {
            log.error("AppleBattleController.create: 방 생성 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 처리할 수 없습니다."));
        }
    }

    // ─── /join/{roomId} ───────────────────────────────────────────────────────

    /**
     * POST /api/apple-battle/join/{roomId} — 특정 방 직접 입장.
     */
    @PostMapping("/join/{roomId}")
    public ResponseEntity<?> joinSpecific(
            @PathVariable String roomId,
            @RequestBody(required = false) AppleBattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        AuthenticatedUser auth = resolveUserOrUnauthorized(authHeader);
        if (auth.errorResponse() != null) {
            return auth.errorResponse();
        }
        Long userId = auth.userId();
        String nickname = auth.nickname();

        try {
            AppleBattleJoinResponse response = appleService.joinSpecificRoom(roomId, userId, null, nickname);
            return ResponseEntity.ok(response);
        } catch (AppleBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId(), "playerId", e.getPlayerId()));
        } catch (AppleBattleRoomService.RoomNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ROOM_NOT_FOUND"));
        } catch (AppleBattleRoomService.RoomFullOrStartedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ROOM_FULL_OR_STARTED"));
        } catch (Exception e) {
            log.error("AppleBattleController.joinSpecific: 입장 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 처리할 수 없습니다."));
        }
    }

    // ─── /room/{roomId}/cancel ────────────────────────────────────────────────

    /**
     * POST /api/apple-battle/room/{roomId}/cancel
     *
     * <p>WebSocket 연결 전에 취소 버튼을 누른 경우를 위한 REST 폴백.
     * WAITING 상태의 방만 취소 가능.
     */
    @PostMapping("/room/{roomId}/cancel")
    public ResponseEntity<?> cancel(
            @PathVariable String roomId,
            @RequestBody(required = false) AppleBattleJoinRequest req,
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

        boolean cancelled = appleService.cancelWaiting(roomId, playerId);
        if (cancelled) {
            return ResponseEntity.ok(Map.of("result", "CANCELLED"));
        }
        return ResponseEntity.ok(Map.of("result", "NOT_WAITING"));
    }

    // ─── /rooms/waiting ───────────────────────────────────────────────────────

    /**
     * GET /api/apple-battle/rooms/waiting — WAITING 상태 대기방 목록 (인증 불필요).
     */
    @GetMapping("/rooms/waiting")
    public ResponseEntity<List<WaitingRoomInfo>> getWaitingRooms() {
        return ResponseEntity.ok(appleService.listWaitingRooms());
    }

    // ─── JWT 인증 공통 헬퍼 ───────────────────────────────────────────────────

    /**
     * Authorization 헤더에서 JWT 를 검증하고 userId/nickname 을 추출한다.
     * join/create/joinSpecific 3곳에서 동일하게 사용 — 로그인 필수(게스트 불가).
     *
     * @return 인증 성공 시 userId/nickname 이 채워지고 errorResponse 는 null.
     *         인증 실패 시 errorResponse 에 401 응답이 채워짐(userId/nickname 은 무시).
     */
    private AuthenticatedUser resolveUserOrUnauthorized(String authHeader) {
        if (!StringUtils.hasText(authHeader) || !authHeader.startsWith("Bearer ")) {
            return AuthenticatedUser.unauthorized(
                    ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "UNAUTHORIZED", "message", "로그인이 필요합니다.")));
        }

        String token = authHeader.substring(7);
        if (!jwtUtil.validateToken(token)) {
            return AuthenticatedUser.unauthorized(
                    ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "UNAUTHORIZED",
                                    "message", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.")));
        }

        Long userId = jwtUtil.getUserIdFromToken(token);
        String nickname = jwtUtil.getNicknameFromToken(token);
        return AuthenticatedUser.of(userId, nickname);
    }

    /** resolveUserOrUnauthorized 결과 — errorResponse 가 null 이 아니면 즉시 반환해야 함. */
    private record AuthenticatedUser(Long userId, String nickname, ResponseEntity<?> errorResponse) {
        static AuthenticatedUser of(Long userId, String nickname) {
            return new AuthenticatedUser(userId, nickname, null);
        }
        static AuthenticatedUser unauthorized(ResponseEntity<?> errorResponse) {
            return new AuthenticatedUser(null, null, errorResponse);
        }
    }
}
