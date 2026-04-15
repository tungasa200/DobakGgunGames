package com.dobakggun.controller;

import com.dobakggun.dto.SolitaireMovesBatchRequest;
import com.dobakggun.dto.SolitaireMovesBatchResponse;
import com.dobakggun.service.SolitaireMoveService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class SolitaireController {

    private final SolitaireMoveService solitaireMoveService;

    @PostMapping("/api/solitaire/moves-batch")
    public SolitaireMovesBatchResponse movesBatch(@Valid @RequestBody SolitaireMovesBatchRequest req) {
        return solitaireMoveService.processBatch(req);
    }
}
