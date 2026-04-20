package com.dobakggun.repository;

import com.dobakggun.entity.MinesweeperRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface MinesweeperRankingRepository extends RankingRepository<MinesweeperRanking> {

    @Query("""
        SELECT r FROM MinesweeperRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.time ASC
        LIMIT 10
    """)
    List<MinesweeperRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM MinesweeperRanking r WHERE r.level = :level ORDER BY r.time ASC LIMIT 1")
    MinesweeperRanking findAlltimeBest(@Param("level") String level);

    @Query("""
        SELECT r FROM MinesweeperRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart AND r.createdAt < :weekEnd
        ORDER BY r.time ASC
        LIMIT 3
    """)
    List<MinesweeperRanking> findPreviousWeekTop3(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart,
            @Param("weekEnd") LocalDateTime weekEnd
    );
}
