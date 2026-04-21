package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "admin_rsp_play",
    indexes = {
        @Index(name = "idx_admin_rsp_play_user_played", columnList = "admin_user_id, played_at DESC")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class AdminRspPlay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_user_id", nullable = false)
    private Long adminUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "user_choice", nullable = false, length = 10)
    private RspChoice userChoice;

    @Enumerated(EnumType.STRING)
    @Column(name = "computer_choice", nullable = false, length = 10)
    private RspChoice computerChoice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private RspResult result;

    @CreationTimestamp
    @Column(name = "played_at", nullable = false, updatable = false)
    private LocalDateTime playedAt;
}
