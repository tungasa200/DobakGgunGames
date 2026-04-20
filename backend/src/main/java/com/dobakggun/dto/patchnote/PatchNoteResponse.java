package com.dobakggun.dto.patchnote;

import com.dobakggun.entity.PatchNote;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PatchNoteResponse {

    private Long id;
    private String version;
    private String title;
    private String content;
    private String game;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PatchNoteResponse from(PatchNote p) {
        return PatchNoteResponse.builder()
                .id(p.getId())
                .version(p.getVersion())
                .title(p.getTitle())
                .content(p.getContent())
                .game(p.getGame().name())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }

    // 목록용 (content 제외)
    public static PatchNoteResponse fromSummary(PatchNote p) {
        return PatchNoteResponse.builder()
                .id(p.getId())
                .version(p.getVersion())
                .title(p.getTitle())
                .game(p.getGame().name())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
