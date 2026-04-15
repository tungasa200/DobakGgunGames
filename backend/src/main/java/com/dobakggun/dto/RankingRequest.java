package com.dobakggun.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter @Setter
public class RankingRequest {

    @NotBlank
    @Size(max = 20)
    private String level;

    @NotBlank
    @Size(max = 50)
    private String name;

    // 게임별로 해당하는 필드만 사용
    private Double time;
    private Integer score;
    private Integer attempts;
    private Integer moves;
    private Integer gameLevel;

    // Phase 2: 블록폴 — 제거된 줄 수 (서버 검증용)
    private Integer linesCleared;

    // Phase 2: 사과게임 — 드래그 이벤트 로그 (서버 검증용)
    private List<AppleEvent> events;

    private String sessionId;  // Phase 1: 세션 기반 검증

    private String token;      // 레거시 HMAC (정리 예정)
    private Long timestamp;    // 레거시 HMAC (정리 예정)

    @Getter @Setter
    public static class AppleEvent {
        private long t;                    // 게임 시작 이후 경과 ms
        private List<List<Integer>> cells; // 제거된 셀 좌표 [[r,c], ...]
    }
}
