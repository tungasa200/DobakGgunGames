package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtRoomStatePayload {

    private String roomId;
    private String status;
    private Long hostUserId;
    private int maxPlayers;
    private List<YachtParticipantDto> participants;
}
