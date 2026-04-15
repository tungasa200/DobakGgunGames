package com.dobakggun.controller;

import com.dobakggun.dto.AppleSessionStartResponse;
import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.service.AppleSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Phase 3 — 사과게임 전용 컨트롤러.
 * "/api/apple/session/start" 는 리터럴 경로이므로
 * SessionController 의 "/api/{game}/session/start" 보다 Spring MVC가 우선 매핑.
 */
@RestController
@RequiredArgsConstructor
public class AppleController {

    private final AppleSessionService appleSessionService;

    @PostMapping("/api/apple/session/start")
    public AppleSessionStartResponse startSession(
            @Valid @RequestBody SessionStartRequest req,
            HttpServletRequest httpReq) {
        return appleSessionService.createSession(req, httpReq);
    }
}
