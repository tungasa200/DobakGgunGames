package com.dobakggun.repository;

import com.dobakggun.entity.yacht.YachtDiceType;
import com.dobakggun.entity.yacht.YachtRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface YachtRecordRepository extends JpaRepository<YachtRecord, Long> {

    /**
     * 유저 + diceType으로 레코드 조회.
     * d8 도입 이후 (user_id, dice_type) UNIQUE 제약 → 모드별 분리 레코드.
     */
    @Query("SELECT yr FROM YachtRecord yr WHERE yr.user.id = :userId AND yr.diceType = :diceType")
    Optional<YachtRecord> findByUserIdAndDiceType(@Param("userId") Long userId,
                                                   @Param("diceType") YachtDiceType diceType);

    /**
     * 모드별 랭킹 상위 N명.
     * 정렬 기준: 승수 DESC → lastPlayedAt DESC.
     */
    @Query("SELECT yr FROM YachtRecord yr JOIN FETCH yr.user " +
           "WHERE yr.diceType = :diceType " +
           "ORDER BY yr.winCount DESC, yr.lastPlayedAt DESC")
    List<YachtRecord> findTopRankingsByDiceType(@Param("diceType") YachtDiceType diceType,
                                                 Pageable pageable);
}
