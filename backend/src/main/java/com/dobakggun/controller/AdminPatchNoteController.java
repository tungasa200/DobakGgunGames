package com.dobakggun.controller;

import com.dobakggun.dto.patchnote.PatchNoteRequest;
import com.dobakggun.dto.patchnote.PatchNoteResponse;
import com.dobakggun.service.PatchNoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/patch-notes")
@RequiredArgsConstructor
public class AdminPatchNoteController {

    private final PatchNoteService patchNoteService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getList(
            @RequestParam(required = false) String game,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<PatchNoteResponse> result = patchNoteService.getList(game,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(PatchNoteResponse::fromSummary);
        return ResponseEntity.ok(Map.of(
                "content", result.getContent(),
                "hasNext", !result.isLast(),
                "totalCount", result.getTotalElements()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PatchNoteResponse> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(PatchNoteResponse.from(patchNoteService.getDetail(id)));
    }

    @PostMapping
    public ResponseEntity<PatchNoteResponse> create(@RequestBody @Valid PatchNoteRequest req) {
        return ResponseEntity.ok(PatchNoteResponse.from(patchNoteService.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PatchNoteResponse> update(
            @PathVariable Long id,
            @RequestBody @Valid PatchNoteRequest req
    ) {
        return ResponseEntity.ok(PatchNoteResponse.from(patchNoteService.update(id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        patchNoteService.delete(id);
        return ResponseEntity.ok(Map.of("message", "패치노트가 삭제되었습니다"));
    }
}
