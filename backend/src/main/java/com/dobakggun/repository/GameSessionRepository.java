package com.dobakggun.repository;

import com.dobakggun.entity.GameSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface GameSessionRepository extends JpaRepository<GameSession, String> {

    @Modifying
    @Query("UPDATE GameSession s SET s.state = 'EXPIRED' " +
           "WHERE s.state = 'ACTIVE' AND s.startedAt < :cutoff")
    int expireOldSessions(@Param("cutoff") Instant cutoff);

    @Modifying
    @Query("DELETE FROM GameSession s WHERE s.startedAt < :cutoff")
    int deleteOldSessions(@Param("cutoff") Instant cutoff);
}
