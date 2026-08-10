package com.dobakggun.repository;

import com.dobakggun.entity.apple.AppleRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AppleRoomRepository extends JpaRepository<AppleRoom, Long> {

    Optional<AppleRoom> findByRoomId(String roomId);

    List<AppleRoom> findByStatusIn(List<String> statuses);

    /**
     * TTL 스윕: 지정 상태(WAITING 등)로 오래 방치된 방 조회.
     */
    @Query("SELECT r FROM AppleRoom r WHERE r.status = :status AND r.createdAt < :cutoff")
    List<AppleRoom> findStaleWaitingRooms(@Param("status") String status,
                                           @Param("cutoff") LocalDateTime cutoff);

    /**
     * 서버 시작 시 잔존 활성 상태(WAITING/MATCHED/PLAYING) 방 일괄 종료 처리 (좀비 row 대응).
     */
    @Modifying
    @Query("UPDATE AppleRoom r SET r.status = :finished, r.closedAt = :now WHERE r.status IN :statuses")
    int closeAllActiveRooms(@Param("finished") String finished,
                             @Param("now") LocalDateTime now,
                             @Param("statuses") List<String> statuses);
}
