package com.dobakggun.repository;

import com.dobakggun.entity.BaseballRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BaseballRankingRepository extends RankingRepository<BaseballRanking> {

    @Query("""
        SELECT r FROM BaseballRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.attempts ASC, r.time ASC
        LIMIT 10
    """)
    List<BaseballRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM BaseballRanking r WHERE r.level = :level ORDER BY r.attempts ASC, r.time ASC LIMIT 1")
    BaseballRanking findAlltimeBest(@Param("level") String level);

    @Query("""
        SELECT r FROM BaseballRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart AND r.createdAt < :weekEnd
        ORDER BY r.attempts ASC, r.time ASC
        LIMIT 3
    """)
    List<BaseballRanking> findPreviousWeekTop3(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart,
            @Param("weekEnd") LocalDateTime weekEnd
    );
}
