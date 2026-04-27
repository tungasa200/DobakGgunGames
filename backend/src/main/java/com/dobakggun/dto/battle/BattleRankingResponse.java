package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class BattleRankingResponse {
    private List<RankingEntry> topRankings;

    @Getter
    @Builder
    public static class RankingEntry {
        private int rank;
        private long userId;
        private String nickname;
        private int winCount;
        private int totalGames;
        private LocalDateTime lastPlayedAt;
    }
}
