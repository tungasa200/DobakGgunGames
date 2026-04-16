package com.dobakggun.controller;

import com.dobakggun.dto.user.NicknameUpdateRequest;
import com.dobakggun.dto.user.UserProfileResponse;
import com.dobakggun.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // 내 정보 조회
    @GetMapping
    public ResponseEntity<UserProfileResponse> getProfile(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(userService.getProfile(userId));
    }

    // 닉네임 변경
    @PatchMapping
    public ResponseEntity<UserProfileResponse> updateNickname(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody NicknameUpdateRequest req) {
        return ResponseEntity.ok(userService.updateNickname(userId, req));
    }

    // 프로필 사진 업로드
    @PostMapping(value = "/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserProfileResponse> uploadProfileImage(
            @AuthenticationPrincipal Long userId,
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(userService.uploadProfileImage(userId, file));
    }

    // 프로필 사진 삭제
    @DeleteMapping("/profile-image")
    public ResponseEntity<UserProfileResponse> deleteProfileImage(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(userService.deleteProfileImage(userId));
    }
}
