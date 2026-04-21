package com.dobakggun.controller;

import com.dobakggun.entity.GameStatus;
import com.dobakggun.service.GameStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/games")
@RequiredArgsConstructor
public class AdminGameController {

    private final GameStatusService gameStatusService;

    @GetMapping
    public ResponseEntity<List<GameStatus>> list() {
        return ResponseEntity.ok(gameStatusService.listAll());
    }

    @PatchMapping("/{key}/active")
    public ResponseEntity<GameStatus> setActive(
            @PathVariable String key,
            @RequestBody Map<String, Boolean> body
    ) {
        Boolean active = body.get("active");
        if (active == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(gameStatusService.setActive(key, active));
    }
}
