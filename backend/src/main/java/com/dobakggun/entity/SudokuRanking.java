package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

// 필드: level, name, score, ip_hash, created_at
@Entity
@Table(name = "sudoku_ranking", indexes = {
        @Index(name = "idx_su_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class SudokuRanking extends Ranking {

    @Column(nullable = false)
    private Integer score;
}
