package com.dobakggun.repository;

import com.dobakggun.entity.yacht.YachtWin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface YachtWinRepository extends JpaRepository<YachtWin, Long> {

    Optional<YachtWin> findByUserId(Long userId);
}
