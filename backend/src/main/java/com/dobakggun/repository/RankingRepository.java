package com.dobakggun.repository;

import com.dobakggun.entity.Ranking;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

@NoRepositoryBean
public interface RankingRepository<T extends Ranking> extends JpaRepository<T, Long> {
    long countByIpHashAndCreatedAtAfter(String ipHash, LocalDateTime after);

    @Query("SELECT CAST(r.createdAt AS localdate), COUNT(r) FROM #{#entityName} r " +
           "WHERE r.createdAt >= :weekStart AND r.createdAt < :weekEnd " +
           "GROUP BY CAST(r.createdAt AS localdate) ORDER BY CAST(r.createdAt AS localdate)")
    List<Object[]> countByDayInWeek(@Param("weekStart") LocalDateTime weekStart, @Param("weekEnd") LocalDateTime weekEnd);

    @Query("SELECT r FROM #{#entityName} r WHERE (:level IS NULL OR r.level = :level) " +
           "AND (:from IS NULL OR r.createdAt >= :from) " +
           "AND (:to IS NULL OR r.createdAt < :to)")
    Page<T> findFiltered(
            @Param("level") String level,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable
    );
}
