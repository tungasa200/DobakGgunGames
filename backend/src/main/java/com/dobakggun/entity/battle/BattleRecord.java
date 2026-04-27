package com.dobakggun.entity.battle;

import com.dobakggun.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "battle_record",
    indexes = {
        @Index(name = "idx_battle_record_wins", columnList = "win_count DESC, last_played_at DESC")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class BattleRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
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
