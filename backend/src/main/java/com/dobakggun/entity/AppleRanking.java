package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

// 필드: level, name, score, ip_hash, created_at
@Entity
@Table(name = "apple_ranking", indexes = {
        @Index(name = "idx_ap_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class AppleRanking extends Ranking {

    @Column(nullable = false)
    private Integer score;
}
