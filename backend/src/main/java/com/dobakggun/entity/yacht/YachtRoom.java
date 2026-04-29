package com.dobakggun.entity.yacht;

import com.dobakggun.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * yacht_room 테이블 JPA 엔티티.
 * 실시간 상태(dice, rollsLeft 등)는 YachtGameService 인메모리에서 관리.
 * 확정된 점수는 YachtScore에 저장.
 */
@Entity
@Table(
    name = "yacht_room",
    indexes = {
        @Index(name = "idx_yacht_room_status_created", columnList = "status, created_at"),
        @Index(name = "idx_yacht_room_room_id", columnList = "room_id")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class YachtRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 외부 노출용 8자리 roomId (영소문자+숫자) */
    @Column(name = "room_id", unique = true, nullable = false, length = 8)
    private String roomId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private YachtRoomStatus status = YachtRoomStatus.WAITING;

    /** 방장 userId (User FK) */
    @Column(name = "host_user_id", nullable = false)
    private Long hostUserId;

    @Column(name = "max_players", nullable = false)
    @Builder.Default
    private int maxPlayers = 4;

    /** 현재 참가자 수 (매칭 시 증가, 퇴장 시 감소) */
    @Column(name = "current_players", nullable = false)
    @Builder.Default
    private int currentPlayers = 0;

    /** 승자 userId CSV (공동 1위 대비). GAME_OVER 시 기록. */
    @Column(name = "winner_user_ids", length = 255)
    private String winnerUserIds;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;
}
