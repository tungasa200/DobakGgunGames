package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

// 필드: level, name, score, game_level, ip_hash, created_at
@Entity
@Table(name = "blockfall_insane_ranking", indexes = {
        @Index(name = "idx_bfi_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class BlockfallInsaneRanking extends Ranking {

    @Column(nullable = false)
    private Integer score;

    @Column(nullable = false)
    private Integer gameLevel;
}
