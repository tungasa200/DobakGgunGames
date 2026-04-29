package com.dobakggun.entity.yacht;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * yacht_participant 테이블 JPA 엔티티.
 * 방 참가자 목록 및 게임 결과를 저장.
 */
@Entity
@Table(
    name = "yacht_participant",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_yacht_participant_room_user",
        columnNames = {"room_id", "user_id"}
    ),
    indexes = {
        @Index(name = "idx_yacht_participant_user", columnList = "user_id"),
        @Index(name = "idx_yacht_participant_room", columnList = "room_id")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class YachtParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private YachtRoom room;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 입장 순서 (0-based). 턴 순서 결정 시 참조. */
    @Column(name = "join_order", nullable = false)
    @Builder.Default
    private int joinOrder = 0;

    /** GAME_STARTED 시점에 셔플된 턴 순서 인덱스 (0-based). 게임 시작 전 null. */
    @Column(name = "turn_order")
    private Integer turnOrder;

    @Column(nullable = false)
    @Builder.Default
    private boolean ready = false;

    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    /** GAME_OVER 시 최종 점수 (상단+보너스+하단 합산). */
    @Column(name = "final_grand_total")
    private Integer finalGrandTotal;

    /** GAME_OVER 시 1위 여부. */
    @Column(name = "is_winner")
    private Boolean isWinner;
}
