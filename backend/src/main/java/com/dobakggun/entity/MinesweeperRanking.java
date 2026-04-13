package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

// 필드: level, name, time, ip_hash, created_at
@Entity
@Table(name = "minesweeper_ranking", indexes = {
        @Index(name = "idx_ms_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class MinesweeperRanking extends Ranking {

    @Column(nullable = false)
    private Double time;
}
