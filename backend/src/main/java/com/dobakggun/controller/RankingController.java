package com.dobakggun.controller;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.dto.RankingResponse;
import com.dobakggun.service.RankingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/{game}/rankings")
@RequiredArgsConstructor
public class RankingController {

    private final RankingService rankingService;

    @GetMapping
    public List<RankingResponse> getWeeklyRankings(
            @PathVariable String game,
            @RequestParam String level) {
        return rankingService.getWeeklyRankings(game, level);
    }

    @GetMapping("/alltime")
    public ResponseEntity<?> getAlltimeBest(
            @PathVariable String game,
            @RequestParam String level) {
        RankingResponse best = rankingService.getAlltimeBest(game, level);
        if (best == null) return ResponseEntity.ok(Map.of());
        return ResponseEntity.ok(best);
    }

    @PostMapping
    public RankingResponse submitRanking(
            @PathVariable String game,
            @Valid @RequestBody RankingRequest request,
            HttpServletRequest httpRequest) {
        return rankingService.submit(game, request, httpRequest);
    }
}
