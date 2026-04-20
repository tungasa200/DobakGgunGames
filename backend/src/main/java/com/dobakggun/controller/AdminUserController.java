package com.dobakggun.controller;

import com.dobakggun.dto.admin.AdminUserResponse;
import com.dobakggun.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<?> result = adminUserService.getUsers(search, role, status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(AdminUserResponse::from);
        return ResponseEntity.ok(Map.of(
                "content", result.getContent(),
                "hasNext", !result.isLast(),
                "totalCount", result.getTotalElements()
        ));
    }

    @PatchMapping("/{id}/role")
    public ResponseEntity<AdminUserResponse> updateRole(
            @PathVariable Long id,
            @AuthenticationPrincipal Long adminId,
            @RequestBody Map<String, String> body
    ) {
        return ResponseEntity.ok(AdminUserResponse.from(adminUserService.updateRole(id, adminId, body.get("role"))));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AdminUserResponse> updateStatus(
            @PathVariable Long id,
            @AuthenticationPrincipal Long adminId,
            @RequestBody Map<String, String> body
    ) {
        return ResponseEntity.ok(AdminUserResponse.from(adminUserService.updateStatus(id, adminId, body.get("status"))));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteUser(
            @PathVariable Long id,
            @AuthenticationPrincipal Long adminId
    ) {
        adminUserService.deleteUser(id, adminId);
        return ResponseEntity.ok(Map.of("message", "유저가 삭제되었습니다"));
    }
}
