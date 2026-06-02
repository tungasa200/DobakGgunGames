package com.dobakggun.repository;

import com.dobakggun.entity.apple.AppleRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppleRoomRepository extends JpaRepository<AppleRoom, Long> {

    Optional<AppleRoom> findByRoomId(String roomId);

    List<AppleRoom> findByStatusIn(List<String> statuses);
}
