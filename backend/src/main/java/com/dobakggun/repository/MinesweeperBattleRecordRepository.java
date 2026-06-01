package com.dobakggun.repository;

import com.dobakggun.entity.minesweeper.MinesweeperBattleRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MinesweeperBattleRecordRepository extends JpaRepository<MinesweeperBattleRecord, Long> {

    @Query("SELECT r FROM MinesweeperBattleRecord r WHERE r.user.id = :userId")
    Optional<MinesweeperBattleRecord> findByUserId(@Param("userId") Long userId);

    @Query("SELECT r FROM MinesweeperBattleRecord r JOIN FETCH r.user ORDER BY r.winCount DESC, r.lastPlayedAt DESC")
    List<MinesweeperBattleRecord> findTopRankings(Pageable pageable);
}
