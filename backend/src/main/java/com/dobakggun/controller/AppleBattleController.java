package com.dobakggun.controller;

import com.dobakggun.dto.WaitingRoomInfo;
import com.dobakggun.dto.apple.AppleBattleJoinRequest;
import com.dobakggun.dto.apple.AppleBattleJoinResponse;
import com.dobakggun.security.BlockfallBattleHandshakeInterceptor;
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
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 사과게임 배틀 REST 컨트롤러.
 *
 * POST /api/apple-battle/join          — 자동 매칭 진입
 * POST /api/apple-battle/create        — 신규 방 직접 생성
 * POST /api/apple-battle/join/{roomId} — 특정 방 직접 입장
 * POST /api/apple-battle/room/{roomId}/cancel — WAITING 방 취소
 * GET  /api/apple-battle/rooms/waiting — 대기방 목록
 */
@Slf4j
@RestController
@RequestMapping("/api/apple-battle")
@RequiredArgsConstructor
public class AppleBattleController {

    private static final String GUEST_PREFIX = "guest_";
    private static final Pattern GUEST_TOKEN_PATTERN = BlockfallBattleHandshakeInterceptor.GUEST_TOKEN_PATTERN;

    private final AppleBattleRoomService appleService;
    private final JwtUtil jwtUtil;

    // ─── /join ────────────────────────────────────────────────────────────────

    /**
     * POST /api/apple-battle/join
     *
     * <p>로그인 유저: Authorization 헤더의 JWT 에서 userId/nickname 추출.
     * <p>게스트: body 의 guestToken 검증(또는 신규 발급) + nickname 사용.
     *
     * <p>응답:
     * <ul>
     *   <li>200 OK — AppleBattleJoinResponse
     *   <li>401 — 잘못된 JWT 또는 guestToken 형식
     *   <li>409 — 이미 다른 방에 참가 중
     * </ul>
     */
    @PostMapping("/join")
    public ResponseEntity<?> join(
            @RequestBody(required = false) AppleBattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Long userId = null;
        String nickname = null;
        boolean isGuest;
        String guestToken = null;

        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.validateToken(token)) {
                userId = jwtUtil.getUserIdFromToken(token);
                nickname = jwtUtil.getNicknameFromToken(token);
                isGuest = false;
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED",
                                "message", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."));
            }
        } else {
            isGuest = true;
        }

        if (isGuest) {
            String requestToken = (req != null) ? req.getGuestToken() : null;
            if (StringUtils.hasText(requestToken)) {
                if (!GUEST_TOKEN_PATTERN.matcher(requestToken).matches()) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "UNAUTHORIZED_GUEST_TOKEN",
                                    "message", "guestToken 형식이 올바르지 않습니다. guest_{UUID v4} 형식이 필요합니다."));
                }
                guestToken = requestToken;
            } else {
                guestToken = GUEST_PREFIX + UUID.randomUUID();
            }
            String requestNickname = (req != null) ? req.getNickname() : null;
            if (StringUtils.hasText(requestNickname)) {
                nickname = requestNickname.length() > 12
                        ? requestNickname.substring(0, 12) : requestNickname;
            } else {
                String uuid = guestToken.substring(GUEST_PREFIX.length());
                String prefix = uuid.replace("-", "")
                        .substring(0, Math.min(4, uuid.replace("-", "").length()))
                        .toUpperCase();
                nickname = "손님-" + prefix;
            }
        }

        try {
            AppleBattleJoinResponse response = appleService.joinOrCreate(userId, guestToken, nickname);
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
     * POST /api/apple-battle/create — 신규 방 직접 생성 (게스트/로그인 모두 허용).
     */
    @PostMapping("/create")
    public ResponseEntity<?> create(
            @RequestBody(required = false) AppleBattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Long userId = null;
        String nickname = null;
        boolean isGuest;
        String guestToken = null;

        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.validateToken(token)) {
                userId = jwtUtil.getUserIdFromToken(token);
                nickname = jwtUtil.getNicknameFromToken(token);
                isGuest = false;
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED",
                                "message", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."));
            }
        } else {
            isGuest = true;
        }

        if (isGuest) {
            String requestToken = (req != null) ? req.getGuestToken() : null;
            if (StringUtils.hasText(requestToken)) {
                if (!GUEST_TOKEN_PATTERN.matcher(requestToken).matches()) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "UNAUTHORIZED_GUEST_TOKEN",
                                    "message", "guestToken 형식이 올바르지 않습니다."));
                }
                guestToken = requestToken;
            } else {
                guestToken = GUEST_PREFIX + UUID.randomUUID();
            }
            String requestNickname = (req != null) ? req.getNickname() : null;
            if (StringUtils.hasText(requestNickname)) {
                nickname = requestNickname.length() > 12 ? requestNickname.substring(0, 12) : requestNickname;
            } else {
                String uuid = guestToken.substring(GUEST_PREFIX.length());
                String prefix = uuid.replace("-", "").substring(0, Math.min(4, uuid.replace("-", "").length())).toUpperCase();
                nickname = "손님-" + prefix;
            }
        }

        try {
            AppleBattleJoinResponse response = appleService.createRoomOnly(userId, guestToken, nickname);
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

        Long userId = null;
        String nickname = null;
        boolean isGuest;
        String guestToken = null;

        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.validateToken(token)) {
                userId = jwtUtil.getUserIdFromToken(token);
                nickname = jwtUtil.getNicknameFromToken(token);
                isGuest = false;
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED",
                                "message", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."));
            }
        } else {
            isGuest = true;
        }

        if (isGuest) {
            String requestToken = (req != null) ? req.getGuestToken() : null;
            if (StringUtils.hasText(requestToken)) {
                if (!GUEST_TOKEN_PATTERN.matcher(requestToken).matches()) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "UNAUTHORIZED_GUEST_TOKEN",
                                    "message", "guestToken 형식이 올바르지 않습니다."));
                }
                guestToken = requestToken;
            } else {
                guestToken = GUEST_PREFIX + UUID.randomUUID();
            }
            String requestNickname = (req != null) ? req.getNickname() : null;
            if (StringUtils.hasText(requestNickname)) {
                nickname = requestNickname.length() > 12 ? requestNickname.substring(0, 12) : requestNickname;
            } else {
                String uuid = guestToken.substring(GUEST_PREFIX.length());
                String prefix = uuid.replace("-", "").substring(0, Math.min(4, uuid.replace("-", "").length())).toUpperCase();
                nickname = "손님-" + prefix;
            }
        }

        try {
            AppleBattleJoinResponse response = appleService.joinSpecificRoom(roomId, userId, guestToken, nickname);
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
            String guestToken = (req != null) ? req.getGuestToken() : null;
            if (!StringUtils.hasText(guestToken) || !GUEST_TOKEN_PATTERN.matcher(guestToken).matches()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "UNAUTHORIZED_GUEST_TOKEN", "message", "guestToken이 필요합니다."));
            }
            playerId = guestToken;
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
}
