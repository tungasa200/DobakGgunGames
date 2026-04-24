package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MatchResponseDto {

    private String roomId;
    private String status;
    private int playerCount;
    private int maxPlayers;
    private boolean created;
}
