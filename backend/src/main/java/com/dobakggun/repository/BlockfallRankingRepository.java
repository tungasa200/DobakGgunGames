package com.dobakggun.repository;

import com.dobakggun.entity.BlockfallRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BlockfallRankingRepository extends RankingRepository<BlockfallRanking> {

    @Query("""
        SELECT r FROM BlockfallRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.score DESC
        LIMIT 10
    """)
    List<BlockfallRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM BlockfallRanking r WHERE r.level = :level ORDER BY r.score DESC LIMIT 1")
    BlockfallRanking findAlltimeBest(@Param("level") String level);
}
