package com.dobakggun.controller;

import com.dobakggun.dto.rsp.RspPlayRequest;
import com.dobakggun.dto.rsp.RspPlayResponse;
import com.dobakggun.dto.rsp.RspStatsResponse;
import com.dobakggun.service.AdminRspService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 어드민 전용 가위바위보(RSP) 게임 API.
 *
 * /api/admin/** 는 SecurityConfig에서 hasRole("ADMIN")으로 이미 보호됨.
 * 추가 SecurityConfig 변경 없음.
 */
@RestController
@RequestMapping("/api/admin/rsp")
@RequiredArgsConstructor
public class AdminRspController {

    private final AdminRspService adminRspService;

    /**
     * POST /api/admin/rsp/plays
     * 어드민이 선택한 userChoice 전송 → 서버가 computerChoice 생성 + 판정 + 저장 + 결과 반환.
     * userId는 JWT principal에서만 추출 (클라이언트 전달 금지).
     */
    @PostMapping("/plays")
    public ResponseEntity<RspPlayResponse> play(
            @AuthenticationPrincipal Long adminId,
            @Valid @RequestBody RspPlayRequest request
    ) {
        RspPlayResponse response = adminRspService.play(adminId, request.getUserChoice());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/admin/rsp/stats
     * 어드민 본인 누적 통계 조회. 타 어드민 데이터는 조회 불가.
     */
    @GetMapping("/stats")
    public ResponseEntity<RspStatsResponse> getStats(
            @AuthenticationPrincipal Long adminId
    ) {
        RspStatsResponse response = adminRspService.getStats(adminId);
        return ResponseEntity.ok(response);
    }
}
