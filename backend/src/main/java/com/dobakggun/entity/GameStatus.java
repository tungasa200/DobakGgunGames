package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "game_status")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GameStatus {

    @Id
    @Column(name = "game_key", length = 50)
    private String gameKey;

    @Column(nullable = false)
    private boolean active = true;
}
