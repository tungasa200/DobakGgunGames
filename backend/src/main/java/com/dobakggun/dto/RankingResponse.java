package com.dobakggun.dto;

import com.dobakggun.entity.Ranking;
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
        this.time = r.getTime();
        this.score = r.getScore();
        this.attempts = r.getAttempts();
        this.moves = r.getMoves();
        this.gameLevel = r.getGameLevel();
        this.createdAt = r.getCreatedAt();
    }
}
