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
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 지뢰찾기 배틀 REST 컨트롤러.
 *
 * POST /api/minesweeper-battle/join — 자동 매칭 진입
 */
@Slf4j
@RestController
@RequestMapping("/api/minesweeper-battle")
@RequiredArgsConstructor
public class MinesweeperBattleController {

    private static final String GUEST_PREFIX = "guest_";
    private static final Pattern GUEST_TOKEN_PATTERN = Pattern.compile(
            "^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    );

    private final MinesweeperBattleRoomService minesweeperService;
    private final JwtUtil jwtUtil;

    /**
     * POST /api/minesweeper-battle/join
     *
     * <p>로그인 유저: Authorization 헤더의 JWT 에서 userId/nickname 추출.
     * <p>게스트: body 의 guestToken 검증(또는 신규 발급) + nickname 사용.
     *
     * <p>응답:
     * <ul>
     *   <li>200 OK — MinesweeperBattleJoinResponse
     *   <li>401 — 잘못된 guestToken 형식
     *   <li>409 — 이미 다른 방에 참가 중
     * </ul>
     */
    @PostMapping("/join")
    public ResponseEntity<?> join(
            @RequestBody(required = false) MinesweeperBattleJoinRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Long userId = null;
        String nickname = null;
        boolean isGuest;
        String guestToken = null;

        // 1. JWT 검증 (로그인 유저)
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

        // 2. 게스트 처리
        if (isGuest) {
            String requestToken = (req != null) ? req.getGuestToken() : null;

            if (StringUtils.hasText(requestToken)) {
                // 형식 검증 — guest_ + UUID v4 완전 일치
                if (!GUEST_TOKEN_PATTERN.matcher(requestToken).matches()) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "UNAUTHORIZED_GUEST_TOKEN",
                                    "message", "guestToken 형식이 올바르지 않습니다. guest_{UUID v4} 형식이 필요합니다."));
                }
                guestToken = requestToken;
            } else {
                // 신규 게스트 토큰 발급
                guestToken = GUEST_PREFIX + UUID.randomUUID();
            }

            // 닉네임 결정: body 제공 닉네임 우선, 없으면 자동 생성
            String requestNickname = (req != null) ? req.getNickname() : null;
            if (StringUtils.hasText(requestNickname)) {
                // 최대 12자 제한 (User.nickname 컬럼 길이)
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
            MinesweeperBattleJoinResponse response =
                    minesweeperService.joinOrCreate(userId, guestToken, nickname);

            log.info("MinesweeperBattleController.join: playerId={} roomId={} status={}",
                    response.getPlayerId(), response.getRoomId(), response.getStatus());

            return ResponseEntity.ok(response);

        } catch (MinesweeperBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
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
    public ResponseEntity<List<WaitingRoomInfo>> getWaitingRooms() {
        return ResponseEntity.ok(minesweeperService.listWaitingRooms());
    }

    /**
     * POST /api/minesweeper-battle/create — 신규 방 직접 생성 (게스트/로그인 모두 허용).
     */
    @PostMapping("/create")
    public ResponseEntity<?> create(
            @RequestBody(required = false) MinesweeperBattleJoinRequest req,
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
            MinesweeperBattleJoinResponse response = minesweeperService.createRoomOnly(userId, guestToken, nickname);
            return ResponseEntity.ok(response);
        } catch (MinesweeperBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        } catch (Exception e) {
            log.error("MinesweeperBattleController.create: 방 생성 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "MATCH_UNAVAILABLE", "message", "일시적으로 처리할 수 없습니다."));
        }
    }

    /**
     * POST /api/minesweeper-battle/join/{roomId} — 특정 방 직접 입장 (게스트/로그인 모두 허용).
     */
    @PostMapping("/join/{roomId}")
    public ResponseEntity<?> joinSpecific(
            @PathVariable String roomId,
            @RequestBody(required = false) MinesweeperBattleJoinRequest req,
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
            MinesweeperBattleJoinResponse response = minesweeperService.joinSpecificRoom(roomId, userId, guestToken, nickname);
            return ResponseEntity.ok(response);
        } catch (MinesweeperBattleRoomService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
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
}
