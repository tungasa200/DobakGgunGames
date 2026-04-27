package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** ROOM_STATE payload */
@Getter
@Builder
public class RoomStatePayload {
    private String roomId;
    private String status;
    private List<PlayerInfo> players;
    private int queueCount;
}
