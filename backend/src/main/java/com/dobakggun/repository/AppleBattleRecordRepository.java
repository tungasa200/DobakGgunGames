package com.dobakggun.repository;

import com.dobakggun.entity.apple.AppleBattleRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AppleBattleRecordRepository extends JpaRepository<AppleBattleRecord, Long> {

    @Query("SELECT r FROM AppleBattleRecord r WHERE r.user.id = :userId")
    Optional<AppleBattleRecord> findByUserId(@Param("userId") Long userId);

    @Query("SELECT r FROM AppleBattleRecord r JOIN FETCH r.user ORDER BY r.winCount DESC, r.lastPlayedAt DESC")
    List<AppleBattleRecord> findTopRankings(Pageable pageable);
}
