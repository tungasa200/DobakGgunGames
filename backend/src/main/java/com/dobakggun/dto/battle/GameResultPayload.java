package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** GAME_RESULT payload */
@Getter
@Builder
public class GameResultPayload {
    private String roomId;
    private List<ResultEntry> results;
    private List<BattleRankingResponse.RankingEntry> topRankings;

    @Getter
    @Builder
    public static class ResultEntry {
        private int rank;
        private String playerId;
        private String nickname;
        private int score;
        private boolean isGuest;
    }
}
