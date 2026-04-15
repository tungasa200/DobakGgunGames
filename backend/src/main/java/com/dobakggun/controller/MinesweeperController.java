package com.dobakggun.controller;

import com.dobakggun.dto.MinesweeperSessionStartRequest;
import com.dobakggun.dto.MinesweeperSessionStartResponse;
import com.dobakggun.service.MinesweeperSessionService;
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

    @PostMapping("/api/minesweeper/session/start")
    public MinesweeperSessionStartResponse startSession(
            @Valid @RequestBody MinesweeperSessionStartRequest req,
            HttpServletRequest httpReq) {
        return minesweeperSessionService.createSession(req, httpReq);
    }
}
