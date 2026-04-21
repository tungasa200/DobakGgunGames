package com.dobakggun.repository;

import com.dobakggun.entity.GameStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameStatusRepository extends JpaRepository<GameStatus, String> {
}
