package com.dobakggun.repository;

import com.dobakggun.entity.BlockfallInsaneRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BlockfallInsaneRankingRepository extends RankingRepository<BlockfallInsaneRanking> {

    @Query("""
        SELECT r FROM BlockfallInsaneRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.score DESC
        LIMIT 10
    """)
    List<BlockfallInsaneRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM BlockfallInsaneRanking r WHERE r.level = :level ORDER BY r.score DESC LIMIT 1")
    BlockfallInsaneRanking findAlltimeBest(@Param("level") String level);

    @Query("""
        SELECT r FROM BlockfallInsaneRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart AND r.createdAt < :weekEnd
        ORDER BY r.score DESC
        LIMIT 3
    """)
    List<BlockfallInsaneRanking> findPreviousWeekTop3(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart,
            @Param("weekEnd") LocalDateTime weekEnd
    );
}
