package com.dobakggun.entity.yacht;

import jakarta.persistence.*;
import lombok.*;

/**
 * yacht_win 테이블 JPA 엔티티 (CP1-2: 안A).
 * 게임 종료 시 1위 플레이어(공동 1위 포함) win_count++.
 */
@Entity
@Table(
    name = "yacht_win",
    indexes = {
        @Index(name = "idx_yacht_win_user", columnList = "user_id", unique = true)
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class YachtWin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "win_count", nullable = false)
    @Builder.Default
    private int winCount = 0;
}
