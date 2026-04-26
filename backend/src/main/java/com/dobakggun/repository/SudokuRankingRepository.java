package com.dobakggun.repository;

import com.dobakggun.entity.SudokuRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface SudokuRankingRepository extends RankingRepository<SudokuRanking> {

    @Query("""
        SELECT r FROM SudokuRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.clearTime ASC
        LIMIT 100
    """)
    List<SudokuRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM SudokuRanking r WHERE r.level = :level ORDER BY r.clearTime ASC LIMIT 1")
    SudokuRanking findAlltimeBest(@Param("level") String level);

    @Query("""
        SELECT r FROM SudokuRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart AND r.createdAt < :weekEnd
        ORDER BY r.clearTime ASC
        LIMIT 3
    """)
    List<SudokuRanking> findPreviousWeekTop3(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart,
            @Param("weekEnd") LocalDateTime weekEnd
    );
}
