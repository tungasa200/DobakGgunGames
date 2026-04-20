package com.dobakggun.controller;

import com.dobakggun.dto.patchnote.PatchNoteResponse;
import com.dobakggun.service.PatchNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/patch-notes")
@RequiredArgsConstructor
public class PatchNoteController {

    private final PatchNoteService patchNoteService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getList(
            @RequestParam(required = false) String game,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size
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
    public ResponseEntity<PatchNoteResponse> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(PatchNoteResponse.from(patchNoteService.getDetail(id)));
    }
}
