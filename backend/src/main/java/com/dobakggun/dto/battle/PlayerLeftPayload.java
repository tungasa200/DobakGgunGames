package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/** PLAYER_LEFT payload */
@Getter
@Builder
public class PlayerLeftPayload {
    private String playerId;
    private String nickname;
}
