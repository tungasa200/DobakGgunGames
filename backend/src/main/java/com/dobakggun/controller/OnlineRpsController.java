package com.dobakggun.controller;

import com.dobakggun.dto.rps.MatchResponseDto;
import com.dobakggun.service.RpsMatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Online RPS REST 컨트롤러.
 * 단일 엔드포인트: POST /api/rps/match
 * 비로그인 게스트도 허용 — guestToken 기반 식별.
 */
@Slf4j
@RestController
@RequestMapping("/api/rps")
@RequiredArgsConstructor
public class OnlineRpsController {

    private final RpsMatchService rpsMatchService;

    /**
     * POST /api/rps/match — 자동 매칭 요청.
     *
     * - 200: 기존 대기방에 합류.
     * - 201: 신규 방 자동 생성.
     * - 409: 이미 활성 방에 참가 중 (ALREADY_IN_ROOM).
     * - 429: Rate limit 초과 (MATCH_RATE_LIMIT).
     * - 503: Redis/DB 락 획득 실패 (MATCH_UNAVAILABLE).
     *
     * 비로그인 게스트: userId=null, body.guestToken 으로 식별.
     * 신규 게스트이면 응답에 guestToken 포함.
     */
    @PostMapping("/match")
    public ResponseEntity<?> match(
            @AuthenticationPrincipal Long userId,
            @RequestBody(required = false) Map<String, String> body) {

        String guestToken = (body != null) ? body.get("guestToken") : null;

        try {
            MatchResponseDto response = rpsMatchService.match(userId, guestToken);
            HttpStatus status = response.isCreated() ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status).body(response);

        } catch (RpsMatchService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        }
    }

    /** GET /api/rps/rooms/status — 공개 엔드포인트, 인증 불필요. */
    @GetMapping("/rooms/status")
    public ResponseEntity<Map<String, Long>> getRoomsStatus() {
        return ResponseEntity.ok(rpsMatchService.getRoomStats());
    }
}
