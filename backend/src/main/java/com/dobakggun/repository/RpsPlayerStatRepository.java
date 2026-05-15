package com.dobakggun.repository;

import com.dobakggun.entity.rps.RpsPlayerStat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface RpsPlayerStatRepository extends JpaRepository<RpsPlayerStat, Long> {

    @Transactional
    @Modifying
    @Query(value = """
            INSERT INTO rps_player_stat (user_id, total_games, total_wins)
            VALUES (:userId, 1, :win)
            ON DUPLICATE KEY UPDATE
              total_games = total_games + 1,
              total_wins  = total_wins  + :win
            """, nativeQuery = true)
    void upsert(@Param("userId") Long userId, @Param("win") int win);
}
