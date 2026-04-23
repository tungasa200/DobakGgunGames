package com.dobakggun.controller;

import com.dobakggun.service.BoardImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/board")
@RequiredArgsConstructor
public class BoardImageController {

    private final BoardImageService boardImageService;

    /** 에디터용 이미지 업로드 — FRIEND+ */
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadImage(
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal Long userId
    ) {
        String url = boardImageService.upload(file, userId);
        return ResponseEntity.ok(Map.of("url", url));
    }
}
