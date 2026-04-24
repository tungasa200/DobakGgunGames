package com.dobakggun.entity.rps;

import com.dobakggun.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "rps_round_result",
    indexes = {
        @Index(name = "idx_rps_round_result_room_round", columnList = "room_id, round_num"),
        @Index(name = "idx_rps_round_result_player_played", columnList = "player_id, played_at")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class RpsRoundResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private RpsRoom room;

    @Column(name = "round_num", nullable = false)
    private int roundNum;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player_id", nullable = false)
    private User player;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RpsChoice choice;

    @Column(name = "auto_picked", nullable = false)
    @Builder.Default
    private boolean autoPicked = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private RpsResult result;

    @CreationTimestamp
    @Column(name = "played_at", nullable = false, updatable = false)
    private LocalDateTime playedAt;
}
