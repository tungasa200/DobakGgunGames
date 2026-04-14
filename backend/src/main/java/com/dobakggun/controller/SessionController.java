package com.dobakggun.controller;

import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.dto.SessionStartResponse;
import com.dobakggun.service.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping("/api/{game}/session/start")
    public SessionStartResponse startSession(
            @PathVariable String game,
            @Valid @RequestBody SessionStartRequest req,
            HttpServletRequest httpReq) {
        return sessionService.createSession(game, req, httpReq);
    }
}
