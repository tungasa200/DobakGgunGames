package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@MappedSuperclass
@Getter @Setter @NoArgsConstructor @SuperBuilder
public abstract class Ranking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String level;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 64)
    private String ipHash;

    // 로그인 사용자 연동 (비로그인은 null)
    @Column(nullable = true)
    private Long userId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
