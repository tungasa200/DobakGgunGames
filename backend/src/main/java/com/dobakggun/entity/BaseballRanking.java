package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

// 필드: level, name, attempts, time, ip_hash, created_at
@Entity
@Table(name = "baseball_ranking", indexes = {
        @Index(name = "idx_bb_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class BaseballRanking extends Ranking {

    @Column(nullable = false)
    private Integer attempts;

    @Column(nullable = false)
    private Double time;
}
