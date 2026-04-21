package com.dobakggun.controller;

import com.dobakggun.entity.GameStatus;
import com.dobakggun.service.GameStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/games")
@RequiredArgsConstructor
public class GameStatusController {

    private final GameStatusService gameStatusService;

    @GetMapping("/status")
    public ResponseEntity<List<GameStatus>> status() {
        return ResponseEntity.ok(gameStatusService.listAll());
    }
}
