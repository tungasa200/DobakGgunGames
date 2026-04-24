package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class RpsRoomStateDto {

    private String roomId;
    private String name;
    private String status;
    private Long hostUserId;
    private int maxPlayers;
    private List<RpsParticipantDto> participants;
}
