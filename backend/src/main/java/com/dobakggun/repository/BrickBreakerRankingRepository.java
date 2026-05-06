package com.dobakggun.repository;

import com.dobakggun.entity.BrickBreakerRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BrickBreakerRankingRepository extends RankingRepository<BrickBreakerRanking> {

    @Query("""
        SELECT r FROM BrickBreakerRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.gameLevel DESC, r.score DESC, r.createdAt ASC
        LIMIT 100
    """)
    List<BrickBreakerRanking> findWeeklyRankings(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart
    );

    @Query("""
        SELECT r FROM BrickBreakerRanking r
        WHERE r.level = :level
        ORDER BY r.gameLevel DESC, r.score DESC, r.createdAt ASC
        LIMIT 1
    """)
    BrickBreakerRanking findAlltimeBest(@Param("level") String level);

    long countByIpHashAndLevelAndCreatedAtAfter(String ipHash, String level, LocalDateTime after);
}
