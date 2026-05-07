package com.dobakggun.repository;

import com.dobakggun.entity.yacht.YachtRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface YachtRecordRepository extends JpaRepository<YachtRecord, Long> {

    @Query("SELECT yr FROM YachtRecord yr WHERE yr.user.id = :userId")
    Optional<YachtRecord> findByUserId(@Param("userId") Long userId);

    @Query("SELECT yr FROM YachtRecord yr JOIN FETCH yr.user " +
           "ORDER BY yr.winCount DESC, yr.lastPlayedAt DESC")
    List<YachtRecord> findTopRankings(Pageable pageable);
}
