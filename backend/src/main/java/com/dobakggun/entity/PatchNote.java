package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "patch_notes", indexes = {
        @Index(name = "idx_pn_game_created", columnList = "game,created_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PatchNote {

    public enum Game {
        ALL, COMMON, MINESWEEPER, BASEBALL, BLOCKFALL, SOLITAIRE, APPLE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String version;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Game game;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
