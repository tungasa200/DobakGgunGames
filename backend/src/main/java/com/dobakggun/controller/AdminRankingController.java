package com.dobakggun.controller;

import com.dobakggun.entity.Ranking;
import com.dobakggun.service.AdminRankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/rankings")
@RequiredArgsConstructor
public class AdminRankingController {

    private final AdminRankingService adminRankingService;

    @GetMapping("/{game}")
    public ResponseEntity<Map<String, Object>> getList(
            @PathVariable String game,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : null;
        LocalDate toDate   = to   != null ? LocalDate.parse(to)   : null;
        Page<? extends Ranking> result = adminRankingService.getList(game, level, fromDate, toDate,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of(
                "content", result.getContent(),
                "hasNext", !result.isLast(),
                "totalCount", result.getTotalElements()
        ));
    }

    @GetMapping("/{game}/leaderboard")
    public ResponseEntity<Map<String, Object>> getLeaderboard(@PathVariable String game) {
        return ResponseEntity.ok(adminRankingService.getLeaderboard(game));
    }

    @DeleteMapping("/{game}/{id}")
    public ResponseEntity<Map<String, String>> deleteOne(
            @PathVariable String game,
            @PathVariable Long id
    ) {
        adminRankingService.deleteOne(game, id);
        return ResponseEntity.ok(Map.of("message", "랭킹이 삭제되었습니다"));
    }

    @DeleteMapping("/{game}")
    public ResponseEntity<Map<String, String>> deleteAll(@PathVariable String game) {
        adminRankingService.deleteAll(game);
        return ResponseEntity.ok(Map.of("message", game + " 랭킹 전체가 초기화되었습니다"));
    }
}
