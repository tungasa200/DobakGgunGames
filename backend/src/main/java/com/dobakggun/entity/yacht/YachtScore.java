package com.dobakggun.entity.yacht;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * yacht_score 테이블 JPA 엔티티.
 * 플레이어가 족보를 선택할 때마다 INSERT (0점 포함).
 */
@Entity
@Table(
    name = "yacht_score",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_yacht_score_room_user_key",
        columnNames = {"room_id", "user_id", "score_key"}
    ),
    indexes = {
        @Index(name = "idx_yacht_score_room_user", columnList = "room_id, user_id")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class YachtScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private YachtRoom room;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 족보 키. ONES/TWOS/.../YACHT 중 하나. */
    @Column(name = "score_key", nullable = false, length = 20)
    private String scoreKey;

    /** 실제 점수 (0~50). 조건 미달 시 0. */
    @Column(name = "score_value", nullable = false)
    private int scoreValue;

    @CreationTimestamp
    @Column(name = "recorded_at", nullable = false, updatable = false)
    private LocalDateTime recordedAt;
}
