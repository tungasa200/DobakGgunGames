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
    /** 결과 화면(FINISHED)에서 큐 자동 승격까지 남은 초. 예약이 없으면 null. */
    private Integer nextRoundInSeconds;
}
