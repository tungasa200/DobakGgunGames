package com.dobakggun.controller;

import com.dobakggun.service.AdminStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
public class AdminStatsController {

    private final AdminStatsService adminStatsService;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        return ResponseEntity.ok(adminStatsService.getSummary());
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<Map<String, Object>>> getSessionTrend(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(adminStatsService.getSessionTrend(days));
    }

    @GetMapping("/sessions/weekly")
    public ResponseEntity<List<Map<String, Object>>> getWeeklySessionTrend() {
        return ResponseEntity.ok(adminStatsService.getWeeklySessionTrend());
    }

    @GetMapping("/games")
    public ResponseEntity<List<Map<String, Object>>> getGameCounts() {
        return ResponseEntity.ok(adminStatsService.getGameCounts());
    }

    @GetMapping("/rankings")
    public ResponseEntity<List<Map<String, Object>>> getRankingCounts() {
        return ResponseEntity.ok(adminStatsService.getRankingCounts());
    }

    @GetMapping("/rankings/weekly")
    public ResponseEntity<List<Map<String, Object>>> getWeeklyRankingCounts() {
        return ResponseEntity.ok(adminStatsService.getWeeklyRankingCounts());
    }
}
