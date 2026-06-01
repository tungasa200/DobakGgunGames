package com.dobakggun.repository;

import com.dobakggun.entity.battle.BattleRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BattleRecordRepository extends JpaRepository<BattleRecord, Long> {

    @Query("SELECT br FROM BattleRecord br WHERE br.user.id = :userId")
    Optional<BattleRecord> findByUserId(@Param("userId") Long userId);

    @Query("SELECT br FROM BattleRecord br JOIN FETCH br.user " +
           "ORDER BY br.winCount DESC, br.lastPlayedAt DESC")
    List<BattleRecord> findTopRankings(Pageable pageable);
}
