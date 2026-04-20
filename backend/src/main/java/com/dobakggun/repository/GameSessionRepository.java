package com.dobakggun.repository;

import com.dobakggun.entity.GameSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface GameSessionRepository extends JpaRepository<GameSession, String> {

    @Modifying
    @Query("UPDATE GameSession s SET s.state = 'EXPIRED' " +
           "WHERE s.state = 'ACTIVE' AND s.startedAt < :cutoff")
    int expireOldSessions(@Param("cutoff") Instant cutoff);

    @Modifying
    @Query("DELETE FROM GameSession s WHERE s.startedAt < :cutoff")
    int deleteOldSessions(@Param("cutoff") Instant cutoff);

    // 게임별 세션 수
    @Query("SELECT s.game, COUNT(s) FROM GameSession s GROUP BY s.game ORDER BY COUNT(s) DESC")
    List<Object[]> countByGame();

    // 일별 세션 수 (최근 N일)
    @Query("SELECT CAST(s.startedAt AS localdate), COUNT(s) FROM GameSession s " +
           "WHERE s.startedAt >= :since GROUP BY CAST(s.startedAt AS localdate) " +
           "ORDER BY CAST(s.startedAt AS localdate)")
    List<Object[]> countByDaySince(@Param("since") Instant since);
}
