package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

// 필드: level, name, time, moves, ip_hash, created_at
@Entity
@Table(name = "solitaire_ranking", indexes = {
        @Index(name = "idx_sl_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class SolitaireRanking extends Ranking {

    @Column(nullable = false)
    private Double time;

    @Column(nullable = false)
    private Integer moves;
}
