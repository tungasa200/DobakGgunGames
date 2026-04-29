package com.dobakggun.repository;

import com.dobakggun.entity.yacht.YachtParticipant;
import com.dobakggun.entity.yacht.YachtRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface YachtParticipantRepository extends JpaRepository<YachtParticipant, Long> {

    List<YachtParticipant> findByRoomOrderByJoinOrderAsc(YachtRoom room);

    Optional<YachtParticipant> findByRoomAndUserId(YachtRoom room, Long userId);

    @Query("SELECT COUNT(p) FROM YachtParticipant p WHERE p.room = :room AND p.leftAt IS NULL")
    int countActiveParticipants(@Param("room") YachtRoom room);

    @Query("SELECT p FROM YachtParticipant p WHERE p.room = :room AND p.leftAt IS NULL ORDER BY p.joinOrder ASC")
    List<YachtParticipant> findActiveParticipants(@Param("room") YachtRoom room);
}
