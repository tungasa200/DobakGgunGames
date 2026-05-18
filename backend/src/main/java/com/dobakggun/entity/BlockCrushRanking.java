package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "block_crush_ranking", indexes = {
        @Index(name = "idx_bcr_level_score",   columnList = "level,score,created_at"),
        @Index(name = "idx_bcr_level_created", columnList = "level,created_at"),
        @Index(name = "idx_bcr_user",          columnList = "user_id")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class BlockCrushRanking extends Ranking {

    @Column(nullable = false)
    private Integer score;

    /** 제거한 줄 수 */
    @Column(name = "lines_cleared", nullable = false)
    private Integer linesCleared;
}
