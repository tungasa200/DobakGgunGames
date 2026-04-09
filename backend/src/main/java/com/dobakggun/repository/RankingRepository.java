package com.dobakggun.repository;

import com.dobakggun.entity.Ranking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface RankingRepository extends JpaRepository<Ranking, Long> {

    // 주간 랭킹 TOP N (각 게임별 정렬 기준 다름 - 서비스에서 처리)
    @Query("""
        SELECT r FROM Ranking r
        WHERE r.game = :game AND r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.time ASC
        LIMIT 10
    """)
    List<Ranking> findWeeklyByTime(@Param("game") String game, @Param("level") String level,
                                   @Param("weekStart") LocalDateTime weekStart);

    @Query("""
        SELECT r FROM Ranking r
        WHERE r.game = :game AND r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.score DESC
        LIMIT 10
    """)
    List<Ranking> findWeeklyByScore(@Param("game") String game, @Param("level") String level,
                                    @Param("weekStart") LocalDateTime weekStart);

    @Query("""
        SELECT r FROM Ranking r
        WHERE r.game = :game AND r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.attempts ASC, r.time ASC
        LIMIT 10
    """)
    List<Ranking> findWeeklyByAttempts(@Param("game") String game, @Param("level") String level,
                                       @Param("weekStart") LocalDateTime weekStart);

    @Query("""
        SELECT r FROM Ranking r
        WHERE r.game = :game AND r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.time ASC, r.moves ASC
        LIMIT 10
    """)
    List<Ranking> findWeeklyByTimeAndMoves(@Param("game") String game, @Param("level") String level,
                                           @Param("weekStart") LocalDateTime weekStart);

    // 역대 최고 1개
    @Query("SELECT r FROM Ranking r WHERE r.game = :game AND r.level = :level ORDER BY r.time ASC LIMIT 1")
    Ranking findAlltimeBestByTime(@Param("game") String game, @Param("level") String level);

    @Query("SELECT r FROM Ranking r WHERE r.game = :game AND r.level = :level ORDER BY r.score DESC LIMIT 1")
    Ranking findAlltimeBestByScore(@Param("game") String game, @Param("level") String level);

    @Query("SELECT r FROM Ranking r WHERE r.game = :game AND r.level = :level ORDER BY r.attempts ASC, r.time ASC LIMIT 1")
    Ranking findAlltimeBestByAttempts(@Param("game") String game, @Param("level") String level);

    @Query("SELECT r FROM Ranking r WHERE r.game = :game AND r.level = :level ORDER BY r.time ASC, r.moves ASC LIMIT 1")
    Ranking findAlltimeBestByTimeAndMoves(@Param("game") String game, @Param("level") String level);

    // rate limit 확인용
    long countByIpHashAndGameAndCreatedAtAfter(String ipHash, String game, LocalDateTime after);
}
