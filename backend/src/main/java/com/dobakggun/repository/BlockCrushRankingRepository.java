package com.dobakggun.repository;

import com.dobakggun.entity.BlockCrushRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BlockCrushRankingRepository extends RankingRepository<BlockCrushRanking> {

    @Query("""
        SELECT r FROM BlockCrushRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.score DESC, r.createdAt ASC
        LIMIT 100
    """)
    List<BlockCrushRanking> findWeekly(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart
    );

    @Query("""
        SELECT r FROM BlockCrushRanking r
        WHERE r.level = :level
        ORDER BY r.score DESC, r.createdAt ASC
        LIMIT 1
    """)
    BlockCrushRanking findAlltimeBest(@Param("level") String level);
}
