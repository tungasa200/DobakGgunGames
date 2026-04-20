package com.dobakggun.controller;

import com.dobakggun.entity.IpBan;
import com.dobakggun.service.IpBanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/ip-bans")
@RequiredArgsConstructor
public class AdminIpBanController {

    private final IpBanService ipBanService;

    @GetMapping
    public ResponseEntity<List<IpBan>> getAll() {
        return ResponseEntity.ok(ipBanService.getAll());
    }

    @PostMapping
    public ResponseEntity<IpBan> ban(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Long adminId
    ) {
        return ResponseEntity.ok(ipBanService.ban(body.get("ip"), body.get("reason"), adminId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> unban(@PathVariable Long id) {
        ipBanService.unban(id);
        return ResponseEntity.ok(Map.of("message", "IP 차단이 해제되었습니다"));
    }
}
