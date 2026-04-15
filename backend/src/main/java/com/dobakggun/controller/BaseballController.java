package com.dobakggun.controller;

import com.dobakggun.dto.GuessRequest;
import com.dobakggun.dto.GuessResponse;
import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.dto.SessionStartResponse;
import com.dobakggun.service.BaseballSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class BaseballController {

    private final BaseballSessionService baseballSessionService;

    /**
     * 숫자야구 세션 시작 — /api/{game}/session/start 패턴보다 우선 적용됨
     */
    @PostMapping("/api/baseball/session/start")
    public SessionStartResponse startSession(
            @Valid @RequestBody SessionStartRequest req,
            HttpServletRequest httpReq) {
        return baseballSessionService.createSession(req, httpReq);
    }

    /**
     * 숫자 추측 제출
     */
    @PostMapping("/api/baseball/guess")
    public GuessResponse guess(
            @Valid @RequestBody GuessRequest req,
            HttpServletRequest httpReq) {
        return baseballSessionService.processGuess(req, httpReq);
    }
}
