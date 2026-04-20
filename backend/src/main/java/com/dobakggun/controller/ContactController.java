package com.dobakggun.controller;

import com.dobakggun.dto.contact.ContactRequest;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.service.EmailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/contact")
@RequiredArgsConstructor
public class ContactController {

    private final EmailService emailService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> send(
            @AuthenticationPrincipal Long userId,
            @RequestPart("data") String dataJson,
            @RequestPart(value = "files", required = false) List<MultipartFile> files
    ) throws IOException {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다"));
        }

        ContactRequest req = objectMapper.readValue(dataJson, ContactRequest.class);

        // 유효성 검사
        if (req.getCategory() == null || req.getCategory().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "문의 유형을 선택해 주세요"));
        }
        if (req.getSubject() == null || req.getSubject().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "제목을 입력해 주세요"));
        }
        if (req.getBody() == null || req.getBody().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "내용을 입력해 주세요"));
        }

        String userEmail = userRepository.findById(userId)
                .map(u -> u.getEmail())
                .orElse("알 수 없음");

        emailService.sendContactEmail(userEmail, req.getCategory(), req.getSubject(), req.getBody(), files);

        return ResponseEntity.ok(Map.of("message", "문의가 접수되었습니다"));
    }
}
