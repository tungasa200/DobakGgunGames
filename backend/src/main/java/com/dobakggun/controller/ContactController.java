package com.dobakggun.controller;

import com.dobakggun.dto.contact.ContactRequest;
import com.dobakggun.dto.contact.ContactResponse;
import com.dobakggun.entity.Contact;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.service.ContactService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    // 문의 접수 (DB 저장)
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> submit(
            @AuthenticationPrincipal Long userId,
            @RequestPart("data") String dataJson,
            @RequestPart(value = "files", required = false) List<MultipartFile> files
    ) throws JsonProcessingException {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다"));
        }

        ContactRequest req = objectMapper.readValue(dataJson, ContactRequest.class);

        if (req.getCategory() == null || req.getCategory().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "문의 유형을 선택해 주세요"));
        }
        if (req.getSubject() == null || req.getSubject().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "제목을 입력해 주세요"));
        }
        if (req.getBody() == null || req.getBody().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "내용을 입력해 주세요"));
        }

        var user = userRepository.findById(userId).orElse(null);
        String userEmail = user != null ? user.getEmail() : "";
        String userNickname = user != null ? user.getNickname() : "";

        // 첨부파일 키 목록 (파일명만 저장, 실제 R2 업로드는 기존 로직과 별개)
        List<String> fileNames = new ArrayList<>();
        if (files != null) {
            for (MultipartFile file : files) {
                if (file != null && !file.isEmpty()) {
                    fileNames.add(file.getOriginalFilename());
                }
            }
        }
        String fileKeys = fileNames.isEmpty() ? null : objectMapper.writeValueAsString(fileNames);

        contactService.submit(userId, userEmail, userNickname, req.getCategory(), req.getSubject(), req.getBody(), fileKeys);

        return ResponseEntity.ok(Map.of("message", "문의가 접수되었습니다"));
    }

    // 내 문의 목록
    @GetMapping("/my")
    public ResponseEntity<Map<String, Object>> getMyContacts(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다"));
        }
        Page<Contact> result = contactService.getMyContacts(userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of(
                "content", result.getContent().stream().map(ContactResponse::from).toList(),
                "hasNext", !result.isLast(),
                "totalCount", result.getTotalElements()
        ));
    }

    // 내 문의 상세
    @GetMapping("/my/{id}")
    public ResponseEntity<ContactResponse> getMyContact(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long id
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(ContactResponse.from(contactService.getMyContact(userId, id)));
    }
}
