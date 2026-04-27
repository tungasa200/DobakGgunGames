package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/** PLAYER_FINISHED payload */
@Getter
@Builder
public class PlayerFinishedPayload {
    private String playerId;
    private int rank;
    private int score;
}
