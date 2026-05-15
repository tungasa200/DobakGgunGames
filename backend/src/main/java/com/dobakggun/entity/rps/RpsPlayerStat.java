package com.dobakggun.entity.rps;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@Entity
@Table(name = "rps_player_stat")
public class RpsPlayerStat {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "total_games", nullable = false)
    private int totalGames;

    @Column(name = "total_wins", nullable = false)
    private int totalWins;
}
