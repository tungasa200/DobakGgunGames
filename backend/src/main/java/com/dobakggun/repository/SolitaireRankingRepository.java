package com.dobakggun.repository;

import com.dobakggun.entity.SolitaireRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface SolitaireRankingRepository extends RankingRepository<SolitaireRanking> {

    @Query("""
        SELECT r FROM SolitaireRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.time ASC, r.moves ASC
        LIMIT 10
    """)
    List<SolitaireRanking> findWeekly(@Param("level") String level, @Param("weekStart") LocalDateTime weekStart);

    @Query("SELECT r FROM SolitaireRanking r WHERE r.level = :level ORDER BY r.time ASC, r.moves ASC LIMIT 1")
    SolitaireRanking findAlltimeBest(@Param("level") String level);

    @Query("""
        SELECT r FROM SolitaireRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart AND r.createdAt < :weekEnd
        ORDER BY r.time ASC, r.moves ASC
        LIMIT 3
    """)
    List<SolitaireRanking> findPreviousWeekTop3(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart,
            @Param("weekEnd") LocalDateTime weekEnd
    );
}
