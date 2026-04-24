package com.dobakggun.repository;

import com.dobakggun.entity.rps.RpsRoom;
import com.dobakggun.entity.rps.RpsRoundResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RpsRoundResultRepository extends JpaRepository<RpsRoundResult, Long> {

    /**
     * rps_room.id (PK) 기준 조회 — room.id 로 탐색.
     */
    List<RpsRoundResult> findByRoom_IdOrderByRoundNumAscPlayerIdAsc(Long roomPkId);

    /**
     * RpsRoom 엔티티 기준 조회.
     */
    List<RpsRoundResult> findByRoomOrderByRoundNumAscPlayerIdAsc(RpsRoom room);

    /**
     * 특정 플레이어의 최근 라운드 결과 조회.
     */
    List<RpsRoundResult> findByPlayer_IdOrderByPlayedAtDesc(Long playerId);
}
