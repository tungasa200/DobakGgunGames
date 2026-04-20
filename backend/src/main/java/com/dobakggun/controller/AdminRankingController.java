package com.dobakggun.controller;

import com.dobakggun.entity.Ranking;
import com.dobakggun.service.AdminRankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/rankings")
@RequiredArgsConstructor
public class AdminRankingController {

    private final AdminRankingService adminRankingService;

    @GetMapping("/{game}")
    public ResponseEntity<Map<String, Object>> getList(
            @PathVariable String game,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<? extends Ranking> result = adminRankingService.getList(game,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of(
                "content", result.getContent(),
                "hasNext", !result.isLast(),
                "totalCount", result.getTotalElements()
        ));
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
