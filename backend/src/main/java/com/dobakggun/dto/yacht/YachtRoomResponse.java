package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtRoomResponse {

    private String roomId;
    private String status;
    private Long hostUserId;
    private int maxPlayers;
    private Long currentTurnUserId;
    private List<Long> turnOrder;
    private int roundIndex;
    private List<YachtParticipantDto> participants;
    private List<YachtScoreboardDto> scoreboard;
}
