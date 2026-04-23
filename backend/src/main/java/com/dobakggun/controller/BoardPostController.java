package com.dobakggun.controller;

import com.dobakggun.dto.board.BoardPostDetailResponse;
import com.dobakggun.dto.board.CreatePostRequest;
import com.dobakggun.dto.board.UpdatePostRequest;
import com.dobakggun.entity.User;
import com.dobakggun.entity.board.BoardPost;
import com.dobakggun.service.BoardPostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/board/posts")
@RequiredArgsConstructor
public class BoardPostController {

    private final BoardPostService boardPostService;

    /** 글 목록 — FRIEND+ (SecurityConfig에서 보장) */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getPosts(
            @RequestParam(required = false) BoardPost.PostType postType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(boardPostService.getPosts(postType, page, size));
    }

    /** 글 상세 — FRIEND+ */
    @GetMapping("/{id}")
    public ResponseEntity<BoardPostDetailResponse> getPost(@PathVariable Long id) {
        return ResponseEntity.ok(boardPostService.getPostDetail(id));
    }

    /** 글 작성 — FRIEND+ */
    @PostMapping
    public ResponseEntity<BoardPostDetailResponse> createPost(
            @RequestBody @Valid CreatePostRequest req,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(boardPostService.createPost(req, userId));
    }

    /** 글 수정 — 본인만 (서비스 레이어에서 소유권 검증) */
    @PutMapping("/{id}")
    public ResponseEntity<BoardPostDetailResponse> updatePost(
            @PathVariable Long id,
            @RequestBody @Valid UpdatePostRequest req,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(boardPostService.updatePost(id, req, userId));
    }

    /** 글 삭제 — 본인 OR ADMIN */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deletePost(
            @PathVariable Long id,
            @AuthenticationPrincipal Long userId,
            Authentication authentication
    ) {
        User.Role role = extractRole(authentication);
        boardPostService.deletePost(id, userId, role);
        return ResponseEntity.ok(Map.of("message", "글이 삭제되었습니다"));
    }

    private User.Role extractRole(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .findFirst()
                .map(a -> {
                    String authority = a.getAuthority(); // e.g. "ROLE_ADMIN"
                    String roleName = authority.startsWith("ROLE_")
                            ? authority.substring(5) : authority;
                    return User.Role.valueOf(roleName);
                })
                .orElse(User.Role.USER);
    }
}
