package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "brickbreaker_ranking", indexes = {
        @Index(name = "idx_bb_level_stage_score", columnList = "level,game_level,score,created_at"),
        @Index(name = "idx_bb_level_created",     columnList = "level,created_at"),
        @Index(name = "idx_bb_user",              columnList = "user_id")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class BrickBreakerRanking extends Ranking {

    @Column(nullable = false)
    private Integer score;

    /** 클리어한 스테이지 (1~10) */
    @Column(nullable = false)
    private Integer gameLevel;
}
