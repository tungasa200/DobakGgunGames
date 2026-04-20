package com.dobakggun.controller;

import com.dobakggun.dto.contact.ContactReplyRequest;
import com.dobakggun.dto.contact.ContactResponse;
import com.dobakggun.entity.Contact;
import com.dobakggun.service.ContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/contacts")
@RequiredArgsConstructor
public class AdminContactController {

    private final ContactService contactService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Contact.Status statusEnum = null;
        if (status != null && !status.isBlank()) {
            statusEnum = Contact.Status.valueOf(status.toUpperCase());
        }
        Page<Contact> result = contactService.getAll(statusEnum, category,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of(
                "content", result.getContent().stream().map(ContactResponse::from).toList(),
                "hasNext", !result.isLast(),
                "totalCount", result.getTotalElements()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContactResponse> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(ContactResponse.from(contactService.getAndMarkRead(id)));
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<ContactResponse> reply(
            @PathVariable Long id,
            @AuthenticationPrincipal Long adminId,
            @RequestBody @Valid ContactReplyRequest req
    ) {
        return ResponseEntity.ok(ContactResponse.from(contactService.reply(id, adminId, req.getContent())));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Map<String, String>> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        contactService.updateStatus(id, Contact.Status.valueOf(body.get("status").toUpperCase()));
        return ResponseEntity.ok(Map.of("message", "상태가 변경되었습니다"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        contactService.delete(id);
        return ResponseEntity.ok(Map.of("message", "문의가 삭제되었습니다"));
    }
}
