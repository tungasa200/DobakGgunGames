package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtMatchResponse {

    private String roomId;
    private String status;
    private int playerCount;
    private int maxPlayers;
    private boolean created;
}
