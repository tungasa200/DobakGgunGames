package com.dobakggun.controller;

import com.dobakggun.dto.board.BoardCommentResponse;
import com.dobakggun.dto.board.CreateCommentRequest;
import com.dobakggun.entity.User;
import com.dobakggun.service.BoardCommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/board/posts/{postId}/comments")
@RequiredArgsConstructor
public class BoardCommentController {

    private final BoardCommentService boardCommentService;

    /** 댓글 추가 로드 (cursor 기반) — FRIEND+ */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getComments(
            @PathVariable Long postId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(boardCommentService.getComments(postId, cursor, size));
    }

    /** 댓글 작성 — FRIEND+ */
    @PostMapping
    public ResponseEntity<BoardCommentResponse> createComment(
            @PathVariable Long postId,
            @RequestBody @Valid CreateCommentRequest req,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(boardCommentService.createComment(postId, req, userId));
    }

    /** 댓글 삭제 — 본인 OR ADMIN */
    @DeleteMapping("/{commentId}")
    public ResponseEntity<Map<String, String>> deleteComment(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            @AuthenticationPrincipal Long userId,
            Authentication authentication
    ) {
        User.Role role = extractRole(authentication);
        boardCommentService.deleteComment(postId, commentId, userId, role);
        return ResponseEntity.ok(Map.of("message", "댓글이 삭제되었습니다"));
    }

    private User.Role extractRole(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .findFirst()
                .map(a -> {
                    String authority = a.getAuthority();
                    String roleName = authority.startsWith("ROLE_")
                            ? authority.substring(5) : authority;
                    return User.Role.valueOf(roleName);
                })
                .orElse(User.Role.USER);
    }
}
