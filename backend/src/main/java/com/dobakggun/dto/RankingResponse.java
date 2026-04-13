package com.dobakggun.dto;

import com.dobakggun.entity.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class RankingResponse {
    private final Long id;
    private final String name;
    private final String level;
    private final Double time;
    private final Integer score;
    private final Integer attempts;
    private final Integer moves;
    private final Integer gameLevel;
    private final LocalDateTime createdAt;

    public RankingResponse(Ranking r) {
        this.id = r.getId();
        this.name = r.getName();
        this.level = r.getLevel();
        this.createdAt = r.getCreatedAt();

        if (r instanceof MinesweeperRanking ms) {
            this.time = ms.getTime();
            this.score = null;
            this.attempts = null;
            this.moves = null;
            this.gameLevel = null;
        } else if (r instanceof BaseballRanking bb) {
            this.attempts = bb.getAttempts();
            this.time = bb.getTime();
            this.score = null;
            this.moves = null;
            this.gameLevel = null;
        } else if (r instanceof SolitaireRanking sl) {
            this.time = sl.getTime();
            this.moves = sl.getMoves();
            this.score = null;
            this.attempts = null;
            this.gameLevel = null;
        } else if (r instanceof BlockfallRanking tt) {
            this.score = tt.getScore();
            this.gameLevel = tt.getGameLevel();
            this.time = null;
            this.attempts = null;
            this.moves = null;
        } else if (r instanceof AppleRanking ap) {
            this.score = ap.getScore();
            this.time = null;
            this.attempts = null;
            this.moves = null;
            this.gameLevel = null;
        } else {
            this.time = null;
            this.score = null;
            this.attempts = null;
            this.moves = null;
            this.gameLevel = null;
        }
    }
}
