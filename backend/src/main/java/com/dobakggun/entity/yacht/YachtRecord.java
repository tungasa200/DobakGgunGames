package com.dobakggun.entity.yacht;

import com.dobakggun.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "yacht_record",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_yacht_record_user_dice_type", columnNames = {"user_id", "dice_type"})
    },
    indexes = {
        @Index(name = "idx_yacht_record_wins", columnList = "win_count DESC, last_played_at DESC"),
        @Index(name = "idx_yacht_record_dice_type_user", columnList = "dice_type, user_id")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class YachtRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 주사위 타입별 레코드 분리. NOT NULL DEFAULT 'D6'. */
    @Enumerated(EnumType.STRING)
    @Column(name = "dice_type", nullable = false, length = 4)
    @Builder.Default
    private YachtDiceType diceType = YachtDiceType.D6;

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
