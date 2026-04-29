package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtRoomClosedPayload {

    private String roomId;
    /** "EMPTY" 또는 "INSUFFICIENT_PLAYERS" */
    private String reason;
}
