package com.dobakggun.repository;

import com.dobakggun.entity.yacht.YachtRoom;
import com.dobakggun.entity.yacht.YachtScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface YachtScoreRepository extends JpaRepository<YachtScore, Long> {

    List<YachtScore> findByRoomAndUserId(YachtRoom room, Long userId);

    List<YachtScore> findByRoom(YachtRoom room);

    Optional<YachtScore> findByRoomAndUserIdAndScoreKey(YachtRoom room, Long userId, String scoreKey);

    @Query("SELECT COUNT(s) FROM YachtScore s WHERE s.room = :room AND s.userId = :userId")
    int countByRoomAndUserId(@Param("room") YachtRoom room, @Param("userId") Long userId);
}
