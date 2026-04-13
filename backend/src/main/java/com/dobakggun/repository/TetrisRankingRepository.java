package com.dobakggun.repository;

import com.dobakggun.entity.TetrisRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface TetrisRankingRepository extends RankingRepository<TetrisRanking> {

    @Query("""
        SELECT r FROM TetrisRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.score DESC
        LIMIT 10
    """)
    List<TetrisRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM TetrisRanking r WHERE r.level = :level ORDER BY r.score DESC LIMIT 1")
    TetrisRanking findAlltimeBest(@Param("level") String level);
}
