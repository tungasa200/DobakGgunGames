package com.dobakggun.entity.minesweeper;

import com.dobakggun.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "minesweeper_battle_record",
    indexes = {
        @Index(name = "idx_ms_battle_record_wins", columnList = "win_count DESC, last_played_at DESC")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_ms_battle_record_user", columnNames = "user_id")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class MinesweeperBattleRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "win_count", nullable = false)
    @Builder.Default
    private int winCount = 0;

    @Column(name = "lose_count", nullable = false)
    @Builder.Default
    private int loseCount = 0;

    @Column(name = "total_games", nullable = false)
    @Builder.Default
    private int totalGames = 0;

    @Column(name = "last_played_at", nullable = false)
    private LocalDateTime lastPlayedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
