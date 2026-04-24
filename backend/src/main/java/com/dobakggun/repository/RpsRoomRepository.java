package com.dobakggun.repository;

import com.dobakggun.entity.rps.RoomStatus;
import com.dobakggun.entity.rps.RpsRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RpsRoomRepository extends JpaRepository<RpsRoom, Long> {

    Optional<RpsRoom> findByRoomId(String roomId);

    /**
     * WAITING 상태 + 정원 미달 방 중 가장 오래된 것 1건 (FIFO 매칭 — OQ-11 결정).
     */
    @Query("SELECT r FROM RpsRoom r WHERE r.status = :status AND r.currentPlayers < r.maxPlayers ORDER BY r.createdAt ASC")
    List<RpsRoom> findAvailableRooms(@Param("status") RoomStatus status);

    /**
     * 특정 유저가 현재 참여 중인 활성 방 확인 (ALREADY_IN_ROOM 체크).
     * 인메모리 RpsGameState.participants 목록에서 확인 후, 없으면 DB 조회 생략 가능.
     * 이 쿼리는 서버 재시작 후 좀비 row 정리 시에도 활용.
     */
    @Query("SELECT r FROM RpsRoom r WHERE r.createdBy.id = :userId AND r.status IN :statuses")
    List<RpsRoom> findActiveRoomsByCreatedBy(@Param("userId") Long userId,
                                              @Param("statuses") List<RoomStatus> statuses);

    /**
     * 서버 시작 시 WAITING/PLAYING 상태 방 일괄 FINISHED 처리 (6.5 좀비 row 대응).
     */
    @Modifying
    @Query("UPDATE RpsRoom r SET r.status = :finished, r.closedAt = :now WHERE r.status IN :statuses")
    int closeAllActiveRooms(@Param("finished") RoomStatus finished,
                             @Param("now") LocalDateTime now,
                             @Param("statuses") List<RoomStatus> statuses);

    /**
     * TTL 스윕: WAITING 상태로 10분 이상 방치된 방 조회.
     */
    @Query("SELECT r FROM RpsRoom r WHERE r.status = :status AND r.createdAt < :cutoff")
    List<RpsRoom> findStaleWaitingRooms(@Param("status") RoomStatus status,
                                         @Param("cutoff") LocalDateTime cutoff);
}
