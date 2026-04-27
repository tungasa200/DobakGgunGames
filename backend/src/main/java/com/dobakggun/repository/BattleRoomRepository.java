package com.dobakggun.repository;

import com.dobakggun.entity.battle.BattleRoom;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BattleRoomRepository extends JpaRepository<BattleRoom, Long> {

    Optional<BattleRoom> findByRoomId(String roomId);

    List<BattleRoom> findByStatusIn(List<String> statuses);

    Optional<BattleRoom> findFirstByStatus(String status, Sort sort);
}
