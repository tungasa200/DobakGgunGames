package com.dobakggun.controller;

import com.dobakggun.dto.MinesweeperRevealRequest;
import com.dobakggun.dto.MinesweeperRevealResponse;
import com.dobakggun.dto.MinesweeperSessionStartRequest;
import com.dobakggun.service.MinesweeperPlayService;
import com.dobakggun.service.MinesweeperSessionService;
import com.dobakggun.service.PlaySessionSupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Phase 3 — 지뢰찾기 전용 컨트롤러.
 * "/api/minesweeper/session/start" 는 리터럴 경로이므로
 * SessionController 의 "/api/{game}/session/start" 보다 Spring MVC가 우선 매핑.
 */
@RestController
@RequiredArgsConstructor
public class MinesweeperController {

    private final MinesweeperSessionService minesweeperSessionService;
    private final MinesweeperPlayService    minesweeperPlayService;

    /** protocol 2는 서버 판정, 없으면 구경로(MinesweeperSessionStartResponse) */
    @PostMapping("/api/minesweeper/session/start")
    public Object startSession(
            @Valid @RequestBody MinesweeperSessionStartRequest req,
            HttpServletRequest httpReq) {
        if (Integer.valueOf(PlaySessionSupport.PROTOCOL).equals(req.getProtocol())) {
            return minesweeperPlayService.createSession(req, httpReq);
        }
        return minesweeperSessionService.createSession(req, httpReq);
    }

    @PostMapping("/api/minesweeper/session/{sessionId}/reveal")
    public MinesweeperRevealResponse reveal(
            @PathVariable String sessionId,
            @RequestBody MinesweeperRevealRequest req,
            HttpServletRequest httpReq) {
        return minesweeperPlayService.reveal(sessionId, req, httpReq);
    }
}
