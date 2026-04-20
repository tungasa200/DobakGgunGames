package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "ip_bans", indexes = {
        @Index(name = "idx_ip_ban_ip", columnList = "ip", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpBan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 45)
    private String ip;

    @Column(length = 255)
    private String reason;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime bannedAt;

    // 차단한 어드민 userId
    private Long bannedBy;
}
