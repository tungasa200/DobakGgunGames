package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "game_session", indexes = {
    @Index(name = "idx_gs_state_started", columnList = "state, started_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GameSession {

    @Id
    @Column(name = "session_id", length = 36, nullable = false)
    private String sessionId;

    @Column(nullable = false, length = 20)
    private String game;

    @Column(nullable = false, length = 20)
    private String level;

    @Column(name = "ip_hash", nullable = false, length = 64)
    private String ipHash;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private SessionState state = SessionState.ACTIVE;

    @Column(name = "ip_mismatch", nullable = false)
    @Builder.Default
    private boolean ipMismatch = false;

    public enum SessionState {
        ACTIVE, SUBMITTED, EXPIRED
    }
}
