package com.dobakggun.repository;

import com.dobakggun.entity.minesweeper.MinesweeperRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MinesweeperRoomRepository extends JpaRepository<MinesweeperRoom, Long> {

    Optional<MinesweeperRoom> findByRoomId(String roomId);

    List<MinesweeperRoom> findByStatusIn(List<String> statuses);
}
