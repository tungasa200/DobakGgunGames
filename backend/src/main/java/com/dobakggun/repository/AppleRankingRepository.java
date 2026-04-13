package com.dobakggun.repository;

import com.dobakggun.entity.AppleRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AppleRankingRepository extends RankingRepository<AppleRanking> {

    @Query("""
        SELECT r FROM AppleRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.score DESC
        LIMIT 10
    """)
    List<AppleRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM AppleRanking r WHERE r.level = :level ORDER BY r.score DESC LIMIT 1")
    AppleRanking findAlltimeBest(@Param("level") String level);
}
