package com.dobakggun.repository;

import com.dobakggun.entity.battle.BattleRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BattleRecordRepository extends JpaRepository<BattleRecord, Long> {

    /** Blockfall Battle 전적 조회 (기존 코드 — 하위 호환 유지) */
    @Query("SELECT br FROM BattleRecord br WHERE br.user.id = :userId")
    Optional<BattleRecord> findByUserId(@Param("userId") Long userId);

    /**
     * game_key + userId 로 전적 조회.
     * 마이그레이션 후 game_key + user_id 복합 unique 키 기반.
     */
    @Query("SELECT br FROM BattleRecord br WHERE br.gameKey = :gameKey AND br.user.id = :userId")
    Optional<BattleRecord> findByGameKeyAndUserId(
            @Param("gameKey") String gameKey,
            @Param("userId") Long userId);

    /** 전체 Blockfall Battle 상위 랭킹 (기존 — 하위 호환) */
    @Query("SELECT br FROM BattleRecord br JOIN FETCH br.user " +
           "ORDER BY br.winCount DESC, br.lastPlayedAt DESC")
    List<BattleRecord> findTopRankings(Pageable pageable);

    /** game_key 별 상위 랭킹 */
    @Query("SELECT br FROM BattleRecord br JOIN FETCH br.user " +
           "WHERE br.gameKey = :gameKey " +
           "ORDER BY br.winCount DESC, br.lastPlayedAt DESC")
    List<BattleRecord> findTopRankingsByGameKey(
            @Param("gameKey") String gameKey,
            Pageable pageable);
}
