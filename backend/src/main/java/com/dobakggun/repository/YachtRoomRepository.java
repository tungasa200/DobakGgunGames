package com.dobakggun.repository;

import com.dobakggun.entity.yacht.YachtDiceType;
import com.dobakggun.entity.yacht.YachtRoom;
import com.dobakggun.entity.yacht.YachtRoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface YachtRoomRepository extends JpaRepository<YachtRoom, Long> {

    Optional<YachtRoom> findByRoomId(String roomId);

    /**
     * 매칭 대상: 지정 status + diceType 필터 + 정원 미달. 오래된 방 FIFO.
     * D6 방과 D8 방이 절대 섞이지 않도록 diceType 필터 필수.
     */
    @Query("SELECT r FROM YachtRoom r WHERE r.status = :status AND r.diceType = :diceType AND r.currentPlayers < r.maxPlayers ORDER BY r.createdAt ASC")
    List<YachtRoom> findAvailableRooms(@Param("status") YachtRoomStatus status,
                                       @Param("diceType") YachtDiceType diceType);

    /**
     * ALREADY_IN_ROOM 체크: 해당 유저가 참가 중인 활성 방.
     * 모드 무관으로 확인 (한 사용자는 모드 막론 한 번에 한 방만).
     */
    @Query("""
        SELECT r FROM YachtRoom r
        JOIN YachtParticipant p ON p.room = r
        WHERE p.userId = :userId AND r.status IN :statuses AND p.leftAt IS NULL
        """)
    List<YachtRoom> findActiveRoomsByUserId(@Param("userId") Long userId,
                                             @Param("statuses") List<YachtRoomStatus> statuses);

    /**
     * 서버 재시작 시 좀비 방 일괄 FINISHED.
     */
    @Modifying
    @Query("UPDATE YachtRoom r SET r.status = :finished, r.closedAt = :now WHERE r.status IN :statuses")
    int closeAllActiveRooms(@Param("finished") YachtRoomStatus finished,
                             @Param("now") LocalDateTime now,
                             @Param("statuses") List<YachtRoomStatus> statuses);

    /**
     * TTL 스윕: WAITING 상태 10분 이상 방치된 방.
     */
    @Query("SELECT r FROM YachtRoom r WHERE r.status = :status AND r.createdAt < :cutoff")
    List<YachtRoom> findStaleWaitingRooms(@Param("status") YachtRoomStatus status,
                                           @Param("cutoff") LocalDateTime cutoff);

    long countByStatus(YachtRoomStatus status);

    @Query("SELECT COALESCE(SUM(r.currentPlayers), 0) FROM YachtRoom r WHERE r.status IN :statuses")
    Long sumCurrentPlayersByStatusIn(@Param("statuses") List<YachtRoomStatus> statuses);

    /**
     * 모드별 방 현황: 지정 status + diceType 방 수.
     */
    long countByStatusAndDiceType(YachtRoomStatus status, YachtDiceType diceType);
}
