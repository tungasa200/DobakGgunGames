package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

// 필드: level, name, clear_time, ip_hash, created_at
@Entity
@Table(name = "sudoku_ranking", indexes = {
        @Index(name = "idx_su_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class SudokuRanking extends Ranking {

    @Column(name = "clear_time", nullable = false)
    private Integer clearTime;
}
