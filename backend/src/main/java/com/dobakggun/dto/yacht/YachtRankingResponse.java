package com.dobakggun.dto.yacht;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * GET /api/yacht/rankings 응답.
 * d8 모드 도입 이후 D6 / D8 두 그룹을 분리해서 반환.
 */
@Getter
@Builder
public class YachtRankingResponse {

    @JsonProperty("D6")
    private List<RankingEntry> d6;

    @JsonProperty("D8")
    private List<RankingEntry> d8;

    @Getter
    @Builder
    public static class RankingEntry {
        private int rank;
        private Long userId;
        private String nickname;
        private int winCount;
        private int totalScore;
        private int playedCount;
    }
}
