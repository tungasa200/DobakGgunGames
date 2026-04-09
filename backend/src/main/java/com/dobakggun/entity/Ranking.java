package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "rankings", indexes = {
        @Index(name = "idx_game_level_created", columnList = "game,level,created_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Ranking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String game;  // minesweeper, baseball, tetris, solitaire, apple

    @Column(nullable = false, length = 20)
    private String level;

    @Column(nullable = false, length = 50)
    private String name;

    // minesweeper, solitaire
    private Double time;

    // tetris, apple
    private Integer score;

    // baseball
    private Integer attempts;

    // solitaire
    private Integer moves;

    // tetris
    private Integer gameLevel;

    @Column(nullable = false, length = 64)
    private String ipHash;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
