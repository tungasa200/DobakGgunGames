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
     */
    @PostMapping("/match")
    public ResponseEntity<?> match(@AuthenticationPrincipal Long userId) {
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED"));
        }

        try {
            MatchResponseDto response = rpsMatchService.match(userId);
            HttpStatus status = response.isCreated() ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status).body(response);

        } catch (RpsMatchService.AlreadyInRoomException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "ALREADY_IN_ROOM", "roomId", e.getRoomId()));
        }
    }
}
