package com.dobakggun.controller;

import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.dto.SolitaireMovesBatchRequest;
import com.dobakggun.dto.SolitaireMovesBatchResponse;
import com.dobakggun.dto.SolitaireSessionStartResponse;
import com.dobakggun.service.SolitaireMoveService;
import com.dobakggun.service.SolitaireSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 솔리테어 전용 컨트롤러.
 * "/api/solitaire/..." 는 리터럴 경로이므로 SessionController 의 {game} 경로보다 우선 매핑.
 */
@RestController
@RequiredArgsConstructor
public class SolitaireController {

    private final SolitaireMoveService    solitaireMoveService;
    private final SolitaireSessionService solitaireSessionService;

    /** Phase 3 — 덱 Seed 세션 발급 */
    @PostMapping("/api/solitaire/session/start")
    public SolitaireSessionStartResponse startSession(
            @Valid @RequestBody SessionStartRequest req,
            HttpServletRequest httpReq) {
        return solitaireSessionService.createSession(req, httpReq);
    }

    @PostMapping("/api/solitaire/moves-batch")
    public SolitaireMovesBatchResponse movesBatch(@Valid @RequestBody SolitaireMovesBatchRequest req) {
        return solitaireMoveService.processBatch(req);
    }
}
