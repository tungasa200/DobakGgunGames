package com.dobakggun.entity.apple;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "apple_battle_room",
    indexes = {
        @Index(name = "idx_apple_battle_room_status_created", columnList = "status, created_at")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class AppleRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_id", unique = true, nullable = false, length = 8)
    private String roomId;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = "WAITING";

    @Column(name = "max_players", nullable = false)
    @Builder.Default
    private int maxPlayers = 2;

    @Column(name = "current_players", nullable = false)
    @Builder.Default
    private int currentPlayers = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;
}
