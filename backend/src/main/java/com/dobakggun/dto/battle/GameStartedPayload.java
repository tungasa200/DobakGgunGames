package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** GAME_STARTED payload */
@Getter
@Builder
public class GameStartedPayload {
    private String roomId;
    private List<PlayerInfo> players;
    private String startAt;
}
